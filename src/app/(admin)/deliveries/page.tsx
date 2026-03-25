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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Search, Building2 } from 'lucide-react'
import { toast } from 'sonner'

interface Delivery {
  id: string
  productName: string
  quantity: number
  deliveryDate: string
  status: string
  notes?: string
  sourceType: string
  supplierName?: string
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: '未処理',
  SHIPPED: '出荷済み',
  DELIVERED: '納品済み',
  DELAYED: '遅延',
  CANCELLED: 'キャンセル',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  SHIPPED: 'default',
  DELIVERED: 'outline',
  DELAYED: 'destructive',
  CANCELLED: 'secondary',
}

const STATUS_FILTERS = [
  { value: 'ALL', label: '全て' },
  { value: 'PENDING', label: '未処理' },
  { value: 'SHIPPED', label: '出荷済み' },
  { value: 'DELIVERED', label: '納品済み' },
  { value: 'CANCELLED', label: 'キャンセル' },
]

const emptyForm = {
  productName: '',
  quantity: '',
  deliveryDate: '',
  status: 'PENDING',
  notes: '',
  supplierName: '',
}

export default function DeliveriesPage() {
  const { isAdmin } = useAuth()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Delivery | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // 一括削除
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // 取引先リスト
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

  const openCreate = () => {
    setEditTarget(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (d: Delivery) => {
    setEditTarget(d)
    setForm({
      productName: d.productName,
      quantity: String(d.quantity),
      deliveryDate: d.deliveryDate.split('T')[0],
      status: d.status,
      notes: d.notes ?? '',
      supplierName: d.supplierName ?? '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.productName || !form.quantity || !form.deliveryDate) {
      toast.error('必須項目を入力してください')
      return
    }
    setSaving(true)
    try {
      const body = {
        productName: form.productName,
        quantity: parseInt(form.quantity),
        deliveryDate: form.deliveryDate,
        status: form.status,
        notes: form.notes || null,
        supplierName: form.supplierName || null,
        sourceType: 'MANUAL',
      }
      if (editTarget) {
        await apiFetch(`/api/mobile/deliveries/${editTarget.id}`, {
          method: 'PUT', body, headers: authHeaders(),
        })
        toast.success('更新しました')
      } else {
        await apiFetch('/api/mobile/deliveries', {
          method: 'POST', body, headers: authHeaders(),
        })
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
      await apiFetch(`/api/mobile/deliveries/${id}`, {
        method: 'DELETE', headers: authHeaders(),
      })
      toast.success('削除しました')
      setDeleteId(null)
      fetchDeliveries()
    } catch {
      toast.error('削除に失敗しました')
    }
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
    } catch {
      toast.error('削除に失敗しました')
    } finally {
      setBulkDeleting(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(d => d.id)))
    }
  }

  const filtered = deliveries.filter(d => {
    const term = searchTerm.toLowerCase()
    const matchSearch = !term ||
      d.productName.toLowerCase().includes(term) ||
      (d.notes ?? '').toLowerCase().includes(term) ||
      (d.supplierName ?? '').toLowerCase().includes(term)
    const matchStatus = statusFilter === 'ALL' || d.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#102A43]">入荷管理</h1>
        <div className="flex items-center gap-2">
          {isAdmin && selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {selectedIds.size}件を削除
            </Button>
          )}
          <Button onClick={openCreate} className="bg-[#102A43] hover:bg-[#1a3a5c]">
            <Plus className="h-4 w-4 mr-2" />新規追加
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

      {/* ステータスフィルター */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setSelectedIds(new Set()) }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-[#102A43] text-white'
                : 'bg-gray-100 text-[#64748B] hover:bg-gray-200'
            }`}
          >
            {f.label}
            <span className="ml-1.5 text-xs opacity-70">
              {f.value === 'ALL' ? deliveries.length : deliveries.filter(d => d.status === f.value).length}
            </span>
          </button>
        ))}
        {isAdmin && filtered.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="ml-auto px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-[#64748B] hover:bg-gray-200"
          >
            {selectedIds.size === filtered.length ? '全選択解除' : '全選択'}
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
          {filtered.map(d => (
            <Card
              key={d.id}
              className={`transition-all ${selectedIds.has(d.id) ? 'ring-2 ring-[#102A43] bg-blue-50/30' : 'hover:shadow-md'}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* チェックボックス（管理者のみ） */}
                  {isAdmin && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.id)}
                      onChange={() => toggleSelect(d.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 accent-[#102A43] shrink-0 cursor-pointer"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-[#102A43]">{d.productName}</h3>
                      <Badge variant={STATUS_VARIANT[d.status] ?? 'secondary'}>
                        {STATUS_LABEL[d.status] ?? d.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-[#64748B]">
                      <span>数量: {d.quantity}個</span>
                      <span>納期: {new Date(d.deliveryDate).toLocaleDateString('ja-JP')}</span>
                      {d.supplierName && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{d.supplierName}
                        </span>
                      )}
                    </div>
                    {d.notes && (
                      <p className="mt-1 text-xs text-[#64748B] truncate">{d.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteId(d.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 作成・編集ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? '入荷情報を編集' : '新規入荷を追加'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>商品名 *</Label>
              <Input
                placeholder="商品名を入力"
                value={form.productName}
                onChange={e => setForm(f => ({ ...f, productName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>取引先</Label>
              <Input
                list="supplier-datalist"
                placeholder="取引先名を入力または選択"
                value={form.supplierName}
                onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))}
              />
              <datalist id="supplier-datalist">
                {suppliers.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label>数量 *</Label>
              <Input
                type="number"
                placeholder="数量"
                min="1"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>納期 *</Label>
              <Input
                type="date"
                value={form.deliveryDate}
                onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>ステータス</Label>
              <Select value={form.status} onValueChange={val => setForm(f => ({ ...f, status: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">未処理</SelectItem>
                  <SelectItem value="SHIPPED">出荷済み</SelectItem>
                  <SelectItem value="DELIVERED">納品済み</SelectItem>
                  <SelectItem value="DELAYED">遅延</SelectItem>
                  <SelectItem value="CANCELLED">キャンセル</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>備考</Label>
              <Textarea
                placeholder="備考（任意）"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
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

      {/* 単体削除確認 */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>削除の確認</DialogTitle></DialogHeader>
          <p className="text-[#64748B]">このデータを削除してもよろしいですか？</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>削除する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 一括削除確認 */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>一括削除の確認</DialogTitle></DialogHeader>
          <p className="text-[#64748B]">選択した <span className="font-bold text-red-600">{selectedIds.size}件</span> を削除します。この操作は元に戻せません。</p>
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
