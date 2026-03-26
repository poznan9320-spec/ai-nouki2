import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'

function generateJoinCode(): string {
  const digits = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
  const letters = String.fromCharCode(
    65 + Math.floor(Math.random() * 26),
    65 + Math.floor(Math.random() * 26)
  )
  return digits + letters
}

export async function POST(req: NextRequest) {
  try {
    const { companyName, email, password, name } = await req.json()

    if (!companyName || !email || !password) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'このメールアドレスは既に登録されています' }, { status: 400 })
    }

    // joinCode の重複を避けてリトライ
    let joinCode = generateJoinCode()
    while (await prisma.company.findUnique({ where: { joinCode } })) {
      joinCode = generateJoinCode()
    }

    const hashed = await bcrypt.hash(password, 10)

    const company = await prisma.company.create({
      data: { name: companyName, joinCode },
    })

    // 管理者は即ACTIVE
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: name || email,
        role: 'ADMIN',
        status: 'ACTIVE',
        companyId: company.id,
      },
    })

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    })

    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      company: { id: company.id, name: company.name, joinCode: company.joinCode },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
