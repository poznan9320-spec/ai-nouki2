'use client'
import { useState, useEffect } from 'react'
import { authHeaders } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'

interface Delivery {
  id: string
  productName: string
  quantity: number
  deliveryDate: string
  status: string
  notes?: string
  sourceType: string
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

const emptyForm = {
  productName: '',
  quantity: '',
  deliveryDate: '',
  status: 'PENDING',
  notes: '',
}

export default function DeliveriesPage() {
  const { isAdmin } = useAuth()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Delivery | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

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

  useEffect(() => { fetchDeliveries() }, [])

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
        sourceType: 'MANUAL',
      }
      if (editTarget) {
        await apiFetch(`/api/mobile/deliveries/${editTarget.id}`, {
          method: 'PUT',
          body,
          headers: authHeaders(),
        })
        toast.success('更新しました')
      } else {
        await apiFetch('/api/mobile/deliveries', {
          method: 'POST',
          body,
          headers: authHeaders(),
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
        method: 'DELETE',
        headers: authHeaders(),
      })
      toast.success('削除しました')
      setDeleteId(null)
      fetchDeliveries()
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  const filtered = deliveries.filter(d =>
    d.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.notes ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#102A43]">入荷管理</h1>
        <Button onClick={openCreate} className="bg-[#102A43] hover:bg-[#1a3a5c]">
          <Plus className="h-4 w-4 mr-2" />
          新規追加
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="商品名で検索..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[#102A43] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-[#64748B]">データがありません</p>
            <p className="text-sm text-[#64748B] mt-1">「新規追加」ボタンから入荷情報を登録してください</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => (
            <Card key={d.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-[#102A43]">{d.productName}</h3>
                      <Badge variant={STATUS_VARIANT[d.status] ?? 'secondary'}>
                        {STATUS_LABEL[d.status] ?? d.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#64748B]">
                      <span>数量: {d.quantity}個</span>
                      <span>納期: {new Date(d.deliveryDate).toLocaleDateString('ja-JP')}</span>
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

      {/* Create / Edit Dialog */}
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>削除の確認</DialogTitle>
          </DialogHeader>
          <p className="text-[#64748B]">この入荷データを削除してもよろしいですか？この操作は元に戻せません。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>キャンセル</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
