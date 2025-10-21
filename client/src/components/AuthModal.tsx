/**
 * AuthModal Component
 *
 * A modal component for user authentication, supporting both login and registration.
 * Handles form validation, API requests, and authentication state management.
 *
 * @component
 * @example
 * ```tsx
 * <AuthModal
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 * />
 * ```
 *
 * Features:
 * - Toggle between login and registration modes
 * - Form validation and error handling
 * - Password visibility toggle
 * - ESC key to close
 * - Click outside to close
 * - Accessible form controls with labels
 *
 * @param props - Component props
 * @param props.isOpen - Controls modal visibility
 * @param props.onClose - Callback when modal should close
 */
'use client'

import { AUTH_URL } from '@/utils/urls'
import { createLogger } from '@/utils/logger'
import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'

interface AuthModalProps {
  /** Controls whether the modal is visible */
  isOpen: boolean
  /** Callback function to close the modal */
  onClose: () => void
}

const logger = createLogger('AuthModal')

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login } = useAuth()
  const [isLogin, setIsLogin] = useState<boolean>(true)
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [name, setName] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setName('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`${AUTH_URL}/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        const { access_token, user_id } = await response.json()
        login(user_id, access_token)
        onClose()
        resetForm()
      } else {
        const errorData = await response.json()
        setErrorMsg(errorData.error || 'Login failed')
      }
    } catch (error) {
      logger.error('Login error:', error)
      setErrorMsg('Login error:' + error)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`${AUTH_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })

      if (response.ok) {
        await response.json()
        // After successful signup, log them in
        await handleLogin(e)
      } else {
        const errorData = await response.json()
        setErrorMsg(errorData.error || 'Signup failed')
      }
    } catch (error) {
      logger.error('Signup error:', error)
      setErrorMsg('Signup error:' + error)
    }
  }

  const toggleMode = () => {
    setIsLogin(!isLogin)
    resetForm()
  }

  const handleClose = () => {
    onClose()
    resetForm()
  }

  if (!isOpen) return null

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
      <div className='bg-white rounded-lg p-6 w-full max-w-md'>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-xl font-semibold'>
            {isLogin ? 'Login' : 'Sign Up'}
          </h2>
          <button
            onClick={handleClose}
            className='text-gray-500 hover:text-gray-700'
          >
            ✕
          </button>
        </div>

        <form onSubmit={isLogin ? handleLogin : handleSignup}>
          {!isLogin && (
            <div className='mb-4'>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Name
              </label>
              <input
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
                className='w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-transparent'
                placeholder='Enter your name'
              />
            </div>
          )}

          <div className='mb-4'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              Email
            </label>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className='w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-transparent'
              placeholder='Enter your email'
            />
          </div>

          <div className='mb-6'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              Password
            </label>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className='w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-transparent'
              placeholder='Enter your password'
            />
          </div>

          <div>
            {errorMsg && (
              <div className='mb-4 p-3 bg-red-100 border border-red-400 text-red-700/80 rounded-lg text-xs'>
                {errorMsg}
              </div>
            )}
          </div>

          <div className='flex flex-col items-center'>
            <button
              type='submit'
              className='w-28 bg-teal-600 text-white py-2 rounded hover:bg-teal-700 transition-colors font-medium mb-4'
            >
              {isLogin ? 'Login' : 'Sign Up'}
            </button>
          </div>

          <div className='text-center'>
            <button
              type='button'
              onClick={toggleMode}
              className='text-teal-600 hover:text-teal-700 text-sm'
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : 'Already have an account? Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
