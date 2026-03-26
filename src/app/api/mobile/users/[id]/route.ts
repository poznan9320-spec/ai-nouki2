import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getTokenFromRequest(req)
  if (!admin || admin.role !== 'ADMIN') return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const { id } = await params

  // 自分自身は削除不可
  if (id === admin.userId) return NextResponse.json({ error: '自分自身は削除できません' }, { status: 400 })

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target || target.companyId !== admin.companyId) {
    return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
  }

  // 関連データを先に削除してからユーザー削除
  await prisma.notification.deleteMany({ where: { userId: id } })
  await prisma.message.deleteMany({ where: { senderId: id } })
  await prisma.orderRequest.deleteMany({ where: { requesterId: id } })
  await prisma.user.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
