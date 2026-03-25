'use client'
import { useState, useEffect, useCallback } from 'react'
import { authHeaders } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { Building2, Users, Shield, Copy, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface CompanyInfo {
  company_id: string
  name: string
}

interface UserInfo {
  user_id: string
  name: string | null
  email: string
  role: string
  created_at: string
}

export default function SettingsPage() {
  const { user: currentUser, isAdmin } = useAuth()
  const [company, setCompany] = useState<CompanyInfo | null>(null)
  const [users, setUsers] = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const companyData = await apiFetch<CompanyInfo>('/api/mobile/company', { headers: authHeaders() })
      setCompany(companyData)
      if (isAdmin) {
        const usersData = await apiFetch<UserInfo[]>('/api/mobile/users', { headers: authHeaders() })
        setUsers(usersData)
      }
    } catch {
      toast.error('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => { fetchData() }, [fetchData])

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

  const getRoleLabel = (role: string) => role === 'ADMIN' ? '管理者' : '従業員'
  const getRoleVariant = (role: string): 'default' | 'secondary' => role === 'ADMIN' ? 'default' : 'secondary'

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
            <p className="text-sm text-[#64748B]">会社ID</p>
            <div className="flex items-center gap-2 mt-1">
              <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded text-[#102A43] flex-1 truncate">
                {company?.company_id ?? '—'}
              </code>
              <Button variant="outline" size="icon" onClick={copyCompanyId}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-[#64748B] mt-1">従業員がこのIDを使って会社に参加できます</p>
          </div>
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
          <CardContent>
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
              {users.length === 0 ? (
                <p className="text-sm text-[#64748B] text-center py-4">メンバーがいません</p>
              ) : (
                users.map(u => (
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
                      <Select
                        value={u.role}
                        onValueChange={val => handleRoleChange(u.user_id, val)}
                        disabled={updatingRole === u.user_id}
                      >
                        <SelectTrigger className="w-28 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">管理者</SelectItem>
                          <SelectItem value="EMPLOYEE">従業員</SelectItem>
                        </SelectContent>
                      </Select>
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
