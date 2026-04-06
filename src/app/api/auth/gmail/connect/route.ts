/**
 * Gmail OAuth接続開始
 * 管理者が「Gmailを接続する」ボタンを押すとここにリダイレクトされる
 */
import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: '管理者のみ操作できます' }, { status: 403 })

  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    return NextResponse.json({ error: 'Gmail OAuth が設定されていません（GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET）' }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    `${baseUrl}/api/auth/gmail/callback`,
  )

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',           // 必ずrefresh_tokenを返すようにする
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify', // 既読化のため
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state: user.companyId,       // コールバックで会社を特定するために使う
  })

  return NextResponse.redirect(url)
}
