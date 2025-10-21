import type { EventHandler } from '../test-types'
import { MockSocket } from '../test-types'
import { vi } from 'vitest'

export const createMockSocket = (): MockSocket => {
  const eventHandlers: Record<string, EventHandler[]> = {}

  const mockSocket: MockSocket = {
    id: 'mock-socket-id',
    connected: true,
    disconnected: false,
    on: vi.fn((event: string, handler: EventHandler) => {
      if (!eventHandlers[event]) {
        eventHandlers[event] = []
      }
      eventHandlers[event].push(handler)
      return mockSocket
    }),
    once: vi.fn((event: string, handler: EventHandler) => {
      const wrappedHandler: EventHandler = (...args: unknown[]) => {
        handler(...args)
        mockSocket.off(event, wrappedHandler)
      }
      return mockSocket.on(event, wrappedHandler)
    }),
    off: vi.fn((event: string, handler?: EventHandler) => {
      if (handler && eventHandlers[event]) {
        eventHandlers[event] = eventHandlers[event].filter((h) => h !== handler)
      } else if (eventHandlers[event]) {
        delete eventHandlers[event]
      }
      return mockSocket
    }),
    removeListener: vi.fn((event: string, handler?: EventHandler) => {
      return mockSocket.off(event, handler)
    }),
    emit: vi.fn((...args) => {
      const [event, ...eventArgs] = args
      const handlers = eventHandlers[event]
      if (handlers) {
        handlers.forEach((handler) => handler(...eventArgs))
      }
      return mockSocket
    }),
    connect: vi.fn(() => {
      mockSocket.connected = true
      mockSocket.disconnected = false
      return mockSocket
    }),
    disconnect: vi.fn(() => {
      mockSocket.connected = false
      mockSocket.disconnected = true
      return mockSocket
    }),
    removeAllListeners: vi.fn((event?: string) => {
      if (event) {
        delete eventHandlers[event]
      } else {
        Object.keys(eventHandlers).forEach((key) => delete eventHandlers[key])
      }
      return mockSocket
    }),
    listeners: vi.fn((event: string) => {
      return eventHandlers[event] || []
    }),
    // Helper method to simulate events (for testing)
    simulateEvent: (event: string, ...args: unknown[]) => {
      const handlers = eventHandlers[event]
      if (handlers) {
        handlers.forEach((handler) => handler(...args))
      }
    },
    // Helper to get registered handlers (for testing)
    getHandlers: (event?: string) => {
      if (event) {
        return eventHandlers[event] || []
      }
      return { ...eventHandlers }
    },
  }

  return mockSocket
}
