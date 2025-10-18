'use client'

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'

import { AUTH_URL } from '@/utils/config'

interface AuthContextType {
  userId: string | null
  isLoggedIn: boolean
  accessToken: string | null
  login: (userId: string, token: string) => void
  logout: () => void
  checkAuthStatus: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  // Check if user is already logged in via JWT tokens
  const checkAuthStatus = async () => {
    const token = localStorage.getItem('access_token')

    if (token) {
      try {
        // TODO: Call backend service to validate access token
        const response = await fetch(`${AUTH_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (response.ok) {
          const userData = await response.json()
          setUserId(userData.user_id)
          setAccessToken(token)
          setIsLoggedIn(true)
        } else {
          // Token is invalid, clear it
          localStorage.removeItem('access_token')
          setUserId(null)
          setAccessToken(null)
          setIsLoggedIn(false)
        }
      } catch (error) {
        console.error('Auth validation error:', error)
        // Clear invalid tokens
        localStorage.removeItem('access_token')
        setUserId(null)
        setAccessToken(null)
        setIsLoggedIn(false)
      }
    }
  }

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const login = (userId: string, access_token: string) => {
    localStorage.setItem('access_token', access_token)
    setUserId(userId)
    setAccessToken(access_token)
    setIsLoggedIn(true)
  }

  const logout = async () => {
    try {
      if (accessToken) {
        // TODO: Call backend auth service to invalidate tokens
        await fetch(`${AUTH_URL}/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear local state and tokens
      localStorage.removeItem('access_token')
      setUserId(null)
      setAccessToken(null)
      setIsLoggedIn(false)
    }
  }

  const value = {
    userId,
    isLoggedIn,
    accessToken,
    login,
    logout,
    checkAuthStatus,
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
