import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const room = searchParams.get('room') || 'ALL'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')

  const messages = await prisma.message.findMany({
    where: { chatRoom: room },
    include: { sender: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  })

  return NextResponse.json({ messages: messages.reverse() })
}

export async function POST(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  try {
    const { content, chatRoom, fileName, fileUrl } = await req.json()

    if (!content && !fileUrl) {
      return NextResponse.json({ error: 'メッセージ内容が必要です' }, { status: 400 })
    }

    const message = await prisma.message.create({
      data: {
        content: content || '',
        senderId: user.userId,
        chatRoom: chatRoom || 'ALL',
        fileName,
        fileUrl,
      },
      include: { sender: { select: { id: true, name: true, email: true, role: true } } },
    })

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
