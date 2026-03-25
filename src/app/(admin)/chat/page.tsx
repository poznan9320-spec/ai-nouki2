'use client'
import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { authHeaders } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Send, Bot, User, Package } from 'lucide-react'
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
  '今週納期の商品を教えてください',
  '来月の入荷予定は？',
  '数量が多い商品はどれですか？',
  '遅延している商品がありますか？',
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const userMsg: Message = { role: 'user', content: trimmed }
    setMessages(m => [...m, userMsg])
    setInput('')
    setLoading(true)
    try {
      const res = await axios.post('/api/admin/chat', { message: trimmed }, { headers: authHeaders() })
      const assistantMsg: Message = {
        role: 'assistant',
        content: res.data.response,
        deliveries: res.data.deliveries,
      }
      setMessages(m => [...m, assistantMsg])
    } catch {
      toast.error('送信に失敗しました')
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
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[#102A43]">AIチャット</h1>
        <p className="text-[#64748B] mt-1">入荷データについて質問してください</p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef as React.RefObject<HTMLDivElement>}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <Bot className="h-12 w-12 text-[#102A43]/30 mb-4" />
              <p className="text-[#64748B] mb-6">入荷データについて何でもお聞きください</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED.map(s => (
                  <Button
                    key={s}
                    variant="outline"
                    size="sm"
                    onClick={() => sendMessage(s)}
                    className="text-xs"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-[#102A43] flex items-center justify-center shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[80%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-[#102A43] text-white rounded-tr-sm'
                          : 'bg-gray-100 text-[#102A43] rounded-tl-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                    {msg.deliveries && msg.deliveries.length > 0 && (
                      <div className="w-full space-y-1">
                        <p className="text-xs text-[#64748B] flex items-center gap-1">
                          <Package className="h-3 w-3" /> 関連データ
                        </p>
                        {msg.deliveries.map((d, j) => (
                          <div key={j} className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
                            <span className="font-medium">{d.product_name}</span>
                            {' '}&mdash; {d.quantity}個 | {d.delivery_date}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-1">
                      <User className="h-4 w-4 text-gray-600" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-[#102A43] flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <CardContent className="border-t p-3">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="メッセージを入力..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-[#102A43] hover:bg-[#1a3a5c]"
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
