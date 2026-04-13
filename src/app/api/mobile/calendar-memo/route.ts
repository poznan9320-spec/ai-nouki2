import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  if (!year || !month) {
    return NextResponse.json({ error: 'year と month が必要です' }, { status: 400 })
  }

  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const memos = await prisma.calendarMemo.findMany({
    where: { companyId: user.companyId, date: { startsWith: prefix } },
  })

  const memoMap: Record<string, string> = {}
  for (const m of memos) {
    memoMap[m.date] = m.content
  }

  return NextResponse.json({ memos: memoMap })
}

export async function PUT(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { date, content } = await req.json()
  if (!date) return NextResponse.json({ error: 'date が必要です' }, { status: 400 })

  if (!content || content.trim() === '') {
    await prisma.calendarMemo.deleteMany({
      where: { companyId: user.companyId, date },
    })
    return NextResponse.json({ deleted: true })
  }

  const memo = await prisma.calendarMemo.upsert({
    where: { companyId_date: { companyId: user.companyId, date } },
    update: { content: content.trim() },
    create: { companyId: user.companyId, date, content: content.trim() },
  })

  return NextResponse.json({ memo })
}
