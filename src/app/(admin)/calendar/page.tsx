'use client'
import { useState, useEffect, useCallback } from 'react'
import { authHeaders } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Package } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CalendarItem {
  product_name: string
  quantity: number
  id?: string
}

type CalendarData = Record<string, CalendarItem[]>

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

export default function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [calendarData, setCalendarData] = useState<CalendarData>({})
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const fetchCalendar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<CalendarData>(
        `/api/mobile/calendar?year=${year}&month=${month}`,
        { headers: authHeaders() }
      )
      setCalendarData(data)
    } catch {
      toast.error('カレンダーデータの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetchCalendar() }, [fetchCalendar])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
    setSelectedDate(null)
  }

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
    setSelectedDate(null)
  }

  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ...Array(totalCells - firstDay - daysInMonth).fill(null),
  ]

  const todayStr = new Date().toISOString().split('T')[0]
  const formatDateKey = (day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const selectedItems = selectedDate ? (calendarData[selectedDate] ?? []) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#102A43]">カレンダー</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-[#102A43] min-w-[6rem] text-center">
            {year}年 {MONTHS[month - 1]}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[#102A43] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-3">
                <div className="grid grid-cols-7 gap-0">
                  {WEEKDAYS.map((wd, i) => (
                    <div
                      key={wd}
                      className={cn(
                        'text-center text-xs font-medium py-2',
                        i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-[#64748B]'
                      )}
                    >
                      {wd}
                    </div>
                  ))}
                  {cells.map((day, i) => {
                    if (day === null) return <div key={i} className="aspect-square" />
                    const dateKey = formatDateKey(day)
                    const items = calendarData[dateKey] ?? []
                    const isToday = dateKey === todayStr
                    const isSelected = dateKey === selectedDate
                    const dayOfWeek = (firstDay + day - 1) % 7
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                        className={cn(
                          'aspect-square p-1 flex flex-col items-center rounded-lg transition-colors text-xs border',
                          isSelected
                            ? 'bg-[#102A43] text-white border-[#102A43]'
                            : isToday
                            ? 'bg-blue-50 border-blue-300 text-[#102A43]'
                            : 'border-transparent hover:bg-gray-50',
                          dayOfWeek === 0 && !isSelected ? 'text-red-500' : '',
                          dayOfWeek === 6 && !isSelected ? 'text-blue-500' : '',
                        )}
                      >
                        <span className="font-medium leading-none">{day}</span>
                        {items.length > 0 && (
                          <Badge
                            className={cn(
                              'mt-0.5 h-4 px-1 text-[10px]',
                              isSelected ? 'bg-white text-[#102A43]' : 'bg-[#102A43] text-white'
                            )}
                          >
                            {items.length}
                          </Badge>
                        )}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="h-full">
              <CardContent className="p-4">
                {selectedDate ? (
                  <div>
                    <h3 className="font-semibold text-[#102A43] mb-3">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ja-JP', {
                        month: 'long', day: 'numeric', weekday: 'short'
                      })}
                    </h3>
                    {selectedItems.length === 0 ? (
                      <p className="text-sm text-[#64748B]">入荷予定なし</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedItems.map((item, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                            <Package className="h-4 w-4 text-[#102A43] mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-[#102A43]">{item.product_name}</p>
                              <p className="text-xs text-[#64748B]">{item.quantity}個</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <Package className="h-8 w-8 text-gray-300 mb-2" />
                    <p className="text-sm text-[#64748B]">日付を選択すると<br />入荷予定を確認できます</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
