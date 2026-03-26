'use client'
import { useState, useRef, useEffect } from 'react'
import { authHeaders } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, ImageIcon, Check, AlertTriangle, Info, Building2 } from 'lucide-react'
import { toast } from 'sonner'

interface ImportedItem {
  productName: string
  quantity: number
  deliveryDate: string
  notes?: string
}

interface CsvResult {
  imported: number
  skipped: number
  preview: { productName: string; quantity: number; deliveryDate: string }[]
  mapping: { productName: string | null; quantity: string | null; deliveryDate: string | null; notes: string | null }
}

export default function IngestPage() {
  // OCR tab
  const [ocrFile, setOcrFile] = useState<File | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResults, setOcrResults] = useState<ImportedItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // CSV tab
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvLoading, setCsvLoading] = useState(false)
  const [csvResult, setCsvResult] = useState<CsvResult | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)

  // 取引先
  const [supplierName, setSupplierName] = useState('')
  const [suppliers, setSuppliers] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/mobile/suppliers', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then((data: { name: string }[]) => setSuppliers(data.map(s => s.name)))
      .catch(() => {})
  }, [])

  const handleOcrSubmit = async () => {
    if (!ocrFile && !ocrText.trim()) {
      toast.error('画像またはテキストを入力してください')
      return
    }
    setOcrLoading(true)
    setOcrResults([])
    try {
      const formData = new FormData()
      if (ocrFile) formData.append('file', ocrFile)
      if (ocrText.trim()) formData.append('text', ocrText.trim())
      if (supplierName.trim()) formData.append('supplierName', supplierName.trim())

      const h = { ...authHeaders() }
      delete h['Content-Type']

      const res = await fetch('/api/ingest/ocr', { method: 'POST', headers: h, body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'OCR処理に失敗しました')

      const items: ImportedItem[] = data.items ?? []
      setOcrResults(items)
      toast.success(`${items.length}件のデータをDBに登録しました`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'OCR処理に失敗しました')
    } finally {
      setOcrLoading(false)
    }
  }

  const handleCsvSubmit = async () => {
    if (!csvFile) { toast.error('CSVファイルを選択してください'); return }
    setCsvLoading(true)
    setCsvResult(null)
    setCsvError(null)
    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      if (supplierName.trim()) formData.append('supplierName', supplierName.trim())

      const h = { ...authHeaders() }
      delete h['Content-Type']

      const res = await fetch('/api/ingest/csv', { method: 'POST', headers: h, body: formData })
      const data = await res.json()

      if (!res.ok) {
        // エラー詳細を表示
        const detail = data.detectedHeaders
          ? `\n検出されたヘッダー: ${data.detectedHeaders.join(', ')}\n${data.hint ?? ''}`
          : ''
        setCsvError((data.error ?? 'エラーが発生しました') + detail)
        if (data.errors?.length > 0) {
          console.error('CSV errors:', data.errors)
        }
        return
      }

      setCsvResult(data as CsvResult)
      toast.success(`${data.imported}件を登録しました`)
    } catch (err: unknown) {
      setCsvError(err instanceof Error ? err.message : 'CSV処理に失敗しました')
    } finally {
      setCsvLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[#102A43]">データ取込</h1>
        <p className="text-[#64748B] mt-1">画像、テキスト、またはCSVから入荷データを取込みます</p>
      </div>

      <Tabs defaultValue="csv">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="csv" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            CSV取込
          </TabsTrigger>
          <TabsTrigger value="ocr" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            OCR / テキスト
          </TabsTrigger>
        </TabsList>

        {/* CSV tab */}
        <TabsContent value="csv">
          <Card>
            <CardHeader>
              <CardTitle>CSV取込</CardTitle>
              <CardDescription>
                どんな会社のCSVフォーマットにも自動対応します（AIがカラムを自動判定）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Format hint */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 space-y-1">
                <p className="font-medium flex items-center gap-1">
                  <Info className="h-4 w-4" />
                  対応フォーマット（ヘッダー行が必要）
                </p>
                <p className="font-mono text-xs">英語例: productName, quantity, deliveryDate</p>
                <p className="font-mono text-xs">日本語例: 商品名, 数量, 納期</p>
                <p className="font-mono text-xs">その他: 品名, 品目名, 品番 / 発注数, 個数 / 回答納期, 納入日</p>
                <p className="text-xs mt-1">対応エンコード: UTF-8, Shift-JIS（Excel CSV）｜ 対応日付: YYYY-MM-DD, YYYY/MM/DD, YYYY年MM月DD日</p>
              </div>

              {/* 取引先 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  取引先（任意）
                </Label>
                <Input
                  list="supplier-list"
                  placeholder="取引先名を入力または選択"
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                />
                <datalist id="supplier-list">
                  {suppliers.map(s => <option key={s} value={s} />)}
                </datalist>
                {suppliers.length > 0 && (
                  <p className="text-xs text-[#64748B]">登録済み取引先から選択、または直接入力できます</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>CSVファイル（1000件以上も対応）</Label>
                <Input
                  type="file"
                  accept=".csv,.txt"
                  onChange={e => {
                    setCsvFile(e.target.files?.[0] ?? null)
                    setCsvResult(null)
                    setCsvError(null)
                  }}
                />
                {csvFile && (
                  <p className="text-xs text-[#64748B]">
                    選択: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <Button
                onClick={handleCsvSubmit}
                disabled={csvLoading || !csvFile}
                className="w-full bg-[#102A43] hover:bg-[#1a3a5c]"
              >
                {csvLoading ? 'AI解析・登録中...' : 'CSVを取込む'}
              </Button>

              {/* Error display */}
              {csvError && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800 text-sm">取込エラー</p>
                      <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap">{csvError}</pre>
                      <p className="text-xs text-red-500 mt-2">
                        CSVのヘッダー行に「商品名」「数量」「納期」（または英語名）が含まれているか確認してください
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Success display */}
              {csvResult && (
                <div className="mt-4 space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-5 w-5 text-green-600" />
                      <p className="font-semibold text-green-800">
                        {csvResult.imported}件を登録しました
                        {csvResult.skipped > 0 && (
                          <span className="text-orange-600 ml-2">（{csvResult.skipped}件スキップ）</span>
                        )}
                      </p>
                    </div>
                    {csvResult.mapping && (
                      <div className="text-xs text-green-700 space-y-0.5">
                        <p>AI判定カラム:</p>
                        <p>商品名 ← <code className="bg-green-100 px-1 rounded">{csvResult.mapping.productName}</code></p>
                        <p>数量 ← <code className="bg-green-100 px-1 rounded">{csvResult.mapping.quantity}</code></p>
                        <p>納期 ← <code className="bg-green-100 px-1 rounded">{csvResult.mapping.deliveryDate}</code></p>
                        {csvResult.mapping.notes && (
                          <p>備考 ← <code className="bg-green-100 px-1 rounded">{csvResult.mapping.notes}</code></p>
                        )}
                      </div>
                    )}
                  </div>

                  {csvResult.preview.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-[#102A43] mb-2">登録データのサンプル（最大5件）</p>
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-3 py-2 text-[#64748B] font-medium">商品名</th>
                              <th className="text-right px-3 py-2 text-[#64748B] font-medium">数量</th>
                              <th className="text-left px-3 py-2 text-[#64748B] font-medium">納期</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvResult.preview.map((row, i) => (
                              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-3 py-2 text-[#102A43]">{row.productName}</td>
                                <td className="px-3 py-2 text-right">{row.quantity.toLocaleString()}</td>
                                <td className="px-3 py-2 text-[#64748B]">{row.deliveryDate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* OCR tab */}
        <TabsContent value="ocr">
          <Card>
            <CardHeader>
              <CardTitle>OCR / テキスト取込</CardTitle>
              <CardDescription>
                納品書の画像をアップロード、またはテキストを貼り付けてAIで解析・登録します
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 取引先（OCRタブ） */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  取引先（任意）
                </Label>
                <Input
                  list="supplier-list-ocr"
                  placeholder="取引先名を入力または選択"
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                />
                <datalist id="supplier-list-ocr">
                  {suppliers.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>

              <div className="space-y-2">
                <Label>画像ファイル（任意）</Label>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-[#102A43] transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {ocrFile ? (
                    <div className="flex items-center justify-center gap-2 text-[#102A43]">
                      <Upload className="h-5 w-5" />
                      <span className="text-sm font-medium">{ocrFile.name}</span>
                    </div>
                  ) : (
                    <div className="text-[#64748B]">
                      <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">クリックしてファイルを選択</p>
                      <p className="text-xs mt-1">PNG, JPG, PDF 対応</p>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf,application/pdf" className="hidden"
                    onChange={e => setOcrFile(e.target.files?.[0] ?? null)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>テキスト（任意）</Label>
                <Textarea
                  placeholder="例: 来月5日に部品Aを100個納品してください"
                  rows={5}
                  value={ocrText}
                  onChange={e => setOcrText(e.target.value)}
                />
              </div>

              <Button onClick={handleOcrSubmit} disabled={ocrLoading} className="w-full bg-[#102A43] hover:bg-[#1a3a5c]">
                {ocrLoading ? '解析中...' : 'AIで解析・登録する'}
              </Button>

              {ocrResults.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="h-4 w-4 text-green-600" />
                    <h3 className="font-semibold text-[#102A43]">登録済み ({ocrResults.length}件)</h3>
                  </div>
                  <div className="space-y-2">
                    {ocrResults.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div>
                          <p className="font-medium text-[#102A43]">{item.productName}</p>
                          <p className="text-sm text-[#64748B]">数量: {item.quantity}個 | 納期: {item.deliveryDate}</p>
                          {item.notes && <p className="text-xs text-[#64748B]">{item.notes}</p>}
                        </div>
                        <Badge variant="outline" className="text-green-600 border-green-300 shrink-0">
                          <Check className="h-3 w-3 mr-1" />登録済
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
