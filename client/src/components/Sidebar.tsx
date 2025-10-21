/**
 * Sidebar Component
 *
 * Navigation sidebar for managing and switching between todo lists.
 * Displays all available lists, highlights the active list, shows connection status,
 * and provides UI for creating new lists.
 *
 * @component
 * @example
 * ```tsx
 * <Sidebar
 *   lists={listsObject}
 *   activeListId={currentListId}
 *   isConnected={socketConnected}
 *   setActiveListId={(id) => setActiveList(id)}
 *   handleCreateList={(name) => createNewList(name)}
 * />
 * ```
 *
 * Features:
 * - Display all todo lists
 * - Highlight currently active list
 * - Show real-time connection status indicator
 * - Create new lists with inline form
 * - Keyboard shortcuts (Enter to submit, Escape to cancel)
 * - Empty state when no lists exist
 *
 * @param props - Component props
 * @param props.lists - Object containing all todo lists keyed by list ID
 * @param props.activeListId - ID of the currently active list (or null)
 * @param props.isConnected - Whether the WebSocket connection is active
 * @param props.setActiveListId - Callback to set the active list
 * @param props.handleCreateList - Callback to create a new list
 */
import { useCallback, useMemo, useState } from 'react'

import { TodoList } from '@/types/todo'

export default function Sidebar({
  lists,
  activeListId,
  isConnected,
  setActiveListId,
  handleCreateList,
}: {
  /** Object containing all todo lists keyed by list ID */
  lists: Record<string, TodoList>
  /** ID of the currently active list, or null if none selected */
  activeListId: string | null
  /** Whether the WebSocket connection is active */
  isConnected: boolean
  /** Callback to set the active list by ID */
  setActiveListId: (id: string) => void
  /** Callback to create a new list with the given name */
  handleCreateList: (listName: string) => void
}) {
  const [newListName, setNewListName] = useState('')
  const [isCreatingList, setIsCreatingList] = useState(false)

  const listArray = useMemo(() => Object.values(lists), [lists])

  const handleCreate = useCallback(() => {
    const trimmedName = newListName.trim()
    if (trimmedName) {
      handleCreateList(trimmedName)
      setNewListName('')
      setIsCreatingList(false)
    }
  }, [newListName, handleCreateList])

  const handleCancel = useCallback(() => {
    setIsCreatingList(false)
    setNewListName('')
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleCreate()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      }
    },
    [handleCreate, handleCancel]
  )

  return (
    <div className='w-64 bg-white border-r border-gray-200 flex flex-col h-full'>
      <div className='flex-shrink-0 p-4 border-b border-gray-200'>
        <h2 className='text-lg font-semibold text-gray-900'>My Lists</h2>
        <div className='flex items-center mt-2 text-sm'>
          <span
            className={`flex items-center ${
              isConnected ? 'text-green-600' : 'text-red-600'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            ></div>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* List Items */}
      <div className='flex-1 overflow-y-auto min-h-0'>
        {listArray.length === 0 ? (
          <div className='p-4 text-center text-gray-500 text-sm'>
            No lists yet. Create one to get started!
          </div>
        ) : (
          listArray.map((list) => (
            <button
              key={list.listId}
              onClick={() => setActiveListId(list.listId)}
              className={`w-full px-4 py-3 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                activeListId === list.listId
                  ? 'bg-blue-50 border-l-4 border-l-blue-500'
                  : ''
              }`}
            >
              <div className='font-medium text-gray-900'>{list.listName}</div>
              <div className='text-sm text-gray-500 mt-1'>
                {Object.values(list.todos).length} tasks
              </div>
            </button>
          ))
        )}
      </div>

      {/* Create New List Button */}
      <div className='flex-shrink-0 p-4 border-t border-gray-200'>
        {isCreatingList ? (
          <div className='space-y-2'>
            <input
              type='text'
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='List name...'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm'
              autoFocus
            />
            <div className='flex space-x-2'>
              <button
                onClick={handleCreate}
                disabled={!newListName.trim()}
                className='flex-1 px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                Create
              </button>
              <button
                onClick={handleCancel}
                className='flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300'
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsCreatingList(true)}
            className='w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2'
          >
            <svg
              className='w-5 h-5'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 4v16m8-8H4'
              />
            </svg>
            <span>New List</span>
          </button>
        )}
      </div>
    </div>
  )
}
