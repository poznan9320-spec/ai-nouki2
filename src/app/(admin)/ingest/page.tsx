'use client'
import { useState, useRef } from 'react'
import axios from 'axios'
import { authHeaders } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, Image, Check, Plus } from 'lucide-react'
import { toast } from 'sonner'

interface ImportedItem {
  productName: string
  quantity: number
  deliveryDate: string
}

export default function IngestPage() {
  // OCR / text tab
  const [ocrFile, setOcrFile] = useState<File | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResults, setOcrResults] = useState<ImportedItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // CSV tab
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvLoading, setCsvLoading] = useState(false)
  const [csvResults, setCsvResults] = useState<ImportedItem[]>([])

  // Saving
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set())

  const handleOcrSubmit = async () => {
    if (!ocrFile && !ocrText.trim()) {
      toast.error('画像またはテキストを入力してください')
      return
    }
    setOcrLoading(true)
    setOcrResults([])
    try {
      const formData = new FormData()
      if (ocrFile) formData.append('image', ocrFile)
      if (ocrText.trim()) formData.append('text', ocrText.trim())
      const res = await axios.post('/api/ingest/ocr', formData, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' }
      })
      const items: ImportedItem[] = res.data.items || []
      setOcrResults(items)
      toast.success(`${items.length}件のデータを取込みました`)
    } catch {
      toast.error('OCR処理に失敗しました')
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
    setCsvResults([])
    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      const res = await axios.post('/api/ingest/csv', formData, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' }
      })
      const items: ImportedItem[] = res.data.items || []
      setCsvResults(items)
      toast.success(`${items.length}件のデータを取込みました`)
    } catch {
      toast.error('CSV処理に失敗しました')
    } finally {
      setCsvLoading(false)
    }
  }

  const saveItem = async (item: ImportedItem, index: number) => {
    setSavingIds(s => new Set(s).add(index))
    try {
      await axios.post('/api/mobile/deliveries', {
        productName: item.productName,
        quantity: item.quantity,
        deliveryDate: item.deliveryDate,
      }, { headers: authHeaders() })
      setSavedIds(s => new Set(s).add(index))
      toast.success(`${item.productName} を保存しました`)
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSavingIds(s => { const n = new Set(s); n.delete(index); return n })
    }
  }

  const renderResults = (items: ImportedItem[], prefix: string) => {
    if (items.length === 0) return null
    return (
      <div className="mt-4 space-y-3">
        <h3 className="font-semibold text-[#102A43]">取込結果 ({items.length}件)</h3>
        {items.map((item, i) => {
          const key = prefix === 'ocr' ? i : 1000 + i
          const isSaving = savingIds.has(key)
          const isSaved = savedIds.has(key)
          return (
            <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-[#102A43]">{item.productName}</p>
                <p className="text-sm text-[#64748B]">
                  数量: {item.quantity}個 | 納期: {item.deliveryDate}
                </p>
              </div>
              {isSaved ? (
                <Badge variant="outline" className="text-green-600 border-green-300">
                  <Check className="h-3 w-3 mr-1" />
                  保存済
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveItem(item, key)}
                  disabled={isSaving}
                  className="shrink-0"
                >
                  {isSaving ? '保存中...' : (
                    <>
                      <Plus className="h-3 w-3 mr-1" />
                      保存
                    </>
                  )}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    )
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
            <Image className="h-4 w-4" />
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
                納品書の画像をアップロード、またはテキストを貼り付けてAIで解析します
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
                      <p className="text-xs mt-1">PNG, JPG, GIF 対応</p>
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
                  placeholder="納品書のテキストを貼り付けてください..."
                  rows={6}
                  value={ocrText}
                  onChange={e => setOcrText(e.target.value)}
                />
              </div>

              <Button
                onClick={handleOcrSubmit}
                disabled={ocrLoading}
                className="w-full bg-[#102A43] hover:bg-[#1a3a5c]"
              >
                {ocrLoading ? '解析中...' : 'AIで解析する'}
              </Button>

              {renderResults(ocrResults, 'ocr')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="csv">
          <Card>
            <CardHeader>
              <CardTitle>CSV取込</CardTitle>
              <CardDescription>
                CSVファイルをアップロードして入荷データを一括取込します
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-medium">CSVフォーマット:</p>
                <p className="mt-1 font-mono text-xs">商品名,数量,納期(YYYY-MM-DD)</p>
                <p className="font-mono text-xs">例: りんご,100,2026-04-01</p>
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

              {renderResults(csvResults, 'csv')}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
