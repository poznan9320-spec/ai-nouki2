/**
 * FAXメール自動登録 Cron
 *
 * 複合機(FromBrotherDevice@brother.com)から届くFAX転送メールを
 * 30分ごとに自動チェックし、PNG添付ファイルをOCRして納期データとして登録します。
 *
 * 必要な環境変数:
 *   GMAIL_CLIENT_ID       - Google Cloud OAuth2 クライアントID
 *   GMAIL_CLIENT_SECRET   - Google Cloud OAuth2 クライアントシークレット
 *   GMAIL_REFRESH_TOKEN   - OAuth2 リフレッシュトークン
 *   GMAIL_USER_EMAIL      - チェックするGmailアドレス
 *   FAX_COMPANY_ID        - FAXを登録する会社ID (PrismaのCompany.id)
 *   CRON_SECRET           - Vercel Cron認証シークレット
 *   ANTHROPIC_API_KEY     - Claude AI OCR用
 */

import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

export const maxDuration = 300

const FAX_SENDER = 'FromBrotherDevice@brother.com'

function buildOCRSystemPrompt(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const todayStr = jst.toISOString().split('T')[0]
  const year = jst.getUTCFullYear()
  const month = jst.getUTCMonth() + 1
  const nextMonth = month === 12 ? 1 : month + 1
  const nextMonthYear = month === 12 ? year + 1 : year

  return `あなたは発注書・納品書・FAXから納期情報を抽出する専門家です。

【基準日】
今日の日付は ${todayStr}（${year}年${month}月）です。
「来月」= ${nextMonthYear}年${nextMonth}月、「今月」= ${year}年${month}月 として計算してください。
年が明示されていない日付は、基準日以降で最も近い日付として解釈してください。

【ステップ1: 全テキストを読み取る】
まず文書内の全ての文字・数字・手書きメモを読み取ってください。

【ステップ2: 納品日の判断（優先順位）】
1. 手書きメモ「〇/〇〇に納品します」「〇日納品」など → 最優先
2. 「納品指定日」「納品日」「納期」「回答納期」「出荷日」などのラベルの横・下の日付
3. 「即納」「即日」→ 今日の日付（${todayStr}）
4. 上記が全てない場合 → 今日+14日

【ステップ3: 納品日として使ってはいけない日付】
- FAXヘッダーの送信日時（例: 26-03-25;18:10）
- 発注書・注文書の作成日・発注日（ページ上部の「〇年〇月〇日」）
- 電話番号・FAX番号の数字

【ステップ4: JSON出力】
推論の後、必ず以下のJSON形式で終わること：
{"items":[{"productName":"商品名","quantity":1,"deliveryDate":"YYYY-MM-DD","notes":"備考","supplierName":"取引先名または不明"}]}

- 商品名不明 → 「不明商品」
- 数量不明 → 1
- 取引先名は文書から読み取れる場合のみ記入、不明なら空文字
- 複数商品は全てitemsに含める`
}

function parseJson(raw: string): { items: Array<{ productName: string; quantity: number; deliveryDate: string; notes?: string; supplierName?: string }> } {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('JSONが見つかりません')
  return JSON.parse(match[0])
}

export async function GET(req: NextRequest) {
  // Cron認証
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = process.env.FAX_COMPANY_ID
  if (!companyId) {
    return NextResponse.json({ error: 'FAX_COMPANY_ID not configured' }, { status: 500 })
  }

  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
    return NextResponse.json({ error: 'Gmail credentials not configured' }, { status: 500 })
  }

  // Gmail OAuth2
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
  )
  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let processed = 0
  let skipped = 0
  let errors = 0

  try {
    // 未読のFAXメールを検索
    const searchRes = await gmail.users.messages.list({
      userId: process.env.GMAIL_USER_EMAIL ?? 'me',
      q: `from:${FAX_SENDER} is:unread`,
      maxResults: 20,
    })

    const messages = searchRes.data.messages ?? []
    if (messages.length === 0) {
      return NextResponse.json({ processed: 0, skipped: 0, errors: 0, message: '新しいFAXメールはありません' })
    }

    for (const msg of messages) {
      if (!msg.id) continue

      // 処理済みチェック
      const alreadyProcessed = await prisma.faxLog.findUnique({ where: { messageId: msg.id } })
      if (alreadyProcessed) { skipped++; continue }

      try {
        // メール詳細取得
        const detail = await gmail.users.messages.get({
          userId: process.env.GMAIL_USER_EMAIL ?? 'me',
          id: msg.id,
          format: 'full',
        })

        // PNG添付ファイルを探す
        const parts = detail.data.payload?.parts ?? []
        const pngParts = parts.filter(p =>
          p.mimeType === 'image/png' || p.filename?.toLowerCase().endsWith('.png')
        )

        if (pngParts.length === 0) {
          // PNG添付なしはスキップして既読にする
          await gmail.users.messages.modify({
            userId: process.env.GMAIL_USER_EMAIL ?? 'me',
            id: msg.id,
            requestBody: { removeLabelIds: ['UNREAD'] },
          })
          await prisma.faxLog.create({ data: { messageId: msg.id, companyId } })
          skipped++
          continue
        }

        let registered = 0

        for (const part of pngParts) {
          const attachmentId = part.body?.attachmentId
          if (!attachmentId) continue

          // 添付ファイルダウンロード
          const attachmentRes = await gmail.users.messages.attachments.get({
            userId: process.env.GMAIL_USER_EMAIL ?? 'me',
            messageId: msg.id,
            id: attachmentId,
          })

          const base64Data = attachmentRes.data.data
          if (!base64Data) continue

          // Base64 URL-safe → 通常Base64
          const base64 = base64Data.replace(/-/g, '+').replace(/_/g, '/')

          // Claude OCR
          const ocrResponse = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: buildOCRSystemPrompt(),
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: 'image/png', data: base64 },
                },
                { type: 'text', text: 'このFAX画像から納期・配送情報を抽出してください。' },
              ],
            }],
          })

          const content = ocrResponse.content[0]
          if (content.type !== 'text') continue

          const extracted = parseJson(content.text)
          if (!extracted.items?.length) continue

          // 重複チェックして保存
          for (const item of extracted.items) {
            const deliveryDate = new Date(item.deliveryDate)
            const existing = await prisma.delivery.findFirst({
              where: {
                companyId,
                productName: item.productName,
                deliveryDate,
              },
            })
            if (existing) continue

            await prisma.delivery.create({
              data: {
                productName: item.productName,
                quantity: item.quantity,
                deliveryDate,
                status: 'PENDING',
                sourceType: 'FAX',
                notes: item.notes ?? null,
                supplierName: item.supplierName || null,
                companyId,
              },
            })
            registered++
          }
        }

        // 処理済みとして記録 + 既読にする
        await prisma.faxLog.create({ data: { messageId: msg.id, companyId } })
        await gmail.users.messages.modify({
          userId: process.env.GMAIL_USER_EMAIL ?? 'me',
          id: msg.id,
          requestBody: { removeLabelIds: ['UNREAD'] },
        })

        console.log(`[FAX] メッセージ ${msg.id}: ${registered}件登録`)
        processed++
      } catch (err) {
        console.error(`[FAX] メッセージ ${msg.id} 処理エラー:`, err)
        errors++
      }
    }

    return NextResponse.json({ processed, skipped, errors, total: messages.length })
  } catch (err) {
    console.error('[FAX] Gmail API エラー:', err)
    return NextResponse.json({ error: 'Gmail API エラー', details: String(err) }, { status: 500 })
  }
}
