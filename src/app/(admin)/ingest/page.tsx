'use client'
import { useState, useRef } from 'react'
import { authHeaders } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, ImageIcon, Check } from 'lucide-react'
import { toast } from 'sonner'

interface ImportedItem {
  productName: string
  quantity: number
  deliveryDate: string
  notes?: string
}

export default function IngestPage() {
  const [ocrFile, setOcrFile] = useState<File | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResults, setOcrResults] = useState<ImportedItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvLoading, setCsvLoading] = useState(false)
  const [csvCount, setCsvCount] = useState<number | null>(null)

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

      const h = { ...authHeaders() }
      delete h['Content-Type'] // Let browser set multipart boundary

      const res = await fetch('/api/ingest/ocr', {
        method: 'POST',
        headers: h,
        body: formData,
      })
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
    if (!csvFile) {
      toast.error('CSVファイルを選択してください')
      return
    }
    setCsvLoading(true)
    setCsvCount(null)
    try {
      const formData = new FormData()
      formData.append('file', csvFile)

      const h = { ...authHeaders() }
      delete h['Content-Type']

      const res = await fetch('/api/ingest/csv', {
        method: 'POST',
        headers: h,
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'CSV処理に失敗しました')

      setCsvCount(data.imported ?? 0)
      toast.success(`${data.imported}件のデータをDBに登録しました`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'CSV処理に失敗しました')
    } finally {
      setCsvLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[#102A43]">データ取込</h1>
        <p className="text-[#64748B] mt-1">画像、テキスト、またはCSVから入荷データを取込みます</p>
      </div>

      <Tabs defaultValue="ocr">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ocr" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            OCR / テキスト
          </TabsTrigger>
          <TabsTrigger value="csv" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            CSV
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ocr">
          <Card>
            <CardHeader>
              <CardTitle>OCR / テキスト取込</CardTitle>
              <CardDescription>
                納品書の画像をアップロード、またはテキストを貼り付けてAIで解析・登録します
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                      <p className="text-sm">クリックして画像を選択</p>
                      <p className="text-xs mt-1">PNG, JPG 対応</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => setOcrFile(e.target.files?.[0] ?? null)}
                  />
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

              <Button
                onClick={handleOcrSubmit}
                disabled={ocrLoading}
                className="w-full bg-[#102A43] hover:bg-[#1a3a5c]"
              >
                {ocrLoading ? '解析中...' : 'AIで解析・登録する'}
              </Button>

              {ocrResults.length > 0 && (
                <div className="mt-4 space-y-3">
                  <h3 className="font-semibold text-[#102A43] flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    登録済み ({ocrResults.length}件)
                  </h3>
                  {ocrResults.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                      <div>
                        <p className="font-medium text-[#102A43]">{item.productName}</p>
                        <p className="text-sm text-[#64748B]">
                          数量: {item.quantity}個 | 納期: {item.deliveryDate}
                        </p>
                        {item.notes && <p className="text-xs text-[#64748B]">{item.notes}</p>}
                      </div>
                      <Badge variant="outline" className="text-green-600 border-green-300 shrink-0">
                        <Check className="h-3 w-3 mr-1" />
                        登録済
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="csv">
          <Card>
            <CardHeader>
              <CardTitle>CSV取込</CardTitle>
              <CardDescription>
                CSVファイルをアップロードして入荷データを一括取込・登録します
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-medium">CSVフォーマット (ヘッダー行必須):</p>
                <p className="mt-1 font-mono text-xs">productName,quantity,deliveryDate</p>
                <p className="font-mono text-xs">部品A,100,2026-04-01</p>
                <p className="mt-1 text-xs">または: 商品名,数量,納期 （日本語ヘッダーも対応）</p>
              </div>

              <div className="space-y-2">
                <Label>CSVファイル</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={e => setCsvFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <Button
                onClick={handleCsvSubmit}
                disabled={csvLoading || !csvFile}
                className="w-full bg-[#102A43] hover:bg-[#1a3a5c]"
              >
                {csvLoading ? '処理中...' : 'CSVを取込む'}
              </Button>

              {csvCount !== null && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200 flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-green-800">{csvCount}件のデータを登録しました</p>
                    <p className="text-sm text-green-600">入荷管理ページで確認できます</p>
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
