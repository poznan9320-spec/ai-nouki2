import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { rateLimit, getIp } from '@/lib/rate-limit'

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'パスワードは8文字以上にしてください'
  if (!/[0-9!@#$%^&*(),.?":{}|<>]/.test(password)) return 'パスワードには数字または記号を含めてください'
  return null
}

export async function POST(req: NextRequest) {
  // Rate limit: 10 attempts per hour per IP
  if (!rateLimit(getIp(req), 10, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: '試行が多すぎます。しばらくしてから再試行してください。' },
      { status: 429 }
    )
  }

  try {
    const { joinCode, email, password, name } = await req.json()
    if (!joinCode || !email || !password || !name) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const pwError = validatePassword(password)
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 })

    const company = await prisma.company.findUnique({ where: { joinCode: joinCode.toUpperCase() } })
    if (!company) return NextResponse.json({ error: '招待コードが正しくありません' }, { status: 404 })

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: 'このメールアドレスは既に登録されています' }, { status: 400 })

    const hashed = await bcrypt.hash(password, 10)
    await prisma.user.create({
      data: { email, password: hashed, name, role: 'EMPLOYEE', status: 'PENDING', companyId: company.id }
    })

    // PENDING users do not receive a token or cookie
    return NextResponse.json({ pending: true, companyName: company.name })
  } catch {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
