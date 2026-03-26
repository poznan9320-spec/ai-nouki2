import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `あなたは納期情報抽出の専門家です。
FAXや画像、テキストから配送・納期に関する情報を抽出してください。

【重要】必ず以下のJSON形式のみで返答してください。説明文や前置きは一切不要です。JSONのみ出力してください。

{"items":[{"productName":"商品名","quantity":1,"deliveryDate":"YYYY-MM-DD","notes":"備考"}]}

ルール:
- 商品名が不明な場合は「不明商品」を使用
- 日付が不明な場合は今日の日付+14日を使用
- 数量が不明な場合は1を使用
- 複数商品は全てitemsに含める
- 必ずJSONのみ返すこと。それ以外のテキストは含めないこと。`

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
      const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: 'この画像から納期・配送情報を抽出してください。' },
          ],
        }],
      })

      const content = response.content[0]
      if (content.type !== 'text') throw new Error('予期しないレスポンス形式')
      extractedData = parseJson(content.text)
    } else {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
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

    const deliveries = await prisma.delivery.createMany({
      data: extractedData.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        deliveryDate: new Date(item.deliveryDate),
        status: 'PENDING' as const,
        sourceType: file ? 'IMAGE' as const : 'TEXT' as const,
        notes: item.notes || null,
        supplierName,
        companyId: user.companyId,
      })),
    })

    return NextResponse.json({
      message: `${deliveries.count}件の配送データを登録しました`,
      imported: deliveries.count,
      items: extractedData.items,
    })
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `OCR処理中にエラーが発生しました: ${msg}` }, { status: 500 })
  }
}
