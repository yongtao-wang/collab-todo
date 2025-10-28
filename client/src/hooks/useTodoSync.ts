/**
 * useTodoSync Hook
 *
 * Custom React hook for managing real-time synchronization of todo lists via Socket.IO.
 * Handles bidirectional communication between client and server, including:
 * - Receiving snapshots and deltas from server
 * - Emitting CRUD operations to server
 * - Managing local state updates
 * - Caching to IndexedDB via localforage
 * - Conflict resolution via revision tracking
 *
 * @param socket - Socket.IO client instance (or null if not connected)
 * @param accessToken - JWT access token for authenticated operations
 * @param lists - Current lists state object keyed by list ID
 * @param setLists - React state setter for updating lists
 * @param activeListId - ID of currently active list (or null)
 * @param setActiveListId - React state setter for active list ID
 * @param revRef - React ref object tracking revision numbers per list
 *
 * @returns Object containing:
 * - lists: Current lists state (passed through)
 * - activeListId: Current active list ID (passed through)
 * - setLists: Lists state setter (passed through)
 * - setActiveListId: Active list setter (passed through)
 * - handleAddTodo: Function to add a new todo
 * - handleUpdateTodo: Function to update an existing todo
 * - toggleDone: Function to toggle todo completion status
 * - handleDeleteTodo: Function to delete a todo
 * - handleShareList: Function to share a list with another user
 * - handleCreateList: Function to create a new list
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [lists, setLists] = useState({})
 *   const [activeListId, setActiveListId] = useState(null)
 *   const revRef = useRef({})
 *   const socket = useSocket(userId, accessToken)
 *
 *   const {
 *     handleAddTodo,
 *     handleUpdateTodo,
 *     handleDeleteTodo,
 *     toggleDone,
 *     handleShareList,
 *     handleCreateList
 *   } = useTodoSync(
 *     socket,
 *     accessToken,
 *     lists,
 *     setLists,
 *     activeListId,
 *     setActiveListId,
 *     revRef
 *   )
 *
 *   // Use the handlers...
 * }
 * ```
 *
 * Socket Events:
 * - **Incoming**: snapshot, delta, error, success
 * - **Outgoing**: create_list, add_todo, update_todo, delete_todo, share_list
 *
 * Features:
 * - Optimistic UI updates
 * - Automatic local cache synchronization
 * - Revision-based conflict resolution
 * - Error handling and user feedback
 */

import { INCOMING_EVENTS, OUTGOING_EVENTS } from '@/constants/events'
import { TodoItem, TodoList } from '@/types/todo'
import { useCallback, useEffect } from 'react'

import { Socket } from 'socket.io-client'
import { createLogger } from '@/utils/logger'
import localforage from 'localforage'
import { useTodoStore } from '@/utils/todoStore'

const logger = createLogger('useTodoSync')

const updateLocalCache = async (
  listId: string,
  updateFn: (cached: TodoList) => TodoList
) => {
  const cached = await localforage.getItem<TodoList>(listId)
  if (!cached) return
  const updated = updateFn(cached)
  await localforage.setItem(listId, updated)
}

export const useTodoSync = (
  socket: Socket | null,
  userId: string,
  lists: Record<string, TodoList>,
  setLists: React.Dispatch<React.SetStateAction<Record<string, TodoList>>>,
  activeListId: string | null,
  setActiveListId: React.Dispatch<React.SetStateAction<string | null>>,
  revRef: React.RefObject<Record<string, number>>
) => {
  const { setMessage, setListenersReady } = useTodoStore.getState()

  const updateLists = useCallback(
    (list_id: string, item: TodoItem) => {
      setLists((prev) => {
        const list = prev[list_id]
        if (!list) return prev
        return {
          ...prev,
          [list_id]: {
            ...list,
            todos: {
              ...list.todos,
              [item.id]: item,
            },
          },
        }
      })
    },
    [setLists]
  )

  const removeListItem = useCallback(
    (list_id: string, item_id: string) => {
      setLists((prev) => {
        const list = prev[list_id]
        if (!list) return prev

        const { [item_id]: removed, ...remainingTodos } = list.todos
        logger.debug('Deleting item:', removed)

        return {
          ...prev,
          [list_id]: {
            ...list,
            todos: remainingTodos,
          },
        }
      })
    },
    [setLists]
  )

  useEffect(() => {
    if (!socket) return

    // Handle incoming socket events

    // --- List snapshot ---
    socket.on(INCOMING_EVENTS.LIST_SNAPSHOT, (data) => {
      logger.debug('Received list snapshot:', data)
      if (!data) return
      const { list_id, list_name, items, rev } = data

      const currentList: TodoList = {
        listId: list_id,
        listName: list_name,
        todos: items,
      }
      revRef.current[list_id] = rev
      setLists((prev) => ({ ...prev, [list_id]: currentList }))
      void localforage.setItem(list_id, currentList) // Overwrite local cache
    })

    // // -- List synced ---
    // socket.on(TODO_EVENTS.LIST_SYNCED, (data) => {
    //   logger.debug('List synced:', data.list_id)
    // })

    // --- List created ---
    socket.on(INCOMING_EVENTS.LIST_CREATED, (data) => {
      logger.debug('List created:', data)
      if (!data) return
      const { list_id, list_name, items = {}, rev = 1 } = data
      const newList: TodoList = {
        listId: list_id,
        listName: list_name,
        todos: items,
      }
      revRef.current[list_id] = rev
      setLists((prev) => ({ ...prev, [list_id]: newList }))
      setActiveListId(list_id)
      void localforage.setItem(list_id, newList)

      setMessage(`Created new list "${list_name}"`)
    })

    // --- Share success ---
    socket.on(INCOMING_EVENTS.LIST_SHARE_SUCCESS, (data) => {
      logger.debug('List shared successfully:', data)
      if (!data) return
      setMessage(data.message)
    })

    // -- Received shared list ---
    socket.on(INCOMING_EVENTS.LIST_SHARED_WITH_YOU, (data) => {
      logger.debug('List shared with you:', data)
      if (!data) return
      const { list_id } = data
      socket.emit('join_list', {
        user_id: userId,
        list_id: list_id,
      })

      setMessage(data.message)
    })

    // --- Item added ---
    socket.on(INCOMING_EVENTS.ITEM_ADDED, (data) => {
      logger.debug('Item added:', data)
      if (!data) return
      const { list_id, item, rev } = data
      updateLists(list_id, item)
      revRef.current[list_id] = rev
      void updateLocalCache(item.list_id, (cached) => ({
        ...cached,
        todos: { ...cached.todos, [item.id]: item },
      }))
    })

    // --- Item updated ---
    socket.on(INCOMING_EVENTS.ITEM_UPDATED, async (data) => {
      logger.debug('Item updated:', data)
      if (!data) return
      const { list_id, item, rev } = data
      revRef.current[list_id] = rev
      updateLists(list_id, item)
      void updateLocalCache(item.list_id, (cached) => ({
        ...cached,
        todos: { ...cached.todos, [item.id]: item },
      }))
    })

    // --- Item deleted ---
    socket.on(INCOMING_EVENTS.ITEM_DELETED, (data) => {
      logger.debug('Item deleted:', data)
      if (!data) return
      const { list_id, item_id, rev } = data
      removeListItem(list_id, item_id)
      revRef.current[list_id] = rev
      void updateLocalCache(list_id, (cached) => {
        const { [item_id]: removed, ...remainingTodos } = cached.todos
        logger.debug('Deleting item:', removed)
        return {
          ...cached,
          todos: remainingTodos,
        }
      })
    })

    setListenersReady(true)
    logger.debug(`All listeners registered`)

    return () => {
      // Clean up listeners on unmount
      socket.removeAllListeners(INCOMING_EVENTS.LIST_SNAPSHOT)
      // socket.removeAllListeners(TODO_EVENTS.LIST_SYNCED)
      socket.removeAllListeners(INCOMING_EVENTS.LIST_CREATED)
      socket.removeAllListeners(INCOMING_EVENTS.LIST_SHARE_SUCCESS)
      socket.removeAllListeners(INCOMING_EVENTS.LIST_SHARED_WITH_YOU)
      socket.removeAllListeners(INCOMING_EVENTS.ITEM_ADDED)
      socket.removeAllListeners(INCOMING_EVENTS.ITEM_UPDATED)
      socket.removeAllListeners(INCOMING_EVENTS.ITEM_DELETED)
      setListenersReady(false)
      logger.debug('Cleaned up socket listeners')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket])

  // Outgoing operations
  const handleAddTodo = useCallback(
    (listId: string, newTodoName: string) => {
      socket?.emit(OUTGOING_EVENTS.ADD_ITEM, {
        list_id: listId,
        user_id: userId,
        name: newTodoName,
        description: '',
      })
    },
    [socket, userId]
  )

  const handleUpdateTodo = useCallback(
    (
      listId: string,
      itemId: string,
      updatedItem: Partial<TodoItem>,
      rev: number
    ) => {
      if (!updatedItem || Object.keys(updatedItem).length === 0) {
        logger.warn('No updates provided for item:', listId, itemId)
        return
      }
      logger.info('Emitting update for item:', listId, itemId, updatedItem)
      socket?.emit(OUTGOING_EVENTS.UPDATE_ITEM, {
        list_id: listId,
        item_id: itemId,
        ...updatedItem,
        rev,
      })
    },
    [socket]
  )

  const toggleDone = useCallback(
    (item: TodoItem) => {
      if (!activeListId) return
      socket?.emit(OUTGOING_EVENTS.UPDATE_ITEM, {
        list_id: activeListId,
        user_id: userId,
        item_id: item.id,
        done: !item.done,
      })
    },
    [socket, userId, activeListId]
  )

  const handleDeleteTodo = useCallback(
    (listId: string, itemId: string) => {
      socket?.emit(OUTGOING_EVENTS.DELETE_ITEM, {
        list_id: listId,
        item_id: itemId,
      })
    },
    [socket]
  )

  const handleShareList = useCallback(
    async (listId: string, targetUserId: string, role: string) => {
      socket?.emit(OUTGOING_EVENTS.SHARE_LIST, {
        list_id: listId,
        user_id: targetUserId,
        role,
      })
    },
    [socket]
  )

  const handleCreateList = useCallback(
    (listName: string) => {
      socket?.emit(OUTGOING_EVENTS.CREATE_LIST, {
        list_name: listName,
        user_id: userId,
      })
    },
    [socket, userId]
  )

  return {
    lists,
    activeListId,
    setLists,
    setActiveListId,
    handleAddTodo,
    handleUpdateTodo,
    toggleDone,
    handleDeleteTodo,
    handleShareList,
    handleCreateList,
  }
}
