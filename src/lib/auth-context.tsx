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
  logout: () => void
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('token') : null
const setToken = (t: string) => localStorage.setItem('token', t)
const removeToken = () => localStorage.removeItem('token')

async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, options)
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || `エラー (${res.status})`)
  return data
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    const token = getToken()
    if (!token) { setLoading(false); return }
    try {
      const data = await apiFetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUser(data.user)
      setCompany(data.company)
    } catch {
      removeToken()
      setUser(null)
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
    setToken(data.token)
    setUser(data.user)
    setCompany(data.company)
  }

  const register = async (companyName: string, email: string, password: string, name: string) => {
    const data = await apiFetch('/api/mobile/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, email, password, name }),
    })
    setToken(data.token)
    setUser(data.user)
    setCompany(data.company)
  }

  const logout = () => {
    removeToken()
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

export function authHeaders(): Record<string, string> {
  const token = getToken()
  const base: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) base['Authorization'] = `Bearer ${token}`
  return base
}
