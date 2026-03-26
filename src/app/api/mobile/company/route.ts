import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  const company = await prisma.company.findUnique({ where: { id: user.companyId } })
  return NextResponse.json({ company_id: company?.joinCode ?? company?.id, name: company?.name })
}
