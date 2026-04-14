/**
 * One-shot migration endpoint to apply missing schema changes to the production DB.
 * Call once via: GET /api/admin/migrate?secret=<CRON_SECRET>
 * Protected by CRON_SECRET. Delete or disable after use.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Array<{ step: string; status: string; error?: string }> = []

  async function run(step: string, sql: string) {
    try {
      await prisma.$executeRawUnsafe(sql)
      results.push({ step, status: 'ok' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      results.push({ step, status: 'error', error: msg })
    }
  }

  // 1. Supplier.color
  await run(
    'Supplier.color',
    `ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "color" TEXT`,
  )

  // 2. FaxLog table
  await run(
    'FaxLog table',
    `CREATE TABLE IF NOT EXISTS "FaxLog" (
      "id" TEXT NOT NULL,
      "messageId" TEXT NOT NULL,
      "companyId" TEXT NOT NULL,
      "processed" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FaxLog_pkey" PRIMARY KEY ("id")
    )`,
  )
  await run(
    'FaxLog_messageId_key',
    `CREATE UNIQUE INDEX IF NOT EXISTS "FaxLog_messageId_key" ON "FaxLog"("messageId")`,
  )

  // 3. GmailToken table
  await run(
    'GmailToken table',
    `CREATE TABLE IF NOT EXISTS "GmailToken" (
      "id" TEXT NOT NULL,
      "companyId" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "accessToken" TEXT NOT NULL,
      "refreshToken" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "GmailToken_pkey" PRIMARY KEY ("id")
    )`,
  )
  await run(
    'GmailToken_companyId_key',
    `CREATE UNIQUE INDEX IF NOT EXISTS "GmailToken_companyId_key" ON "GmailToken"("companyId")`,
  )
  await run(
    'GmailToken_companyId_fkey',
    `DO $$ BEGIN
      ALTER TABLE "GmailToken" ADD CONSTRAINT "GmailToken_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  )

  // 4. GmailToken.faxSenderEmail
  await run(
    'GmailToken.faxSenderEmail',
    `ALTER TABLE "GmailToken" ADD COLUMN IF NOT EXISTS "faxSenderEmail" TEXT NOT NULL DEFAULT 'FromBrotherDevice@brother.com'`,
  )

  // 5. CalendarMemo table
  await run(
    'CalendarMemo table',
    `CREATE TABLE IF NOT EXISTS "CalendarMemo" (
      "id" TEXT NOT NULL,
      "companyId" TEXT NOT NULL,
      "date" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "CalendarMemo_pkey" PRIMARY KEY ("id")
    )`,
  )
  await run(
    'CalendarMemo_companyId_date_key',
    `CREATE UNIQUE INDEX IF NOT EXISTS "CalendarMemo_companyId_date_key" ON "CalendarMemo"("companyId", "date")`,
  )
  await run(
    'CalendarMemo_companyId_fkey',
    `DO $$ BEGIN
      ALTER TABLE "CalendarMemo" ADD CONSTRAINT "CalendarMemo_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  )

  const hasError = results.some(r => r.status === 'error')
  return NextResponse.json({ results }, { status: hasError ? 207 : 200 })
}
