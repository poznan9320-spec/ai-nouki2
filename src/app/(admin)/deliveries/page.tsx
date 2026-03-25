'use client'
import { useState, useEffect } from 'react'
import { authHeaders } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Search, Building2, Calendar } from 'lucide-react'
import { toast } from 'sonner'

interface Delivery {
  id: string
  productName: string
  quantity: number
  deliveryDate: string
  notes?: string
  supplierName?: string
}

const emptyForm = {
  productName: '',
  quantity: '',
  deliveryDate: '',
  notes: '',
  supplierName: '',
}

// 日付を "YYYY年MM月DD日（曜日）" 形式に
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })
}

// 今日・明日・今週などのラベル
function dateLabel(iso: string): string | null {
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(iso); d.setHours(0,0,0,0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return '今日'
  if (diff === 1) return '明日'
  if (diff <= 7) return `${diff}日後`
  return null
}

export default function DeliveriesPage() {
  const { isAdmin } = useAuth()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showPast, setShowPast] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Delivery | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [suppliers, setSuppliers] = useState<string[]>([])

  useEffect(() => {
    fetchDeliveries()
    fetch('/api/mobile/suppliers', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then((data: { name: string }[]) => setSuppliers(data.map(s => s.name)))
      .catch(() => {})
  }, [])

  const fetchDeliveries = async () => {
    setLoading(true)
    try {
      const data = await apiFetch<Delivery[]>('/api/mobile/deliveries', { headers: authHeaders() })
      setDeliveries(data)
    } catch {
      toast.error('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => { setEditTarget(null); setForm(emptyForm); setDialogOpen(true) }
  const openEdit = (d: Delivery) => {
    setEditTarget(d)
    setForm({
      productName: d.productName,
      quantity: String(d.quantity),
      deliveryDate: d.deliveryDate.split('T')[0],
      notes: d.notes ?? '',
      supplierName: d.supplierName ?? '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.productName || !form.quantity || !form.deliveryDate) {
      toast.error('必須項目を入力してください'); return
    }
    setSaving(true)
    try {
      const body = {
        productName: form.productName,
        quantity: parseInt(form.quantity),
        deliveryDate: form.deliveryDate,
        status: 'PENDING',
        notes: form.notes || null,
        supplierName: form.supplierName || null,
        sourceType: 'MANUAL',
      }
      if (editTarget) {
        await apiFetch(`/api/mobile/deliveries/${editTarget.id}`, { method: 'PUT', body, headers: authHeaders() })
        toast.success('更新しました')
      } else {
        await apiFetch('/api/mobile/deliveries', { method: 'POST', body, headers: authHeaders() })
        toast.success('追加しました')
      }
      setDialogOpen(false)
      fetchDeliveries()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/mobile/deliveries/${id}`, { method: 'DELETE', headers: authHeaders() })
      toast.success('削除しました')
      setDeleteId(null)
      fetchDeliveries()
    } catch { toast.error('削除に失敗しました') }
  }

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    try {
      const res = await fetch('/api/mobile/deliveries', {
        method: 'DELETE',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)
      toast.success(`${data.deleted}件を削除しました`)
      setSelectedIds(new Set())
      setBulkDeleteOpen(false)
      fetchDeliveries()
    } catch { toast.error('削除に失敗しました') }
    finally { setBulkDeleting(false) }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const today = new Date(); today.setHours(0,0,0,0)

  const filtered = deliveries.filter(d => {
    const term = searchTerm.toLowerCase()
    const matchSearch = !term ||
      d.productName.toLowerCase().includes(term) ||
      (d.notes ?? '').toLowerCase().includes(term) ||
      (d.supplierName ?? '').toLowerCase().includes(term)
    const dDate = new Date(d.deliveryDate); dDate.setHours(0,0,0,0)
    const matchDate = showPast ? true : dDate >= today
    return matchSearch && matchDate
  })

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#102A43]">納期スケジュール</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{filtered.length}件</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1" />{selectedIds.size}件を削除
            </Button>
          )}
          <Button onClick={openCreate} className="bg-[#102A43] hover:bg-[#1a3a5c]">
            <Plus className="h-4 w-4 mr-2" />追加
          </Button>
        </div>
      </div>

      {/* 検索 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="商品名・取引先・備考で検索..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* 過去データ表示切替 + 全選択 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setShowPast(v => !v); setSelectedIds(new Set()) }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            showPast ? 'bg-[#102A43] text-white' : 'bg-gray-100 text-[#64748B] hover:bg-gray-200'
          }`}
        >
          <Calendar className="h-3.5 w-3.5 inline mr-1" />
          {showPast ? '全期間表示中' : '今日以降のみ'}
        </button>
        {isAdmin && filtered.length > 0 && (
          <button
            onClick={() => setSelectedIds(allSelected ? new Set() : new Set(filtered.map(d => d.id)))}
            className="ml-auto px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-[#64748B] hover:bg-gray-200"
          >
            {allSelected ? '全選択解除' : '全選択'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[#102A43] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-[#64748B]">データがありません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => {
            const label = dateLabel(d.deliveryDate)
            const isPast = new Date(d.deliveryDate).setHours(0,0,0,0) < today.getTime()
            return (
              <Card
                key={d.id}
                className={`transition-all ${selectedIds.has(d.id) ? 'ring-2 ring-[#102A43] bg-blue-50/30' : 'hover:shadow-sm'} ${isPast ? 'opacity-50' : ''}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    {isAdmin && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d.id)}
                        onChange={() => toggleSelect(d.id)}
                        className="h-4 w-4 rounded border-gray-300 accent-[#102A43] shrink-0 cursor-pointer"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[#102A43]">{d.productName}</span>
                        {label && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            label === '今日' ? 'bg-orange-100 text-orange-700' :
                            label === '明日' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-50 text-blue-600'
                          }`}>{label}</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-[#64748B]">
                        <span>{fmtDate(d.deliveryDate)}</span>
                        <span>{d.quantity}個</span>
                        {d.supplierName && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />{d.supplierName}
                          </span>
                        )}
                      </div>
                      {d.notes && <p className="mt-0.5 text-xs text-[#64748B] truncate">{d.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteId(d.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* 追加・編集ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? '納期を編集' : '納期を追加'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>商品名 *</Label>
              <Input placeholder="商品名" value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>取引先</Label>
              <Input list="dl-supplier" placeholder="取引先名を入力または選択" value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} />
              <datalist id="dl-supplier">{suppliers.map(s => <option key={s} value={s} />)}</datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>数量 *</Label>
                <Input type="number" min="1" placeholder="数量" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>納期 *</Label>
                <Input type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>備考</Label>
              <Textarea placeholder="備考（任意）" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#102A43] hover:bg-[#1a3a5c]">
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 単体削除 */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>削除の確認</DialogTitle></DialogHeader>
          <p className="text-[#64748B]">このデータを削除しますか？</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>削除する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 一括削除 */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>一括削除の確認</DialogTitle></DialogHeader>
          <p className="text-[#64748B]">選択した <span className="font-bold text-red-600">{selectedIds.size}件</span> を削除します。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>キャンセル</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? '削除中...' : `${selectedIds.size}件を削除`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
