import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const orders = await prisma.orderRequest.findMany({
    where: user.role === 'ADMIN'
      ? { requester: { companyId: user.companyId } }
      : { requesterId: user.userId },
    include: { requester: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ orders })
}

export async function POST(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  try {
    const { productName, quantity, neededBy, details } = await req.json()

    if (!productName) {
      return NextResponse.json({ error: '商品名は必須です' }, { status: 400 })
    }

    const order = await prisma.orderRequest.create({
      data: {
        productName,
        quantity: quantity ? parseInt(quantity) : null,
        neededBy: neededBy ? new Date(neededBy) : null,
        details,
        requesterId: user.userId,
        status: 'PENDING',
      },
    })

    // 管理者への通知作成
    const admins = await prisma.user.findMany({
      where: { companyId: user.companyId, role: 'ADMIN' },
    })

    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: '新しい発注申請',
        body: `${productName} の発注申請が届きました`,
        type: 'ORDER_STATUS' as const,
      })),
    })

    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
