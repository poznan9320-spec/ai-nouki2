'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { authHeaders } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, Pencil, Trash2, X, Check, Printer, StickyNote } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CalendarItem {
  id: string
  product_name: string
  quantity: number
  status: string
  supplier_name: string | null
  supplier_color: string | null
  notes: string | null
  source_type: string
}

interface Supplier {
  id: string
  name: string
  color: string | null
}

interface CalendarResponse {
  calendar: Record<string, CalendarItem[]>
  suppliers: Supplier[]
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

const STATUS_LABELS: Record<string, string> = {
  PENDING: '未着', SHIPPED: '出荷済', DELIVERED: '着荷', DELAYED: '遅延', CANCELLED: 'キャンセル',
}
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  SHIPPED: 'bg-blue-100 text-blue-800',
  DELIVERED: 'bg-green-100 text-green-800',
  DELAYED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

const DEFAULT_COLORS = ['#ef4444','#3b82f6','#22c55e','#f97316','#a855f7','#ec4899','#14b8a6','#eab308']

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export default function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [calendarData, setCalendarData] = useState<Record<string, CalendarItem[]>>({})
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<CalendarItem | null>(null)
  const [editForm, setEditForm] = useState({
    productName: '', quantity: '', deliveryDate: '', status: '', supplierName: '', notes: ''
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null)
  const [memos, setMemos] = useState<Record<string, string>>({})
  const [editingMemo, setEditingMemo] = useState(false)
  const [memoText, setMemoText] = useState('')
  const [savingMemo, setSavingMemo] = useState(false)
  const memoRef = useRef<HTMLTextAreaElement>(null)

  const fetchCalendar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<CalendarResponse>(
        `/api/mobile/calendar?year=${year}&month=${month}`,
        { headers: authHeaders() }
      )
      setCalendarData(data.calendar)
      setSuppliers(data.suppliers)
      // メモは失敗してもカレンダー本体には影響させない
      try {
        const memoData = await apiFetch<{ memos: Record<string, string> }>(
          `/api/mobile/calendar-memo?year=${year}&month=${month}`,
          { headers: authHeaders() }
        )
        setMemos(memoData.memos)
      } catch {
        // メモ取得失敗は無視
      }
    } catch {
      toast.error('カレンダーデータの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetchCalendar() }, [fetchCalendar])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1)
    setSelectedDate(null)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1)
    setSelectedDate(null)
  }

  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ...Array(totalCells - firstDay - daysInMonth).fill(null),
  ]

  const todayStr = new Date().toISOString().split('T')[0]
  const formatDateKey = (day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const selectedItems = selectedDate ? (calendarData[selectedDate] ?? []) : []

  const supplierColorMap: Record<string, string> = {}
  for (const s of suppliers) {
    if (s.color) supplierColorMap[s.name] = s.color
  }

  const activeSupplierNames = new Set<string>()
  for (const items of Object.values(calendarData)) {
    for (const item of items) {
      if (item.supplier_name) activeSupplierNames.add(item.supplier_name)
    }
  }

  const getColor = (item: CalendarItem) =>
    item.supplier_color
      ?? (item.supplier_name
        ? DEFAULT_COLORS[[...activeSupplierNames].indexOf(item.supplier_name) % DEFAULT_COLORS.length]
        : '#64748B')

  const openEdit = (item: CalendarItem) => {
    setEditItem(item)
    setEditForm({
      productName: item.product_name,
      quantity: String(item.quantity),
      deliveryDate: selectedDate ?? '',
      status: item.status,
      supplierName: item.supplier_name ?? '',
      notes: item.notes ?? '',
    })
  }

  const saveEdit = async () => {
    if (!editItem) return
    setSaving(true)
    try {
      await apiFetch(`/api/mobile/deliveries/${editItem.id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: editForm.productName,
          quantity: parseInt(editForm.quantity) || 1,
          deliveryDate: editForm.deliveryDate,
          status: editForm.status,
          supplierName: editForm.supplierName || null,
          notes: editForm.notes || null,
        }),
      })
      toast.success('更新しました')
      setEditItem(null)
      await fetchCalendar()
    } catch {
      toast.error('更新に失敗しました')
    }
    setSaving(false)
  }

  const deleteDelivery = async () => {
    if (!editItem) return
    if (!confirm('この入荷予定を削除しますか？')) return
    setDeleting(true)
    try {
      await apiFetch(`/api/mobile/deliveries/${editItem.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      toast.success('削除しました')
      setEditItem(null)
      await fetchCalendar()
    } catch {
      toast.error('削除に失敗しました')
    }
    setDeleting(false)
  }

  const updateSupplierColor = async (supplierName: string, color: string) => {
    const supplier = suppliers.find(s => s.name === supplierName)
    if (!supplier) return
    try {
      await apiFetch(`/api/mobile/suppliers/${supplier.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ color }),
      })
      setSuppliers(prev => prev.map(s => s.name === supplierName ? { ...s, color } : s))
      setCalendarData(prev => {
        const next = { ...prev }
        for (const key of Object.keys(next)) {
          next[key] = next[key].map(item =>
            item.supplier_name === supplierName ? { ...item, supplier_color: color } : item
          )
        }
        return next
      })
    } catch {
      toast.error('色の更新に失敗しました')
    }
    setEditingSupplier(null)
  }

  const startMemoEdit = () => {
    setMemoText(selectedDate ? (memos[selectedDate] ?? '') : '')
    setEditingMemo(true)
    setTimeout(() => memoRef.current?.focus(), 50)
  }

  const saveMemo = async () => {
    if (!selectedDate) return
    setSavingMemo(true)
    try {
      await apiFetch('/api/mobile/calendar-memo', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, content: memoText }),
      })
      setMemos(prev => {
        const next = { ...prev }
        if (memoText.trim()) next[selectedDate] = memoText.trim()
        else delete next[selectedDate]
        return next
      })
      setEditingMemo(false)
      toast.success('メモを保存しました')
    } catch {
      toast.error('メモの保存に失敗しました')
    }
    setSavingMemo(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#102A43]">カレンダー</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-[#102A43] min-w-[6rem] text-center">
            {year}年 {MONTHS[month - 1]}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {activeSupplierNames.size > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-[#64748B] font-medium">取引先カラー:</span>
          {[...activeSupplierNames].map((name, i) => {
            const color = supplierColorMap[name] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]
            const isEditing = editingSupplier === name
            return (
              <div key={name} className="flex items-center gap-1">
                {isEditing ? (
                  <div className="flex items-center gap-1 bg-white border rounded-lg px-2 py-1 shadow-sm">
                    <div className="flex gap-1">
                      {DEFAULT_COLORS.map(c => (
                        <button
                          key={c}
                          className="w-5 h-5 rounded-full border-2 border-white shadow hover:scale-110 transition-transform"
                          style={{ background: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
                          onClick={() => updateSupplierColor(name, c)}
                        />
                      ))}
                    </div>
                    <button onClick={() => setEditingSupplier(null)} className="ml-1 text-gray-400 hover:text-gray-600">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingSupplier(name)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
                    <span className="text-[#102A43]">{name}</span>
                    <Pencil className="h-2.5 w-2.5 text-gray-400" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[#102A43] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-3">
                <div className="grid grid-cols-7 gap-0">
                  {WEEKDAYS.map((wd, i) => (
                    <div
                      key={wd}
                      className={cn(
                        'text-center text-xs font-medium py-2',
                        i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-[#64748B]'
                      )}
                    >
                      {wd}
                    </div>
                  ))}
                  {cells.map((day, i) => {
                    if (day === null) return <div key={i} className="aspect-square" />
                    const dateKey = formatDateKey(day)
                    const items = calendarData[dateKey] ?? []
                    const isToday = dateKey === todayStr
                    const isSelected = dateKey === selectedDate
                    const dayOfWeek = (firstDay + day - 1) % 7
                    const hasMemo = !!memos[dateKey]

                    const dayColors: string[] = []
                    const seen = new Set<string>()
                    for (const item of items) {
                      const color = getColor(item)
                      if (!seen.has(color)) { seen.add(color); dayColors.push(color) }
                    }
                    const primaryColor = dayColors[0]

                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                        className={cn(
                          'aspect-square p-1 flex flex-col items-center rounded-lg transition-all text-xs border relative',
                          isSelected
                            ? 'bg-[#102A43] text-white border-[#102A43] shadow-md'
                            : isToday
                            ? 'bg-blue-50 border-blue-300 text-[#102A43]'
                            : 'border-transparent hover:bg-gray-50',
                          dayOfWeek === 0 && !isSelected ? 'text-red-500' : '',
                          dayOfWeek === 6 && !isSelected ? 'text-blue-500' : '',
                        )}
                        style={
                          !isSelected && !isToday && primaryColor
                            ? { backgroundColor: hexToRgba(primaryColor, 0.12), borderColor: hexToRgba(primaryColor, 0.35), borderWidth: 1 }
                            : undefined
                        }
                      >
                        <span className="font-medium leading-none">{day}</span>
                        {dayColors.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5 w-full px-0.5 justify-center">
                            {dayColors.slice(0, 4).map((c, ci) => (
                              <span
                                key={ci}
                                className="h-1.5 flex-1 rounded-full inline-block"
                                style={{ background: isSelected ? 'rgba(255,255,255,0.6)' : c, maxWidth: 14 }}
                              />
                            ))}
                          </div>
                        )}
                        {items.length > 0 && (
                          <span className={cn(
                            'text-[9px] leading-none mt-0.5',
                            isSelected ? 'text-white/70' : 'text-gray-500 font-medium'
                          )}>
                            {items.length}件
                          </span>
                        )}
                        {hasMemo && (
                          <span className={cn(
                            'absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full',
                            isSelected ? 'bg-yellow-300' : 'bg-yellow-400'
                          )} />
                        )}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="h-full">
              <CardContent className="p-4">
                {selectedDate ? (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-[#102A43]">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ja-JP', {
                        month: 'long', day: 'numeric', weekday: 'short'
                      })}
                    </h3>

                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-yellow-700 flex items-center gap-1">
                          <StickyNote className="h-3 w-3" />
                          メモ
                        </span>
                        {!editingMemo && (
                          <button
                            onClick={startMemoEdit}
                            className="text-xs text-yellow-600 hover:text-yellow-800 flex items-center gap-0.5"
                          >
                            <Pencil className="h-3 w-3" />
                            {memos[selectedDate] ? '編集' : '追加'}
                          </button>
                        )}
                      </div>
                      {editingMemo ? (
                        <div className="space-y-2">
                          <Textarea
                            ref={memoRef}
                            value={memoText}
                            onChange={e => setMemoText(e.target.value)}
                            placeholder="この日のメモを入力..."
                            rows={3}
                            className="text-xs bg-white border-yellow-300 focus:border-yellow-400 resize-none"
                          />
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2"
                              onClick={() => setEditingMemo(false)}
                              disabled={savingMemo}
                            >
                              キャンセル
                            </Button>
                            <Button
                              size="sm"
                              className="h-6 text-xs px-2 bg-yellow-500 hover:bg-yellow-600 text-white"
                              onClick={saveMemo}
                              disabled={savingMemo}
                            >
                              <Check className="h-3 w-3 mr-0.5" />
                              {savingMemo ? '保存中...' : '保存'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-yellow-800 whitespace-pre-wrap min-h-4">
                          {memos[selectedDate] || <span className="text-yellow-400 italic">メモなし</span>}
                        </p>
                      )}
                    </div>

                    {selectedItems.length === 0 ? (
                      <p className="text-sm text-[#64748B]">入荷予定なし</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedItems.map((item) => {
                          const color = getColor(item)
                          return (
                            <div
                              key={item.id}
                              className="p-3 bg-gray-50 rounded-lg border-l-4 group"
                              style={{ borderLeftColor: color }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-sm font-medium text-[#102A43] truncate">{item.product_name}</p>
                                    {item.source_type === 'FAX' && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
                                        <Printer className="h-2.5 w-2.5" />FAX
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-[#64748B]">{item.quantity}個</p>
                                  {item.supplier_name && (
                                    <p className="text-xs text-[#64748B] flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                                      {item.supplier_name}
                                    </p>
                                  )}
                                  <span className={cn(
                                    'inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded font-medium',
                                    STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-500'
                                  )}>
                                    {STATUS_LABELS[item.status] ?? item.status}
                                  </span>
                                  {item.notes && (
                                    <p className="text-xs text-[#64748B] mt-1 bg-yellow-50 rounded px-1.5 py-1 border border-yellow-100">
                                      {item.notes}
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={() => openEdit(item)}
                                  className="shrink-0 p-1.5 rounded hover:bg-gray-200 transition-colors"
                                  title="編集"
                                >
                                  <Pencil className="h-3.5 w-3.5 text-gray-500" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                      <ChevronLeft className="h-4 w-4 text-gray-300 rotate-180" />
                    </div>
                    <p className="text-sm text-[#64748B]">日付を選択すると<br />入荷予定を確認できます</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Dialog open={!!editItem} onOpenChange={(open) => { if (!open) setEditItem(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>入荷予定を編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="productName">商品名</Label>
              <Input
                id="productName"
                value={editForm.productName}
                onChange={e => setEditForm(f => ({ ...f, productName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="quantity">数量</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={editForm.quantity}
                  onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="deliveryDate">納品日</Label>
                <Input
                  id="deliveryDate"
                  type="date"
                  value={editForm.deliveryDate}
                  onChange={e => setEditForm(f => ({ ...f, deliveryDate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="status">ステータス</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="supplierName">取引先</Label>
              <Input
                id="supplierName"
                value={editForm.supplierName}
                placeholder="例: A社"
                onChange={e => setEditForm(f => ({ ...f, supplierName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="notes">メモ</Label>
              <Textarea
                id="notes"
                value={editForm.notes}
                placeholder="備考・メモを入力"
                rows={3}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteDelivery}
                disabled={deleting || saving}
                className="flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? '削除中...' : '削除'}
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setEditItem(null)} disabled={saving}>
                キャンセル
              </Button>
              <Button onClick={saveEdit} disabled={saving} className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
