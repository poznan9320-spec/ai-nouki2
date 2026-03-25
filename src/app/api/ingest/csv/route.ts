import { NextRequest, NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ========== エンコード検出 ==========
function countJapanese(text: string): number {
  return (text.match(/[\u3040-\u30FF\u4E00-\u9FAF\uFF00-\uFFEF]/g) ?? []).length
}

function decodeBuffer(buffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(buffer)

  // UTF-8 BOM チェック
  if (uint8[0] === 0xEF && uint8[1] === 0xBB && uint8[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '')
  }

  // UTF-8 と Shift-JIS 両方でデコードして、日本語文字が多い方を採用
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer).replace(/^\uFEFF/, '')
  let sjis = ''
  try {
    sjis = new TextDecoder('shift-jis', { fatal: false }).decode(buffer)
  } catch {
    sjis = ''
  }

  const utf8JP = countJapanese(utf8)
  const sjisJP = countJapanese(sjis)

  // Shift-JIS の日本語文字数が多ければ Shift-JIS を採用
  return sjisJP > utf8JP ? sjis : utf8
}

// ========== 日付解析 ==========
const SKIP_DATE_VALUES = ['未定', 'みてい', '-', '—', 'TBD', 'tbd', '']

function parseDate(str: string): Date | null {
  if (!str) return null
  const s = str.trim().replace(/[\s　]/g, '')  // 全角スペース除去

  if (SKIP_DATE_VALUES.includes(s)) return null

  // YYYY/MM/DD または YYYY-MM-DD
  let d = new Date(s.replace(/\//g, '-'))
  if (!isNaN(d.getTime())) return d

  // YYYY年MM月DD日
  const jp = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/)
  if (jp) {
    d = new Date(`${jp[1]}-${jp[2].padStart(2, '0')}-${jp[3].padStart(2, '0')}`)
    if (!isNaN(d.getTime())) return d
  }

  // 令和/R + 年号
  const wareki = s.match(/[令R](\d+)[年.](\d{1,2})[月.](\d{1,2})/)
  if (wareki) {
    const year = 2018 + parseInt(wareki[1])
    d = new Date(`${year}-${wareki[2].padStart(2, '0')}-${wareki[3].padStart(2, '0')}`)
    if (!isNaN(d.getTime())) return d
  }

  return null
}

// ========== カラム自動判定 ==========
const NAME_ALIASES = ['商品名', '品名', '品目名', '製品名', '商品', 'productName', 'product_name', 'item_name', 'name']
const QTY_ALIASES  = ['数量', '量', '個数', '発注数', '注文数', '受注数', 'quantity', 'qty', 'count', 'Ê']
const DATE_ALIASES = ['納入日', '納品日', '納期', '回答納期', '希望納期', '納入予定日', 'deliveryDate', 'delivery_date', 'date']
const NOTE_ALIASES = ['備考', 'メモ', '摘要', '備考欄', 'notes', 'memo', 'remark', 'Kp']

interface Mapping {
  productName: string | null
  quantity:    string | null
  deliveryDate: string | null
  notes:       string | null
}

function pickCol(headers: string[], aliases: string[]): string | null {
  // 完全一致
  for (const h of headers) {
    if (aliases.includes(h)) return h
  }
  // 部分一致
  for (const h of headers) {
    if (aliases.some(a => h.includes(a) || a.includes(h))) return h
  }
  return null
}

async function detectMapping(headers: string[], sampleRows: Record<string, string>[]): Promise<Mapping> {
  const fallback: Mapping = {
    productName:  pickCol(headers, NAME_ALIASES),
    quantity:     pickCol(headers, QTY_ALIASES),
    deliveryDate: pickCol(headers, DATE_ALIASES),
    notes:        pickCol(headers, NOTE_ALIASES),
  }

  // 3項目揃っていればAI不要
  if (fallback.productName && fallback.quantity && fallback.deliveryDate) return fallback

  // AI判定（APIキーがある場合のみ）
  if (!process.env.ANTHROPIC_API_KEY) return fallback
  try {
    const sample = sampleRows.slice(0, 3)
      .map(r => headers.map(h => `${h}: ${r[h] ?? ''}`).join(' | ')).join('\n')

    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `以下のCSVのヘッダーとサンプルデータを見て、商品名・数量・納期・備考に対応するカラム名をJSONで返してください。
カラムが見つからない場合はnullにしてください。

ヘッダー: ${headers.join(', ')}
サンプル:
${sample}

JSON形式のみ（余計な説明不要）:
{"productName":"カラム名またはnull","quantity":"カラム名またはnull","deliveryDate":"カラム名またはnull","notes":"カラム名またはnull"}`
      }]
    })
    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    const match = text.match(/\{[\s\S]*?\}/)
    if (match) {
      const parsed = JSON.parse(match[0]) as Mapping
      return {
        productName:  (parsed.productName  && headers.includes(parsed.productName))  ? parsed.productName  : fallback.productName,
        quantity:     (parsed.quantity     && headers.includes(parsed.quantity))     ? parsed.quantity     : fallback.quantity,
        deliveryDate: (parsed.deliveryDate && headers.includes(parsed.deliveryDate)) ? parsed.deliveryDate : fallback.deliveryDate,
        notes:        (parsed.notes        && headers.includes(parsed.notes))        ? parsed.notes        : fallback.notes,
      }
    }
  } catch (e) {
    console.error('AI mapping error:', e)
  }
  return fallback
}

// ========== メインハンドラ ==========
export async function POST(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'CSVファイルが必要です' }, { status: 400 })

    // エンコード自動判定（UTF-8 / Shift-JIS）
    const buffer = await file.arrayBuffer()
    const text = decodeBuffer(buffer)

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
    } catch (e) {
      return NextResponse.json({ error: `CSVの解析に失敗しました: ${String(e)}` }, { status: 400 })
    }

    if (records.length === 0) {
      return NextResponse.json({ error: 'CSVにデータが見つかりませんでした' }, { status: 400 })
    }

    const headers = Object.keys(records[0])
    const mapping = await detectMapping(headers, records.slice(0, 5))

    if (!mapping.productName || !mapping.quantity || !mapping.deliveryDate) {
      return NextResponse.json({
        error: 'カラムの自動判定に失敗しました',
        detectedHeaders: headers,
        detectedMapping: mapping,
        hint: '商品名・数量・納期に相当するカラム名がヘッダー行に含まれているか確認してください',
      }, { status: 400 })
    }

    // 全行を変換
    const toSave: {
      productName: string; quantity: number; deliveryDate: Date
      status: 'PENDING'; sourceType: 'CSV'; notes: string | null; companyId: string
    }[] = []
    const errors: { row: number; error: string }[] = []
    const preview: { productName: string; quantity: number; deliveryDate: string }[] = []

    for (let i = 0; i < records.length; i++) {
      const row = records[i]
      try {
        const productName  = (row[mapping.productName!] ?? '').trim()
        const quantityRaw  = (row[mapping.quantity!] ?? '').trim().replace(/[,，,]/g, '')
        const dateRaw      = (row[mapping.deliveryDate!] ?? '').trim()
        const notes        = mapping.notes ? (row[mapping.notes] ?? '').trim() || null : null

        // 未定・空欄の納期はスキップ
        if (SKIP_DATE_VALUES.includes(dateRaw)) {
          errors.push({ row: i + 2, error: `納期未定のためスキップ: ${productName || '(商品名なし)'}` })
          continue
        }

        if (!productName) {
          errors.push({ row: i + 2, error: '商品名が空欄のためスキップ' })
          continue
        }

        const quantity = parseInt(quantityRaw)
        if (isNaN(quantity) || quantity <= 0) {
          errors.push({ row: i + 2, error: `数量が不正: "${quantityRaw}" (${productName})` })
          continue
        }

        const deliveryDate = parseDate(dateRaw)
        if (!deliveryDate) {
          errors.push({ row: i + 2, error: `日付形式が不正: "${dateRaw}" (${productName})` })
          continue
        }

        toSave.push({
          productName, quantity, deliveryDate,
          status: 'PENDING', sourceType: 'CSV',
          notes, companyId: user.companyId,
        })
        if (preview.length < 5) preview.push({ productName, quantity, deliveryDate: dateRaw })
      } catch {
        errors.push({ row: i + 2, error: '解析エラー' })
      }
    }

    if (toSave.length === 0) {
      return NextResponse.json({
        error: '有効なデータが見つかりませんでした（全行スキップ）',
        detectedMapping: mapping,
        errors: errors.slice(0, 20),
      }, { status: 400 })
    }

    // 100件ずつバッチ保存
    for (let i = 0; i < toSave.length; i += 100) {
      await prisma.delivery.createMany({ data: toSave.slice(i, i + 100) })
    }

    return NextResponse.json({
      imported: toSave.length,
      skipped:  errors.length,
      preview,
      mapping,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'CSVの処理中にエラーが発生しました' }, { status: 500 })
  }
}
