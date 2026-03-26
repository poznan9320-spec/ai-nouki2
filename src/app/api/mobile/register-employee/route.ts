import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { joinCode, email, password, name } = await req.json()
    if (!joinCode || !email || !password || !name) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const company = await prisma.company.findUnique({ where: { joinCode: joinCode.toUpperCase() } })
    if (!company) return NextResponse.json({ error: '招待コードが正しくありません' }, { status: 404 })

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: 'このメールアドレスは既に登録されています' }, { status: 400 })

    const hashed = await bcrypt.hash(password, 10)
    await prisma.user.create({
      data: { email, password: hashed, name, role: 'EMPLOYEE', status: 'PENDING', companyId: company.id }
    })

    // 承認待ちのため token は返さない
    return NextResponse.json({ pending: true, companyName: company.name })
  } catch {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
