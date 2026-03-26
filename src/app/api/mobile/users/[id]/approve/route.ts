import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getTokenFromRequest(req)
  if (!admin || admin.role !== 'ADMIN') return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const { id } = await params
  const { action } = await req.json() as { action: 'approve' | 'reject' }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target || target.companyId !== admin.companyId) {
    return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
  }

  const status = action === 'approve' ? 'ACTIVE' : 'REJECTED'
  await prisma.user.update({ where: { id }, data: { status } })

  return NextResponse.json({ ok: true, status })
}
