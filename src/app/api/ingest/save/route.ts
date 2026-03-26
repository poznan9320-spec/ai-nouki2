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

  // 既存データと照合して重複チェック（商品名 + 納期 + 会社ID）
  const dates = items.map(it => new Date(it.deliveryDate))
  const existing = await prisma.delivery.findMany({
    where: {
      companyId: user.companyId,
      deliveryDate: { in: dates },
    },
    select: { productName: true, deliveryDate: true },
  })

  // 正規化して比較（全角半角・大小文字を統一）
  function norm(s: string) {
    return s.normalize('NFKC').toLowerCase().replace(/\s/g, '')
  }
  const existingKeys = new Set(
    existing.map(e => `${norm(e.productName)}_${e.deliveryDate.toISOString().split('T')[0]}`)
  )

  const newItems = items.filter(it => {
    const key = `${norm(it.productName)}_${it.deliveryDate}`
    return !existingKeys.has(key)
  })

  const skipped = items.length - newItems.length

  if (newItems.length === 0) {
    return NextResponse.json({ imported: 0, skipped, message: '全て重複のためスキップしました' })
  }

  const result = await prisma.delivery.createMany({
    data: newItems.map(item => ({
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

  return NextResponse.json({ imported: result.count, skipped })
}
