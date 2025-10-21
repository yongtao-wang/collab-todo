/**
 * AuthContext - Authentication Context Provider
 *
 * Provides authentication state and methods throughout the application.
 * Manages user login/logout, access tokens, and automatic token refresh.
 *
 * @module AuthContext
 * @example
 * ```tsx
 * // Wrap your app with the provider
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 *
 * // Use the hook in components
 * function MyComponent() {
 *   const { userId, isLoggedIn, login, logout } = useAuth()
 *   // ...
 * }
 * ```
 *
 * Features:
 * - User authentication state management
 * - JWT access token management with automatic refresh
 * - Persistent login using HTTP-only refresh tokens
 * - User info retrieval from server
 * - CSRF protection
 *
 * Token Flow:
 * 1. On mount, attempts to refresh access token using refresh token cookie
 * 2. If successful, fetches user info and sets authenticated state
 * 3. Access token stored in memory (not localStorage for security)
 * 4. Refresh token stored as HTTP-only cookie by server
 */
'use client'

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'

import { AUTH_URL } from '@/utils/urls'
import { createLogger } from '@/utils/logger'
import { getCookie } from '@/utils/cookies'

interface AuthContextType {
  /** The ID of the currently authenticated user, or null if not logged in */
  userId: string | null
  /** Whether the user is currently logged in */
  isLoggedIn: boolean
  /** The current JWT access token, or null if not logged in */
  accessToken: string | null
  /** Function to log in a user with their ID and token */
  login: (userId: string, token: string) => void
  /** Function to log out the current user */
  logout: () => void
}

const logger = createLogger('AuthContext')

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * AuthProvider Component
 *
 * Wraps the application to provide authentication context to all child components.
 *
 * @param props - Component props
 * @param props.children - Child components to wrap
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  const refreshAccessToken = async () => {
    try {
      const csrfToken = getCookie('csrf_refresh_token') || ''
      const response = await fetch(`${AUTH_URL}/refresh`, {
        method: 'POST',
        credentials: 'include', // Send cookies
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
        },
      })

      if (response.ok) {
        const data = await response.json()
        const newAccessToken = data.access_token
        setAccessToken(newAccessToken)
        logger.debug('Access token refreshed')
        return newAccessToken
      } else {
        setAccessToken(null)
        return null
      }
    } catch {
      setAccessToken(null)
      return null
    }
  }

  useEffect(() => {
    const tryRefreshAndFetchUser = async () => {
      const token = await refreshAccessToken()
      if (token) {
        // Now fetch user info
        try {
          const response = await fetch(`${AUTH_URL}/me`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (response.ok) {
            const userData = await response.json()
            setUserId(userData.user_id)
            setIsLoggedIn(true)
          } else {
            setUserId(null)
            setIsLoggedIn(false)
            setAccessToken(null)
          }
        } catch {
          setUserId(null)
          setIsLoggedIn(false)
          setAccessToken(null)
        }
      } else {
        setUserId(null)
        setIsLoggedIn(false)
        setAccessToken(null)
      }
    }
    tryRefreshAndFetchUser()
  }, [])

  const login = (userId: string, access_token: string) => {
    setUserId(userId)
    setAccessToken(access_token)
    setIsLoggedIn(true)
  }

  const logout = async () => {
    try {
      if (accessToken) {
        await fetch(`${AUTH_URL}/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        })
      }
    } catch (error) {
      logger.error('Logout error:', error)
    } finally {
      // Clear access token and user info
      setAccessToken(null)
      setUserId(null)
      setIsLoggedIn(false)
    }
  }

  const value = {
    userId,
    isLoggedIn,
    accessToken,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * useAuth Hook
 *
 * React hook to access authentication context.
 * Must be used within an AuthProvider.
 *
 * @returns Authentication context with user state and methods
 * @throws Error if used outside of AuthProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { userId, isLoggedIn, accessToken, login, logout } = useAuth()
 *
 *   if (!isLoggedIn) {
 *     return <LoginButton onClick={() => login(id, token)} />
 *   }
 *
 *   return <div>Welcome, {userId}!</div>
 * }
 * ```
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
