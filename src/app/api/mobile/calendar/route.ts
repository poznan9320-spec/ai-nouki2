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

  let deliveries: Awaited<ReturnType<typeof prisma.delivery.findMany>> = []
  let suppliers: Awaited<ReturnType<typeof prisma.supplier.findMany>> = []
  try {
    deliveries = await prisma.delivery.findMany({
      where: { companyId: user.companyId, deliveryDate: { gte: start, lte: end } },
      orderBy: { deliveryDate: 'asc' },
    })
  } catch (e) {
    console.error('[calendar] delivery query failed:', e)
    return NextResponse.json({ error: `delivery error: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
  try {
    suppliers = await prisma.supplier.findMany({
      where: { companyId: user.companyId },
    })
  } catch (e) {
    console.error('[calendar] supplier query failed:', e)
    return NextResponse.json({ error: `supplier error: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }

  // Build supplier color map by name
  const supplierColorMap: Record<string, string> = {}
  for (const s of suppliers) {
    if (s.color) supplierColorMap[s.name] = s.color
  }

  type CalendarItem = {
    id: string
    product_name: string
    quantity: number
    status: string
    supplier_name: string | null
    supplier_color: string | null
    notes: string | null
    source_type: string
  }

  const calendar: Record<string, CalendarItem[]> = {}
  for (const d of deliveries) {
    const key = d.deliveryDate.toISOString().split('T')[0]
    if (!calendar[key]) calendar[key] = []
    calendar[key].push({
      id: d.id,
      product_name: d.productName,
      quantity: d.quantity,
      status: d.status,
      supplier_name: d.supplierName ?? null,
      supplier_color: d.supplierName ? (supplierColorMap[d.supplierName] ?? null) : null,
      notes: d.notes ?? null,
      source_type: d.sourceType,
    })
  }

  return NextResponse.json({ calendar, suppliers })
}
