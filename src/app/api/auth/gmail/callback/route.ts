/**
 * Gmail OAuth コールバック
 * Google認証後にここにリダイレクトされ、トークンをDBに保存する
 */
import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const companyId = searchParams.get('state')
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
  const settingsUrl = `${baseUrl}/settings`

  if (error || !code || !companyId) {
    return NextResponse.redirect(`${settingsUrl}?gmail_error=cancelled`)
  }

  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    return NextResponse.redirect(`${settingsUrl}?gmail_error=config`)
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      `${baseUrl}/api/auth/gmail/callback`,
    )

    // codeをトークンに交換
    const { tokens } = await oauth2Client.getToken(code)
    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${settingsUrl}?gmail_error=no_refresh_token`)
    }

    // 接続したGmailアドレスを取得
    oauth2Client.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()
    const email = userInfo.email ?? 'unknown'

    // DBに保存（既存があれば上書き）
    await prisma.gmailToken.upsert({
      where: { companyId },
      create: {
        companyId,
        email,
        accessToken: tokens.access_token ?? '',
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
      update: {
        email,
        accessToken: tokens.access_token ?? '',
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    })

    return NextResponse.redirect(`${settingsUrl}?gmail_success=1`)
  } catch (err) {
    console.error('[Gmail OAuth callback]', err)
    return NextResponse.redirect(`${settingsUrl}?gmail_error=server`)
  }
}
