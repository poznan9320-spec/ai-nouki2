import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

interface SaveItem {
  productName: string
  quantity: number
  deliveryDate: string
  notes?: string
}

export async function POST(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { items, supplierName, sourceType } = await req.json() as {
    items: SaveItem[]
    supplierName?: string | null
    sourceType?: 'IMAGE' | 'TEXT'
  }

  if (!items?.length) {
    return NextResponse.json({ error: '登録するデータがありません' }, { status: 400 })
  }

  const result = await prisma.delivery.createMany({
    data: items.map(item => ({
      productName: item.productName,
      quantity: item.quantity,
      deliveryDate: new Date(item.deliveryDate),
      status: 'PENDING' as const,
      sourceType: (sourceType ?? 'TEXT') as 'IMAGE' | 'TEXT',
      notes: item.notes || null,
      supplierName: supplierName || null,
      companyId: user.companyId,
    })),
  })

  return NextResponse.json({ imported: result.count })
}
