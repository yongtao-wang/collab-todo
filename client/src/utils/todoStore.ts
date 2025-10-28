import { UI_CONFIG } from '@/constants/config'
import { create } from 'zustand'

interface TodoState {
  isConnected: boolean
  setIsConnected: (v: boolean) => void
  listenersReady: boolean
  setListenersReady: (ready: boolean) => void
  message: string | null
  error: string | null
  setMessage: (msg: string | null) => void
  setError: (error: string | null) => void
}

let errorTimeoutId: NodeJS.Timeout | null = null
let messageTimeoutId: NodeJS.Timeout | null = null

export const useTodoStore = create<TodoState>((set) => ({
  isConnected: false,
  setIsConnected: (v) => set({ isConnected: v }),
  message: null,
  error: null,

  listenersReady: false,
  setListenersReady: (ready: boolean) => set({ listenersReady: ready }),
  
  setError: (msg: string | null, duration = UI_CONFIG.ERROR_DURATION) => {
    if (errorTimeoutId) clearTimeout(errorTimeoutId)
    set({ error: msg })
    if (msg) {
      errorTimeoutId = setTimeout(() => set({ error: null }), duration)
    }
  },

  setMessage: (msg: string | null, duration = UI_CONFIG.MESSAGE_DURATION) => {
    if (messageTimeoutId) clearTimeout(messageTimeoutId)
    set({ message: msg })
    if (msg) {
      messageTimeoutId = setTimeout(() => set({ message: null }), duration)
    }
  },
}))