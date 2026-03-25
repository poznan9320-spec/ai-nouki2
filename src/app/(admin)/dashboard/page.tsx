'use client'
import { useState, useEffect } from 'react'
import { useAuth, authHeaders } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, Calendar, AlertCircle, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'

interface Delivery {
  id: string
  productName: string
  quantity: number
  deliveryDate: string
  status: string
  notes?: string
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

export default function DashboardPage() {
  const { user } = useAuth()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<Delivery[]>('/api/mobile/deliveries', { headers: authHeaders() })
      .then(data => setDeliveries(data))
      .catch(() => toast.error('データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const upcoming = deliveries.filter(d => {
    const date = new Date(d.deliveryDate)
    date.setHours(0, 0, 0, 0)
    return date >= today && d.status !== 'DELIVERED' && d.status !== 'CANCELLED'
  })

  const overdue = deliveries.filter(d => {
    const date = new Date(d.deliveryDate)
    date.setHours(0, 0, 0, 0)
    return date < today && d.status !== 'DELIVERED' && d.status !== 'CANCELLED'
  })

  const todayDeliveries = deliveries.filter(d => {
    const date = new Date(d.deliveryDate)
    date.setHours(0, 0, 0, 0)
    return date.getTime() === today.getTime()
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#102A43] border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#102A43]">
          ようこそ、{user?.name || user?.email} さん
        </h1>
        <p className="text-[#64748B] mt-1">
          {today.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#64748B]">総件数</CardTitle>
            <Package className="h-4 w-4 text-[#64748B]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#102A43]">{deliveries.length}</div>
            <p className="text-xs text-[#64748B] mt-1">全期間</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#64748B]">本日の納期</CardTitle>
            <Calendar className="h-4 w-4 text-[#64748B]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#102A43]">{todayDeliveries.length}</div>
            <p className="text-xs text-[#64748B] mt-1">今日</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#64748B]">今後の予定</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#64748B]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#102A43]">{upcoming.length}</div>
            <p className="text-xs text-[#64748B] mt-1">件</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#64748B]">遅延</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{overdue.length}</div>
            <p className="text-xs text-[#64748B] mt-1">要対応</p>
          </CardContent>
        </Card>
      </div>

      {overdue.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              遅延アイテム（{overdue.length}件）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdue.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="font-medium text-[#102A43]">{d.productName}</p>
                    <p className="text-sm text-[#64748B]">
                      納期: {new Date(d.deliveryDate).toLocaleDateString('ja-JP')} | 数量: {d.quantity}個
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[d.status] ?? 'secondary'}>
                    {STATUS_LABEL[d.status] ?? d.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-[#102A43]">今後の入荷予定</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-[#64748B] text-center py-8">入荷予定がありません</p>
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0, 10).map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#102A43] truncate">{d.productName}</p>
                    <p className="text-sm text-[#64748B]">
                      {new Date(d.deliveryDate).toLocaleDateString('ja-JP')} | {d.quantity}個
                    </p>
                    {d.notes && <p className="text-xs text-[#64748B] mt-0.5 truncate">{d.notes}</p>}
                  </div>
                  <Badge variant={STATUS_VARIANT[d.status] ?? 'secondary'} className="ml-3 shrink-0">
                    {STATUS_LABEL[d.status] ?? d.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
