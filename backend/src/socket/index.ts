import jwt from 'jsonwebtoken'
import { Server, Socket } from 'socket.io'
import { getUserPartnershipState } from '../services/partnership'

const JWT_SECRET = process.env.JWT_SECRET || 'wedding-manager-secret'
const REALTIME_EVENTS = [
  'node_update',
  'todo_update',
  'expense_update',
  'memo_update',
  'attachment_update',
] as const

type RealtimeEvent = (typeof REALTIME_EVENTS)[number]

interface SocketUser {
  id: number
  username: string
  partnerId?: number | null
  dataOwnerId?: number
}

interface RealtimePayload {
  action: string
  payload: any
}

interface AuthenticatedSocket extends Socket {
  data: Socket['data'] & {
    user?: SocketUser
  }
}

function getPairRoom(user: SocketUser) {
  if (!user.partnerId) {
    return null
  }
  return [user.id, user.partnerId].sort((a, b) => a - b).join('_')
}

export function createSocketAuthMiddleware(socket: AuthenticatedSocket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token
  if (!token) {
    next(new Error('未授权的实时连接'))
    return
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SocketUser
    const currentUser = getUserPartnershipState(decoded.id)
    if (!currentUser) {
      next(new Error('实时连接认证失败'))
      return
    }
    socket.data.user = {
      id: currentUser.id,
      username: currentUser.username,
      partnerId: currentUser.partnerId ?? null,
      dataOwnerId: currentUser.dataOwnerId,
    }
    next()
  } catch {
    next(new Error('实时连接认证失败'))
  }
}

function joinAuthenticatedRoom(socket: AuthenticatedSocket) {
  const user = socket.data.user
  const roomId = user ? getPairRoom(user) : null
  if (!user || !roomId) {
    return
  }
  socket.join(roomId)
  console.log(`User ${user.id} joined room ${roomId}`)
}

function leaveAuthenticatedRoom(socket: AuthenticatedSocket) {
  const user = socket.data.user
  const roomId = user ? getPairRoom(user) : null
  if (!user || !roomId) {
    return
  }
  socket.leave(roomId)
}

function broadcastToAuthenticatedRoom(socket: AuthenticatedSocket, event: RealtimeEvent, data: RealtimePayload) {
  const user = socket.data.user
  const roomId = user ? getPairRoom(user) : null
  if (!user || !roomId) {
    return
  }
  socket.to(roomId).emit(event, {
    action: data.action,
    payload: data.payload,
  })
}

export function createSocketEventRegistrar(socket: AuthenticatedSocket) {
  socket.on('join_room', () => {
    joinAuthenticatedRoom(socket)
  })

  socket.on('leave_room', () => {
    leaveAuthenticatedRoom(socket)
  })

  for (const event of REALTIME_EVENTS) {
    socket.on(event, (data: RealtimePayload) => {
      broadcastToAuthenticatedRoom(socket, event, data)
    })
  }
}

export function setupSocket(io: Server) {
  io.use((socket, next) => createSocketAuthMiddleware(socket as AuthenticatedSocket, next))

  io.on('connection', (socket: Socket) => {
    const authenticatedSocket = socket as AuthenticatedSocket
    const user = authenticatedSocket.data.user

    console.log('User connected:', socket.id, user?.id)
    createSocketEventRegistrar(authenticatedSocket)
    joinAuthenticatedRoom(authenticatedSocket)

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id)
    })
  })
}
