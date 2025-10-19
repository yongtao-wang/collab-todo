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
    <div className='flex flex-col h-screen bg-gray-50'>
      {/* Header Section - Fixed at top */}
      <div className='flex-shrink-0 border-b border-gray-200 bg-white shadow-sm'>
        <div className='max-w-7xl mx-auto p-6'>
          <div className='flex flex-col items-center justify-between'>
            <h1 className='text-3xl font-bold text-gray-900'>
              Collaborative Todo
            </h1>
            <p className='text-sm text-gray-600 mt-1'>
              Manage your tasks efficiently
            </p>
            {isLoggedIn ? (
              <div className='flex items-center gap-4'>
                <p className='text-sm text-gray-500'>User ID: {userId}</p>
                <button
                  onClick={handleLogout}
                  className='bg-red-500 text-white text-xs px-4 py-2 m-2 rounded hover:bg-red-600 transition-colors'
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className='bg-teal-600 text-white px-4 py-2 m-2 text-sm rounded hover:bg-teal-700 transition-colors font-medium'
              >
                Login/Signup
              </button>
            )}
          </div>

          {/* Messages */}
          {message && (
            <div className='mt-3 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm'>
              {message}
            </div>
          )}

          {error && (
            <div className='mt-3 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm'>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area - Fills remaining space */}
      <div className='flex-1 overflow-hidden'>
        {isLoggedIn && userId ? (
          <ListContainer
            userId={userId}
            onMessage={handleMessage}
            onError={handleError}
          />
        ) : (
          <div className='flex items-center justify-center h-full'>
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
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  )
}
