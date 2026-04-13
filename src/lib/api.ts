const getToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('token') : null

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }
}

export async function apiFetch<T = unknown>(
  url: string,
  options: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
    isFormData?: boolean
  } = {}
): Promise<T> {
  const { method = 'GET', body, headers = authHeaders(), isFormData = false } = options

  const init: RequestInit = { method, headers }

  if (body !== undefined) {
    if (isFormData) {
      // Remove Content-Type so browser sets multipart boundary
      const h = { ...headers }
      delete h['Content-Type']
      init.headers = h
      init.body = body as FormData
    } else {
      init.body = JSON.stringify(body)
    }
  }

  const res = await fetch(url, { ...init, credentials: 'same-origin' })

  if (!res.ok) {
    let msg = `エラーが発生しました (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) msg = data.error
    } catch {
      // ignore
    }
    throw new Error(msg)
  }

  const contentType = res.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return res.json() as Promise<T>
  }
  return res.text() as unknown as Promise<T>
}
