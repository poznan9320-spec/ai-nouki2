import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { message } = await req.json()
  if (!message) return NextResponse.json({ error: 'メッセージが必要です' }, { status: 400 })

  // 直近180日以内 + 未処理・遅延を優先、最大150件に絞る
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const until = new Date()
  until.setDate(until.getDate() + 150)

  const deliveries = await prisma.delivery.findMany({
    where: {
      companyId: user.companyId,
      deliveryDate: { gte: since, lte: until },
    },
    orderBy: { deliveryDate: 'asc' },
    take: 150,
  })

  const total = await prisma.delivery.count({ where: { companyId: user.companyId } })

  const deliveryContext = deliveries.map(d =>
    `- ${d.productName}: ${d.quantity}個, 納期: ${d.deliveryDate.toLocaleDateString('ja-JP')}, ステータス: ${d.status}${d.notes ? ', 備考: ' + d.notes : ''}`
  ).join('\n')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `あなたは納期管理アシスタントです。以下の入荷予定データ（直近データ${deliveries.length}件／全${total}件）を参照して質問に答えてください。データに関係ない質問には「納期管理に関する質問をお願いします」と答えてください。\n\n入荷予定データ:\n${deliveryContext || 'データなし'}`,
    messages: [{ role: 'user', content: message }]
  })

  const content = response.content[0]
  const text = content.type === 'text' ? content.text : ''

  const mentioned = deliveries.filter(d =>
    text.includes(d.productName) || message.includes(d.productName)
  ).slice(0, 5)

  return NextResponse.json({
    response: text,
    deliveries: mentioned.map(d => ({
      product_name: d.productName,
      quantity: d.quantity,
      delivery_date: d.deliveryDate.toISOString().split('T')[0]
    }))
  })
}
