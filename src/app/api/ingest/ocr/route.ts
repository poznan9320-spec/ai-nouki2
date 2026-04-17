import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { put } from '@vercel/blob'
import { getTokenFromRequest } from '@/lib/auth'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildSystemPrompt(): string {
  const now = new Date()
  // JST (UTC+9)
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const todayStr = jst.toISOString().split('T')[0] // YYYY-MM-DD
  const year = jst.getUTCFullYear()
  const month = jst.getUTCMonth() + 1
  const nextMonth = month === 12 ? 1 : month + 1
  const nextMonthYear = month === 12 ? year + 1 : year

  return `あなたは発注書・納品書・FAXから納期情報を抽出する専門家です。

【基準日】
今日の日付は ${todayStr}（${year}年${month}月）です。
「来月」= ${nextMonthYear}年${nextMonth}月、「今月」= ${year}年${month}月 として計算してください。
年が明示されていない日付は、基準日以降で最も近い日付として解釈してください。

【ステップ1: 全体把握と推論（Chain of Thought）】
まず画像やテキスト内のすべての文字（商品名、数量、日付、手書きメモなど）を丁寧に読み取り、以下の【納品日の判断基準】に従って各商品の納期を推論してください。FAX特有の不鮮明な文字や手書き文字も文脈から推測して読み取ってください。推論過程はテキストとして出力してください。

【納品日の判断基準（優先順位）】
以下の順で納品日を特定してください：
1. 手書きメモ「〇/〇〇に納品します」「〇日納品」など → 最優先
2. 「納品指定日」「納品日」「納期」「回答納期」「出荷日」などのラベルの横・下の日付
3. 「即納」「即日」→ 今日の日付（${todayStr}）
4. 上記が全てない場合 → 今日+14日

【納品日として使ってはいけない日付】
- FAXヘッダーの送信日時（例: 26-03-25;18:10）
- 発注書・注文書の作成日・発注日（ページ上部の「〇年〇月〇日」）
- 電話番号・FAX番号の数字

【ステップ2: JSON出力】
推論が終わったら、必ず以下のJSON形式を含めてください。JSONブロックのみをシステムがパースします。
\`\`\`json
{"items":[{"productName":"商品名","quantity":1,"deliveryDate":"YYYY-MM-DD","notes":"備考"}]}
\`\`\`

- 商品名不明 → 「不明商品」
- 数量不明 → 1
- 複数商品は全てitemsに含める`
}

export async function POST(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'OCR機能が設定されていません' }, { status: 500 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const text = formData.get('text') as string | null

    if (!file && !text) {
      return NextResponse.json({ error: 'ファイルまたはテキストが必要です' }, { status: 400 })
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (file && file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'ファイルサイズは10MB以下にしてください' }, { status: 400 })
    }

    const supplierName = (formData.get('supplierName') as string | null)?.trim() || null

    type ExtractedItem = { productName: string; quantity: number; deliveryDate: string; notes?: string }
    type ExtractedData = { items: ExtractedItem[] }

    function parseJson(raw: string): ExtractedData {
      const codeBlockMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i)
      if (codeBlockMatch) {
        return JSON.parse(codeBlockMatch[1]) as ExtractedData
      }
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error(`JSONが見つかりません。モデルの返答: ${raw.slice(0, 200)}`)
      return JSON.parse(match[0]) as ExtractedData
    }

    let extractedData: ExtractedData
    const systemPrompt = buildSystemPrompt()

    if (file) {
      const bytes = await file.arrayBuffer()
      const base64 = Buffer.from(bytes).toString('base64')
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

      type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      type MessageContent =
        | { type: 'image'; source: { type: 'base64'; media_type: ImageMediaType; data: string } }
        | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
        | { type: 'text'; text: string }

      const fileContent: MessageContent = isPdf
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
        : { type: 'image', source: { type: 'base64', media_type: (file.type || 'image/jpeg') as ImageMediaType, data: base64 } }

      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            fileContent,
            { type: 'text', text: 'このファイルから納期・配送情報を抽出してください。' },
          ],
        }],
      })

      const content = response.content[0]
      if (content.type !== 'text') throw new Error('予期しないレスポンス形式')
      extractedData = parseJson(content.text)
    } else {
      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: text! }],
      })

      const content = response.content[0]
      if (content.type !== 'text') throw new Error('予期しないレスポンス形式')
      extractedData = parseJson(content.text)
    }

    if (!extractedData.items?.length) {
      return NextResponse.json({ error: '納期情報を抽出できませんでした' }, { status: 400 })
    }

    // ファイルがあればBlobにアップロード（失敗してもOCR結果は返す）
    let fileUrl: string | null = null
    if (file && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blob = await put(`deliveries/${Date.now()}_${file.name}`, file, { access: 'public' })
        fileUrl = blob.url
      } catch (blobErr) {
        console.warn('[OCR] Blob upload skipped:', blobErr instanceof Error ? blobErr.message : blobErr)
      }
    }

    return NextResponse.json({
      items: extractedData.items,
      sourceType: file ? 'IMAGE' : 'TEXT',
      supplierName,
      fileUrl,
    })
  } catch (error) {
    const name = error instanceof Error ? error.constructor.name : 'UnknownError'
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[OCR] ${name}: ${msg}`)
    if (name === 'AuthenticationError') {
      return NextResponse.json({ error: 'APIキーが無効です' }, { status: 500 })
    }
    if (name === 'RateLimitError') {
      return NextResponse.json({ error: 'API利用制限に達しました。しばらく待ってから再試行してください。' }, { status: 429 })
    }
    if (name === 'InvalidRequestError' || msg.includes('image')) {
      return NextResponse.json({ error: '画像の処理に失敗しました。別の画像で試してください。' }, { status: 400 })
    }
    return NextResponse.json({ error: `OCRエラー: ${msg}` }, { status: 500 })
  }
}
