'use client'

import { useEffect, useState } from 'react'

import { createLogger } from '@/utils/logger'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  listId: string
  listName: string
  onShare: (userId: string, role: 'viewer' | 'editor') => void
}

const logger = createLogger('ShareModal')

export default function ShareModal({
  isOpen,
  onClose,
  listId,
  listName,
  onShare,
}: ShareModalProps) {
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Add ESC key listener
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setUserId('')
      setRole('viewer')
      setIsSubmitting(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId.trim()) return

    setIsSubmitting(true)
    try {
      onShare(userId, role)
      setUserId('')
      setRole('viewer')
    } catch (error) {
      logger.error('Error sharing:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'
      onClick={onClose}
    >
      <div
        className='bg-white rounded-lg shadow-xl w-full max-w-md'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between p-6 border-b'>
          <div>
            <h2 className='text-xl font-bold text-gray-900'>Share Todo List</h2>
            <p className='text-sm text-gray-500 mt-1'>{listName}</p>
            <p className='text-xs text-gray-300 mt-1'>{listId}</p>
          </div>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600 transition-colors'
          >
            <svg
              className='w-6 h-6'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          {/* User ID Input */}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              User ID <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder='Enter user ID to share with'
              className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm'
              required
              disabled={isSubmitting}
            />
            <p className='text-xs text-gray-500 mt-1'>
              Enter the exact user ID of the person you want to share with
            </p>
          </div>

          {/* Role Selection */}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Permission Level
            </label>
            <div className='space-y-2'>
              <label className='flex items-start space-x-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors'>
                <input
                  type='radio'
                  name='role'
                  value='viewer'
                  checked={role === 'viewer'}
                  onChange={(e) =>
                    setRole(e.target.value as 'viewer' | 'editor')
                  }
                  className='mt-1 w-4 h-4 text-blue-500'
                  disabled={isSubmitting}
                />
                <div className='flex-1'>
                  <div className='font-medium text-gray-900'>Viewer</div>
                  <div className='text-sm text-gray-500'>
                    Can view todos but cannot make changes
                  </div>
                </div>
              </label>

              <label className='flex items-start space-x-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors'>
                <input
                  type='radio'
                  name='role'
                  value='editor'
                  checked={role === 'editor'}
                  onChange={(e) =>
                    setRole(e.target.value as 'viewer' | 'editor')
                  }
                  className='mt-1 w-4 h-4 text-blue-500'
                  disabled={isSubmitting}
                />
                <div className='flex-1'>
                  <div className='font-medium text-gray-900'>Editor</div>
                  <div className='text-sm text-gray-500'>
                    Can view, create, edit, and delete todos
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Info Box */}
          <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
            <div className='flex items-start space-x-2'>
              <svg
                className='w-5 h-5 text-blue-500 mt-0.5'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
              <p className='text-sm text-blue-800'>
                The user will be granted {role} access to this todo list. They
                can access it using their user ID.
              </p>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className='flex justify-end space-x-3 p-6 border-t bg-gray-50'>
          <button
            type='button'
            onClick={onClose}
            className='px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium'
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!userId.trim() || isSubmitting}
            className='px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center space-x-2'
          >
            {isSubmitting ? (
              <>
                <svg
                  className='animate-spin h-4 w-4'
                  fill='none'
                  viewBox='0 0 24 24'
                >
                  <circle
                    className='opacity-25'
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='4'
                  />
                  <path
                    className='opacity-75'
                    fill='currentColor'
                    d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                  />
                </svg>
                <span>Sending...</span>
              </>
            ) : (
              <span>Send Invitation</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
