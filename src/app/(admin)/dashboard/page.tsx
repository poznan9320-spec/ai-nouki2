'use client'
import { useState, useEffect } from 'react'
import { useAuth, authHeaders } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Truck, Download, CalendarClock, Upload } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface Delivery {
  id: string
  productName: string
  quantity: number
  deliveryDate: string
  supplierName?: string
  notes?: string
  createdAt: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })
}

function DeliveryList({ items, empty }: { items: Delivery[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-[#64748B] text-center py-6 text-sm">{empty}</p>
  }
  return (
    <div className="space-y-2">
      {items.map(d => (
        <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[#102A43] truncate">{d.productName}</p>
            <p className="text-sm text-[#64748B]">
              {d.quantity}個
              {d.supplierName && <span className="ml-2">取引先: {d.supplierName}</span>}
            </p>
            {d.notes && <p className="text-xs text-[#64748B] truncate mt-0.5">{d.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  )
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

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

  const todayDeliveries = deliveries.filter(d => {
    const date = new Date(d.deliveryDate); date.setHours(0, 0, 0, 0)
    return date.getTime() === today.getTime()
  })

  const tomorrowDeliveries = deliveries.filter(d => {
    const date = new Date(d.deliveryDate); date.setHours(0, 0, 0, 0)
    return date.getTime() === tomorrow.getTime()
  })

  const yesterdayDeliveries = deliveries.filter(d => {
    const date = new Date(d.deliveryDate); date.setHours(0, 0, 0, 0)
    return date.getTime() === yesterday.getTime()
  })

  const todayImports = deliveries.filter(d => {
    return new Date(d.createdAt) >= todayStart
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#102A43] border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const hasAnyData = deliveries.length > 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#102A43]">
          ようこそ、{user?.name || user?.email} さん
        </h1>
        <p className="text-[#64748B] mt-1">
          {today.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      {!hasAnyData && (
        <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-3">
            <div className="w-14 h-14 bg-[#102A43]/5 rounded-full flex items-center justify-center">
              <Package className="h-7 w-7 text-[#102A43]/30" />
            </div>
            <div>
              <p className="font-semibold text-[#102A43]">まだ納期データがありません</p>
              <p className="text-sm text-[#64748B] mt-1">CSVや画像から納期データを取り込んでください</p>
            </div>
            <Link href="/ingest">
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-[#102A43] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c] transition-colors">
                <Upload className="h-4 w-4" />
                データを取り込む
              </button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* 明日納品商品 */}
      <Card className={tomorrowDeliveries.length > 0 ? 'border-blue-200 bg-blue-50/40' : ''}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[#102A43]">
            <CalendarClock className="h-5 w-5 text-blue-500" />
            明日納品商品
            {tomorrowDeliveries.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-blue-500 text-white rounded-full">
                {tomorrowDeliveries.length}件
              </span>
            )}
            {tomorrowDeliveries.length === 0 && (
              <span className="ml-auto text-sm font-normal text-[#64748B]">0件</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeliveryList items={tomorrowDeliveries} empty="明日の納品予定はありません" />
        </CardContent>
      </Card>

      {/* 本日納品商品 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[#102A43]">
            <Truck className="h-5 w-5 text-orange-500" />
            本日納品商品
            <span className="ml-auto text-sm font-normal text-[#64748B]">{todayDeliveries.length}件</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeliveryList items={todayDeliveries} empty="本日の納品予定はありません" />
        </CardContent>
      </Card>

      {/* 昨日納品商品 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[#102A43]">
            <Package className="h-5 w-5 text-[#64748B]" />
            昨日納品商品
            <span className="ml-auto text-sm font-normal text-[#64748B]">{yesterdayDeliveries.length}件</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeliveryList items={yesterdayDeliveries} empty="昨日の納品データはありません" />
        </CardContent>
      </Card>

      {/* 本日の取り込み */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-[#102A43]">
            <Download className="h-5 w-5 text-blue-500" />
            本日の取り込み
            <span className="ml-auto text-sm font-normal text-[#64748B]">{todayImports.length}件</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeliveryList items={todayImports} empty="本日取り込んだデータはありません" />
        </CardContent>
      </Card>
    </div>
  )
}
