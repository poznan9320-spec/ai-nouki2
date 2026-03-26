import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  const { id } = await params
  try {
    const body = await req.json()
    const updateData: Record<string, unknown> = {}
    if (body.productName !== undefined) updateData.productName = body.productName
    if (body.quantity !== undefined) updateData.quantity = parseInt(body.quantity)
    if (body.deliveryDate !== undefined) updateData.deliveryDate = new Date(body.deliveryDate)
    if (body.status !== undefined) updateData.status = body.status
    if (body.notes !== undefined) updateData.notes = body.notes ?? null
    if (body.supplierName !== undefined) updateData.supplierName = body.supplierName ?? null

    const delivery = await prisma.delivery.update({
      where: { id, companyId: user.companyId },
      data: updateData,
    })
    return NextResponse.json(delivery)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  const { id } = await params
  try {
    await prisma.delivery.delete({ where: { id, companyId: user.companyId } })
  } catch {
    return NextResponse.json({ error: 'データが見つかりません' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
