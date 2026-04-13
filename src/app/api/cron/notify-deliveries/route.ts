import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Runs every hour via Vercel Cron: "0 * * * *"
// Sends delivery notifications to users whose preferred hour matches the current JST hour.
export async function GET(req: NextRequest) {
  // Protect the cron endpoint
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Current hour in JST (UTC+9)
  const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const currentHour = nowJST.getUTCHours()

  const todayJST = new Date(nowJST)
  todayJST.setUTCHours(0, 0, 0, 0)
  const tomorrowJST = new Date(todayJST)
  tomorrowJST.setUTCDate(tomorrowJST.getUTCDate() + 1)
  const dayAfterJST = new Date(tomorrowJST)
  dayAfterJST.setUTCDate(dayAfterJST.getUTCDate() + 1)

  // Find enabled settings that match the current hour
  const settings = await prisma.notificationSetting.findMany({
    where: {
      enabled: true,
      OR: [
        { todayHour: currentHour },
        { tomorrowHour: currentHour },
      ],
    },
    include: { user: true },
  })

  if (settings.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  // Group company IDs to batch delivery queries
  const companyIds = [...new Set(settings.map(s => s.user.companyId))]
  const deliveriesByCompany = await prisma.delivery.findMany({
    where: {
      companyId: { in: companyIds },
      deliveryDate: {
        gte: todayJST,
        lt: dayAfterJST,
      },
      status: { notIn: ['CANCELLED'] },
    },
  })

  let sent = 0

  for (const setting of settings) {
    const companyId = setting.user.companyId
    const userId = setting.userId

    // Today notifications
    if (setting.todayHour === currentHour) {
      const todayDeliveries = deliveriesByCompany.filter(d => {
        const date = new Date(d.deliveryDate)
        return d.companyId === companyId && date >= todayJST && date < tomorrowJST
      })
      if (todayDeliveries.length > 0) {
        // Deduplicate: skip if already sent today
        const existing = await prisma.notification.findFirst({
          where: {
            userId,
            type: 'DELIVERY_UPDATE',
            title: { contains: '本日' },
            createdAt: { gte: todayJST },
          },
        })
        if (!existing) {
          await prisma.notification.create({
            data: {
              userId,
              title: `本日の納品 ${todayDeliveries.length}件`,
              body: todayDeliveries.slice(0, 3).map(d => d.productName).join('、') +
                (todayDeliveries.length > 3 ? `、他${todayDeliveries.length - 3}件` : ''),
              type: 'DELIVERY_UPDATE',
            },
          })
          sent++
        }
      }
    }

    // Tomorrow notifications
    if (setting.tomorrowHour === currentHour) {
      const tomorrowDeliveries = deliveriesByCompany.filter(d => {
        const date = new Date(d.deliveryDate)
        return d.companyId === companyId && date >= tomorrowJST && date < dayAfterJST
      })
      if (tomorrowDeliveries.length > 0) {
        const existing = await prisma.notification.findFirst({
          where: {
            userId,
            type: 'DELIVERY_UPDATE',
            title: { contains: '明日' },
            createdAt: { gte: todayJST },
          },
        })
        if (!existing) {
          await prisma.notification.create({
            data: {
              userId,
              title: `明日の納品 ${tomorrowDeliveries.length}件`,
              body: tomorrowDeliveries.slice(0, 3).map(d => d.productName).join('、') +
                (tomorrowDeliveries.length > 3 ? `、他${tomorrowDeliveries.length - 3}件` : ''),
              type: 'DELIVERY_UPDATE',
            },
          })
          sent++
        }
      }
    }
  }

  return NextResponse.json({ sent, hour: currentHour })
}
