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
  userId: string | null
  isLoggedIn: boolean
  accessToken: string | null
  login: (userId: string, token: string) => void
  logout: () => void
}

const logger = createLogger('AuthContext')

const AuthContext = createContext<AuthContextType | undefined>(undefined)

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
    } catch (error) {
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

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
