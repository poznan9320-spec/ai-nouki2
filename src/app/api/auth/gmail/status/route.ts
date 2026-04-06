/**
 * Gmail接続状態確認
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const token = await prisma.gmailToken.findUnique({
    where: { companyId: user.companyId },
    select: { email: true, updatedAt: true },
  })

  return NextResponse.json({
    connected: !!token,
    email: token?.email ?? null,
    connectedAt: token?.updatedAt ?? null,
  })
}

export async function DELETE(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: '管理者のみ操作できます' }, { status: 403 })

  await prisma.gmailToken.deleteMany({ where: { companyId: user.companyId } })
  return NextResponse.json({ success: true })
}
