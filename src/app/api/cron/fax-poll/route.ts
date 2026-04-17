/**
 * FAXメール自動登録 Cron（SaaS対応・全社ループ）
 *
 * Gmailを接続済みの全会社を対象に、
 * 複合機(FromBrotherDevice@brother.com)からの未読FAXメールを
 * 30分ごとに自動チェックしてOCR→納期データ登録します。
 *
 * 必要な環境変数:
 *   GMAIL_CLIENT_ID       - Google Cloud OAuth2 クライアントID
 *   GMAIL_CLIENT_SECRET   - Google Cloud OAuth2 クライアントシークレット
 *   CRON_SECRET           - Vercel Cron認証シークレット
 *   ANTHROPIC_API_KEY     - Claude AI OCR用
 */

import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

export const maxDuration = 300

// デフォルトの送信元（GmailTokenに設定がない場合のフォールバック）
const DEFAULT_FAX_SENDER = 'FromBrotherDevice@brother.com'

function buildOCRSystemPrompt(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const todayStr = jst.toISOString().split('T')[0]
  const year = jst.getUTCFullYear()
  const month = jst.getUTCMonth() + 1
  const nextMonth = month === 12 ? 1 : month + 1
  const nextMonthYear = month === 12 ? year + 1 : year

  return `あなたは発注書・納品書・FAXから納期情報を抽出する専門家です。

【基準日】今日の日付は ${todayStr}（${year}年${month}月）です。
「来月」= ${nextMonthYear}年${nextMonth}月、「今月」= ${year}年${month}月として計算してください。
年が明示されていない日付は、基準日以降で最も近い日付として解釈してください。

【ステップ1: 全体把握と推論（Chain of Thought）】
まずは画像内のすべてのテキスト（商品名、数量、日付、手書きメモなど）を丁寧に読み取り、以下の【納品日の判断基準】に従って各商品の納期を推論してください。FAX特有の不鮮明な文字や手書き文字も文脈から推測して読み取ってください。推論過程はテキストとして出力してください。

【納品日の判断基準（優先順位）】
1. 手書きメモ「〇/〇〇に納品します」「〇日納品」など → 最優先
2. 「納品指定日」「納品日」「納期」「回答納期」「出荷日」などのラベル横・下の日付
3. 「即納」「即日」→ 今日の日付（${todayStr}）
4. 上記が全てない場合 → 今日+14日

【使ってはいけない日付】
- FAXヘッダーの送信日時（例: 26-03-25;18:10）
- 発注書・注文書の作成日・発注日（ページ上部の「〇年〇月〇日」）
- 電話番号・FAX番号の数字

【ステップ2: JSON出力】
推論が終わったら、必ず以下のJSON形式を含めてください。JSONブロックのみをシステムがパースします。
\`\`\`json
{"items":[{"productName":"商品名","quantity":1,"deliveryDate":"YYYY-MM-DD","notes":"備考","supplierName":"取引先名"}]}
\`\`\`

- 商品名不明 → 「不明商品」、数量不明 → 1、取引先不明 → 空文字
- 複数商品は全てitemsに含める`
}

function parseJson(raw: string): { items: Array<{ productName: string; quantity: number; deliveryDate: string; notes?: string; supplierName?: string }> } {
  const codeBlockMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i)
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1])
  }
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('JSONが見つかりません')
  return JSON.parse(match[0])
}

async function processCompany(
  companyId: string,
  gmailToken: { email: string; accessToken: string; refreshToken: string; faxSenderEmail: string },
  anthropic: Anthropic,
): Promise<{ processed: number; skipped: number; errors: number }> {
  let processed = 0, skipped = 0, errors = 0

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
  )
  oauth2Client.setCredentials({
    access_token: gmailToken.accessToken,
    refresh_token: gmailToken.refreshToken,
  })

  // アクセストークンが更新されたらDBに保存
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await prisma.gmailToken.update({
        where: { companyId },
        data: {
          accessToken: tokens.access_token,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        },
      })
    }
  })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const faxSender = gmailToken.faxSenderEmail || DEFAULT_FAX_SENDER
  const searchRes = await gmail.users.messages.list({
    userId: gmailToken.email,
    q: `from:${faxSender} is:unread`,
    maxResults: 10,
  })

  const messages = searchRes.data.messages ?? []
  if (messages.length === 0) return { processed, skipped, errors }

  for (const msg of messages) {
    if (!msg.id) continue

    const alreadyProcessed = await prisma.faxLog.findUnique({ where: { messageId: msg.id } })
    if (alreadyProcessed) { skipped++; continue }

    try {
      const detail = await gmail.users.messages.get({
        userId: gmailToken.email,
        id: msg.id,
        format: 'full',
      })

      const parts = detail.data.payload?.parts ?? []
      const pngParts = parts.filter(p =>
        p.mimeType === 'image/png' || p.filename?.toLowerCase().endsWith('.png')
      )

      // PNG添付なし → スキップして既読化
      if (pngParts.length === 0) {
        await markProcessed(gmail, gmailToken.email, msg.id, companyId)
        skipped++
        continue
      }

      let registered = 0

      for (const part of pngParts) {
        const attachmentId = part.body?.attachmentId
        if (!attachmentId) continue

        const attachmentRes = await gmail.users.messages.attachments.get({
          userId: gmailToken.email,
          messageId: msg.id,
          id: attachmentId,
        })

        const base64Data = attachmentRes.data.data
        if (!base64Data) continue

        const base64 = base64Data.replace(/-/g, '+').replace(/_/g, '/')

        const ocrResponse = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          system: buildOCRSystemPrompt(),
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
              { type: 'text', text: 'このFAX画像から納期・配送情報を抽出してください。' },
            ],
          }],
        })

        const content = ocrResponse.content[0]
        if (content.type !== 'text') continue

        let extracted
        try { extracted = parseJson(content.text) } catch { continue }
        if (!extracted.items?.length) continue

        for (const item of extracted.items) {
          const deliveryDate = new Date(item.deliveryDate)
          const exists = await prisma.delivery.findFirst({
            where: { companyId, productName: item.productName, deliveryDate },
          })
          if (exists) continue

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

      await markProcessed(gmail, gmailToken.email, msg.id, companyId)
      console.log(`[FAX] 会社:${companyId} メッセージ:${msg.id} → ${registered}件登録`)
      processed++
    } catch (err) {
      console.error(`[FAX] 会社:${companyId} メッセージ:${msg.id} エラー:`, err)
      errors++
    }
  }

  return { processed, skipped, errors }
}

async function markProcessed(
  gmail: ReturnType<typeof google.gmail>,
  userId: string,
  messageId: string,
  companyId: string,
) {
  await Promise.all([
    gmail.users.messages.modify({
      userId,
      id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    }),
    prisma.faxLog.create({ data: { messageId, companyId } }),
  ])
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    return NextResponse.json({ error: 'Gmail credentials not configured' }, { status: 500 })
  }

  // Gmail接続済みの全会社を取得
  const tokens = await prisma.gmailToken.findMany({
    select: { companyId: true, email: true, accessToken: true, refreshToken: true, faxSenderEmail: true },
  })

  if (tokens.length === 0) {
    return NextResponse.json({ message: 'Gmail接続済みの会社がありません', companies: 0 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let totalProcessed = 0, totalSkipped = 0, totalErrors = 0
  const results: Array<{ companyId: string; email: string; processed: number; skipped: number; errors: number }> = []

  for (const token of tokens) {
    try {
      const result = await processCompany(token.companyId, token, anthropic)
      totalProcessed += result.processed
      totalSkipped += result.skipped
      totalErrors += result.errors
      results.push({ companyId: token.companyId, email: token.email, ...result })
    } catch (err) {
      console.error(`[FAX] 会社:${token.companyId} 致命的エラー:`, err)
      totalErrors++
      results.push({ companyId: token.companyId, email: token.email, processed: 0, skipped: 0, errors: 1 })
    }
  }

  return NextResponse.json({
    companies: tokens.length,
    totalProcessed,
    totalSkipped,
    totalErrors,
    results,
  })
}
