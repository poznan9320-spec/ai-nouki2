'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

export default function LoginPage() {
  const { user, loading, login, register, registerEmployee } = useAuth()
  const router = useRouter()

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Register company state
  const [companyName, setCompanyName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminName, setAdminName] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)

  // Join company state
  const [joinCompanyId, setJoinCompanyId] = useState('')
  const [joinEmail, setJoinEmail] = useState('')
  const [joinPassword, setJoinPassword] = useState('')
  const [joinName, setJoinName] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#102A43] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#64748B] text-sm">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (user) return null

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    try {
      await login(loginEmail, loginPassword)
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ログインに失敗しました'
      toast.error(msg)
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegisterLoading(true)
    try {
      await register(companyName, adminEmail, adminPassword, adminName)
      toast.success('会社登録が完了しました')
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '登録に失敗しました'
      toast.error(msg)
    } finally {
      setRegisterLoading(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setJoinLoading(true)
    try {
      await registerEmployee(joinCompanyId, joinEmail, joinPassword, joinName)
      toast.success('参加登録が完了しました')
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '参加に失敗しました'
      toast.error(msg)
    } finally {
      setJoinLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#102A43]">AI納期管理</h1>
          <p className="text-[#64748B] mt-2">B2B配送・納期管理システム</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="login">ログイン</TabsTrigger>
            <TabsTrigger value="register">新規登録</TabsTrigger>
            <TabsTrigger value="join">参加</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>ログイン</CardTitle>
                <CardDescription>アカウントにログインしてください</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">メールアドレス</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="example@company.com"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">パスワード</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="パスワード"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-[#102A43] hover:bg-[#1a3a5c]" disabled={loginLoading}>
                    {loginLoading ? 'ログイン中...' : 'ログイン'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>会社登録</CardTitle>
                <CardDescription>新しい会社アカウントを作成します</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">会社名</Label>
                    <Input
                      id="company-name"
                      placeholder="株式会社サンプル"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-name">管理者名</Label>
                    <Input
                      id="admin-name"
                      placeholder="山田 太郎"
                      value={adminName}
                      onChange={e => setAdminName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">メールアドレス</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@company.com"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">パスワード</Label>
                    <Input
                      id="admin-password"
                      type="password"
                      placeholder="パスワード（8文字以上）"
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-[#102A43] hover:bg-[#1a3a5c]" disabled={registerLoading}>
                    {registerLoading ? '登録中...' : '会社を登録する'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="join">
            <Card>
              <CardHeader>
                <CardTitle>会社に参加</CardTitle>
                <CardDescription>既存の会社に従業員として参加します</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleJoin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="join-company-id">会社ID</Label>
                    <Input
                      id="join-company-id"
                      placeholder="管理者から受け取った会社ID"
                      value={joinCompanyId}
                      onChange={e => setJoinCompanyId(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="join-name">お名前</Label>
                    <Input
                      id="join-name"
                      placeholder="山田 花子"
                      value={joinName}
                      onChange={e => setJoinName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="join-email">メールアドレス</Label>
                    <Input
                      id="join-email"
                      type="email"
                      placeholder="hanako@company.com"
                      value={joinEmail}
                      onChange={e => setJoinEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="join-password">パスワード</Label>
                    <Input
                      id="join-password"
                      type="password"
                      placeholder="パスワード（8文字以上）"
                      value={joinPassword}
                      onChange={e => setJoinPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-[#102A43] hover:bg-[#1a3a5c]" disabled={joinLoading}>
                    {joinLoading ? '参加中...' : '会社に参加する'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
