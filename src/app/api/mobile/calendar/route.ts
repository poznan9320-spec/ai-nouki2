import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)
  const deliveries = await prisma.delivery.findMany({
    where: { companyId: user.companyId, deliveryDate: { gte: start, lte: end } }
  })
  const calendar: Record<string, { product_name: string; quantity: number; id: string }[]> = {}
  deliveries.forEach(d => {
    const key = d.deliveryDate.toISOString().split('T')[0]
    if (!calendar[key]) calendar[key] = []
    calendar[key].push({ product_name: d.productName, quantity: d.quantity, id: d.id })
  })
  return NextResponse.json(calendar)
}
