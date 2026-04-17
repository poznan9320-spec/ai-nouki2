/**
 * FAXメール自動登録 Cron（SaaS対応・全社ループ）
 *
 * Gmailを接続済みの全会社を対象に、
 * 複合機(FromBrotherDevice@brother.com)からの未読FAXメールを
 * 30分ごとに自動チェックしてOCR→納期データ登録します。
 *
 * 必要な環境変数:
 *   GMAIL_CLIENT_ID       - Google Cloud OAuth2 クライアントID
 *   GMAIL_CLIENT_SECRET   - Google Cloud OAuth2 クライアントシークレット
 *   CRON_SECRET           - Vercel Cron認証シークレット
 *   ANTHROPIC_API_KEY     - Claude AI OCR用
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { processCompany } from '@/lib/fax/processor'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    return NextResponse.json({ error: 'Gmail credentials not configured' }, { status: 500 })
  }

  // Gmail接続済みの全会社を取得
  const tokens = await prisma.gmailToken.findMany({
    select: { companyId: true, email: true, accessToken: true, refreshToken: true, faxSenderEmail: true },
  })

  if (tokens.length === 0) {
    return NextResponse.json({ message: 'Gmail接続済みの会社がありません', companies: 0 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let totalProcessed = 0, totalSkipped = 0, totalErrors = 0
  const results: Array<{ companyId: string; email: string; processed: number; skipped: number; errors: number }> = []

  for (const token of tokens) {
    try {
      const result = await processCompany(token.companyId, token, anthropic)
      totalProcessed += result.processed
      totalSkipped += result.skipped
      totalErrors += result.errors
      results.push({ companyId: token.companyId, email: token.email, ...result })
    } catch (err) {
      console.error(`[FAX] 会社:${token.companyId} 致命的エラー:`, err)
      totalErrors++
      results.push({ companyId: token.companyId, email: token.email, processed: 0, skipped: 0, errors: 1 })
    }
  }

  return NextResponse.json({
    companies: tokens.length,
    totalProcessed,
    totalSkipped,
    totalErrors,
    results,
  })
}
