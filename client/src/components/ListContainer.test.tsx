import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent, { UserEvent } from '@testing-library/user-event'

import ListContainer from './ListContainer'
import type { Socket } from 'socket.io-client'
import type { TodoList } from '@/types/todo'
import localforage from 'localforage'
import { useAuth } from '@/contexts/AuthContext'
import { useSocket } from '@/hooks/useSocket'
import { useTodoFilters } from '@/hooks/useTodoFilters'
import { useTodoStore } from '@/utils/todoStore'
import { useTodoSync } from '@/hooks/useTodoSync'

interface TodoState {
  isConnected: boolean
  setIsConnected: (v: boolean) => void
  message: string | null
  error: string | null
  setMessage: (msg: string | null) => void
  setError: (error: string | null) => void
}

// Mock all dependencies
vi.mock('@/contexts/AuthContext')
vi.mock('@/hooks/useSocket')
vi.mock('@/hooks/useTodoFilters')
vi.mock('@/utils/todoStore')
vi.mock('@/hooks/useTodoSync')
vi.mock('localforage')

const mockSelectedActiveList = async (user: UserEvent, mockUserId: string) => {
  // Mock localforage to return a cached list
  vi.mocked(localforage.keys).mockResolvedValue(['list-1'])
  vi.mocked(localforage.getItem).mockResolvedValue({
    listId: 'list-1',
    listName: 'My Shared List',
    todos: {},
    rev: 1,
  })

  render(<ListContainer userId={mockUserId} />)
  // Wait for the cached list to load
  await waitFor(() => {
    expect(screen.getByText(/Select First List/i)).toBeInTheDocument()
  })

  // Select the first list to make it active
  await user.click(screen.getByText('Select First List'))
}

// Mock child components
vi.mock('./Sidebar', () => ({
  default: ({
    activeListId,
    isConnected,
    handleCreateList,
    setActiveListId,
    lists,
  }: {
    activeListId: string | null
    isConnected: boolean
    handleCreateList: (name: string) => void
    setActiveListId: (id: string) => void
    lists: Record<string, TodoList>
  }) => (
    <div data-testid='sidebar'>
      <div>Sidebar</div>
      <div>Connected: {isConnected ? 'true' : 'false'}</div>
      <div>Active List: {activeListId || 'none'}</div>
      <button onClick={() => handleCreateList('New List')}>Create List</button>
      {lists && Object.keys(lists).length > 0 && (
        <button
          data-testid='select-first-list-button'
          onClick={() => setActiveListId(Object.keys(lists)[0])}
        >
          Select First List
        </button>
      )}
    </div>
  ),
}))

vi.mock('./TodoListView', () => ({
  TodoListView: ({
    activeList,
    newTodo,
    setNewTodo,
    onShareClick,
    onTodoClick,
    onKeyPress,
  }: {
    activeList: TodoList | null
    newTodo: string
    setNewTodo: (value: string) => void
    onShareClick: () => void
    onTodoClick: (todo: { id: string; name: string }) => void
    onKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void
  }) => (
    <div data-testid='todo-list-view'>
      <div>TodoListView</div>
      <div>List: {activeList?.listName || 'No list selected'}</div>
      <input
        data-testid='new-todo-input'
        value={newTodo}
        onChange={(e) => setNewTodo(e.target.value)}
        onKeyPress={onKeyPress}
      />
      <button data-testid='share-button' onClick={onShareClick}>
        Share
      </button>
      <button onClick={() => onTodoClick({ id: 'todo-1', name: 'Test Todo' })}>
        Click Todo
      </button>
    </div>
  ),
}))

vi.mock('./TodoModal', () => ({
  default: ({
    todo,
    isOpen,
    onClose,
    onUpdate,
    onDelete,
  }: {
    todo: { id: string; name: string } | null
    isOpen: boolean
    onClose: () => void
    onUpdate: (updates: { name: string }) => void
    onDelete: () => void
  }) =>
    isOpen ? (
      <div data-testid='todo-modal'>
        <div>Todo Modal</div>
        <div>Todo: {todo?.name}</div>
        <button onClick={onClose}>Close Modal</button>
        <button onClick={() => onUpdate({ name: 'Updated' })}>Update</button>
        <button data-testid='delete-item-button' onClick={onDelete}>
          Delete
        </button>
      </div>
    ) : null,
}))

vi.mock('./ShareModal', () => ({
  default: ({
    isOpen,
    onClose,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    listId,
    listName,
    onShare,
  }: {
    isOpen: boolean
    onClose: () => void
    listId: string
    listName: string
    onShare: (userId: string, role: string) => void
  }) =>
    isOpen ? (
      <div data-testid='share-modal'>
        <div data-testid='share-modal-title'>Share Modal</div>
        <div data-testid='share-modal-list-name'>List: {listName}</div>
        <button onClick={onClose}>Close Share Modal</button>
        <button
          data-testid='do-share'
          onClick={() => onShare('user-2', 'editor')}
        >
          Share with User
        </button>
      </div>
    ) : null,
}))

describe('ListContainer', () => {
  let mockSocket: Partial<Socket>
  let mockHandleAddTodo: ReturnType<typeof vi.fn>
  let mockHandleUpdateTodo: ReturnType<typeof vi.fn>
  let mockHandleDeleteTodo: ReturnType<typeof vi.fn>
  let mockToggleDone: ReturnType<typeof vi.fn>
  let mockHandleShareList: ReturnType<typeof vi.fn>
  let mockHandleCreateList: ReturnType<typeof vi.fn>
  let mockSetFilterStatus: ReturnType<typeof vi.fn>
  let mockSetFilterDueDate: ReturnType<typeof vi.fn>
  let mockSetSortBy: ReturnType<typeof vi.fn>
  let mockSetSortOrder: ReturnType<typeof vi.fn>
  let mockResetFilters: ReturnType<typeof vi.fn>
  let mockFilterAndSort: ReturnType<typeof vi.fn>

  const mockUserId = 'user-123'
  const mockAccessToken = 'token-abc'

  beforeEach(() => {
    // Create fresh mock functions
    mockSocket = { on: vi.fn(), emit: vi.fn(), off: vi.fn() }
    mockHandleAddTodo = vi.fn()
    mockHandleUpdateTodo = vi.fn()
    mockHandleDeleteTodo = vi.fn()
    mockToggleDone = vi.fn()
    mockHandleShareList = vi.fn()
    mockHandleCreateList = vi.fn()
    mockSetFilterStatus = vi.fn()
    mockSetFilterDueDate = vi.fn()
    mockSetSortBy = vi.fn()
    mockSetSortOrder = vi.fn()
    mockResetFilters = vi.fn()
    mockFilterAndSort = vi.fn((todos) => todos)

    // Mock useAuth
    vi.mocked(useAuth).mockReturnValue({
      userId: mockUserId,
      accessToken: mockAccessToken,
      isLoggedIn: true,
      login: vi.fn(),
      logout: vi.fn(),
    })

    // Mock useSocket
    vi.mocked(useSocket).mockReturnValue(mockSocket as Socket)

    // Mock useTodoFilters
    vi.mocked(useTodoFilters).mockReturnValue({
      filterStatus: 'all',
      setFilterStatus: mockSetFilterStatus,
      filterDueDate: 'all',
      setFilterDueDate: mockSetFilterDueDate,
      sortBy: 'name',
      setSortBy: mockSetSortBy,
      sortOrder: 'asc',
      setSortOrder: mockSetSortOrder,
      resetFilters: mockResetFilters,
      hasActiveFilters: false,
      filterAndSort: mockFilterAndSort,
    })

    // Mock useTodoStore
    vi.mocked(useTodoStore).mockImplementation(
      (selector: (state: TodoState) => unknown) => {
        const mockState: TodoState = {
          isConnected: true,
          setIsConnected: vi.fn(),
          error: null,
          setError: vi.fn(),
          message: null,
          setMessage: vi.fn(),
        }
        return selector(mockState)
      }
    )

    // Mock useTodoSync
    vi.mocked(useTodoSync).mockReturnValue({
      lists: {},
      setLists: vi.fn(),
      activeListId: null,
      setActiveListId: vi.fn(),
      handleAddTodo: mockHandleAddTodo,
      handleUpdateTodo: mockHandleUpdateTodo,
      handleDeleteTodo: mockHandleDeleteTodo,
      toggleDone: mockToggleDone,
      handleShareList: mockHandleShareList,
      handleCreateList: mockHandleCreateList,
    })

    // Mock localforage
    vi.mocked(localforage.config).mockReturnValue({} as LocalForageOptions)
    vi.mocked(localforage.keys).mockResolvedValue([])
    vi.mocked(localforage.getItem).mockResolvedValue(null)
    vi.mocked(localforage.setItem).mockResolvedValue(null as unknown as string)

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial Rendering', () => {
    it('should render Sidebar component', () => {
      render(<ListContainer userId={mockUserId} />)

      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
      expect(screen.getByText('Sidebar')).toBeInTheDocument()
    })

    it('should render TodoListView component', () => {
      render(<ListContainer userId={mockUserId} />)

      expect(screen.getByTestId('todo-list-view')).toBeInTheDocument()
      expect(screen.getByText('TodoListView')).toBeInTheDocument()
    })

    it('should show "No list selected" when no active list', () => {
      render(<ListContainer userId={mockUserId} />)

      expect(screen.getByText('List: No list selected')).toBeInTheDocument()
    })

    it('should display connection status', () => {
      render(<ListContainer userId={mockUserId} />)

      expect(screen.getByText('Connected: true')).toBeInTheDocument()
    })

    it('should initialize socket with userId and accessToken', () => {
      render(<ListContainer userId={mockUserId} />)

      expect(useSocket).toHaveBeenCalledWith(mockUserId, mockAccessToken)
    })

    it('should initialize useTodoSync with correct parameters', () => {
      render(<ListContainer userId={mockUserId} />)

      expect(useTodoSync).toHaveBeenCalledWith(
        mockSocket,
        mockAccessToken,
        expect.any(Object), // lists
        expect.any(Function), // setLists
        null, // activeListId
        expect.any(Function), // setActiveListId
        expect.any(Object) // revRef
      )
    })
  })

  describe('Local Cache Loading', () => {
    it('should load cached lists from localforage on mount', async () => {
      const mockCachedList: TodoList = {
        listId: 'list-1',
        listName: 'Cached List',
        todos: {
          'todo-1': {
            id: 'todo-1',
            list_id: 'list-1',
            name: 'Cached Todo',
            description: null,
            status: 'not_started',
            done: false,
            due_date: null,
            media_url: null,
            is_deleted: false,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        },
      }

      vi.mocked(localforage.keys).mockResolvedValue(['list-1'])
      vi.mocked(localforage.getItem).mockResolvedValue({
        listId: 'list-1',
        listName: 'Cached List',
        todos: mockCachedList.todos,
        rev: 1,
      })

      render(<ListContainer userId={mockUserId} />)

      await waitFor(() => {
        expect(localforage.keys).toHaveBeenCalled()
      })
    })

    it('should handle empty cache gracefully', async () => {
      vi.mocked(localforage.keys).mockResolvedValue([])

      render(<ListContainer userId={mockUserId} />)

      await waitFor(() => {
        expect(localforage.keys).toHaveBeenCalled()
      })

      // Should not crash, just show no lists
      expect(screen.getByText('List: No list selected')).toBeInTheDocument()
    })

    it('should handle cache loading errors gracefully', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      vi.mocked(localforage.keys).mockRejectedValue(new Error('Cache error'))

      render(<ListContainer userId={mockUserId} />)

      await waitFor(() => {
        expect(localforage.keys).toHaveBeenCalled()
      })

      // Should not crash
      expect(screen.getByTestId('sidebar')).toBeInTheDocument()

      consoleError.mockRestore()
    })
  })

  describe('Modal Management', () => {
    it('should not show TodoModal initially', () => {
      render(<ListContainer userId={mockUserId} />)

      expect(screen.queryByTestId('todo-modal')).not.toBeInTheDocument()
    })

    it('should open TodoModal when todo is clicked', async () => {
      const user = userEvent.setup()
      // Mock load cache and activate first list
      await mockSelectedActiveList(user, mockUserId)

      await user.click(screen.getByText('Click Todo'))

      expect(screen.getByTestId('todo-modal')).toBeInTheDocument()
      expect(screen.getByText('Todo: Test Todo')).toBeInTheDocument()
    })

    it('should close TodoModal when close button is clicked', async () => {
      const user = userEvent.setup()
      // Mock load cache and activate first list
      await mockSelectedActiveList(user, mockUserId)

      // Open modal
      await user.click(screen.getByText('Click Todo'))
      expect(screen.getByTestId('todo-modal')).toBeInTheDocument()

      // Close modal
      await user.click(screen.getByText('Close Modal'))
      expect(screen.queryByTestId('todo-modal')).not.toBeInTheDocument()
    })

    it('should not show ShareModal initially', () => {
      render(<ListContainer userId={mockUserId} />)

      expect(screen.queryByTestId('share-modal')).not.toBeInTheDocument()
    })

    it('should open ShareModal when share button is clicked', async () => {
      const user = userEvent.setup()
      // Mock load cache and activate first list
      await mockSelectedActiveList(user, mockUserId)

      await user.click(screen.getByText('Share'))

      expect(screen.getByTestId('share-modal')).toBeInTheDocument()
    })

    it('should close ShareModal when close button is clicked', async () => {
      const user = userEvent.setup()
      // Mock load cache and activate first list
      await mockSelectedActiveList(user, mockUserId)

      // Open modal
      await user.click(screen.getByTestId('share-button'))
      expect(screen.getByTestId('share-modal')).toBeInTheDocument()

      // Close modal
      await user.click(screen.getByText('Close Share Modal'))
      expect(screen.queryByTestId('share-modal')).not.toBeInTheDocument()
    })
  })

  describe('Todo Operations', () => {
    it('should handle adding todo via Enter key', async () => {
      const user = userEvent.setup()
      render(<ListContainer userId={mockUserId} />)

      const input = screen.getByTestId('new-todo-input')
      await user.type(input, 'New Task')

      // Simulate Enter key
      await user.keyboard('{Enter}')

      // Note: Since we don't have an active list, handleAddTodo won't be called
      // This tests the Enter key handler logic
    })

    it('should update todo through TodoModal', async () => {
      const user = userEvent.setup()

      // Mock load cache and activate first list
      await mockSelectedActiveList(user, mockUserId)

      // Open modal
      await user.click(screen.getByText('Click Todo'))

      // Update todo
      await user.click(screen.getByText('Update'))

      expect(mockHandleUpdateTodo).toHaveBeenCalledWith(
        'list-1',
        'todo-1',
        {
          name: 'Updated',
        },
        ''
      )
    })

    it('should delete todo through TodoModal', async () => {
      const user = userEvent.setup()

      // Mock load cache and activate first list
      await mockSelectedActiveList(user, mockUserId)

      // Open modal
      await user.click(screen.getByText('Click Todo'))

      // Delete todo
      await user.click(screen.getByTestId('delete-item-button'))

      expect(mockHandleDeleteTodo).toHaveBeenCalledWith('list-1', 'todo-1')
    })
  })

  describe('Share Operations', () => {
    it('should share list through ShareModal', async () => {
      const user = userEvent.setup()

      // Mock load cache and activate first list
      await mockSelectedActiveList(user, mockUserId)

      // Open share modal
      await user.click(screen.getByTestId('share-button'))
      await user.click(screen.getByTestId('do-share'))

      expect(mockHandleShareList).toHaveBeenCalledWith(
        'list-1',
        'user-2',
        'editor'
      )
    })

    it('should display list name in ShareModal when opened', async () => {
      const user = userEvent.setup()

      // Mock localforage to return a cached list
      vi.mocked(localforage.keys).mockResolvedValue(['list-1'])
      vi.mocked(localforage.getItem).mockResolvedValue({
        listId: 'list-1',
        listName: 'My Shared List',
        todos: {},
        rev: 1,
      })

      render(<ListContainer userId={mockUserId} />)

      // Wait for the cached list to load
      await waitFor(() => {
        expect(screen.getByText(/Select First List/i)).toBeInTheDocument()
      })

      // Select the first list to make it active
      await user.click(screen.getByText('Select First List'))

      // Wait for the list to be active
      await waitFor(() => {
        expect(screen.getByText('Active List: list-1')).toBeInTheDocument()
      })

      // Open share modal
      await user.click(screen.getByTestId('share-button'))

      // The ShareModal should be rendered
      await waitFor(() => {
        expect(screen.getByTestId('share-modal')).toBeInTheDocument()
      })

      // The mock renders "Share Modal" text
      expect(screen.getByTestId('share-modal')).toBeInTheDocument()
      // Verify the list name is passed to the modal
      const listNameDiv = screen.getByTestId('share-modal-list-name')
      expect(listNameDiv).toHaveTextContent('List: My Shared List')
    })
  })

  describe('List Creation', () => {
    it('should create list through Sidebar', async () => {
      const user = userEvent.setup()
      render(<ListContainer userId={mockUserId} />)

      await user.click(screen.getByText('Create List'))

      expect(mockHandleCreateList).toHaveBeenCalledWith('New List')
    })
  })

  describe('Connection Status', () => {
    it('should display connected status when connected', () => {
      vi.mocked(useTodoStore).mockImplementation(
        (selector: (state: TodoState) => unknown) => {
          const mockState: TodoState = {
            isConnected: true,
            setIsConnected: vi.fn(),
            error: null,
            setError: vi.fn(),
            message: null,
            setMessage: vi.fn(),
          }
          return selector(mockState)
        }
      )

      render(<ListContainer userId={mockUserId} />)

      expect(screen.getByText('Connected: true')).toBeInTheDocument()
    })

    it('should display disconnected status when not connected', () => {
      vi.mocked(useTodoStore).mockImplementation(
        (selector: (state: TodoState) => unknown) => {
          const mockState: TodoState = {
            isConnected: false,
            setIsConnected: vi.fn(),
            error: null,
            setError: vi.fn(),
            message: null,
            setMessage: vi.fn(),
          }
          return selector(mockState)
        }
      )

      render(<ListContainer userId={mockUserId} />)

      expect(screen.getByText('Connected: false')).toBeInTheDocument()
    })
  })

  describe('State Isolation', () => {
    it('should have independent state in each test (test 1)', () => {
      render(<ListContainer userId={mockUserId} />)

      expect(screen.queryByTestId('todo-modal')).not.toBeInTheDocument()
      expect(screen.queryByTestId('share-modal')).not.toBeInTheDocument()
    })

    it('should have independent state in each test (test 2)', () => {
      render(<ListContainer userId={mockUserId} />)

      expect(screen.queryByTestId('todo-modal')).not.toBeInTheDocument()
      expect(screen.queryByTestId('share-modal')).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing accessToken', () => {
      vi.mocked(useAuth).mockReturnValue({
        userId: mockUserId,
        accessToken: null,
        isLoggedIn: false,
        login: vi.fn(),
        logout: vi.fn(),
      })

      render(<ListContainer userId={mockUserId} />)

      expect(useSocket).toHaveBeenCalledWith(mockUserId, '')
    })

    it('should not render TodoModal when no active list', async () => {
      userEvent.setup()
      render(<ListContainer userId={mockUserId} />)

      // Modal should not have Update/Delete buttons working without active list
      expect(screen.queryByText('Edit Todo')).not.toBeInTheDocument()
    })

    it('should not render ShareModal when no active list', () => {
      render(<ListContainer userId={mockUserId} />)

      // ShareModal component has conditional rendering based on activeListId
      // Since activeListId is null, the modal wrapper won't render
      expect(screen.queryByTestId('share-modal')).not.toBeInTheDocument()
    })
  })
})
