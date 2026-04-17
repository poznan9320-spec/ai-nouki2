import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'
import { processCompany } from '@/lib/fax/processor'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: '管理者のみ操作できます' }, { status: 403 })

  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    return NextResponse.json({ error: 'Gmail設定が不完全です' }, { status: 500 })
  }

  try {
    const token = await prisma.gmailToken.findUnique({
      where: { companyId: user.companyId },
      select: { companyId: true, email: true, accessToken: true, refreshToken: true, faxSenderEmail: true },
    })

    if (!token) {
      return NextResponse.json({ error: 'Gmailが接続されていません' }, { status: 400 })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const result = await processCompany(token.companyId, token, anthropic)

    return NextResponse.json(result)
  } catch (error) {
    console.error(`[FAX-SYNC] 会社:${user.companyId} エラー:`, error)
    return NextResponse.json({ error: 'FAXの同期処理中にエラーが発生しました' }, { status: 500 })
  }
}
