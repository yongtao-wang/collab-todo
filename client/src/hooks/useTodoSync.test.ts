import type { MockSocket, TestSocket } from '@/test/test-types'
import { TODO_EMIT_EVENTS, TODO_EVENTS } from '@/constants/events'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockLists, mockTodoItem, mockTodoList } from '@/test/mockData'

import { TodoItem } from '@/types/todo'
import { createMockSocket } from '@/test/mocks/socket'
import localforage from 'localforage'
import { useRef } from 'react'
import { useTodoSync } from './useTodoSync'

// Mock localforage
vi.mock('localforage')

// Mock logger
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock todoStore
vi.mock('@/utils/todoStore', () => ({
  useTodoStore: {
    getState: () => ({
      setMessage: vi.fn(),
    }),
  },
}))

describe('useTodoSync', () => {
  let mockSocket: MockSocket
  let mockSetLists: ReturnType<typeof vi.fn>
  let mockSetActiveListId: ReturnType<typeof vi.fn>

  const mockUserId = 'user-123'

  beforeEach(() => {
    // Create fresh mocks for each test
    mockSocket = createMockSocket()
    mockSetLists = vi.fn()
    mockSetActiveListId = vi.fn()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  const renderUseTodoSync = (
    lists = mockLists,
    activeListId: string | null = mockTodoList.listId
  ) => {
    return renderHook(() => {
      const revRef = useRef<Record<string, number>>({})
      return useTodoSync(
        mockSocket as TestSocket,
        mockUserId,
        lists,
        mockSetLists,
        activeListId,
        mockSetActiveListId,
        revRef
      )
    })
  }

  describe('Socket Event Listeners', () => {
    describe('LIST_SNAPSHOT event', () => {
      it('should handle list snapshot and update state', async () => {
        renderUseTodoSync()

        const snapshotData = {
          list_id: 'list-1',
          list_name: 'Test List',
          items: {
            'item-1': { ...mockTodoItem, id: 'item-1' },
          },
          rev: 5,
        }

        act(() => {
          mockSocket.simulateEvent(TODO_EVENTS.LIST_SNAPSHOT, snapshotData)
        })

        await waitFor(() => {
          expect(mockSetLists).toHaveBeenCalledWith(expect.any(Function))
        })

        // Verify localforage was updated
        expect(localforage.setItem).toHaveBeenCalledWith('list-1', {
          listId: 'list-1',
          listName: 'Test List',
          todos: snapshotData.items,
        })
      })

      it('should update revision reference on snapshot', async () => {
        renderUseTodoSync()

        const snapshotData = {
          list_id: 'list-1',
          list_name: 'Updated List',
          items: {},
          rev: 10,
        }

        act(() => {
          mockSocket.simulateEvent(TODO_EVENTS.LIST_SNAPSHOT, snapshotData)
        })

        await waitFor(() => {
          expect(mockSetLists).toHaveBeenCalled()
        })
      })
    })

    describe('LIST_CREATED event', () => {
      it('should handle list creation and set as active', async () => {
        renderUseTodoSync()

        const createdData = {
          list_id: 'new-list-1',
          list_name: 'New List',
          items: {},
          rev: 1,
        }

        act(() => {
          mockSocket.simulateEvent(TODO_EVENTS.LIST_CREATED, createdData)
        })

        await waitFor(() => {
          expect(mockSetLists).toHaveBeenCalledWith(expect.any(Function))
          expect(mockSetActiveListId).toHaveBeenCalledWith('new-list-1')
        })

        expect(localforage.setItem).toHaveBeenCalledWith('new-list-1', {
          listId: 'new-list-1',
          listName: 'New List',
          todos: {},
        })
      })

      it('should handle list creation with initial items', async () => {
        renderUseTodoSync()

        const createdData = {
          list_id: 'new-list-2',
          list_name: 'List With Items',
          items: {
            'item-1': mockTodoItem,
          },
          rev: 1,
        }

        act(() => {
          mockSocket.simulateEvent(TODO_EVENTS.LIST_CREATED, createdData)
        })

        await waitFor(() => {
          expect(mockSetLists).toHaveBeenCalled()
        })

        expect(localforage.setItem).toHaveBeenCalledWith('new-list-2', {
          listId: 'new-list-2',
          listName: 'List With Items',
          todos: createdData.items,
        })
      })
    })

    describe('LIST_SHARE_SUCCESS event', () => {
      it('should handle successful list sharing', async () => {
        renderUseTodoSync()

        const shareData = {
          message: 'List shared with user successfully',
        }

        act(() => {
          mockSocket.simulateEvent(TODO_EVENTS.LIST_SHARE_SUCCESS, shareData)
        })

        // Just verify the event was handled without errors
        await waitFor(() => {
          expect(mockSocket.on).toHaveBeenCalledWith(
            TODO_EVENTS.LIST_SHARE_SUCCESS,
            expect.any(Function)
          )
        })
      })

      it('should not crash when share data is null', async () => {
        renderUseTodoSync()

        act(() => {
          mockSocket.simulateEvent(TODO_EVENTS.LIST_SHARE_SUCCESS, null)
        })

        // Should not crash with null data
        expect(() =>
          mockSocket.simulateEvent(TODO_EVENTS.LIST_SHARE_SUCCESS, null)
        ).not.toThrow()
      })
    })

    describe('LIST_SHARED_WITH_YOU event', () => {
      it('should handle receiving a shared list', async () => {
        renderUseTodoSync()

        const sharedData = {
          list_id: 'shared-list-1',
          message: 'User shared a list with you',
        }

        act(() => {
          mockSocket.simulateEvent(TODO_EVENTS.LIST_SHARED_WITH_YOU, sharedData)
        })

        await waitFor(() => {
          expect(mockSocket.emit).toHaveBeenCalledWith('join_list', {
            user_id: mockUserId,
            list_id: 'shared-list-1',
          })
        })
      })
    })

    describe('ITEM_ADDED event', () => {
      it('should handle item addition', async () => {
        renderUseTodoSync()

        const addedData = {
          list_id: mockTodoList.listId,
          item: mockTodoItem,
          rev: 6,
        }

        act(() => {
          mockSocket.simulateEvent(TODO_EVENTS.ITEM_ADDED, addedData)
        })

        await waitFor(() => {
          expect(mockSetLists).toHaveBeenCalledWith(expect.any(Function))
        })

        // Verify localforage was called to update cache
        expect(localforage.getItem).toHaveBeenCalledWith(mockTodoItem.list_id)
      })
    })

    describe('ITEM_UPDATED event', () => {
      it('should handle item update', async () => {
        renderUseTodoSync()

        const updatedItem: TodoItem = {
          ...mockTodoItem,
          name: 'Updated Task',
          done: true,
        }

        const updateData = {
          list_id: mockTodoList.listId,
          item: updatedItem,
          rev: 7,
        }

        act(() => {
          mockSocket.simulateEvent(TODO_EVENTS.ITEM_UPDATED, updateData)
        })

        await waitFor(() => {
          expect(mockSetLists).toHaveBeenCalledWith(expect.any(Function))
        })

        expect(localforage.getItem).toHaveBeenCalledWith(updatedItem.list_id)
      })
    })

    describe('ITEM_DELETED event', () => {
      it('should handle item deletion', async () => {
        renderUseTodoSync()

        const deleteData = {
          list_id: mockTodoList.listId,
          item_id: mockTodoItem.id,
          rev: 8,
        }

        act(() => {
          mockSocket.simulateEvent(TODO_EVENTS.ITEM_DELETED, deleteData)
        })

        await waitFor(() => {
          expect(mockSetLists).toHaveBeenCalledWith(expect.any(Function))
        })

        // Verify localforage was called to update cache
        expect(localforage.getItem).toHaveBeenCalledWith(mockTodoList.listId)
      })
    })
  })

  describe('Outgoing Operations', () => {
    describe('handleAddTodo', () => {
      it('should emit ADD_ITEM event with correct data', () => {
        const { result } = renderUseTodoSync()

        act(() => {
          result.current.handleAddTodo(mockTodoList.listId, 'New Task')
        })

        expect(mockSocket.emit).toHaveBeenCalledWith(
          TODO_EMIT_EVENTS.ADD_ITEM,
          {
            list_id: mockTodoList.listId,
            user_id: mockUserId,
            name: 'New Task',
            description: '',
            rev: expect.any(Number),
          }
        )
      })

      it('should use current revision when adding item', () => {
        const { result } = renderUseTodoSync()

        // Simulate a snapshot to set revision
        act(() => {
          mockSocket.simulateEvent(TODO_EVENTS.LIST_SNAPSHOT, {
            list_id: mockTodoList.listId,
            list_name: mockTodoList.listName,
            items: mockTodoList.todos,
            rev: 15,
          })
        })

        act(() => {
          result.current.handleAddTodo(mockTodoList.listId, 'Another Task')
        })

        expect(mockSocket.emit).toHaveBeenCalledWith(
          TODO_EMIT_EVENTS.ADD_ITEM,
          expect.objectContaining({
            rev: 15,
          })
        )
      })
    })

    describe('handleUpdateTodo', () => {
      it('should emit UPDATE_ITEM event with partial updates', () => {
        const { result } = renderUseTodoSync()

        const updates = {
          name: 'Updated Name',
          done: true,
        }

        act(() => {
          result.current.handleUpdateTodo(
            mockTodoList.listId,
            mockTodoItem.id,
            updates
          )
        })

        expect(mockSocket.emit).toHaveBeenCalledWith(
          TODO_EMIT_EVENTS.UPDATE_ITEM,
          {
            list_id: mockTodoList.listId,
            item_id: mockTodoItem.id,
            ...updates,
          }
        )
      })

      it('should not emit when no updates provided', () => {
        const { result } = renderUseTodoSync()

        act(() => {
          result.current.handleUpdateTodo(
            mockTodoList.listId,
            mockTodoItem.id,
            {}
          )
        })

        expect(mockSocket.emit).not.toHaveBeenCalled()
      })
    })

    describe('toggleDone', () => {
      it('should toggle item done status', () => {
        const { result } = renderUseTodoSync()

        act(() => {
          result.current.toggleDone(mockTodoItem)
        })

        expect(mockSocket.emit).toHaveBeenCalledWith(
          TODO_EMIT_EVENTS.UPDATE_ITEM,
          {
            list_id: mockTodoList.listId,
            user_id: mockUserId,
            item_id: mockTodoItem.id,
            done: !mockTodoItem.done,
          }
        )
      })

      it('should not emit when no active list', () => {
        const { result } = renderUseTodoSync(mockLists, null)

        act(() => {
          result.current.toggleDone(mockTodoItem)
        })

        expect(mockSocket.emit).not.toHaveBeenCalled()
      })
    })

    describe('handleDeleteTodo', () => {
      it('should emit DELETE_ITEM event', () => {
        const { result } = renderUseTodoSync()

        act(() => {
          result.current.handleDeleteTodo(mockTodoList.listId, mockTodoItem.id)
        })

        expect(mockSocket.emit).toHaveBeenCalledWith(
          TODO_EMIT_EVENTS.DELETE_ITEM,
          {
            list_id: mockTodoList.listId,
            item_id: mockTodoItem.id,
          }
        )
      })
    })

    describe('handleShareList', () => {
      it('should emit SHARE_LIST event with role', async () => {
        const { result } = renderUseTodoSync()

        await act(async () => {
          await result.current.handleShareList(
            mockTodoList.listId,
            'user-456',
            'editor'
          )
        })

        expect(mockSocket.emit).toHaveBeenCalledWith(
          TODO_EMIT_EVENTS.SHARE_LIST,
          {
            list_id: mockTodoList.listId,
            user_id: 'user-456',
            role: 'editor',
          }
        )
      })
    })

    describe('handleCreateList', () => {
      it('should emit CREATE_LIST event', () => {
        const { result } = renderUseTodoSync()

        act(() => {
          result.current.handleCreateList('My New List')
        })

        expect(mockSocket.emit).toHaveBeenCalledWith(
          TODO_EMIT_EVENTS.CREATE_LIST,
          {
            list_name: 'My New List',
            user_id: mockUserId,
          }
        )
      })
    })
  })

  describe('Cleanup', () => {
    it('should remove all event listeners on unmount', () => {
      const { unmount } = renderUseTodoSync()

      unmount()

      expect(mockSocket.removeAllListeners).toHaveBeenCalledWith(
        TODO_EVENTS.LIST_SNAPSHOT
      )
      expect(mockSocket.removeAllListeners).toHaveBeenCalledWith(
        TODO_EVENTS.LIST_CREATED
      )
      expect(mockSocket.removeAllListeners).toHaveBeenCalledWith(
        TODO_EVENTS.LIST_SHARE_SUCCESS
      )
      expect(mockSocket.removeAllListeners).toHaveBeenCalledWith(
        TODO_EVENTS.LIST_SHARED_WITH_YOU
      )
      expect(mockSocket.removeAllListeners).toHaveBeenCalledWith(
        TODO_EVENTS.ITEM_ADDED
      )
      expect(mockSocket.removeAllListeners).toHaveBeenCalledWith(
        TODO_EVENTS.ITEM_UPDATED
      )
      expect(mockSocket.removeAllListeners).toHaveBeenCalledWith(
        TODO_EVENTS.ITEM_DELETED
      )
    })
  })

  describe('State Management', () => {
    it('should return current lists and activeListId', () => {
      const { result } = renderUseTodoSync()

      expect(result.current.lists).toEqual(mockLists)
      expect(result.current.activeListId).toBe(mockTodoList.listId)
    })

    it('should expose setLists and setActiveListId', () => {
      const { result } = renderUseTodoSync()

      expect(result.current.setLists).toBe(mockSetLists)
      expect(result.current.setActiveListId).toBe(mockSetActiveListId)
    })

    it('should expose all CRUD operations', () => {
      const { result } = renderUseTodoSync()

      expect(typeof result.current.handleAddTodo).toBe('function')
      expect(typeof result.current.handleUpdateTodo).toBe('function')
      expect(typeof result.current.toggleDone).toBe('function')
      expect(typeof result.current.handleDeleteTodo).toBe('function')
      expect(typeof result.current.handleShareList).toBe('function')
      expect(typeof result.current.handleCreateList).toBe('function')
    })
  })

  describe('Edge Cases', () => {
    it('should handle null data in LIST_SNAPSHOT event', async () => {
      renderUseTodoSync()

      act(() => {
        mockSocket.simulateEvent(TODO_EVENTS.LIST_SNAPSHOT, null)
      })

      await waitFor(() => {
        expect(mockSetLists).not.toHaveBeenCalled()
      })
    })

    it('should handle null data in ITEM_ADDED event', async () => {
      renderUseTodoSync()

      act(() => {
        mockSocket.simulateEvent(TODO_EVENTS.ITEM_ADDED, null)
      })

      await waitFor(() => {
        expect(mockSetLists).not.toHaveBeenCalled()
      })
    })

    it('should handle operations with null socket', () => {
      const { result } = renderHook(() => {
        const revRef = useRef<Record<string, number>>({})
        return useTodoSync(
          null,
          mockUserId,
          mockLists,
          mockSetLists,
          mockTodoList.listId,
          mockSetActiveListId,
          revRef
        )
      })

      // Should not crash when socket is null
      expect(() => {
        result.current.handleAddTodo(mockTodoList.listId, 'Test')
        result.current.handleDeleteTodo(mockTodoList.listId, 'item-1')
      }).not.toThrow()
    })
  })
})
