import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { put } from '@vercel/blob'
import { getTokenFromRequest } from '@/lib/auth'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `あなたは発注書・納品書・FAXから納期情報を抽出する専門家です。

【ステップ1: 全テキストを読み取る】
まず文書内の全ての文字・数字・手書きメモを読み取ってください。

【ステップ2: 納品日の判断（優先順位）】
以下の順で納品日を特定してください：
1. 手書きメモ「〇/〇〇に納品します」「〇日納品」など → 最優先
2. 「納品指定日」「納品日」「納期」「回答納期」「出荷日」などのラベルの横・下の日付
3. 「即納」「即日」→ 今日の日付
4. 上記が全てない場合 → 今日+14日

【ステップ2: 納品日として使ってはいけない日付】
- FAXヘッダーの送信日時（例: 26-03-25;18:10）
- 発注書・注文書の作成日・発注日（ページ上部の「〇年〇月〇日」）
- 電話番号・FAX番号の数字

【ステップ3: JSON出力】
推論の後、必ず以下のJSON形式で終わること：
{"items":[{"productName":"商品名","quantity":1,"deliveryDate":"YYYY-MM-DD","notes":"備考"}]}

- 商品名不明 → 「不明商品」
- 数量不明 → 1
- 複数商品は全てitemsに含める`

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

    const supplierName = (formData.get('supplierName') as string | null)?.trim() || null

    type ExtractedItem = { productName: string; quantity: number; deliveryDate: string; notes?: string }
    type ExtractedData = { items: ExtractedItem[] }

    function parseJson(raw: string): ExtractedData {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (!match) throw new Error(`JSONが見つかりません。モデルの返答: ${cleaned.slice(0, 200)}`)
      return JSON.parse(match[0]) as ExtractedData
    }

    let extractedData: ExtractedData

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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text! }],
      })

      const content = response.content[0]
      if (content.type !== 'text') throw new Error('予期しないレスポンス形式')
      extractedData = parseJson(content.text)
    }

    if (!extractedData.items?.length) {
      return NextResponse.json({ error: '納期情報を抽出できませんでした' }, { status: 400 })
    }

    // ファイルがあればBlobにアップロード
    let fileUrl: string | null = null
    if (file && process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`deliveries/${Date.now()}_${file.name}`, file, { access: 'public' })
      fileUrl = blob.url
    }

    return NextResponse.json({
      items: extractedData.items,
      sourceType: file ? 'IMAGE' : 'TEXT',
      supplierName,
      fileUrl,
    })
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `OCR処理中にエラーが発生しました: ${msg}` }, { status: 500 })
  }
}
