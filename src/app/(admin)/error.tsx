'use client'
import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex items-center justify-center h-full min-h-[400px] p-4">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-[#102A43] mb-2">ページの読み込みに失敗しました</h2>
        <p className="text-[#64748B] mb-4 text-sm">{error.message || 'データの取得中にエラーが発生しました。'}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-[#102A43] text-white rounded-lg text-sm font-medium hover:bg-[#1a3a5c] transition-colors"
        >
          再読み込み
        </button>
      </div>
    </div>
  )
}
