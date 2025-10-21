import { Socket } from 'socket.io-client'
import { vi } from 'vitest'

// Define a generic event handler type
export type EventHandler = (...args: unknown[]) => void

// Define mock socket interface with test helpers
export interface MockSocket {
  id: string
  connected: boolean
  disconnected: boolean
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  removeAllListeners: ReturnType<typeof vi.fn>
  once: ReturnType<typeof vi.fn>
  removeListener: ReturnType<typeof vi.fn>
  listeners: ReturnType<typeof vi.fn>
  simulateEvent: (event: string, ...args: unknown[]) => void
  getHandlers: (
    event?: string
  ) => EventHandler[] | Record<string, EventHandler[]>
}

export type TestSocket = MockSocket & Socket
