import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unread_only') === 'true'
  const notifications = await prisma.notification.findMany({
    where: { userId: user.userId, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json(notifications.map(n => ({
    notification_id: n.id,
    title: n.title,
    message: n.body,
    type: n.type.toLowerCase(),
    is_read: n.isRead,
    created_at: n.createdAt
  })))
}
