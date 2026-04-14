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
  try {
    deliveries = await prisma.delivery.findMany({
      where: { companyId: user.companyId, deliveryDate: { gte: start, lte: end } },
      orderBy: { deliveryDate: 'asc' },
    })
  } catch (e) {
    console.error('[calendar] delivery query failed:', e)
    return NextResponse.json({ error: `delivery error: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }

  // Build supplier color map — use raw SQL to avoid failures when schema columns (e.g. color) are missing in DB
  const supplierColorMap: Record<string, string> = {}
  let suppliersForResponse: Array<{ id: string; name: string; color: string | null }> = []
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; name: string; color: string | null }>>`
      SELECT id, name, color FROM "Supplier" WHERE "companyId" = ${user.companyId}
    `
    for (const s of rows) {
      if (s.color) supplierColorMap[s.name] = s.color
    }
    suppliersForResponse = rows
  } catch (e) {
    // color column may not exist yet — skip colors gracefully so calendar still loads
    console.warn('[calendar] supplier color query failed, trying without color:', e instanceof Error ? e.message : String(e))
    try {
      const rows = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
        SELECT id, name FROM "Supplier" WHERE "companyId" = ${user.companyId}
      `
      suppliersForResponse = rows.map(r => ({ ...r, color: null }))
    } catch (e2) {
      console.warn('[calendar] supplier query failed entirely:', e2 instanceof Error ? e2.message : String(e2))
    }
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

  return NextResponse.json({ calendar, suppliers: suppliersForResponse })
}
