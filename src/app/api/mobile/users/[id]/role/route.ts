import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getTokenFromRequest(req)
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  const { id } = await params
  const { role } = await req.json()
  try {
    await prisma.user.update({ where: { id, companyId: user.companyId }, data: { role } })
  } catch {
    return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
