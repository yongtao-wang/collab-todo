/**
 * TodoModal Component
 *
 * A modal dialog for viewing and editing todo item details.
 * Provides a comprehensive form for managing all todo properties including
 * name, description, status, due date, and completion state.
 *
 * @component
 * @example
 * ```tsx
 * <TodoModal
 *   todo={selectedTodo}
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   onUpdate={(updates) => handleUpdate(todo.id, updates)}
 *   onDelete={(id) => handleDelete(id)}
 * />
 * ```
 *
 * Features:
 * - Edit todo name, description, status, and due date
 * - Toggle completion status
 * - Delete todo with confirmation
 * - Date picker for due dates
 * - ESC key to close
 * - Click outside to close
 * - Form validation
 * - Real-time state synchronization with parent todo
 *
 * @param props - Component props
 * @param props.todo - The todo item to display/edit
 * @param props.isOpen - Controls modal visibility
 * @param props.onClose - Callback when modal should close
 * @param props.onUpdate - Callback to update the todo
 * @param props.onDelete - Callback to delete the todo
 */
'use client'

import { useEffect, useState } from 'react'

import DatePicker from 'react-datepicker'
import { TodoItem } from '@/types/todo'

interface ToDoModalProps {
  /** The todo item to display and edit */
  todo: TodoItem
  /** Controls whether the modal is visible */
  isOpen: boolean
  /** Callback function to close the modal */
  onClose: () => void
  /** Callback function to update the todo with partial changes */
  onUpdate: (updates: Partial<TodoItem>) => void
  /** Callback function to delete the todo by ID */
  onDelete: (id: string) => void
}

export default function ToDoModal({
  todo,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}: ToDoModalProps) {
  const [name, setName] = useState(todo.name)
  const [description, setDescription] = useState(todo.description || '')
  const [status, setStatus] = useState(todo.status)
  const [dueDate, setDueDate] = useState(todo.due_date || '')
  const [done, setDone] = useState(todo.done)

  // Update local state when todo prop changes
  useEffect(() => {
    setName(todo.name)
    setDescription(todo.description || '')
    setStatus(todo.status)
    setDueDate(todo.due_date || '')
    setDone(todo.done)
  }, [todo])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyPress)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSave = () => {
    const updates: Partial<TodoItem> = {
      name,
      description: description || null,
      status,
      due_date: dueDate || null,
      done,
    }
    onUpdate(updates)
    onClose()
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this todo?')) {
      onDelete(todo.id)
      onClose()
    }
  }

  return (
    <div
      className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'
      onClick={onClose}
    >
      <div
        className='bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between p-6 border-b'>
          <h2 className='text-2xl font-bold text-gray-900'>Edit Todo</h2>
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
        <div className='p-6 space-y-4'>
          {/* Title */}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Title <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
              placeholder='Todo title'
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none'
              placeholder='Add a description...'
            />
          </div>

          {/* Status and Done */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {/* Status */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const newStatus = e.target.value as TodoItem['status']
                  setStatus(newStatus)
                  // Auto-set done based on status
                  if (newStatus === 'completed') {
                    setDone(true)
                  }
                }}
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
              >
                <option value='not_started'>Not Started</option>
                <option value='in_progress'>In Progress</option>
                <option value='completed'>Completed</option>
              </select>
            </div>

            {/* Done Checkbox */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                Completion
              </label>
              <label className='flex items-center space-x-3 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50'>
                <input
                  type='checkbox'
                  checked={done}
                  onChange={(e) => {
                    const isDone = e.target.checked
                    setDone(isDone)
                    // Auto-set status when marking as done
                    if (isDone && status !== 'completed') {
                      setStatus('completed')
                    } else if (!isDone && status === 'completed') {
                      setStatus('in_progress')
                    }
                  }}
                  className='w-5 h-5 text-blue-500 rounded focus:ring-2 focus:ring-blue-500'
                />
                <span className='text-gray-700'>Mark as done</span>
              </label>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Due Date
            </label>
            <DatePicker
              selected={dueDate ? new Date(dueDate) : null}
              onChange={(date) => setDueDate(date ? date.toISOString() : '')}
              showTimeSelect
              timeFormat='HH:mm'
              dateFormat='yyyy-MM-dd HH:mm aa'
              placeholderText='Select due date'
              className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
            />
          </div>

          {/* Metadata */}
          <div className='pt-4 border-t space-y-2 text-sm text-gray-500'>
            <div className='flex items-center justify-between'>
              <span>Created:</span>
              <span>{new Date(todo.created_at).toLocaleString()}</span>
            </div>
            <div className='flex items-center justify-between'>
              <span>Last Updated:</span>
              <span>{new Date(todo.updated_at).toLocaleString()}</span>
            </div>
            <div className='flex items-center justify-between'>
              <span>ID:</span>
              <span className='font-mono text-xs'>{todo.id}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='flex items-center justify-between p-6 border-t bg-gray-50'>
          <button
            onClick={handleDelete}
            className='px-4 py-2 text-red-600 border border-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium'
          >
            Delete Todo
          </button>
          <div className='flex space-x-3'>
            <button
              onClick={onClose}
              className='px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium'
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className='px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium'
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
