import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const suppliers = await prisma.supplier.findMany({
    where: { companyId: user.companyId },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(suppliers)
}

export async function POST(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '取引先名が必要です' }, { status: 400 })

  const supplier = await prisma.supplier.create({
    data: { name: name.trim(), companyId: user.companyId },
  })
  return NextResponse.json(supplier, { status: 201 })
}
