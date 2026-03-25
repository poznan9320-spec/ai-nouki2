import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const { id } = await params
  await prisma.supplier.delete({ where: { id, companyId: user.companyId } })
  return NextResponse.json({ success: true })
}
