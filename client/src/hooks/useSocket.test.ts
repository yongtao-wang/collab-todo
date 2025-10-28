import * as socketClient from '@/utils/socketClient'

import type { MockSocket, TestSocket } from '@/test/test-types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@/test/test-utils'

import { createMockSocket } from '@/test/mocks/socket'
import { useSocket } from '@/hooks/useSocket'

const { mockSetIsConnected, mockSetError, mockSetListenersReady } = vi.hoisted(() => ({
  mockSetIsConnected: vi.fn(),
  mockSetError: vi.fn(),
  mockSetListenersReady: vi.fn(),
}))
// Mock the store
vi.mock('@/utils/todoStore', () => {
  const mockState = {
    setIsConnected: mockSetIsConnected,
    setError: mockSetError,
    setListenersReady: mockSetListenersReady,
    listenersReady: true,
    isConnected: true,
  }
  return {
    useTodoStore: Object.assign(
      <T>(selector: (state: typeof mockState) => T): T => selector(mockState),
      { getState: () => mockState }
    ),
  }
})

// Mock socketClient
vi.mock('@/utils/socketClient', () => ({
  initSocket: vi.fn(),
  getSocket: vi.fn(),
  disconnectSocket: vi.fn(),
}))

describe('useSocket', () => {
  const mockUserId = 'user-123'
  const mockAccessToken = 'token-abc'

  let mockSocket: MockSocket

  beforeEach(() => {
    mockSetIsConnected.mockClear()
    mockSetError.mockClear()
    mockSetListenersReady.mockClear()

    // Create fresh mock socket for each test
    mockSocket = createMockSocket()

    // Update socketClient mocks to use the fresh socket
    vi.mocked(socketClient.initSocket).mockReturnValue(mockSocket as TestSocket)
    vi.mocked(socketClient.getSocket).mockReturnValue(mockSocket as TestSocket)

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Connection lifecycle', () => {
    it('should initialize socket when userId and accessToken are provided', () => {
      renderHook(() => useSocket(mockUserId, mockAccessToken))

      expect(mockSocket.on).toHaveBeenCalledWith(
        'connect',
        expect.any(Function)
      )
      expect(mockSocket.on).toHaveBeenCalledWith(
        'disconnect',
        expect.any(Function)
      )
    })

    it('should not initialize socket when userId is missing', () => {
      const onCallCount = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls
        .length
      renderHook(() => useSocket('', mockAccessToken))

      // Should not add new listeners
      expect(mockSocket.on).toHaveBeenCalledTimes(onCallCount)
    })

    it('should not initialize socket when accessToken is missing', () => {
      const onCallCount = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls
        .length
      renderHook(() => useSocket(mockUserId, ''))

      // Should not add new listeners
      expect(mockSocket.on).toHaveBeenCalledTimes(onCallCount)
    })

    it('should handle connect event', async () => {
      renderHook(() => useSocket(mockUserId, mockAccessToken))

      // Get the connect callback
      const connectCallback = (
        mockSocket.on as ReturnType<typeof vi.fn>
      ).mock.calls.find((call) => call[0] === 'connect')?.[1]

      expect(connectCallback).toBeDefined()

      // Simulate connect
      connectCallback?.()

      await waitFor(() => {
        expect(mockSetIsConnected).toHaveBeenCalledWith(true)
      })
      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('join', {})
      })
    })

    it('should handle disconnect event', async () => {
      renderHook(() => useSocket(mockUserId, mockAccessToken))

      // Get the disconnect callback
      const disconnectCallback = (
        mockSocket.on as ReturnType<typeof vi.fn>
      ).mock.calls.find((call) => call[0] === 'disconnect')?.[1]

      expect(disconnectCallback).toBeDefined()

      // Simulate disconnect
      disconnectCallback?.()

      await waitFor(() => {
        expect(mockSetIsConnected).toHaveBeenCalledWith(false)
      })
    })
  })

  describe('Error handling', () => {
    it('should handle connect_error', async () => {
      renderHook(() => useSocket(mockUserId, mockAccessToken))

      const errorCallback = (
        mockSocket.on as ReturnType<typeof vi.fn>
      ).mock.calls.find((call) => call[0] === 'connect_error')?.[1]

      const error = { message: 'Connection failed' }
      errorCallback?.(error)

      await waitFor(() => {
        expect(mockSetIsConnected).toHaveBeenCalledWith(false)
        expect(mockSetError).toHaveBeenCalledWith(
          expect.stringContaining('Connection failed')
        )
      })
    })

    it('should handle generic socket error', async () => {
      renderHook(() => useSocket(mockUserId, mockAccessToken))

      const errorCallback = (
        mockSocket.on as ReturnType<typeof vi.fn>
      ).mock.calls.find((call) => call[0] === 'error')?.[1]

      const error = { message: 'Socket error occurred' }
      errorCallback?.(error)

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(
          expect.stringContaining('Socket error occurred')
        )
      })
    })

    it('should handle permission_error', async () => {
      renderHook(() => useSocket(mockUserId, mockAccessToken))

      const errorCallback = (
        mockSocket.on as ReturnType<typeof vi.fn>
      ).mock.calls.find((call) => call[0] === 'permission_error')?.[1]

      const error = { message: 'Access denied' }
      errorCallback?.(error)

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(
          expect.stringContaining('Access denied')
        )
      })
    })

    it('should handle auth_error', async () => {
      renderHook(() => useSocket(mockUserId, mockAccessToken))

      const errorCallback = (
        mockSocket.on as ReturnType<typeof vi.fn>
      ).mock.calls.find((call) => call[0] === 'auth_error')?.[1]

      const error = { message: 'Invalid token' }
      errorCallback?.(error)

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(
          expect.stringContaining('Invalid token')
        )
      })
    })
  })

  describe('Cleanup', () => {
    it('should disconnect socket on unmount', () => {
      const { unmount } = renderHook(() =>
        useSocket(mockUserId, mockAccessToken)
      )

      unmount()

      expect(socketClient.disconnectSocket).toHaveBeenCalled()
    })

    it('should reconnect when userId changes', () => {
      const { rerender } = renderHook(
        ({ userId, token }) => useSocket(userId, token),
        {
          initialProps: { userId: mockUserId, token: mockAccessToken },
        }
      )

      const initialConnectCalls = (
        mockSocket.on as ReturnType<typeof vi.fn>
      ).mock.calls.filter((call) => call[0] === 'connect').length

      // Change userId
      rerender({ userId: 'new-user-id', token: mockAccessToken })

      const finalConnectCalls = (
        mockSocket.on as ReturnType<typeof vi.fn>
      ).mock.calls.filter((call) => call[0] === 'connect').length

      expect(finalConnectCalls).toBeGreaterThan(initialConnectCalls)
      expect(socketClient.disconnectSocket).toHaveBeenCalled()
    })
  })

  describe('Return value', () => {
    it('should return socket instance', () => {
      const { result } = renderHook(() =>
        useSocket(mockUserId, mockAccessToken)
      )

      expect(result.current).toBe(mockSocket)
    })
  })
})
