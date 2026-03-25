import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Record<string, unknown> = { companyId: user.companyId }
  if (status) where.status = status
  if (from || to) {
    where.deliveryDate = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  }

  const deliveries = await prisma.delivery.findMany({
    where,
    orderBy: { deliveryDate: 'asc' },
  })

  return NextResponse.json(deliveries)
}

export async function DELETE(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const { count } = await prisma.delivery.deleteMany({ where: { companyId: user.companyId } })
  return NextResponse.json({ deleted: count })
}

export async function POST(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  try {
    const body = await req.json()
    const { productName, quantity, deliveryDate, status, sourceType, notes } = body

    if (!productName || !quantity || !deliveryDate) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const delivery = await prisma.delivery.create({
      data: {
        productName,
        quantity: parseInt(quantity),
        deliveryDate: new Date(deliveryDate),
        status: status ?? 'PENDING',
        sourceType: sourceType ?? 'MANUAL',
        notes: notes ?? null,
        companyId: user.companyId,
      },
    })

    return NextResponse.json(delivery, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
