'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { authHeaders } from '@/lib/auth-context'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
}

const emptyForm = {
  productName: '',
  quantity: '',
  deliveryDate: '',
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

  useEffect(() => {
    fetchDeliveries()
  }, [])

  const fetchDeliveries = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/mobile/deliveries', { headers: authHeaders() })
      setDeliveries(res.data)
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
      if (editTarget) {
        await axios.put(`/api/mobile/deliveries/${editTarget.id}`, {
          productName: form.productName,
          quantity: parseInt(form.quantity),
          deliveryDate: form.deliveryDate,
          notes: form.notes || null,
        }, { headers: authHeaders() })
        toast.success('更新しました')
      } else {
        await axios.post('/api/mobile/deliveries', {
          productName: form.productName,
          quantity: parseInt(form.quantity),
          deliveryDate: form.deliveryDate,
          notes: form.notes || null,
        }, { headers: authHeaders() })
        toast.success('追加しました')
      }
      setDialogOpen(false)
      fetchDeliveries()
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`/api/mobile/deliveries/${id}`, { headers: authHeaders() })
      toast.success('削除しました')
      setDeleteId(null)
      fetchDeliveries()
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      PENDING: '待機中',
      IN_PROGRESS: '進行中',
      COMPLETED: '完了',
      CANCELLED: 'キャンセル',
    }
    return map[status] ?? status
  }

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      PENDING: 'secondary',
      IN_PROGRESS: 'default',
      COMPLETED: 'outline',
      CANCELLED: 'destructive',
    }
    return map[status] ?? 'secondary'
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

      {/* Search */}
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
                      <Badge variant={getStatusVariant(d.status)}>{getStatusLabel(d.status)}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#64748B]">
                      <span>数量: {d.quantity}個</span>
                      <span>納期: {new Date(d.deliveryDate).toLocaleDateString('ja-JP')}</span>
                    </div>
                    {d.notes && (
                      <p className="mt-1 text-xs text-[#64748B] truncate">{d.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(d)}
                    >
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
