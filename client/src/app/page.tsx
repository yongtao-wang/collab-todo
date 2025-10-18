'use client'

import AuthModal from '@/components/AuthModal'
import ListContainer from '@/components/ListContainer'
import localforage from 'localforage'
import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'

export default function Home() {
  const { userId, isLoggedIn, logout } = useAuth()
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false)

  const handleMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 5000) // Clear message after 5 seconds
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
    setTimeout(() => setError(''), 5000) // Clear error after 5 seconds
  }

  const openAuthModal = () => {
    setShowAuthModal(true)
  }

  const handleLogout = async () => {
    await logout()
    await localforage.clear()
    handleMessage('Successfully logged out!')
  }

  return (
    <div className='flex flex-col items-center min-h-screen bg-gray-50'>
      <div className='w-full max-w-6xl p-6'>
        <div className='text-center mb-8'>
          <h1 className='text-5xl font-bold text-gray-900 mb-2'>
            Collaborative Todo
          </h1>
          <p className='text-gray-600'>Manage your tasks efficiently</p>
          {isLoggedIn ? (
            <div className='mt-4 flex items-center justify-center gap-4'>
              <p className='text-sm text-gray-500'>User ID: {userId}</p>
              <button
                onClick={handleLogout}
                className='bg-red-500 text-white text-xs px-4 py-1 rounded hover:bg-red-600 transition-colors'
              >
                Logout
              </button>
            </div>
          ) : (
            <div className='mt-6 flex items-center justify-center gap-2'>
              <button
                onClick={openAuthModal}
                className='bg-teal-600 text-white px-4 py-1 text-sm rounded hover:bg-teal-700 transition-colors font-medium'
              >
                Login/Signup
              </button>
            </div>
          )}
        </div>

        {message && (
          <div className='mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg'>
            {message}
          </div>
        )}

        {error && (
          <div className='mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg'>
            {error}
          </div>
        )}

        {isLoggedIn && userId ? (
          <ListContainer
            userId={userId}
            onMessage={handleMessage}
            onError={handleError}
          />
        ) : (
          <div className='text-center py-12'>
            <div className='max-w-md mx-auto bg-white rounded-lg shadow-lg p-8'>
              <div className='mb-6'>
                <svg
                  className='mx-auto h-16 w-16 text-gray-400'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                </svg>
              </div>
              <h3 className='text-xl font-semibold text-gray-900 mb-2'>
                Welcome to Collaborative Todo
              </h3>
              <p className='text-gray-600 mb-6'>
                Please log in or sign up to start managing your tasks and
                collaborate with others.
              </p>
            </div>
          </div>
        )}

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </div>
    </div>
  )
}
