import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const delivery = await prisma.delivery.update({
    where: { id, companyId: user.companyId },
    data: {
      productName: body.productName || body.product_name,
      quantity: parseInt(body.quantity),
      deliveryDate: new Date(body.deliveryDate || body.delivery_date),
      notes: body.notes || null,
    }
  })
  return NextResponse.json({ delivery })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  const { id } = await params
  await prisma.delivery.delete({ where: { id, companyId: user.companyId } })
  return NextResponse.json({ success: true })
}
