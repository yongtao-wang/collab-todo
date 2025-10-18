'use client'

import { Socket, io } from 'socket.io-client'
import { TodoItem, TodoList } from '@/types/todo'
import { useEffect, useRef, useState } from 'react'

import { SOCKET_URL } from '@/utils/config'
import ShareModal from './ShareModal'
import ToDoModal from './ToDoModal'
import localforage from 'localforage'
import { useAuth } from '@/contexts/AuthContext'

localforage.config({
  name: 'collaborative_todo_app',
  storeName: 'todo_lists',
})

const REV_STATE = 'rev_state'
const SERVER_EPOCH = 'server_epoch'

interface ListContainerProps {
  userId: string
  onMessage?: (message: string) => void
  onError?: (error: string) => void
}

export default function ListContainer({
  userId,
  onMessage,
  onError,
}: ListContainerProps) {
  const { accessToken } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [lists, setLists] = useState<Record<string, TodoList>>({})
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [newTodo, setNewTodo] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [isCreatingList, setIsCreatingList] = useState(false)

  const revStateRef = useRef<Record<string, number>>({})
  const serverEpochRef = useRef<string>('')

  const updateLocalCache = async (
    listId: string,
    updateFn: (cached: TodoList) => TodoList
  ) => {
    const cached = await localforage.getItem<TodoList>(listId)
    if (!cached) return
    const updated = updateFn(cached)
    await localforage.setItem(listId, updated)
  }

  const loadLocalCachedLists = async () => {
    try {
      const keys = await localforage.keys()
      if (keys.length === 0) return
      const cachedLists: Record<string, TodoList> = {}
      for (const key of keys) {
        const cached = await localforage.getItem<{
          listId: string
          listName: string
          todos: Record<string, TodoItem>
          rev: number
        }>(key)
        if (cached) {
          cachedLists[key] = {
            listId: key,
            listName: cached.listName,
            todos: cached.todos,
            rev: cached.rev,
          }
        }
      }
      console.log('Loaded cached lists: ', cachedLists)
      setLists(cachedLists)

      // Set first list as active
      if (!activeListId && Object.keys(cachedLists).length > 0) {
        setActiveListId(Object.keys(cachedLists)[0])
      }
    } catch (error) {
      console.error('Error loading cached lists:', error)
    }
  }

  useEffect(() => {
    // Initialize revStateRef and serverEpochRef from localStorage
    try {
      revStateRef.current = JSON.parse(localStorage.getItem(REV_STATE) ?? '{}')
    } catch {
      revStateRef.current = {}
    }
    try {
      serverEpochRef.current =
        JSON.parse(localStorage.getItem(SERVER_EPOCH) ?? '') || ''
    } catch {
      serverEpochRef.current = ''
    }

    // Load cached lists from localForage
    loadLocalCachedLists()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Initialize socket connection
    console.log('Connecting to socket:', SOCKET_URL)

    let retryDelay = 1000

    const s = io(SOCKET_URL, {
      transports: ['websocket'], // Force WebSocket (prevent polling)
      auth: { token: accessToken },
      reconnection: false, // Disable built-in reconnection
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    })
    setSocket(s)

    // Join room
    s.on('connect', () => {
      console.log('connected:', s.id)
      setIsConnected(true)
      s.emit('join', {
        user_id: userId,
        revState: revStateRef.current,
        epoch: serverEpochRef.current,
      })
      retryDelay = 1000
    })

    s.on('disconnect', () => {
      console.log('disconnected')
      setIsConnected(false)
    })

    s.on('connect_error', (err) => {
      console.warn('Socket connect_error:', err.message)
      setTimeout(() => s.connect(), retryDelay)
      // Exponential backoff
      retryDelay = Math.min(retryDelay * 2, 10000) // max 10s
    })

    s.on('error', (errorData) => {
      console.error('Socket error:', errorData)
      const errorMessage = errorData.message || 'Connection error'
      onError?.(errorMessage)
    })

    s.on('permission_error', (data) => {
      const errorMessage = data.message || 'Permission denied'
      onError?.(errorMessage)
    })

    s.on('list_snapshot', (data) => {
      console.log('snapshot:', data)
      if (data) {
        const { list_id, list_name, items = {}, rev = 1 } = data

        // Update server epoch
        if (data.server_epoch) {
          serverEpochRef.current = data.server_epoch
          localStorage.setItem(SERVER_EPOCH, JSON.stringify(data.server_epoch))
        }

        const currentList = {
          listId: list_id,
          listName: list_name,
          todos: items,
          rev: rev,
        }

        setLists((prev) => ({
          ...prev,
          [list_id]: currentList,
        }))

        // Cache the list in localForage
        localforage.setItem(list_id, currentList)

        // Set first list as active if none selected
        setActiveListId((current) => current || list_id)

        revStateRef.current = {
          ...revStateRef.current,
          [list_id]: rev,
        }
        localStorage.setItem(REV_STATE, JSON.stringify(revStateRef.current))
      }
    })

    s.on('list_synced', (data) => {
      console.log('list_synced:', data)
      if (data) {
        revStateRef.current = {
          ...revStateRef.current,
          [data.list_id]: data.rev,
        }
        localStorage.setItem(REV_STATE, JSON.stringify(revStateRef.current))
      }
    })

    s.on('item_added', (data) => {
      console.log('item_added:', data)
      const item = data.item
      setLists((prev) => {
        const list = prev[item.list_id]
        if (!list) return prev
        return {
          ...prev,
          [item.list_id]: {
            ...list,
            todos: { ...list.todos, [item.id]: item },
            rev: data.rev,
          },
        }
      })
      revStateRef.current = {
        ...revStateRef.current,
        [item.list_id]: data.rev,
      }
      localStorage.setItem(REV_STATE, JSON.stringify(revStateRef.current))
      // Add to localForage cache
      void updateLocalCache(item.list_id, (cached) => ({
        ...cached,
        todos: { ...cached.todos, [item.id]: item },
        rev: data.rev,
      }))
    })

    s.on('item_updated', (data) => {
      console.log('item_updated:', data)
      const { item, list_id, rev } = data
      setLists((prev) => {
        const list = prev[list_id]
        if (!list) return prev
        return {
          ...prev,
          [list_id]: {
            ...list,
            todos: { ...list.todos, [item.id]: item },
            rev: rev,
          },
        }
      })
      revStateRef.current = {
        ...revStateRef.current,
        [list_id]: rev,
      }
      localStorage.setItem(REV_STATE, JSON.stringify(revStateRef.current))

      // Update localForage cache
      void updateLocalCache(list_id, (cached) => ({
        ...cached,
        todos: { ...cached.todos, [item.id]: item },
        rev: rev,
      }))
    })

    s.on('item_deleted', (data) => {
      const { item_id, list_id, rev } = data
      setLists((prev) => {
        const list = prev[list_id]
        if (!list) return prev
        const updatedTodos = { ...list.todos }
        delete updatedTodos[item_id]
        return {
          ...prev,
          [list_id]: {
            ...list,
            todos: updatedTodos,
            rev: rev,
          },
        }
      })

      revStateRef.current = {
        ...revStateRef.current,
        [list_id]: rev,
      }
      localStorage.setItem(REV_STATE, JSON.stringify(revStateRef.current))

      // Update localForage cache
      void updateLocalCache(list_id, (cached) => {
        const updated = { ...cached.todos }
        delete updated[item_id]
        return { ...cached, todos: updated, rev }
      })
    })

    s.on('list_created', (data) => {
      console.log('list_created:', data)
      const { list_id, name, items = {}, rev = 1 } = data

      const newList = {
        listId: list_id,
        listName: name,
        todos: items,
        rev,
      }

      setLists((prev) => ({
        ...prev,
        [list_id]: newList,
      }))

      // Set new list as active
      setActiveListId(list_id)

      revStateRef.current = {
        ...revStateRef.current,
        [list_id]: rev,
      }
      localStorage.setItem(REV_STATE, JSON.stringify(revStateRef.current))

      void localforage.setItem(list_id, newList)

      onMessage?.(`Created new list: ${name}`)
    })

    s.on('share_success', (data) => {
      console.log('share_success:', data)
      // You could show a success toast notification here
      onMessage?.(data.message)
    })

    s.on('list_shared_with_you', (data) => {
      console.log('list_shared_with_you:', data)
      // You could show a success toast notification here
      s.emit('join', {
        user_id: userId,
        revState: revStateRef.current,
        epoch: serverEpochRef.current,
      })
      onMessage?.(data.message)
    })

    s.on('error', (errorData) => {
      console.error('Socket error:', errorData)
      const errorMessage = errorData.message || 'Unknown error occurred'
      onError?.(errorMessage)
    })

    return () => {
      s.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const addTodo = () => {
    if (!socket || !activeListId || !newTodo.trim()) return
    socket.emit('item_add', {
      list_id: activeListId,
      user_id: userId,
      name: newTodo,
      description: '',
    })
    setNewTodo('')
  }

  const toggleDone = (item: TodoItem) => {
    if (!socket || !activeListId) return
    socket.emit('item_update', {
      list_id: activeListId,
      user_id: userId,
      item_id: item.id,
      done: !item.done,
    })
  }

  const handleUpdateTodo = (updates: Partial<TodoItem>) => {
    if (!socket || !activeListId || !selectedTodo) return
    socket.emit('item_update', {
      list_id: activeListId,
      user_id: userId,
      item_id: selectedTodo.id,
      ...updates,
    })
  }

  const handleDeleteTodo = (id: string) => {
    if (!socket || !activeListId) return
    socket.emit('item_delete', {
      list_id: activeListId,
      user_id: userId,
      item_id: id,
    })
  }

  const handleTodoClick = (todo: TodoItem) => {
    setSelectedTodo(todo)
    setIsModalOpen(true)
  }

  const handleShare = async (
    sharedUserId: string,
    role: 'viewer' | 'editor'
  ) => {
    if (!socket || !activeListId) return

    // Emit share event to backend
    socket.emit('list_share', {
      list_id: activeListId,
      shared_user_id: sharedUserId,
      role: role,
      user_id: userId,
    })

    // Show success message (you could add a toast notification here)
    console.log(`Shared with user ${sharedUserId} as ${role}`)
    setIsShareModalOpen(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTodo.trim()) {
      addTodo()
    }
  }

  const handleCreateList = () => {
    if (!socket || !newListName.trim()) return

    // Emit create list event to backend
    socket.emit('list_create', {
      user_id: userId,
      name: newListName,
    })

    setNewListName('')
    setIsCreatingList(false)
  }

  const activeList = activeListId ? lists[activeListId] : null
  const activeTodos = activeList?.todos || {}
  const activeListName = activeList?.listName || 'Select a list'

  return (
    <div className='flex min-h-screen bg-gray-50'>
      {/* Sidebar - List Navigation */}
      <div className='w-64 bg-white border-r border-gray-200 flex flex-col'>
        <div className='p-4 border-b border-gray-200'>
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
        <div className='flex-1 overflow-y-auto'>
          {Object.values(lists).map((list) => (
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
          ))}
        </div>

        {/* Create New List Button */}
        <div className='p-4 border-t border-gray-200'>
          {isCreatingList ? (
            <div className='space-y-2'>
              <input
                type='text'
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleCreateList()
                  if (e.key === 'Escape') setIsCreatingList(false)
                }}
                placeholder='List name...'
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm'
                autoFocus
              />
              <div className='flex space-x-2'>
                <button
                  onClick={handleCreateList}
                  disabled={!newListName.trim()}
                  className='flex-1 px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50'
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setIsCreatingList(false)
                    setNewListName('')
                  }}
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

      {/* Main Content */}
      <div className='flex-1 overflow-y-auto p-8'>
        {!activeListId ? (
          <div className='flex items-center justify-center h-full'>
            <div className='text-center'>
              <svg
                className='w-24 h-24 text-gray-300 mx-auto mb-4'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
                />
              </svg>
              <h3 className='text-xl font-medium text-gray-500 mb-2'>
                No list selected
              </h3>
              <p className='text-gray-400'>
                Select a list from the sidebar or create a new one
              </p>
            </div>
          </div>
        ) : (
          <div className='w-full max-w-4xl mx-auto'>
            {/* Header */}
            <div className='flex items-center justify-between mb-6'>
              <div>
                <h1 className='text-3xl font-bold text-gray-900'>
                  {activeListName}
                </h1>
                <div className='text-sm text-gray-600 mt-2'>
                  {Object.values(activeTodos).length} tasks
                </div>
              </div>

              {/* Share Button */}
              <button
                onClick={() => setIsShareModalOpen(true)}
                className='flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium'
                disabled={!isConnected}
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
                    d='M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z'
                  />
                </svg>
                <span>Share</span>
              </button>
            </div>

            {/* Add Todo Form */}
            <div className='bg-white rounded-lg shadow p-4 mb-6'>
              <div className='flex space-x-3'>
                <input
                  className='flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder='What needs to be done?'
                  disabled={!isConnected}
                />
                <button
                  className='px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                  onClick={addTodo}
                  disabled={!isConnected || !newTodo.trim()}
                >
                  Add Task
                </button>
              </div>
            </div>

            {/* Todo List */}
            <div className='space-y-3'>
              {Object.values(activeTodos).length === 0 ? (
                <div className='text-center py-12 bg-white rounded-lg shadow'>
                  <svg
                    className='w-16 h-16 text-gray-300 mx-auto mb-4'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
                    />
                  </svg>
                  <h3 className='text-lg font-medium text-gray-500 mb-2'>
                    No tasks yet
                  </h3>
                  <p className='text-gray-400'>
                    Add your first task to get started!
                  </p>
                </div>
              ) : (
                Object.values(activeTodos).map((todo) => (
                  <div
                    key={todo.id}
                    className={`bg-white rounded-lg shadow p-4 border-l-4 transition-all cursor-pointer ${
                      todo.done
                        ? 'border-l-green-500 opacity-75'
                        : 'border-l-blue-500 hover:shadow-md'
                    }`}
                    onClick={() => handleTodoClick(todo)}
                  >
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center space-x-3 flex-1'>
                        <button
                          onClick={(e) => {
                            e.stopPropagation() // Prevent triggering the card click
                            toggleDone(todo)
                          }}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            todo.done
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300 hover:border-green-400'
                          }`}
                          disabled={!isConnected}
                        >
                          {todo.done && (
                            <svg
                              className='w-3 h-3'
                              fill='currentColor'
                              viewBox='0 0 20 20'
                            >
                              <path
                                fillRule='evenodd'
                                d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                                clipRule='evenodd'
                              />
                            </svg>
                          )}
                        </button>

                        <div className='flex-1 min-w-0'>
                          <h3
                            className={`font-medium text-gray-900 ${
                              todo.done ? 'line-through text-gray-500' : ''
                            }`}
                          >
                            {todo.name}
                          </h3>
                          {todo.description && (
                            <p
                              className={`text-sm mt-1 ${
                                todo.done ? 'text-gray-400' : 'text-gray-600'
                              }`}
                            >
                              {todo.description}
                            </p>
                          )}

                          <div className='flex items-center mt-2 space-x-3 text-xs text-gray-500'>
                            <span
                              className={`px-2 py-1 rounded-full font-medium ${
                                todo.status === 'completed'
                                  ? 'bg-green-100 text-green-700'
                                  : todo.status === 'in_progress'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {todo.status.replace('_', ' ').toUpperCase()}
                            </span>
                            {todo.due_date && (
                              <span>
                                Due:{' '}
                                {new Date(todo.due_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Todo Modal */}
      {selectedTodo && (
        <ToDoModal
          todo={selectedTodo}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onUpdate={handleUpdateTodo}
          onDelete={handleDeleteTodo}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        listId={activeListId || ''}
        listName={activeListName}
        onShare={handleShare}
      />
    </div>
  )
}
