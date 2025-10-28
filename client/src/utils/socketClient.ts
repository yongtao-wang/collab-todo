// client/src/utils/socketClient.ts
import { Socket, io } from 'socket.io-client'

import { SOCKET_CONFIG } from '@/constants/config'
import { SOCKET_URL } from '@/utils/urls'

let socket: Socket | null = null

export function initSocket(accessToken: string) {
  if (socket) return socket // Singleton

  if (!SOCKET_URL) {
    throw new Error('SOCKET_URL is not defined')
  }

  socket = io(SOCKET_URL, {
    transports: [...SOCKET_CONFIG.TRANSPORTS], // Force WebSocket (prevent polling)
    auth: { token: accessToken },
    reconnection: true,
    reconnectionAttempts: SOCKET_CONFIG.RECONNECTION_ATTEMPTS,
    reconnectionDelay: SOCKET_CONFIG.RECONNECTION_DELAY,
    reconnectionDelayMax: SOCKET_CONFIG.RECONNECTION_DELAY_MAX,
    timeout: SOCKET_CONFIG.TIMEOUT,
  })

  // Expose socket to window for debugging (only in development)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    ;(window as unknown as Record<string, unknown>)._socket = socket
  }

  return socket
}

export function getSocket(): Socket | null {
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  // Clean up global reference
  if (typeof window !== 'undefined') {
    delete (window as unknown as Record<string, unknown>)._socket
  }
}
