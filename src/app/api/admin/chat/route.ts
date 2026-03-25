import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 半角・全角・大小文字を統一して比較用に正規化
function norm(s: string): string {
  return s
    .normalize('NFKC')          // 全角英数→半角、半角ｶﾅ→全角カナ
    .toLowerCase()
    .replace(/[\s　・\-－_]/g, '') // スペース・区切り文字を除去
}

export async function POST(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { message } = await req.json()
  if (!message) return NextResponse.json({ error: 'メッセージが必要です' }, { status: 400 })

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 未来の納期データを全件取得（今日以降）、supplierNameは任意
    const futureDeliveries = await prisma.delivery.findMany({
      where: {
        companyId: user.companyId,
        deliveryDate: { gte: today },
      },
      select: {
        id: true,
        productName: true,
        quantity: true,
        deliveryDate: true,
        status: true,
        notes: true,
        supplierName: true,
      },
      orderBy: { deliveryDate: 'asc' },
    })

    // メッセージを正規化してキーワード抽出（2文字以上の単語）
    const msgNorm = norm(message)
    const keywords = msgNorm.match(/[^\s,、。！？「」【】()（）]+/g)
      ?.filter(w => w.length >= 2) ?? [msgNorm]

    // キーワードに一致する商品を絞り込み（半角・全角を同一視）
    const matched = futureDeliveries.filter(d => {
      const nameNorm = norm(d.productName)
      return keywords.some(kw => nameNorm.includes(kw) || kw.includes(nameNorm))
    })

    // 一致あり → そのデータのみ、なし → 直近50件をコンテキストに使用
    const contextData = matched.length > 0 ? matched : futureDeliveries.slice(0, 50)

    const lines = contextData.map(d =>
      `- ${d.productName}: ${d.quantity}個, 納期: ${d.deliveryDate.toLocaleDateString('ja-JP')}, ステータス: ${d.status}${d.supplierName ? ', 取引先: ' + d.supplierName : ''}${d.notes ? ', 備考: ' + d.notes : ''}`
    ).join('\n')

    const systemPrompt = matched.length > 0
      ? `あなたは納期管理アシスタントです。ユーザーが問い合わせた商品の未来の納期データを以下に示します。この情報を元に納期・数量を分かりやすく回答してください。\n\n該当データ（${matched.length}件）:\n${lines}`
      : `あなたは納期管理アシスタントです。直近の入荷予定データ（${contextData.length}件）を以下に示します。ユーザーの質問に答えてください。商品名で質問すると該当商品の納期をお答えできます。\n\n入荷予定データ:\n${lines || 'データなし'}`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    const cards = (matched.length > 0 ? matched : []).slice(0, 10).map(d => ({
      product_name: d.productName,
      quantity: d.quantity,
      delivery_date: d.deliveryDate.toISOString().split('T')[0],
    }))

    return NextResponse.json({ response: text, deliveries: cards })
  } catch (error) {
    console.error('Chat error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `チャットエラー: ${msg}` }, { status: 500 })
  }
}
