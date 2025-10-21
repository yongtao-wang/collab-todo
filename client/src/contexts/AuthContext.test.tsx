import { AuthProvider, useAuth } from './AuthContext'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ReactNode } from 'react'

// Mock the utilities
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/utils/cookies', () => ({
  getCookie: vi.fn(() => 'mock-csrf-token'),
}))

vi.mock('@/utils/urls', () => ({
  AUTH_URL: 'http://localhost:3000/auth',
}))

describe('AuthContext', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    global.fetch = mockFetch
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  )

  describe('Initialization', () => {
    it('should initialize with null values', () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      expect(result.current.userId).toBeNull()
      expect(result.current.isLoggedIn).toBe(false)
      expect(result.current.accessToken).toBeNull()
    })

    it('should attempt to refresh token on mount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'new-token' }),
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user_id: 'user-123' }),
      })

      renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/auth/refresh',
          expect.objectContaining({
            method: 'POST',
            credentials: 'include',
          })
        )
      })
    })

    it('should set user data after successful refresh and user fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'new-token' }),
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user_id: 'user-123' }),
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.userId).toBe('user-123')
        expect(result.current.isLoggedIn).toBe(true)
        expect(result.current.accessToken).toBe('new-token')
      })
    })

    it('should handle failed token refresh on mount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.userId).toBeNull()
        expect(result.current.isLoggedIn).toBe(false)
        expect(result.current.accessToken).toBeNull()
      })
    })

    it('should handle failed user fetch after successful refresh', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'new-token' }),
      })
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.userId).toBeNull()
        expect(result.current.isLoggedIn).toBe(false)
        expect(result.current.accessToken).toBeNull()
      })
    })

    it('should handle network errors during initialization', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.userId).toBeNull()
        expect(result.current.isLoggedIn).toBe(false)
        expect(result.current.accessToken).toBeNull()
      })
    })
  })

  describe('login', () => {
    it('should set user data when login is called', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoggedIn).toBe(false)
      })

      act(() => {
        result.current.login('user-456', 'access-token-abc')
      })

      expect(result.current.userId).toBe('user-456')
      expect(result.current.isLoggedIn).toBe(true)
      expect(result.current.accessToken).toBe('access-token-abc')
    })

    it('should update existing session with new credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'initial-token' }),
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user_id: 'user-initial' }),
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.userId).toBe('user-initial')
      })

      act(() => {
        result.current.login('user-new', 'new-token')
      })

      expect(result.current.userId).toBe('user-new')
      expect(result.current.accessToken).toBe('new-token')
      expect(result.current.isLoggedIn).toBe(true)
    })
  })

  describe('logout', () => {
    it('should clear user data on logout', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token' }),
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user_id: 'user-123' }),
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoggedIn).toBe(true)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      await act(async () => {
        await result.current.logout()
      })

      expect(result.current.userId).toBeNull()
      expect(result.current.isLoggedIn).toBe(false)
      expect(result.current.accessToken).toBeNull()
    })

    it('should call logout endpoint with access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'my-token' }),
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user_id: 'user-123' }),
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.accessToken).toBe('my-token')
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      await act(async () => {
        await result.current.logout()
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/auth/logout',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer my-token' },
          credentials: 'include',
        })
      )
    })

    it('should clear user data even if logout request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token' }),
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user_id: 'user-123' }),
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoggedIn).toBe(true)
      })

      mockFetch.mockRejectedValueOnce(new Error('Logout failed'))

      await act(async () => {
        await result.current.logout()
      })

      expect(result.current.userId).toBeNull()
      expect(result.current.isLoggedIn).toBe(false)
      expect(result.current.accessToken).toBeNull()
    })

    it('should not call logout endpoint if no access token exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.accessToken).toBeNull()
      })

      await act(async () => {
        await result.current.logout()
      })

      // Should only have called refresh during initialization
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(result.current.userId).toBeNull()
      expect(result.current.isLoggedIn).toBe(false)
    })
  })

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      expect(() => {
        renderHook(() => useAuth())
      }).toThrow('useAuth must be used within an AuthProvider')
    })

    it('should return auth context when used within AuthProvider', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      expect(result.current).toHaveProperty('userId')
      expect(result.current).toHaveProperty('isLoggedIn')
      expect(result.current).toHaveProperty('accessToken')
      expect(result.current).toHaveProperty('login')
      expect(result.current).toHaveProperty('logout')
    })
  })

  describe('Token refresh flow', () => {
    it('should fetch user info after successful token refresh', async () => {
      const mockAccessToken = 'refreshed-token-123'
      const mockUserId = 'user-789'

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: mockAccessToken }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user_id: mockUserId }),
        })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/auth/me',
          expect.objectContaining({
            headers: { Authorization: `Bearer ${mockAccessToken}` },
          })
        )
      })

      expect(result.current.userId).toBe(mockUserId)
      expect(result.current.accessToken).toBe(mockAccessToken)
      expect(result.current.isLoggedIn).toBe(true)
    })

    it('should include CSRF token in refresh request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/auth/refresh',
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-CSRF-TOKEN': 'mock-csrf-token',
            }),
          })
        )
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle malformed JSON in refresh response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.accessToken).toBeNull()
        expect(result.current.isLoggedIn).toBe(false)
      })
    })

    it('should handle malformed JSON in user fetch response', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'valid-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => {
            throw new Error('Invalid JSON')
          },
        })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.userId).toBeNull()
        expect(result.current.isLoggedIn).toBe(false)
        expect(result.current.accessToken).toBeNull()
      })
    })
  })
})
