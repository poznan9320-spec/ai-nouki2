import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { company: true }
  })
  if (!user) return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    company: { id: user.company.id, name: user.company.name }
  })
}
