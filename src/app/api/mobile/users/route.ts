import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  const users = await prisma.user.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: 'asc' }
  })
  return NextResponse.json(users.map(u => ({
    user_id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.createdAt
  })))
}
