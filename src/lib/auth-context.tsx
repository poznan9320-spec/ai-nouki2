'use client'
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

interface User {
  id: string
  email: string
  name: string | null
  role: string
}

interface Company {
  id: string
  name: string
}

interface AuthContextType {
  user: User | null
  company: Company | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (companyName: string, email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, { ...options, credentials: 'same-origin' })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || `エラー (${res.status})`)
  return data
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    try {
      // Cookie is sent automatically — no token management needed
      const data = await apiFetch('/api/auth/me')
      setUser(data.user)
      setCompany(data.company)
    } catch {
      setUser(null)
      setCompany(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { checkAuth() }, [checkAuth])

  const login = async (email: string, password: string) => {
    const data = await apiFetch('/api/mobile/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    // HttpOnly cookie is set by the server; also persist token for API calls
    if (data.token) localStorage.setItem('token', data.token)
    setUser(data.user)
    setCompany(data.company)
  }

  const register = async (companyName: string, email: string, password: string, name: string) => {
    const data = await apiFetch('/api/mobile/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, email, password, name }),
    })
    if (data.token) localStorage.setItem('token', data.token)
    setUser(data.user)
    setCompany(data.company)
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    localStorage.removeItem('token')
    setUser(null)
    setCompany(null)
  }

  return (
    <AuthContext.Provider value={{
      user, company, loading, login, register, logout,
      isAdmin: user?.role === 'ADMIN',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// Kept for API calls that still pass headers explicitly
export function authHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' }
}
