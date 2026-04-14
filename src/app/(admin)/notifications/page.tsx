'use client'
import { useState, useEffect } from 'react'
import { authHeaders } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, BellOff, CheckCheck, Info, AlertCircle, Package } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Notification {
  notification_id: string
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'たった今'
  if (mins < 60) return `${mins}分前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  if (days === 1) return '昨日'
  if (days < 7) return `${days}日前`
  return new Date(iso).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const data = await apiFetch<Notification[]>(
        `/api/mobile/notifications${unreadOnly ? '?unread_only=true' : ''}`,
        { headers: authHeaders() }
      )
      setNotifications(data)
    } catch {
      toast.error('通知の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchNotifications() }, [unreadOnly])

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/api/mobile/notifications/${id}/read`, {
        method: 'PUT',
        headers: authHeaders(),
      })
      setNotifications(n => n.map(notif =>
        notif.notification_id === id ? { ...notif, is_read: true } : notif
      ))
    } catch {
      toast.error('更新に失敗しました')
    }
  }

  const markAllRead = async () => {
    setMarkingAll(true)
    try {
      await apiFetch('/api/mobile/notifications/read-all', {
        method: 'PUT',
        headers: authHeaders(),
      })
      setNotifications(n => n.map(notif => ({ ...notif, is_read: true })))
      toast.success('すべて既読にしました')
    } catch {
      toast.error('更新に失敗しました')
    } finally {
      setMarkingAll(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'delivery_update': return <Package className="h-4 w-4" />
      case 'order_status': return <AlertCircle className="h-4 w-4" />
      default: return <Info className="h-4 w-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'delivery_update': return 'text-blue-600 bg-blue-50'
      case 'order_status': return 'text-orange-600 bg-orange-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#102A43]">通知</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-[#64748B] mt-1">未読 {unreadCount}件</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUnreadOnly(u => !u)}
            className={unreadOnly ? 'bg-[#102A43] text-white hover:bg-[#1a3a5c]' : ''}
          >
            {unreadOnly ? <Bell className="h-4 w-4 mr-1" /> : <BellOff className="h-4 w-4 mr-1" />}
            {unreadOnly ? '未読のみ' : '全て表示'}
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} disabled={markingAll}>
              <CheckCheck className="h-4 w-4 mr-1" />
              全て既読
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[#102A43] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-[#64748B]">
              {unreadOnly ? '未読の通知はありません' : '通知はありません'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => (
            <Card
              key={notif.notification_id}
              className={cn(
                'transition-colors cursor-pointer hover:shadow-md',
                !notif.is_read ? 'border-l-4 border-l-[#102A43] bg-blue-50/30' : ''
              )}
              onClick={() => !notif.is_read && markRead(notif.notification_id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-full shrink-0', getTypeColor(notif.type))}>
                    {getTypeIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#102A43] text-sm">{notif.title}</p>
                        <p className="text-sm text-[#64748B] mt-0.5">{notif.message}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {!notif.is_read && (
                          <Badge className="bg-[#102A43] text-white text-[10px] h-4">新着</Badge>
                        )}
                        <time className="text-xs text-[#64748B]" title={new Date(notif.created_at).toLocaleString('ja-JP')}>
                          {relativeTime(notif.created_at)}
                        </time>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
