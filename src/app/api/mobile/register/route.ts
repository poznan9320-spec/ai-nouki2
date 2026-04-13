import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'
import { rateLimit, getIp } from '@/lib/rate-limit'

function generateJoinCode(): string {
  // crypto.randomInt is cryptographically secure
  const digits = randomInt(0, 100000).toString().padStart(5, '0')
  const letters = String.fromCharCode(
    65 + randomInt(0, 26),
    65 + randomInt(0, 26)
  )
  return digits + letters
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'パスワードは8文字以上にしてください'
  if (!/[0-9!@#$%^&*(),.?":{}|<>]/.test(password)) return 'パスワードには数字または記号を含めてください'
  return null
}

export async function POST(req: NextRequest) {
  // Rate limit: 5 registrations per hour per IP
  if (!rateLimit(getIp(req), 5, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: '登録の試行が多すぎます。しばらくしてから再試行してください。' },
      { status: 429 }
    )
  }

  try {
    const { companyName, email, password, name } = await req.json()

    if (!companyName || !email || !password) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const pwError = validatePassword(password)
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 })

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'このメールアドレスは既に登録されています' }, { status: 400 })
    }

    let joinCode = generateJoinCode()
    while (await prisma.company.findUnique({ where: { joinCode } })) {
      joinCode = generateJoinCode()
    }

    const hashed = await bcrypt.hash(password, 10)

    const company = await prisma.company.create({
      data: { name: companyName, joinCode },
    })

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

    const res = NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      company: { id: company.id, name: company.name, joinCode: company.joinCode },
    })

    res.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })

    return res
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
