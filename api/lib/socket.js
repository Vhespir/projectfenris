import { Server } from 'socket.io'

let io = null

export function initSocket(httpServer, jwtVerify) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? ['https://projectfenris.com', 'https://www.projectfenris.com']
        : true,
      credentials: true,
    },
    path: '/socket.io',
  })

  io.use((socket, next) => {
    try {
      const raw = socket.handshake.headers.cookie ?? ''
      const match = raw.match(/(?:^|;\s*)session=([^;]+)/)
      if (!match) return next(new Error('Unauthorized'))
      const payload = jwtVerify(match[1])
      socket.userId = payload.id
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', socket => {
    socket.join(`user:${socket.userId}`)
    socket.on('join_channel', channel => {
      socket.join(`channel:${channel}`)
    })
    socket.on('leave_channel', channel => {
      socket.leave(`channel:${channel}`)
    })
  })

  return io
}

export function emitToUser(userId, event, data) {
  io?.to(`user:${userId}`).emit(event, data)
}

export function emitToChannel(channel, event, data) {
  io?.to(`channel:${channel}`).emit(event, data)
}
