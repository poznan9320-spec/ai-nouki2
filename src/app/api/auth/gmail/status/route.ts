/**
 * Gmail接続状態確認・設定更新・切断
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const token = await prisma.gmailToken.findUnique({
    where: { companyId: user.companyId },
    select: { email: true, updatedAt: true, faxSenderEmail: true },
  })

  return NextResponse.json({
    connected: !!token,
    email: token?.email ?? null,
    faxSenderEmail: token?.faxSenderEmail ?? 'FromBrotherDevice@brother.com',
    connectedAt: token?.updatedAt ?? null,
  })
}

export async function PATCH(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: '管理者のみ操作できます' }, { status: 403 })

  const { faxSenderEmail } = await req.json()
  if (!faxSenderEmail?.trim()) {
    return NextResponse.json({ error: 'メールアドレスが必要です' }, { status: 400 })
  }

  const token = await prisma.gmailToken.update({
    where: { companyId: user.companyId },
    data: { faxSenderEmail: faxSenderEmail.trim() },
  })

  return NextResponse.json({ faxSenderEmail: token.faxSenderEmail })
}

export async function DELETE(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: '管理者のみ操作できます' }, { status: 403 })

  await prisma.gmailToken.deleteMany({ where: { companyId: user.companyId } })
  return NextResponse.json({ success: true })
}
