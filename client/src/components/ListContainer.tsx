/**
 * ListContainer Component
 *
 * Main container component that orchestrates the collaborative todo list application.
 * Manages state for todo lists, handles real-time synchronization via WebSocket,
 * and coordinates interactions between child components (Sidebar, TodoListView, modals).
 *
 * @component
 * @example
 * ```tsx
 * <ListContainer userId="user-123" />
 * ```
 *
 * Features:
 * - Real-time todo list synchronization via Socket.IO
 * - Local caching with IndexedDB (via localforage)
 * - Todo filtering and sorting
 * - List sharing and collaboration
 * - Modal management for todo editing and list sharing
 *
 * State Management:
 * - Lists and active list state
 * - Modal visibility (TodoModal, ShareModal)
 * - Connection status
 * - Filter and sort preferences
 *
 * @see {@link Sidebar} - List navigation component
 * @see {@link TodoListView} - Main todo list display and management
 * @see {@link useTodoSync} - Real-time synchronization hook
 */
'use client'

import { TodoItem, TodoList } from '@/types/todo'
import { useEffect, useMemo, useRef, useState } from 'react'

import ShareModal from './ShareModal'
import Sidebar from './Sidebar'
import ToDoModal from './TodoModal'
import { TodoListView } from './TodoListView'
import { createLogger } from '@/utils/logger'
import localforage from 'localforage'
import { useAuth } from '@/contexts/AuthContext'
import { useSocket } from '@/hooks/useSocket'
import { useTodoFilters } from '@/hooks/useTodoFilters'
import { useTodoStore } from '@/utils/todoStore'
import { useTodoSync } from '@/hooks/useTodoSync'

localforage.config({
  name: 'collaborative_todo_app',
  storeName: 'todo_lists',
})

interface ListContainerProps {
  /** The ID of the current user */
  userId: string
}

const logger = createLogger('ListContainer')

export default function ListContainer({ userId }: ListContainerProps) {
  // Token, connection state, modals
  const { accessToken } = useAuth()
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  // Lists and todos
  const [lists, setLists] = useState<Record<string, TodoList>>({})
  const [activeListId, setActiveListId] = useState<string | null>(null)
  // Select active list data directly
  const activeList = useMemo(() => {
    if (!activeListId) return null
    return lists[activeListId] || null
  }, [lists, activeListId])
  const activeTodos = useMemo(() => activeList?.todos || {}, [activeList])
  const activeListName = activeList?.listName || 'Select a list'
  const [newTodo, setNewTodo] = useState('')

  const isConnected = useTodoStore((s) => s.isConnected)

  // Revision state ref
  const revRef = useRef<Record<string, number>>({})

  const {
    filterStatus,
    setFilterStatus,
    filterDueDate,
    setFilterDueDate,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    resetFilters,
    hasActiveFilters,
    filterAndSort,
  } = useTodoFilters()

  const socket = useSocket(userId, accessToken || '')
  const {
    handleAddTodo,
    handleUpdateTodo,
    handleDeleteTodo,
    toggleDone,
    handleShareList,
    handleCreateList,
  } = useTodoSync(
    socket,
    accessToken || '',
    lists,
    setLists,
    activeListId,
    setActiveListId,
    revRef
  )

  const filteredAndSortedTodos = useMemo(
    () => filterAndSort(Object.values(activeTodos)),
    [activeTodos, filterAndSort]
  )

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
          }
        }
      }
      logger.debug('Loaded cached lists: ', cachedLists)
      setLists(cachedLists)

      // Set first list as active
      if (!activeListId && Object.keys(cachedLists).length > 0) {
        setActiveListId(Object.keys(cachedLists)[0])
      }
    } catch (error) {
      logger.error('Error loading cached lists:', error)
    }
  }

  useEffect(() => {
    // Load cached lists from localForage
    loadLocalCachedLists()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTodoClick = (todo: TodoItem) => {
    setSelectedTodo(todo)
    setIsModalOpen(true)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTodo.trim() && activeListId) {
      handleAddTodo(activeListId, newTodo)
      setNewTodo('')
    }
  }

  return (
    <div className='flex h-full bg-gray-50'>
      {/* Sidebar - List Navigation */}
      <Sidebar
        lists={lists}
        activeListId={activeListId}
        isConnected={isConnected}
        setActiveListId={setActiveListId}
        handleCreateList={handleCreateList}
      />

      {/* Main Content */}
      <TodoListView
        activeList={activeList}
        activeTodos={activeTodos}
        filteredAndSortedTodos={filteredAndSortedTodos}
        newTodo={newTodo}
        setNewTodo={setNewTodo}
        isConnected={isConnected}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        filterDueDate={filterDueDate}
        setFilterDueDate={setFilterDueDate}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        hasActiveFilters={hasActiveFilters}
        resetFilters={resetFilters}
        handleAddTodo={handleAddTodo}
        handleUpdateTodo={handleUpdateTodo}
        handleDeleteTodo={handleDeleteTodo}
        toggleDone={toggleDone}
        onShareClick={() => setIsShareModalOpen(true)}
        onTodoClick={handleTodoClick}
        onKeyPress={handleKeyPress}
      />

      {/* Todo Modal */}
      {selectedTodo && activeListId && (
        <ToDoModal
          todo={selectedTodo}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onUpdate={(updates) =>
            handleUpdateTodo(
              activeListId,
              selectedTodo.id,
              updates,
              Number(revRef.current[activeListId] || 0)
            )
          }
          onDelete={() => handleDeleteTodo(activeListId, selectedTodo.id)}
        />
      )}

      {/* Share Modal */}
      {activeListId && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          listId={activeListId || ''}
          listName={activeListName}
          onShare={(targetUserId, role) => {
            handleShareList(activeListId, targetUserId, role)
            setIsShareModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
