import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  const where = {
    companyId: user.companyId,
    ...(status ? { status: status as any } : {}),
  }

  const [deliveries, total] = await Promise.all([
    prisma.delivery.findMany({
      where,
      orderBy: { deliveryDate: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.delivery.count({ where }),
  ])

  return NextResponse.json({ deliveries, total, page, limit })
}

export async function POST(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  try {
    const body = await req.json()
    const { productName, quantity, deliveryDate, notes } = body

    if (!productName || !quantity || !deliveryDate) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const delivery = await prisma.delivery.create({
      data: {
        productName,
        quantity: parseInt(quantity),
        deliveryDate: new Date(deliveryDate),
        status: 'PENDING',
        sourceType: 'MANUAL',
        notes,
        companyId: user.companyId,
      },
    })

    return NextResponse.json({ delivery }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
