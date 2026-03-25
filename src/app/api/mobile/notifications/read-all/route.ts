import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function PUT(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  await prisma.notification.updateMany({ where: { userId: user.userId, isRead: false }, data: { isRead: true } })
  return NextResponse.json({ success: true })
}
