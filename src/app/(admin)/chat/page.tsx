'use client'
import { useState, useRef, useEffect } from 'react'
import { authHeaders } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Send, Bot, Package } from 'lucide-react'
import { toast } from 'sonner'

interface DeliveryRef {
  product_name: string
  quantity: number
  delivery_date: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  deliveries?: DeliveryRef[]
}

const SUGGESTED = [
  '今週納期の商品は？',
  '明日の入荷予定',
  '数量が多い商品は？',
  '遅延中の商品は？',
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setMessages(m => [...m, { role: 'user', content: trimmed }])
    setInput('')
    setLoading(true)
    try {
      const data = await apiFetch<{ response: string; deliveries?: DeliveryRef[] }>(
        '/api/admin/chat',
        { method: 'POST', body: { message: trimmed }, headers: authHeaders() }
      )
      setMessages(m => [...m, { role: 'assistant', content: data.response, deliveries: data.deliveries }])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '送信に失敗しました')
      setMessages(m => m.slice(0, -1))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] -mx-6 -mt-6">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-[#102A43] text-white shrink-0">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">AIアシスタント</p>
          <p className="text-xs text-white/60 mt-0.5">入荷データについて質問できます</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-[#F0F2F5] px-3 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 pb-8">
            <div className="w-14 h-14 rounded-full bg-[#102A43]/10 flex items-center justify-center">
              <Bot className="h-7 w-7 text-[#102A43]/40" />
            </div>
            <p className="text-xs text-[#64748B]">入荷データについて何でも聞いてください</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTED.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-1.5 bg-white rounded-full text-xs text-[#102A43] shadow-sm border border-gray-200 hover:bg-[#102A43] hover:text-white transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-[#102A43] flex items-center justify-center shrink-0 mb-0.5">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            <div className={`max-w-[75%] space-y-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              <div className={`px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === 'user'
                  ? 'bg-[#102A43] text-white rounded-2xl rounded-br-sm'
                  : 'bg-white text-[#1a1a1a] rounded-2xl rounded-bl-sm shadow-sm'
              }`}>
                {msg.content}
              </div>
              {msg.deliveries && msg.deliveries.length > 0 && (
                <div className="w-full space-y-1">
                  <p className="text-[10px] text-[#64748B] flex items-center gap-1 px-1">
                    <Package className="h-2.5 w-2.5" /> 関連データ
                  </p>
                  {msg.deliveries.map((d, j) => (
                    <div key={j} className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-800 shadow-sm">
                      <span className="font-medium">{d.product_name}</span>
                      {' '}&mdash; {d.quantity}個 | {d.delivery_date}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-end gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-[#102A43] flex items-center justify-center shrink-0 mb-0.5">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-3 py-2.5 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <input
            ref={inputRef}
            placeholder="メッセージを入力..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 text-sm bg-[#F0F2F5] rounded-full px-4 py-2.5 outline-none placeholder:text-gray-400 disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-9 w-9 rounded-full bg-[#102A43] hover:bg-[#1a3a5c] shrink-0 p-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
