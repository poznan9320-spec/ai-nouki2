'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

export default function LoginPage() {
  const { user, loading, login, register } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [companyName, setCompanyName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminName, setAdminName] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)

  // 会社参加フォーム
  const [joinCode, setJoinCode] = useState('')
  const [joinEmail, setJoinEmail] = useState('')
  const [joinPassword, setJoinPassword] = useState('')
  const [joinName, setJoinName] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinPending, setJoinPending] = useState(false)
  const [defaultTab, setDefaultTab] = useState('login')

  useEffect(() => {
    if (!loading && user) router.push('/dashboard')
  }, [user, loading, router])

  useEffect(() => {
    const code = searchParams.get('join')
    if (code) {
      setJoinCode(code.toUpperCase())
      setDefaultTab('join')
    }
  }, [searchParams])

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
    if (!loginEmail || !loginPassword) {
      toast.error('メールアドレスとパスワードを入力してください')
      return
    }
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

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode || !joinEmail || !joinPassword || !joinName) {
      toast.error('全ての項目を入力してください')
      return
    }
    setJoinLoading(true)
    try {
      const res = await fetch('/api/mobile/register-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode: joinCode.toUpperCase(), email: joinEmail, password: joinPassword, name: joinName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '登録に失敗しました')
      setJoinPending(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '登録に失敗しました')
    } finally {
      setJoinLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName || !adminEmail || !adminPassword || !adminName) {
      toast.error('全ての項目を入力してください')
      return
    }
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#102A43]">AI納期管理</h1>
          <p className="text-[#64748B] mt-2">B2B配送・納期管理システム</p>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="login">ログイン</TabsTrigger>
            <TabsTrigger value="join">会社に参加</TabsTrigger>
            <TabsTrigger value="register">新規登録</TabsTrigger>
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
                  <Button
                    type="submit"
                    className="w-full bg-[#102A43] hover:bg-[#1a3a5c]"
                    disabled={loginLoading}
                  >
                    {loginLoading ? 'ログイン中...' : 'ログイン'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="join">
            <Card>
              <CardHeader>
                <CardTitle>会社に参加</CardTitle>
                <CardDescription>管理者から招待コードまたはQRコードを受け取って登録してください</CardDescription>
              </CardHeader>
              <CardContent>
                {joinPending ? (
                  <div className="text-center py-6 space-y-3">
                    <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-7 h-7 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="font-semibold text-[#102A43]">申請が完了しました</p>
                    <p className="text-sm text-[#64748B]">管理者が承認すると<br />ログインできるようになります</p>
                  </div>
                ) : (
                <form onSubmit={handleJoin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="join-code">招待コード</Label>
                    <Input
                      id="join-code"
                      placeholder="例: 12345AB"
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value.toUpperCase())}
                      className="font-mono text-lg tracking-widest text-center"
                      maxLength={7}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="join-name">氏名</Label>
                    <Input
                      id="join-name"
                      placeholder="山田 太郎"
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
                      placeholder="example@company.com"
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
                      placeholder="パスワード"
                      value={joinPassword}
                      onChange={e => setJoinPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#102A43] hover:bg-[#1a3a5c]"
                    disabled={joinLoading}
                  >
                    {joinLoading ? '登録中...' : '参加申請する'}
                  </Button>
                </form>
                )}
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
                  <Button
                    type="submit"
                    className="w-full bg-[#102A43] hover:bg-[#1a3a5c]"
                    disabled={registerLoading}
                  >
                    {registerLoading ? '登録中...' : '会社を登録する'}
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
