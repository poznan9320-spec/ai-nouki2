import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'
import { rateLimit, getIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Rate limit: 10 attempts per 15 minutes per IP
  if (!rateLimit(getIp(req), 10, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'ログイン試行が多すぎます。15分後に再試行してください。' },
      { status: 429 }
    )
  }

  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'メールアドレスとパスワードは必須です' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true },
    })

    if (!user || !user.password) {
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, { status: 401 })
    }

    if (user.status === 'PENDING') {
      return NextResponse.json({ error: '管理者の承認待ちです。承認後にログインできます。', pending: true }, { status: 403 })
    }
    if (user.status === 'REJECTED') {
      return NextResponse.json({ error: 'アカウントが拒否されました。管理者にお問い合わせください。' }, { status: 403 })
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    })

    const res = NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      company: { id: user.company.id, name: user.company.name },
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
