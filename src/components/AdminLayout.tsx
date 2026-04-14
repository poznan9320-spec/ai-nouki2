'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import {
  LayoutDashboard,
  Package,
  Upload,
  MessageSquare,
  Calendar,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const allNavItems = [
  { href: '/dashboard', label: 'ダッシュボード', icon: LayoutDashboard, adminOnly: false },
  { href: '/deliveries', label: '納期スケジュール', icon: Package, adminOnly: false },
  { href: '/ingest', label: 'データ取込', icon: Upload, adminOnly: true },
  { href: '/chat', label: 'AIチャット', icon: MessageSquare, adminOnly: false },
  { href: '/calendar', label: 'カレンダー', icon: Calendar, adminOnly: false },
  { href: '/notifications', label: '通知', icon: Bell, adminOnly: false },
  { href: '/settings', label: '設定', icon: Settings, adminOnly: false },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, company, logout } = useAuth()
  const navItems = allNavItems.filter(item => !item.adminOnly || user?.role === 'ADMIN')
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (pathname === '/notifications') {
      setUnreadCount(0)
      return
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) return
    fetch('/api/mobile/notifications?unread_only=true', {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : [])
      .then((data: unknown[]) => setUnreadCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {})
  }, [pathname])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 bg-[#102A43] text-white flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h1 className="text-lg font-bold">AI納期管理</h1>
            {company && (
              <p className="text-xs text-white/60 mt-0.5 truncate">{company.name}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-white hover:bg-white/10"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {navItems.map(item => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.href === '/notifications' && unreadCount > 0 ? (
                      <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    ) : isActive ? (
                      <ChevronRight className="h-3 w-3" />
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-white/20 text-white text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || user?.email}</p>
              <p className="text-xs text-white/60 truncate">
                {user?.role === 'ADMIN' ? '管理者' : '従業員'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-white/70 hover:bg-white/10 hover:text-white justify-start gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            ログアウト
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-[#102A43]">
              {navItems.find(item => pathname === item.href || pathname?.startsWith(item.href + '/'))?.label ?? 'ページ'}
            </h2>
          </div>
          {unreadCount > 0 && pathname !== '/notifications' && (
            <Link href="/notifications" className="relative p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="h-5 w-5 text-[#64748B]" />
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            </Link>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
