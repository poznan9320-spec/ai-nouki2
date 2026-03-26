import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const setting = await prisma.notificationSetting.findUnique({
    where: { userId: payload.userId },
  })

  // Return defaults if no setting exists yet
  return NextResponse.json(setting ?? {
    todayHour: 7,
    tomorrowHour: 18,
    enabled: true,
  })
}

export async function PUT(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { todayHour, tomorrowHour, enabled } = await req.json() as {
    todayHour: number
    tomorrowHour: number
    enabled: boolean
  }

  if (
    typeof todayHour !== 'number' || todayHour < 0 || todayHour > 23 ||
    typeof tomorrowHour !== 'number' || tomorrowHour < 0 || tomorrowHour > 23
  ) {
    return NextResponse.json({ error: '時刻は0〜23で指定してください' }, { status: 400 })
  }

  const setting = await prisma.notificationSetting.upsert({
    where: { userId: payload.userId },
    create: { userId: payload.userId, todayHour, tomorrowHour, enabled },
    update: { todayHour, tomorrowHour, enabled },
  })

  return NextResponse.json(setting)
}
