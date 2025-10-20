import {
  disconnectSocket,
  getSocket,
  initSocket,
} from '@/utils/socketClient'

import { createLogger } from '@/utils/logger'
import { useEffect } from 'react'
import { useTodoStore } from '@/utils/todoStore'

const logger = createLogger('useSocket')

export const useSocket = (userId: string, accessToken: string) => {
  const setIsConnected = useTodoStore((state) => state.setIsConnected)
  const setError = useTodoStore((state) => state.setError)
  useEffect(() => {
    if (!userId || !accessToken) return

    // Initialize socket connection
    const socket = initSocket(accessToken)

    // Connection events
    socket.on('connect', () => {
      logger.info('Socket connected')
      setIsConnected(true)
      socket.emit('join', {
        user_id: userId,
        rev: {},  // Always send empty rev to force snapshot
      })
    })

    socket.on('disconnect', () => {
      logger.info('Socket disconnected')
      setIsConnected(false)
    })

    // Error handling
    socket.on('connect_error', (err) => {
      logger.warn('Connection error:', err.message)
      setIsConnected(false)
      setError(`Connection failed: ${err.message || 'Unable to reach server'}`)
    })

    socket.on('error', (err) => {
      logger.warn('Socket error:', err)
      setError(`Connection error: ${err.message || err}`)
    })

    socket.on('permission_error', (err) => {
      logger.warn('Permission error:', err)
      setError(`Permission error: ${err.message || err}`)
    })

    socket.on('auth_error', (err) => {
      logger.warn('Authentication error:', err)
      setError(`Authentication error: ${err.message || err}`)
    })

    return () => {
      disconnectSocket()
    }
  }, [userId, accessToken, setIsConnected, setError])

  return getSocket()
}
