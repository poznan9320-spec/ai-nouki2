import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding demo account for App Store Review...')

  // 既存のデモデータをクリーンアップ
  const existingCompany = await prisma.company.findFirst({
    where: { joinCode: 'DEMO2024' },
  })
  if (existingCompany) {
    await prisma.delivery.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.notificationSetting.deleteMany({
      where: { user: { companyId: existingCompany.id } },
    })
    await prisma.user.deleteMany({ where: { companyId: existingCompany.id } })
    await prisma.company.delete({ where: { id: existingCompany.id } })
    console.log('Existing demo data cleaned up.')
  }

  // デモ会社を作成
  const company = await prisma.company.create({
    data: {
      name: 'デモ商事株式会社',
      joinCode: 'DEMO2024',
    },
  })

  // 管理者アカウントを作成（App Store Review 用）
  const hashedPassword = await bcrypt.hash('AppReview2024!', 10)
  const adminUser = await prisma.user.create({
    data: {
      email: 'review@demo.deliveryhub.com',
      password: hashedPassword,
      name: '審査担当者',
      role: 'ADMIN',
      status: 'ACTIVE',
      companyId: company.id,
    },
  })

  // 通知設定を作成
  await prisma.notificationSetting.create({
    data: {
      userId: adminUser.id,
      todayHour: 7,
      tomorrowHour: 18,
      enabled: true,
    },
  })

  // サンプル入荷データを作成（今日・明日・今週・過去 のパターン）
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const deliveries = [
    {
      productName: 'ステンレスボルト M8×20 (500本入)',
      quantity: 10,
      deliveryDate: new Date(today),
      supplierName: '山田ネジ工業',
      status: 'PENDING' as const,
      sourceType: 'MANUAL' as const,
      notes: '検品要確認',
    },
    {
      productName: 'アルミプレート 200×300mm',
      quantity: 50,
      deliveryDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
      supplierName: '東京アルミ株式会社',
      status: 'PENDING' as const,
      sourceType: 'MANUAL' as const,
    },
    {
      productName: '産業用ゴムパッキン φ50',
      quantity: 200,
      deliveryDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
      supplierName: '大阪ゴム工業',
      status: 'PENDING' as const,
      sourceType: 'IMAGE' as const,
    },
    {
      productName: 'ステンレス配管 1インチ×2m',
      quantity: 30,
      deliveryDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
      supplierName: '名古屋パイプ',
      status: 'PENDING' as const,
      sourceType: 'MANUAL' as const,
    },
    {
      productName: 'エポキシ接着剤 500g缶',
      quantity: 24,
      deliveryDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
      supplierName: '化研工業',
      status: 'DELIVERED' as const,
      sourceType: 'TEXT' as const,
      notes: '納品完了',
    },
  ]

  for (const delivery of deliveries) {
    await prisma.delivery.create({
      data: {
        ...delivery,
        companyId: company.id,
      },
    })
  }

  console.log('✅ Demo seed complete!')
  console.log(`   Company: ${company.name} (joinCode: ${company.joinCode})`)
  console.log(`   Admin:   ${adminUser.email} / AppReview2024!`)
  console.log(`   Deliveries: ${deliveries.length}件`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
