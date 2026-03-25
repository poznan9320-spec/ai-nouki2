'use client'
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import axios from 'axios'

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
  registerEmployee: (companyId: string, email: string, password: string, name: string) => Promise<void>
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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    const token = getToken()
    if (!token) { setLoading(false); return }
    try {
      const res = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUser(res.data.user)
      setCompany(res.data.company)
    } catch {
      removeToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { checkAuth() }, [checkAuth])

  const login = async (email: string, password: string) => {
    const res = await axios.post('/api/mobile/login', { email, password })
    setToken(res.data.token)
    setUser(res.data.user)
    setCompany(res.data.company)
  }

  const register = async (companyName: string, email: string, password: string, name: string) => {
    const res = await axios.post('/api/mobile/register', { companyName, email, password, name })
    setToken(res.data.token)
    setUser(res.data.user)
    setCompany(res.data.company)
  }

  const registerEmployee = async (companyId: string, email: string, password: string, name: string) => {
    const res = await axios.post('/api/mobile/register-employee', { companyId, email, password, name })
    setToken(res.data.token)
    setUser(res.data.user)
    setCompany(res.data.company)
  }

  const logout = () => {
    removeToken()
    setUser(null)
    setCompany(null)
  }

  return (
    <AuthContext.Provider value={{
      user, company, loading, login, register, registerEmployee, logout,
      isAdmin: user?.role === 'ADMIN'
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const authHeaders = () => {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
