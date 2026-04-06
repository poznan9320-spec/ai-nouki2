'use client'
import { useState, useEffect, useCallback } from 'react'
import { authHeaders } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Building2, Users, Shield, Copy, Trash2, Plus, Truck, QrCode, Check, X, Bell, Printer, Mail, Unlink, ExternalLink, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import QRCode from 'react-qr-code'

interface NotificationSettings {
  todayHour: number
  tomorrowHour: number
  enabled: boolean
}

interface CompanyInfo {
  company_id: string
  name: string
}

interface UserInfo {
  user_id: string
  name: string | null
  email: string
  role: string
  status: string
  created_at: string
}

export default function SettingsPage() {
  const { user: currentUser, isAdmin } = useAuth()
  const [company, setCompany] = useState<CompanyInfo | null>(null)
  const [users, setUsers] = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [deletingUser, setDeletingUser] = useState<string | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)
  const [deletingPast, setDeletingPast] = useState(false)

  // 通知設定
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({ todayHour: 7, tomorrowHour: 18, enabled: true })
  const [savingNotif, setSavingNotif] = useState(false)

  // 取引先管理
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
  const [newSupplier, setNewSupplier] = useState('')
  const [addingSupplier, setAddingSupplier] = useState(false)

  // Gmail接続状態
  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email: string | null; connectedAt: string | null; faxSenderEmail: string } | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [editingFaxSender, setEditingFaxSender] = useState(false)
  const [faxSenderInput, setFaxSenderInput] = useState('')
  const [savingFaxSender, setSavingFaxSender] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [companyData, notifData] = await Promise.all([
        apiFetch<CompanyInfo>('/api/mobile/company', { headers: authHeaders() }),
        apiFetch<NotificationSettings>('/api/mobile/notification-settings', { headers: authHeaders() }),
      ])
      setCompany(companyData)
      setNotifSettings(notifData)
      if (isAdmin) {
        const [usersData, suppliersData] = await Promise.all([
          apiFetch<UserInfo[]>('/api/mobile/users', { headers: authHeaders() }),
          apiFetch<{ id: string; name: string }[]>('/api/mobile/suppliers', { headers: authHeaders() }),
        ])
        setUsers(usersData)
        setSuppliers(suppliersData)
        // Gmail状態は独立して取得（失敗しても他のデータに影響させない）
        try {
          const gmailData = await apiFetch<{ connected: boolean; email: string | null; connectedAt: string | null; faxSenderEmail: string }>(
            '/api/auth/gmail/status', { headers: authHeaders() }
          )
          setGmailStatus(gmailData)
        } catch {
          setGmailStatus({ connected: false, email: null, connectedAt: null, faxSenderEmail: 'FromBrotherDevice@brother.com' })
        }
      }
    } catch {
      toast.error('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  const handleSaveNotif = async () => {
    setSavingNotif(true)
    try {
      const updated = await apiFetch<NotificationSettings>('/api/mobile/notification-settings', {
        method: 'PUT',
        body: notifSettings,
        headers: authHeaders(),
      })
      setNotifSettings(updated)
      toast.success('通知設定を保存しました')
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSavingNotif(false)
    }
  }

  useEffect(() => { fetchData() }, [fetchData])

  // Gmail OAuth結果をURLパラメータで受け取ってトースト表示
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail_success')) {
      toast.success('Gmailを接続しました。FAXメールが自動登録されます。')
      window.history.replaceState({}, '', '/settings')
      fetchData()
    } else if (params.get('gmail_error')) {
      const errMap: Record<string, string> = {
        cancelled: 'Gmail接続がキャンセルされました',
        no_refresh_token: '接続に失敗しました（もう一度試してください）',
        config: 'サーバー設定が不足しています',
        server: 'サーバーエラーが発生しました',
      }
      toast.error(errMap[params.get('gmail_error') ?? ''] ?? 'Gmail接続に失敗しました')
      window.history.replaceState({}, '', '/settings')
    }
  }, [fetchData])

  const handleGmailDisconnect = async () => {
    if (!confirm('Gmail接続を解除します。FAXの自動登録が停止されます。よろしいですか？')) return
    setDisconnecting(true)
    try {
      await apiFetch('/api/auth/gmail/status', { method: 'DELETE', headers: authHeaders() })
      setGmailStatus({ connected: false, email: null, connectedAt: null, faxSenderEmail: 'FromBrotherDevice@brother.com' })
      toast.success('Gmail接続を解除しました')
    } catch {
      toast.error('解除に失敗しました')
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSaveFaxSender = async () => {
    if (!faxSenderInput.trim()) return
    setSavingFaxSender(true)
    try {
      await apiFetch('/api/auth/gmail/status', {
        method: 'PATCH',
        headers: authHeaders(),
        body: { faxSenderEmail: faxSenderInput.trim() },
      })
      setGmailStatus(s => s ? { ...s, faxSenderEmail: faxSenderInput.trim() } : s)
      setEditingFaxSender(false)
      toast.success('FAX送信元メールアドレスを保存しました')
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSavingFaxSender(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingRole(userId)
    try {
      await apiFetch(`/api/mobile/users/${userId}/role`, {
        method: 'PUT',
        body: { role: newRole },
        headers: authHeaders(),
      })
      setUsers(u => u.map(user =>
        user.user_id === userId ? { ...user, role: newRole } : user
      ))
      toast.success('ロールを更新しました')
    } catch {
      toast.error('更新に失敗しました')
    } finally {
      setUpdatingRole(null)
    }
  }

  const copyCompanyId = () => {
    if (company?.company_id) {
      navigator.clipboard.writeText(company.company_id)
      toast.success('会社IDをコピーしました')
    }
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    return email[0].toUpperCase()
  }

  const handleAddSupplier = async () => {
    if (!newSupplier.trim()) return
    setAddingSupplier(true)
    try {
      const s = await apiFetch<{ id: string; name: string }>('/api/mobile/suppliers', {
        method: 'POST',
        body: { name: newSupplier.trim() },
        headers: authHeaders(),
      })
      setSuppliers(prev => [...prev, s].sort((a, b) => a.name.localeCompare(b.name, 'ja')))
      setNewSupplier('')
      toast.success('取引先を追加しました')
    } catch {
      toast.error('追加に失敗しました')
    } finally {
      setAddingSupplier(false)
    }
  }

  const handleDeleteSupplier = async (id: string) => {
    try {
      await apiFetch(`/api/mobile/suppliers/${id}`, { method: 'DELETE', headers: authHeaders() })
      setSuppliers(prev => prev.filter(s => s.id !== id))
      toast.success('取引先を削除しました')
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  const handleDeletePast = async () => {
    if (!confirm('今日より前の納期データをすべて削除します。よろしいですか？')) return
    setDeletingPast(true)
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const res = await fetch('/api/mobile/deliveries', {
        method: 'DELETE',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ before: today.toISOString() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '削除に失敗しました')
      toast.success(`${data.deleted}件の過去データを削除しました`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '削除に失敗しました')
    } finally {
      setDeletingPast(false)
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm('すべての納期データを削除します。この操作は取り消せません。よろしいですか？')) return
    setDeletingAll(true)
    try {
      const res = await fetch('/api/mobile/deliveries', {
        method: 'DELETE',
        headers: authHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '削除に失敗しました')
      toast.success(`${data.deleted}件のデータを削除しました`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '削除に失敗しました')
    } finally {
      setDeletingAll(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('このメンバーを削除しますか？この操作は取り消せません。')) return
    setDeletingUser(userId)
    try {
      await apiFetch(`/api/mobile/users/${userId}`, { method: 'DELETE', headers: authHeaders() })
      setUsers(u => u.filter(user => user.user_id !== userId))
      toast.success('メンバーを削除しました')
    } catch {
      toast.error('削除に失敗しました')
    } finally {
      setDeletingUser(null)
    }
  }

  const handleApprove = async (userId: string, action: 'approve' | 'reject') => {
    try {
      await apiFetch(`/api/mobile/users/${userId}/approve`, {
        method: 'PUT',
        body: { action },
        headers: authHeaders(),
      })
      setUsers(u => u.map(user =>
        user.user_id === userId
          ? { ...user, status: action === 'approve' ? 'ACTIVE' : 'REJECTED' }
          : user
      ))
      toast.success(action === 'approve' ? '承認しました' : '拒否しました')
    } catch {
      toast.error('操作に失敗しました')
    }
  }

  const getRoleLabel = (role: string) => role === 'ADMIN' ? '管理者' : '従業員'
  const getRoleVariant = (role: string): 'default' | 'secondary' => role === 'ADMIN' ? 'default' : 'secondary'

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/login?join=${company?.company_id ?? ''}`
    : ''
  const pendingUsers = users.filter(u => u.status === 'PENDING')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#102A43] border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-[#102A43]">設定</h1>

      {/* Company info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            会社情報
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-[#64748B]">会社名</p>
            <p className="font-semibold text-[#102A43]">{company?.name ?? '—'}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm text-[#64748B]">招待コード</p>
            <div className="flex items-center gap-2 mt-1">
              <code className="font-mono text-2xl font-bold tracking-widest bg-gray-100 px-3 py-2 rounded text-[#102A43] flex-1 text-center">
                {company?.company_id ?? '—'}
              </code>
              <Button variant="outline" size="icon" onClick={copyCompanyId}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-[#64748B] mt-1">従業員がこのコードを使って会社に参加できます</p>
          </div>
          <Separator />
          {/* QRコード */}
          {isAdmin && company?.company_id && (
            <div>
              <p className="text-sm text-[#64748B] flex items-center gap-1 mb-3">
                <QrCode className="h-3.5 w-3.5" />
                QRコードで参加
              </p>
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-white border rounded-xl inline-block">
                  <QRCode value={joinUrl} size={160} />
                </div>
                <p className="text-xs text-[#64748B] text-center">
                  スキャンすると参加フォームが開きます
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 通知設定 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            通知設定
          </CardTitle>
          <CardDescription>納品通知を受け取る時刻を設定します</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#102A43]">通知を有効にする</p>
              <p className="text-xs text-[#64748B]">納品リマインダーをオン／オフ</p>
            </div>
            <button
              type="button"
              onClick={() => setNotifSettings(s => ({ ...s, enabled: !s.enabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                notifSettings.enabled ? 'bg-[#102A43]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {notifSettings.enabled && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-[#102A43]">本日納品の通知時刻</p>
                  <Select
                    value={String(notifSettings.todayHour)}
                    onValueChange={v => setNotifSettings(s => ({ ...s, todayHour: Number(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {String(i).padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-[#102A43]">明日納品の通知時刻</p>
                  <Select
                    value={String(notifSettings.tomorrowHour)}
                    onValueChange={v => setNotifSettings(s => ({ ...s, tomorrowHour: Number(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {String(i).padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <Button
            onClick={handleSaveNotif}
            disabled={savingNotif}
            className="w-full bg-[#102A43] hover:bg-[#1a3a5c]"
            size="sm"
          >
            {savingNotif ? '保存中...' : '保存'}
          </Button>
        </CardContent>
      </Card>

      {/* My account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            アカウント情報
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-[#64748B]">名前</p>
            <p className="font-semibold text-[#102A43]">{currentUser?.name ?? '—'}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm text-[#64748B]">メールアドレス</p>
            <p className="font-semibold text-[#102A43]">{currentUser?.email}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm text-[#64748B]">ロール</p>
            <Badge variant={getRoleVariant(currentUser?.role ?? '')} className="mt-1">
              {getRoleLabel(currentUser?.role ?? '')}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* FAX自動登録（管理者専用） */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              FAX自動登録
            </CardTitle>
            <CardDescription>
              複合機から届くFAXをGmail経由で自動受信し、納期データとして登録します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 仕組みの説明 */}
            <div className="bg-blue-50 rounded-lg p-3 space-y-1.5">
              <p className="text-sm font-medium text-blue-800 flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                仕組み
              </p>
              <ul className="text-xs text-blue-700 space-y-1 ml-5 list-disc">
                <li>複合機（Brother等）からFAXが届くと、メールに<strong>PNG添付</strong>で転送されます</li>
                <li>AIがFAX画像を自動読み取り（OCR）して納期・商品名を抽出</li>
                <li><strong>30分ごと</strong>に自動チェックして登録（登録済みは重複スキップ）</li>
                <li>登録されたデータにはカレンダーで <span className="bg-purple-100 text-purple-700 px-1 rounded">FAX</span> バッジが表示されます</li>
              </ul>
            </div>

            <Separator />

            {/* 接続状態 */}
            {gmailStatus?.connected ? (
              <div className="space-y-3">
                {/* 接続中バッジ */}
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-800">接続中</p>
                    <p className="text-xs text-green-600 truncate">{gmailStatus.email}</p>
                    {gmailStatus.connectedAt && (
                      <p className="text-xs text-green-500">
                        接続日: {new Date(gmailStatus.connectedAt).toLocaleDateString('ja-JP')}
                      </p>
                    )}
                  </div>
                </div>

                {/* FAX送信元メールアドレス設定 */}
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                  <p className="text-xs font-medium text-[#102A43] flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    FAX送信元メールアドレス
                  </p>
                  {editingFaxSender ? (
                    <div className="flex gap-2">
                      <Input
                        value={faxSenderInput}
                        onChange={e => setFaxSenderInput(e.target.value)}
                        placeholder="例: FromBrotherDevice@brother.com"
                        className="text-xs h-8 flex-1"
                        autoFocus
                      />
                      <Button size="sm" className="h-8 px-2 bg-[#102A43]" onClick={handleSaveFaxSender} disabled={savingFaxSender}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setEditingFaxSender(false)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-[#64748B] truncate font-mono">{gmailStatus.faxSenderEmail}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 shrink-0"
                        onClick={() => { setFaxSenderInput(gmailStatus.faxSenderEmail); setEditingFaxSender(true) }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <p className="text-[10px] text-[#64748B]">複合機から転送されるメールの送信元アドレスを入力してください</p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-300 hover:bg-red-50 w-full"
                  onClick={handleGmailDisconnect}
                  disabled={disconnecting}
                >
                  <Unlink className="h-3.5 w-3.5 mr-1.5" />
                  {disconnecting ? '解除中...' : 'Gmail接続を解除する'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
                  <p className="text-sm text-gray-600">未接続</p>
                </div>
                <a href="/api/auth/gmail/connect" className="block">
                  <Button className="w-full bg-[#102A43] hover:bg-[#1a3a5c]" size="sm">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Gmailを接続してFAX自動登録を有効にする
                  </Button>
                </a>
                <p className="text-xs text-[#64748B]">
                  ※ Googleアカウントの認証画面に移動します。FAXメールが届くGmailアカウントで許可してください。
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Supplier management (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              取引先管理
            </CardTitle>
            <CardDescription>データ取込時に選択できる取引先を管理します</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 追加フォーム */}
            <div className="flex gap-2">
              <Input
                placeholder="取引先名を入力"
                value={newSupplier}
                onChange={e => setNewSupplier(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSupplier()}
                className="flex-1"
              />
              <Button
                onClick={handleAddSupplier}
                disabled={addingSupplier || !newSupplier.trim()}
                className="bg-[#102A43] hover:bg-[#1a3a5c] shrink-0"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />追加
              </Button>
            </div>
            {/* 一覧 */}
            {suppliers.length === 0 ? (
              <p className="text-sm text-[#64748B] text-center py-3">取引先が登録されていません</p>
            ) : (
              <div className="space-y-1">
                {suppliers.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                    <span className="text-sm text-[#102A43]">{s.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteSupplier(s.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Danger zone (admin only) */}
      {isAdmin && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="h-5 w-5" />
              データ管理
            </CardTitle>
            <CardDescription>取込んだ納期データの一括削除</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div>
                <p className="font-medium text-orange-800 text-sm">過去データを削除</p>
                <p className="text-xs text-orange-600 mt-0.5">今日より前の納期データをすべて削除します</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-orange-300 text-orange-700 hover:bg-orange-100"
                onClick={handleDeletePast}
                disabled={deletingPast}
              >
                {deletingPast ? '削除中...' : '過去を削除'}
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div>
                <p className="font-medium text-red-800 text-sm">全データを削除</p>
                <p className="text-xs text-red-600 mt-0.5">すべての納期データを削除します（取り消し不可）</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteAll}
                disabled={deletingAll}
              >
                {deletingAll ? '削除中...' : '全削除'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending approval (admin only) */}
      {isAdmin && pendingUsers.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <Users className="h-5 w-5" />
              承認待ち
              <Badge className="bg-yellow-100 text-yellow-700 ml-1">{pendingUsers.length}</Badge>
            </CardTitle>
            <CardDescription>以下のユーザーが参加申請中です</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingUsers.map(u => (
              <div key={u.user_id} className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="bg-yellow-200 text-yellow-800 text-xs">
                    {getInitials(u.name, u.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#102A43] truncate">{u.name || u.email}</p>
                  <p className="text-xs text-[#64748B] truncate">{u.email}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 h-8 px-2"
                    onClick={() => handleApprove(u.user_id, 'approve')}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />承認
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50 h-8 px-2"
                    onClick={() => handleApprove(u.user_id, 'reject')}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />拒否
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Users management (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              メンバー管理
            </CardTitle>
            <CardDescription>会社メンバーのロールを管理します</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {users.filter(u => u.status !== 'PENDING').length === 0 ? (
                <p className="text-sm text-[#64748B] text-center py-4">メンバーがいません</p>
              ) : (
                users.filter(u => u.status !== 'PENDING').map(u => (
                  <div key={u.user_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-[#102A43] text-white text-xs">
                        {getInitials(u.name, u.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#102A43] truncate">{u.name || u.email}</p>
                      <p className="text-xs text-[#64748B] truncate">{u.email}</p>
                    </div>
                    {u.user_id === currentUser?.id ? (
                      <Badge variant={getRoleVariant(u.role)} className="shrink-0">
                        {getRoleLabel(u.role)}
                      </Badge>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <Select
                          value={u.role}
                          onValueChange={val => handleRoleChange(u.user_id, val)}
                          disabled={updatingRole === u.user_id}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">管理者</SelectItem>
                            <SelectItem value="EMPLOYEE">従業員</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteUser(u.user_id)}
                          disabled={deletingUser === u.user_id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
