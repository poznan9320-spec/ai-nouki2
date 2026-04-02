import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set')

export interface JWTPayload {
  userId: string
  email: string
  role: string
  companyId: string
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: '7d' })
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET!) as JWTPayload
}

export function getTokenFromRequest(req: NextRequest): JWTPayload | null {
  // Check Authorization header first
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    try { return verifyToken(auth.slice(7)) } catch {}
  }
  // Fall back to HttpOnly cookie
  const cookie = req.cookies.get('token')?.value
  if (cookie) {
    try { return verifyToken(cookie) } catch {}
  }
  return null
}

export function setTokenCookie(res: Response, token: string) {
  const cookie = [
    `token=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    `Max-Age=${7 * 24 * 60 * 60}`,
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
  ].join('; ')
  res.headers.append('Set-Cookie', cookie)
}
