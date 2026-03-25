import { NextRequest, NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'CSVファイルが必要です' }, { status: 400 })
    }

    const text = await file.text()
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[]

    const deliveries = []
    const errors = []

    for (let i = 0; i < records.length; i++) {
      const row = records[i]
      try {
        // 複数のカラム名に対応（日本語・英語）
        const productName = row['商品名'] || row['product_name'] || row['productName'] || row['商品']
        const quantity = row['数量'] || row['quantity'] || row['個数']
        const deliveryDate = row['納期'] || row['delivery_date'] || row['deliveryDate'] || row['納入日']
        const notes = row['備考'] || row['notes'] || row['メモ'] || ''

        if (!productName || !quantity || !deliveryDate) {
          errors.push({ row: i + 2, error: '必須項目（商品名・数量・納期）が不足しています' })
          continue
        }

        const parsed = new Date(deliveryDate)
        if (isNaN(parsed.getTime())) {
          errors.push({ row: i + 2, error: `日付の形式が正しくありません: ${deliveryDate}` })
          continue
        }

        deliveries.push({
          productName: productName.trim(),
          quantity: parseInt(quantity),
          deliveryDate: parsed,
          status: 'PENDING' as const,
          sourceType: 'CSV' as const,
          notes: notes.trim() || null,
          companyId: user.companyId,
        })
      } catch (e) {
        errors.push({ row: i + 2, error: '行の解析に失敗しました' })
      }
    }

    if (deliveries.length === 0) {
      return NextResponse.json({ error: '有効なデータが見つかりませんでした', errors }, { status: 400 })
    }

    await prisma.delivery.createMany({ data: deliveries })

    return NextResponse.json({
      message: `${deliveries.length}件の配送データを登録しました`,
      imported: deliveries.length,
      errors,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'CSVの処理中にエラーが発生しました' }, { status: 500 })
  }
}
