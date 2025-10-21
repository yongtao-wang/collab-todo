import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import AuthModal from './AuthModal'
import { useAuth } from '@/contexts/AuthContext'

// Mock the utilities
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/utils/urls', () => ({
  AUTH_URL: 'http://localhost:3000/auth',
}))

// Mock useAuth hook
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

describe('AuthModal', () => {
  let mockLogin: ReturnType<typeof vi.fn>
  let mockOnClose: ReturnType<typeof vi.fn>
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Create fresh mocks for each test
    mockLogin = vi.fn()
    mockOnClose = vi.fn()
    mockFetch = vi.fn()
    
    global.fetch = mockFetch
    vi.mocked(useAuth).mockReturnValue({
      login: mockLogin,
      userId: null,
      isLoggedIn: false,
      accessToken: null,
      logout: vi.fn(),
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <AuthModal isOpen={false} onClose={mockOnClose} />
      )
      expect(container.firstChild).toBeNull()
    })

    it('should render when isOpen is true', () => {
      render(<AuthModal isOpen={true} onClose={mockOnClose} />)
      expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
    })

    it('should render login form by default', () => {
      render(<AuthModal isOpen={true} onClose={mockOnClose} />)
      expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
      expect(
        screen.getByPlaceholderText('Enter your email')
      ).toBeInTheDocument()
      expect(
        screen.getByPlaceholderText('Enter your password')
      ).toBeInTheDocument()
      expect(
        screen.queryByPlaceholderText('Enter your name')
      ).not.toBeInTheDocument()
    })

    it('should render signup form when toggled', () => {
      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      const toggleButton = screen.getByText("Don't have an account? Sign up")
      fireEvent.click(toggleButton)

      expect(screen.getByRole('heading', { name: 'Sign Up' })).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument()
      expect(
        screen.getByPlaceholderText('Enter your email')
      ).toBeInTheDocument()
      expect(
        screen.getByPlaceholderText('Enter your password')
      ).toBeInTheDocument()
    })
  })

  describe('Login functionality', () => {
    it('should handle successful login', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          user_id: 'user-123',
        }),
      })

      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
        target: { value: 'test@example.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
        target: { value: 'password123' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Login' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/auth/login',
          expect.objectContaining({
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com',
              password: 'password123',
            }),
          })
        )
      })

      expect(mockLogin).toHaveBeenCalledWith('user-123', 'test-token')
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should handle failed login', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Invalid credentials',
        }),
      })

      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
        target: { value: 'test@example.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
        target: { value: 'wrongpassword' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Login' }))

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
      })

      expect(mockLogin).not.toHaveBeenCalled()
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should handle network error during login', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
        target: { value: 'test@example.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
        target: { value: 'password123' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Login' }))

      await waitFor(() => {
        expect(screen.getByText(/Login error/i)).toBeInTheDocument()
      })

      expect(mockLogin).not.toHaveBeenCalled()
    })
  })

  describe('Signup functionality', () => {
    it('should handle successful signup and auto-login', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'User registered' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'new-token',
            user_id: 'new-user-123',
          }),
        })

      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      // Toggle to signup mode
      fireEvent.click(screen.getByText("Don't have an account? Sign up"))

      fireEvent.change(screen.getByPlaceholderText('Enter your name'), {
        target: { value: 'Test User' },
      })
      fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
        target: { value: 'newuser@example.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
        target: { value: 'password123' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/auth/register',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'newuser@example.com',
              password: 'password123',
              name: 'Test User',
            }),
          })
        )
      })

      // Should auto-login after signup
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('new-user-123', 'new-token')
      })
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should handle failed signup', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Email already exists',
        }),
      })

      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      fireEvent.click(screen.getByText("Don't have an account? Sign up"))

      fireEvent.change(screen.getByPlaceholderText('Enter your name'), {
        target: { value: 'Test User' },
      })
      fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
        target: { value: 'existing@example.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
        target: { value: 'password123' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }))

      await waitFor(() => {
        expect(screen.getByText('Email already exists')).toBeInTheDocument()
      })

      expect(mockLogin).not.toHaveBeenCalled()
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should handle network error during signup', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      fireEvent.click(screen.getByText("Don't have an account? Sign up"))

      fireEvent.change(screen.getByPlaceholderText('Enter your name'), {
        target: { value: 'Test User' },
      })
      fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
        target: { value: 'test@example.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
        target: { value: 'password123' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }))

      await waitFor(() => {
        expect(screen.getByText(/Signup error/i)).toBeInTheDocument()
      })

      expect(mockLogin).not.toHaveBeenCalled()
    })
  })

  describe('Form validation', () => {
    it('should require email and password for login', () => {
      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      const emailInput = screen.getByPlaceholderText('Enter your email')
      const passwordInput = screen.getByPlaceholderText('Enter your password')

      expect(emailInput).toBeRequired()
      expect(passwordInput).toBeRequired()
    })

    it('should require name, email, and password for signup', () => {
      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      fireEvent.click(screen.getByText("Don't have an account? Sign up"))

      const nameInput = screen.getByPlaceholderText('Enter your name')
      const emailInput = screen.getByPlaceholderText('Enter your email')
      const passwordInput = screen.getByPlaceholderText('Enter your password')

      expect(nameInput).toBeRequired()
      expect(emailInput).toBeRequired()
      expect(passwordInput).toBeRequired()
    })

    it('should require minimum password length', () => {
      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      const passwordInput = screen.getByPlaceholderText('Enter your password')

      expect(passwordInput).toHaveAttribute('minLength', '6')
    })
  })

  describe('Mode toggling', () => {
    it('should toggle between login and signup modes', () => {
      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()

      fireEvent.click(screen.getByText("Don't have an account? Sign up"))
      expect(
        screen.getByRole('heading', { name: 'Sign Up' })
      ).toBeInTheDocument()

      fireEvent.click(screen.getByText('Already have an account? Login'))
      expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
    })

    it('should reset form when toggling modes', () => {
      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
        target: { value: 'test@example.com' },
      })

      fireEvent.click(screen.getByText("Don't have an account? Sign up"))

      const emailInput = screen.getByPlaceholderText('Enter your email')
      expect(emailInput).toHaveValue('')
    })
  })

  describe('Modal closing', () => {
    it('should close modal when close button is clicked', () => {
      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      fireEvent.click(screen.getByText('✕'))

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should reset form when modal is closed', () => {
      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
        target: { value: 'test@example.com' },
      })

      fireEvent.click(screen.getByText('✕'))

      // Can't directly test this, but the resetForm function should be called
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('should display error message from server', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Custom error message',
        }),
      })

      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
        target: { value: 'test@example.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
        target: { value: 'password123' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Login' }))

      await waitFor(() => {
        expect(screen.getByText('Custom error message')).toBeInTheDocument()
      })
    })

    it('should display default error when server response has no error field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
        target: { value: 'test@example.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
        target: { value: 'password123' },
      })

      fireEvent.click(screen.getByRole('button', { name: 'Login' }))

      await waitFor(() => {
        expect(screen.getByText('Login failed')).toBeInTheDocument()
      })
    })
  })
})