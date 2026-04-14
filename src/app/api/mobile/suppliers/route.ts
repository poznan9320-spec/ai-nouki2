import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'
import { randomUUID } from 'crypto'

type SupplierRow = { id: string; name: string; color: string | null; companyId: string }

async function fetchSuppliers(companyId: string): Promise<SupplierRow[]> {
  try {
    return await prisma.$queryRaw<SupplierRow[]>`
      SELECT id, name, color, "companyId" FROM "Supplier"
      WHERE "companyId" = ${companyId} ORDER BY name ASC
    `
  } catch {
    // color column not yet in DB — fall back without it
    const rows = await prisma.$queryRaw<Omit<SupplierRow, 'color'>[]>`
      SELECT id, name, "companyId" FROM "Supplier"
      WHERE "companyId" = ${companyId} ORDER BY name ASC
    `
    return rows.map(r => ({ ...r, color: null }))
  }
}

export async function GET(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const suppliers = await fetchSuppliers(user.companyId)
  return NextResponse.json(suppliers)
}

export async function POST(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '取引先名が必要です' }, { status: 400 })

  const id = randomUUID()
  const now = new Date()

  try {
    await prisma.$executeRaw`
      INSERT INTO "Supplier" (id, name, color, "companyId", "createdAt", "updatedAt")
      VALUES (${id}, ${name.trim()}, NULL, ${user.companyId}, ${now}, ${now})
    `
  } catch {
    // color column not in DB yet — insert without it
    await prisma.$executeRaw`
      INSERT INTO "Supplier" (id, name, "companyId", "createdAt", "updatedAt")
      VALUES (${id}, ${name.trim()}, ${user.companyId}, ${now}, ${now})
    `
  }

  return NextResponse.json({ id, name: name.trim(), color: null, companyId: user.companyId }, { status: 201 })
}
