/**
 * useSocket Hook
 *
 * Custom React hook for managing WebSocket connections via Socket.IO.
 * Handles connection lifecycle, authentication, and connection state management.
 *
 * @param userId - The ID of the current user
 * @param accessToken - JWT access token for authentication
 * @returns Socket.IO client instance or null if not connected
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { userId, accessToken } = useAuth()
 *   const socket = useSocket(userId, accessToken)
 *
 *   useEffect(() => {
 *     if (socket) {
 *       socket.on('my_event', handleEvent)
 *       return () => socket.off('my_event', handleEvent)
 *     }
 *   }, [socket])
 * }
 * ```
 *
 * Features:
 * - Automatic connection on mount with valid credentials
 * - Automatic disconnection on unmount
 * - Connection state management via Zustand store
 * - Error handling and logging
 * - Automatic join with empty revision to force snapshot
 *
 * Lifecycle:
 * 1. Initializes socket with access token
 * 2. Emits 'join' event on connection
 * 3. Updates connection state in store
 * 4. Cleans up on unmount
 */
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
