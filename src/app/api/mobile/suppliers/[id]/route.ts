import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const { id } = await params
  const { color, name } = await req.json() as { color?: string; name?: string }
  const now = new Date()

  if (color !== undefined && name !== undefined) {
    try {
      await prisma.$executeRaw`
        UPDATE "Supplier" SET name = ${name}, color = ${color}, "updatedAt" = ${now}
        WHERE id = ${id} AND "companyId" = ${user.companyId}
      `
    } catch {
      await prisma.$executeRaw`
        UPDATE "Supplier" SET name = ${name}, "updatedAt" = ${now}
        WHERE id = ${id} AND "companyId" = ${user.companyId}
      `
    }
  } else if (color !== undefined) {
    try {
      await prisma.$executeRaw`
        UPDATE "Supplier" SET color = ${color}, "updatedAt" = ${now}
        WHERE id = ${id} AND "companyId" = ${user.companyId}
      `
    } catch {
      // color column not yet in DB — silently skip
    }
  } else if (name !== undefined) {
    await prisma.$executeRaw`
      UPDATE "Supplier" SET name = ${name}, "updatedAt" = ${now}
      WHERE id = ${id} AND "companyId" = ${user.companyId}
    `
  }

  return NextResponse.json({ id, name, color: color ?? null, companyId: user.companyId })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const { id } = await params
  await prisma.$executeRaw`
    DELETE FROM "Supplier" WHERE id = ${id} AND "companyId" = ${user.companyId}
  `
  return NextResponse.json({ success: true })
}
