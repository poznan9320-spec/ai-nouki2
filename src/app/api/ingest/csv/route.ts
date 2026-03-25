import { NextRequest, NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// UTF-8 BOM を除去
function stripBOM(text: string): string {
  return text.replace(/^\uFEFF/, '')
}

// 複数の日付フォーマットに対応
function parseDate(str: string): Date | null {
  if (!str) return null
  const s = str.trim().replace(/　/g, '') // 全角スペース除去

  // YYYY-MM-DD / YYYY/MM/DD
  let d = new Date(s.replace(/\//g, '-'))
  if (!isNaN(d.getTime())) return d

  // YYYY年MM月DD日
  const jp = s.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日?/)
  if (jp) {
    d = new Date(`${jp[1]}-${jp[2].padStart(2, '0')}-${jp[3].padStart(2, '0')}`)
    if (!isNaN(d.getTime())) return d
  }

  // 令和/平成 (和暦)
  const wareki = s.match(/[令R](\d+)[年.]\s*(\d{1,2})[月.]\s*(\d{1,2})/)
  if (wareki) {
    const year = 2018 + parseInt(wareki[1])
    d = new Date(`${year}-${wareki[2].padStart(2, '0')}-${wareki[3].padStart(2, '0')}`)
    if (!isNaN(d.getTime())) return d
  }

  // MM/DD/YYYY (US format)
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (us) {
    d = new Date(`${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`)
    if (!isNaN(d.getTime())) return d
  }

  return null
}

// カラム名の候補リスト (フォールバック用)
const NAME_COLS = ['商品名', '品名', '品目名', '品目', '製品名', 'productName', 'product_name', '商品', '品番']
const QTY_COLS = ['数量', '個数', '発注数', '注文数', '数', 'quantity', 'qty', '受注数']
const DATE_COLS = ['納期', '回答納期', '納入日', '納品日', '希望納期', 'deliveryDate', 'delivery_date', '納入予定日']
const NOTES_COLS = ['備考', 'メモ', '摘要', 'notes', '注記']

interface Mapping {
  productName: string | null
  quantity: string | null
  deliveryDate: string | null
  notes: string | null
}

async function detectMapping(headers: string[], sampleRows: Record<string, string>[]): Promise<Mapping> {
  // まず候補リストで試みる
  const fallback: Mapping = {
    productName: headers.find(h => NAME_COLS.some(c => h.includes(c))) ?? null,
    quantity: headers.find(h => QTY_COLS.some(c => h.includes(c))) ?? null,
    deliveryDate: headers.find(h => DATE_COLS.some(c => h.includes(c))) ?? null,
    notes: headers.find(h => NOTES_COLS.some(c => h.includes(c))) ?? null,
  }

  // 3つ全て見つかればAI不要
  if (fallback.productName && fallback.quantity && fallback.deliveryDate) return fallback

  // AIで判定
  if (!process.env.ANTHROPIC_API_KEY) return fallback

  const sample = sampleRows.slice(0, 3).map(r =>
    headers.map(h => `${h}: ${r[h] ?? ''}`).join(' | ')
  ).join('\n')

  try {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `以下のCSVヘッダーとサンプルから、商品名・数量・納期・備考に対応するカラム名を特定してください。

ヘッダー: ${headers.join(', ')}
サンプル:
${sample}

JSON形式のみで回答（null可）:
{"productName":"カラム名","quantity":"カラム名","deliveryDate":"カラム名","notes":"カラム名またはnull"}`
      }]
    })
    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    const match = text.match(/\{[\s\S]*?\}/)
    if (match) {
      const parsed = JSON.parse(match[0]) as Mapping
      return {
        productName: parsed.productName && headers.includes(parsed.productName) ? parsed.productName : fallback.productName,
        quantity: parsed.quantity && headers.includes(parsed.quantity) ? parsed.quantity : fallback.quantity,
        deliveryDate: parsed.deliveryDate && headers.includes(parsed.deliveryDate) ? parsed.deliveryDate : fallback.deliveryDate,
        notes: parsed.notes && headers.includes(parsed.notes) ? parsed.notes : fallback.notes,
      }
    }
  } catch (e) {
    console.error('AI mapping failed:', e)
  }

  return fallback
}

export async function POST(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'CSVファイルが必要です' }, { status: 400 })

    // ファイル読み込み（UTF-8 + BOM対応、Shift-JIS フォールバック）
    const buffer = await file.arrayBuffer()
    let text: string
    try {
      text = stripBOM(new TextDecoder('utf-8').decode(buffer))
      // 文字化けチェック（多くの ? や □ が含まれていればShift-JIS）
      if ((text.match(/[?□]/g) ?? []).length > text.length * 0.1) {
        text = stripBOM(new TextDecoder('shift-jis').decode(buffer))
      }
    } catch {
      text = stripBOM(new TextDecoder('utf-8').decode(buffer))
    }

    // CSVパース
    let records: Record<string, string>[]
    try {
      records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        bom: true,
      }) as Record<string, string>[]
    } catch (parseErr) {
      return NextResponse.json({ error: `CSVの解析に失敗しました: ${String(parseErr)}` }, { status: 400 })
    }

    if (records.length === 0) {
      return NextResponse.json({ error: 'CSVにデータが見つかりませんでした' }, { status: 400 })
    }

    const headers = Object.keys(records[0])
    const mapping = await detectMapping(headers, records.slice(0, 3))

    if (!mapping.productName || !mapping.quantity || !mapping.deliveryDate) {
      return NextResponse.json({
        error: 'カラムの自動判定に失敗しました。CSVのヘッダー行を確認してください。',
        detectedHeaders: headers,
        hint: `期待するヘッダー例: 商品名 or productName, 数量 or quantity, 納期 or deliveryDate`,
      }, { status: 400 })
    }

    // 全行を変換
    const toSave = []
    const errors: { row: number; error: string }[] = []
    const preview: { productName: string; quantity: number; deliveryDate: string }[] = []

    for (let i = 0; i < records.length; i++) {
      const row = records[i]
      try {
        const productName = (row[mapping.productName!] ?? '').trim()
        const quantityRaw = (row[mapping.quantity!] ?? '').trim().replace(/[,，,]/g, '')
        const deliveryDateRaw = (row[mapping.deliveryDate!] ?? '').trim()
        const notes = mapping.notes ? (row[mapping.notes] ?? '').trim() || null : null

        if (!productName || !quantityRaw || !deliveryDateRaw) {
          errors.push({ row: i + 2, error: `空白データをスキップ: ${productName || '商品名なし'}` })
          continue
        }

        const quantity = parseInt(quantityRaw)
        if (isNaN(quantity) || quantity <= 0) {
          errors.push({ row: i + 2, error: `数量が不正: "${quantityRaw}"` })
          continue
        }

        const deliveryDate = parseDate(deliveryDateRaw)
        if (!deliveryDate) {
          errors.push({ row: i + 2, error: `日付形式が不正: "${deliveryDateRaw}"` })
          continue
        }

        toSave.push({ productName, quantity, deliveryDate, status: 'PENDING' as const, sourceType: 'CSV' as const, notes, companyId: user.companyId })
        if (preview.length < 5) preview.push({ productName, quantity, deliveryDate: deliveryDateRaw })
      } catch {
        errors.push({ row: i + 2, error: '解析エラー' })
      }
    }

    if (toSave.length === 0) {
      return NextResponse.json({
        error: '有効なデータが見つかりませんでした',
        detectedMapping: mapping,
        errors,
      }, { status: 400 })
    }

    // 100件ずつバッチ保存（タイムアウト回避）
    for (let i = 0; i < toSave.length; i += 100) {
      await prisma.delivery.createMany({ data: toSave.slice(i, i + 100) })
    }

    return NextResponse.json({
      imported: toSave.length,
      skipped: errors.length,
      preview,
      mapping,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'CSVの処理中にエラーが発生しました' }, { status: 500 })
  }
}
