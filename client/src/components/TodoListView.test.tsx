import type { FilterDueDate, FilterStatus } from '@/hooks/useTodoFilters'
import type { TodoItem, TodoList } from '@/types/todo'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { TodoListView } from './TodoListView'
import userEvent from '@testing-library/user-event'

describe('TodoListView', () => {
  let mockSetNewTodo: ReturnType<typeof vi.fn>
  let mockSetFilterStatus: ReturnType<typeof vi.fn>
  let mockSetFilterDueDate: ReturnType<typeof vi.fn>
  let mockSetSortBy: ReturnType<typeof vi.fn>
  let mockSetSortOrder: ReturnType<typeof vi.fn>
  let mockResetFilters: ReturnType<typeof vi.fn>
  let mockHandleAddTodo: ReturnType<typeof vi.fn>
  let mockHandleUpdateTodo: ReturnType<typeof vi.fn>
  let mockHandleDeleteTodo: ReturnType<typeof vi.fn>
  let mockToggleDone: ReturnType<typeof vi.fn>
  let mockOnShareClick: ReturnType<typeof vi.fn>
  let mockOnTodoClick: ReturnType<typeof vi.fn>
  let mockOnKeyPress: ReturnType<typeof vi.fn>

  let mockTodoList: TodoList
  let mockTodos: Record<string, TodoItem>
  let mockTodoArray: TodoItem[]

  beforeEach(() => {
    // Create fresh mock functions for each test
    mockSetNewTodo = vi.fn()
    mockSetFilterStatus = vi.fn()
    mockSetFilterDueDate = vi.fn()
    mockSetSortBy = vi.fn()
    mockSetSortOrder = vi.fn()
    mockResetFilters = vi.fn()
    mockHandleAddTodo = vi.fn()
    mockHandleUpdateTodo = vi.fn()
    mockHandleDeleteTodo = vi.fn()
    mockToggleDone = vi.fn()
    mockOnShareClick = vi.fn()
    mockOnTodoClick = vi.fn()
    mockOnKeyPress = vi.fn()

    // Create fresh mock data for each test
    mockTodoList = {
      listId: 'list-1',
      listName: 'Test List',
      todos: {},
    }

    mockTodos = {
      'todo-1': {
        id: 'todo-1',
        list_id: 'list-1',
        name: 'First Task',
        description: 'First task description',
        status: 'not_started',
        done: false,
        due_date: '2024-12-31T23:59:59Z',
        media_url: null,
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      'todo-2': {
        id: 'todo-2',
        list_id: 'list-1',
        name: 'Second Task',
        description: 'Second task description',
        status: 'in_progress',
        done: false,
        due_date: '2024-12-25T23:59:59Z',
        media_url: null,
        is_deleted: false,
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
      'todo-3': {
        id: 'todo-3',
        list_id: 'list-1',
        name: 'Third Task',
        description: null,
        status: 'completed',
        done: true,
        due_date: null,
        media_url: null,
        is_deleted: false,
        created_at: '2024-01-03T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z',
      },
    }

    mockTodoArray = Object.values(mockTodos)

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const getDefaultProps = () => ({
    activeList: mockTodoList,
    activeTodos: mockTodos,
    filteredAndSortedTodos: mockTodoArray,
    newTodo: '',
    setNewTodo: mockSetNewTodo,
    isConnected: true,
    filterStatus: 'all' as FilterStatus,
    setFilterStatus: mockSetFilterStatus,
    filterDueDate: 'all' as FilterDueDate,
    setFilterDueDate: mockSetFilterDueDate,
    sortBy: 'name' as 'name' | 'due_date' | 'status',
    setSortBy: mockSetSortBy,
    sortOrder: 'asc' as 'asc' | 'desc',
    setSortOrder: mockSetSortOrder,
    hasActiveFilters: false,
    resetFilters: mockResetFilters,
    handleAddTodo: mockHandleAddTodo,
    handleUpdateTodo: mockHandleUpdateTodo,
    handleDeleteTodo: mockHandleDeleteTodo,
    toggleDone: mockToggleDone,
    onShareClick: mockOnShareClick,
    onTodoClick: mockOnTodoClick,
    onKeyPress: mockOnKeyPress,
  })

  describe('Empty State', () => {
    it('should show empty state when no list is selected', () => {
      render(<TodoListView {...getDefaultProps()} activeList={null} />)

      expect(screen.getByText('No list selected')).toBeInTheDocument()
      expect(
        screen.getByText('Select a list from the sidebar or create a new one')
      ).toBeInTheDocument()
    })
  })

  describe('Header Section', () => {
    it('should display list name', () => {
      render(<TodoListView {...getDefaultProps()} />)

      expect(screen.getByText('Test List')).toBeInTheDocument()
    })

    it('should display task count', () => {
      render(<TodoListView {...getDefaultProps()} />)

      expect(screen.getByText('3 tasks')).toBeInTheDocument()
    })

    it('should display correct task count for empty list', () => {
      render(<TodoListView {...getDefaultProps()} activeTodos={{}} />)

      expect(screen.getByText('0 tasks')).toBeInTheDocument()
    })

    it('should render share button when connected', () => {
      render(<TodoListView {...getDefaultProps()} />)

      const shareButton = screen.getByRole('button', { name: /share/i })
      expect(shareButton).toBeInTheDocument()
      expect(shareButton).not.toBeDisabled()
    })

    it('should disable share button when disconnected', () => {
      render(<TodoListView {...getDefaultProps()} isConnected={false} />)

      const shareButton = screen.getByRole('button', { name: /share/i })
      expect(shareButton).toBeDisabled()
    })

    it('should call onShareClick when share button is clicked', async () => {
      const user = userEvent.setup()
      render(<TodoListView {...getDefaultProps()} />)

      await user.click(screen.getByRole('button', { name: /share/i }))

      expect(mockOnShareClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Add Todo Form', () => {
    it('should render input field with placeholder', () => {
      render(<TodoListView {...getDefaultProps()} />)

      expect(
        screen.getByPlaceholderText('What needs to be done?')
      ).toBeInTheDocument()
    })

    it('should display current newTodo value', () => {
      render(<TodoListView {...getDefaultProps()} newTodo='Test task' />)

      expect(screen.getByDisplayValue('Test task')).toBeInTheDocument()
    })

    it('should call setNewTodo when input changes', async () => {
      const user = userEvent.setup()
      render(<TodoListView {...getDefaultProps()} />)

      const input = screen.getByPlaceholderText('What needs to be done?')
      await user.type(input, 'New task')

      expect(mockSetNewTodo).toHaveBeenCalled()
    })

    it('should call onKeyPress when Enter is pressed', () => {
      render(<TodoListView {...getDefaultProps()} />)

      const input = screen.getByPlaceholderText('What needs to be done?')
      fireEvent.keyPress(input, { key: 'Enter', code: 13, charCode: 13 })

      expect(mockOnKeyPress).toHaveBeenCalled()
    })

    it('should render Add Task button', () => {
      render(<TodoListView {...getDefaultProps()} />)

      expect(
        screen.getByRole('button', { name: /add task/i })
      ).toBeInTheDocument()
    })

    it('should disable Add Task button when newTodo is empty', () => {
      render(<TodoListView {...getDefaultProps()} newTodo='' />)

      expect(screen.getByRole('button', { name: /add task/i })).toBeDisabled()
    })

    it('should disable Add Task button when newTodo is whitespace only', () => {
      render(<TodoListView {...getDefaultProps()} newTodo='   ' />)

      expect(screen.getByRole('button', { name: /add task/i })).toBeDisabled()
    })

    it('should enable Add Task button when newTodo has content', () => {
      render(<TodoListView {...getDefaultProps()} newTodo='New task' />)

      expect(
        screen.getByRole('button', { name: /add task/i })
      ).not.toBeDisabled()
    })

    it('should disable input and button when disconnected', () => {
      render(<TodoListView {...getDefaultProps()} isConnected={false} />)

      expect(
        screen.getByPlaceholderText('What needs to be done?')
      ).toBeDisabled()
      expect(screen.getByRole('button', { name: /add task/i })).toBeDisabled()
    })

    it('should call handleAddTodo when Add Task button is clicked', async () => {
      const user = userEvent.setup()
      render(<TodoListView {...getDefaultProps()} newTodo='New task' />)

      await user.click(screen.getByRole('button', { name: /add task/i }))

      expect(mockHandleAddTodo).toHaveBeenCalledWith('list-1', 'New task')
    })
  })

  describe('Filter Controls', () => {
    it('should render status filter dropdown', () => {
      render(<TodoListView {...getDefaultProps()} />)

      expect(screen.getByLabelText('Filter by Status')).toBeInTheDocument()
    })

    it('should render all status filter options', () => {
      render(<TodoListView {...getDefaultProps()} />)

      const statusSelect = screen.getByLabelText('Filter by Status')
      const options = statusSelect.querySelectorAll('option')

      expect(options).toHaveLength(4)
      expect(options[0]).toHaveValue('all')
      expect(options[1]).toHaveValue('not_started')
      expect(options[2]).toHaveValue('in_progress')
      expect(options[3]).toHaveValue('completed')
    })

    it('should call setFilterStatus when status filter changes', async () => {
      const user = userEvent.setup()
      render(<TodoListView {...getDefaultProps()} />)

      await user.selectOptions(
        screen.getByLabelText('Filter by Status'),
        'completed'
      )

      expect(mockSetFilterStatus).toHaveBeenCalledWith('completed')
    })

    it('should render due date filter dropdown', () => {
      render(<TodoListView {...getDefaultProps()} />)

      expect(screen.getByLabelText('Filter by Due Date')).toBeInTheDocument()
    })

    it('should render all due date filter options', () => {
      render(<TodoListView {...getDefaultProps()} />)

      const dueDateSelect = screen.getByLabelText('Filter by Due Date')
      const options = dueDateSelect.querySelectorAll('option')

      expect(options).toHaveLength(6)
      expect(options[0]).toHaveValue('all')
      expect(options[1]).toHaveValue('overdue')
      expect(options[2]).toHaveValue('today')
      expect(options[3]).toHaveValue('tomorrow')
      expect(options[4]).toHaveValue('this_week')
      expect(options[5]).toHaveValue('no_date')
    })

    it('should call setFilterDueDate when due date filter changes', async () => {
      const user = userEvent.setup()
      render(<TodoListView {...getDefaultProps()} />)

      await user.selectOptions(
        screen.getByLabelText('Filter by Due Date'),
        'today'
      )

      expect(mockSetFilterDueDate).toHaveBeenCalledWith('today')
    })
  })

  describe('Sort Controls', () => {
    it('should render sort by dropdown', () => {
      render(<TodoListView {...getDefaultProps()} />)

      expect(screen.getByLabelText('Sort By')).toBeInTheDocument()
    })

    it('should render all sort by options', () => {
      render(<TodoListView {...getDefaultProps()} />)

      const sortBySelect = screen.getByLabelText('Sort By')
      const options = sortBySelect.querySelectorAll('option')

      expect(options).toHaveLength(3)
      expect(options[0]).toHaveValue('name')
      expect(options[1]).toHaveValue('due_date')
      expect(options[2]).toHaveValue('status')
    })

    it('should call setSortBy when sort by changes', async () => {
      const user = userEvent.setup()
      render(<TodoListView {...getDefaultProps()} />)

      await user.selectOptions(screen.getByLabelText('Sort By'), 'due_date')

      expect(mockSetSortBy).toHaveBeenCalledWith('due_date')
    })

    it('should render sort order dropdown', () => {
      render(<TodoListView {...getDefaultProps()} />)

      expect(screen.getByLabelText('Order')).toBeInTheDocument()
    })

    it('should render all sort order options', () => {
      render(<TodoListView {...getDefaultProps()} />)

      const sortOrderSelect = screen.getByLabelText('Order')
      const options = sortOrderSelect.querySelectorAll('option')

      expect(options).toHaveLength(2)
      expect(options[0]).toHaveValue('asc')
      expect(options[1]).toHaveValue('desc')
    })

    it('should call setSortOrder when sort order changes', async () => {
      const user = userEvent.setup()
      render(<TodoListView {...getDefaultProps()} />)

      await user.selectOptions(screen.getByLabelText('Order'), 'desc')

      expect(mockSetSortOrder).toHaveBeenCalledWith('desc')
    })
  })

  describe('Filter Results Info', () => {
    it('should display correct result count', () => {
      render(<TodoListView {...getDefaultProps()} />)

      expect(screen.getByText(/showing/i)).toBeInTheDocument()
      expect(screen.getByText('3 tasks')).toBeInTheDocument()
      expect(screen.getByText(/of/i)).toBeInTheDocument()
    })

    it('should show reset filters button when filters are active', () => {
      render(<TodoListView {...getDefaultProps()} hasActiveFilters={true} />)

      expect(
        screen.getByRole('button', { name: /reset filters/i })
      ).toBeInTheDocument()
    })

    it('should not show reset filters button when no filters are active', () => {
      render(<TodoListView {...getDefaultProps()} hasActiveFilters={false} />)

      expect(
        screen.queryByRole('button', { name: /reset filters/i })
      ).not.toBeInTheDocument()
    })

    it('should call resetFilters when reset button is clicked', async () => {
      const user = userEvent.setup()
      render(<TodoListView {...getDefaultProps()} hasActiveFilters={true} />)

      await user.click(screen.getByRole('button', { name: /reset filters/i }))

      expect(mockResetFilters).toHaveBeenCalledTimes(1)
    })

    it('should show correct count when filters reduce results', () => {
      render(
        <TodoListView
          {...getDefaultProps()}
          filteredAndSortedTodos={[mockTodoArray[0]]}
        />
      )

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  describe('Todo List Display', () => {
    it('should render all todos', () => {
      render(<TodoListView {...getDefaultProps()} />)

      expect(screen.getByText('First Task')).toBeInTheDocument()
      expect(screen.getByText('Second Task')).toBeInTheDocument()
      expect(screen.getByText('Third Task')).toBeInTheDocument()
    })

    it('should display todo descriptions', () => {
      render(<TodoListView {...getDefaultProps()} />)

      expect(screen.getByText('First task description')).toBeInTheDocument()
      expect(screen.getByText('Second task description')).toBeInTheDocument()
    })

    it('should not display description when null', () => {
      render(<TodoListView {...getDefaultProps()} />)

      // Third task has null description, should not be rendered
      const todoCard = screen.getByText('Third Task').closest('div')
      expect(todoCard).not.toHaveTextContent('null')
    })

    it('should display status badges', () => {
      render(<TodoListView {...getDefaultProps()} />)

      const notStartedBadges = screen.getAllByText('Not Started')
      expect(notStartedBadges.length).toBe(2) // One at filter status, one for todo-1
      const inProgressBadges = screen.getAllByText('In Progress')
      expect(inProgressBadges.length).toBe(2) // One at filter status, one for todo-2
      const completedBadges = screen.getAllByText('Completed')
      expect(completedBadges.length).toBe(2) // One at filter status, one for todo-3
    })

    it('should display due dates when present', () => {
      render(<TodoListView {...getDefaultProps()} />)

      // Should have 2 due dates (todo-1 and todo-2)
      expect(
        screen.getByText(new Date('2024-12-31T23:59:59Z').toLocaleDateString())
      ).toBeInTheDocument()
      expect(
        screen.getByText(new Date('2024-12-25T23:59:59Z').toLocaleDateString())
      ).toBeInTheDocument()
    })

    it('should apply line-through style to completed todos', () => {
      render(<TodoListView {...getDefaultProps()} />)

      const completedTodo = screen.getByText('Third Task')
      expect(completedTodo).toHaveClass('line-through')
    })

    it('should call onTodoClick when todo is clicked', async () => {
      const user = userEvent.setup()
      render(<TodoListView {...getDefaultProps()} />)

      const todoCard = screen.getByText('First Task').closest('div')
      await user.click(todoCard!)

      expect(mockOnTodoClick).toHaveBeenCalledWith(mockTodos['todo-1'])
    })
  })

  describe('Empty Todo List State', () => {
    it('should show empty state when no todos exist', () => {
      render(
        <TodoListView
          {...getDefaultProps()}
          activeTodos={{}}
          filteredAndSortedTodos={[]}
        />
      )

      expect(screen.getByText('No tasks yet')).toBeInTheDocument()
      expect(
        screen.getByText('Add your first task to get started!')
      ).toBeInTheDocument()
    })

    it('should show filtered empty state when filters match nothing', () => {
      render(
        <TodoListView
          {...getDefaultProps()}
          filteredAndSortedTodos={[]}
          hasActiveFilters={true}
        />
      )

      expect(
        screen.getByText('No tasks match your filters')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Try adjusting your filters or reset them')
      ).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper labels for all inputs', () => {
      render(<TodoListView {...getDefaultProps()} />)

      expect(screen.getByLabelText('Filter by Status')).toBeInTheDocument()
      expect(screen.getByLabelText('Filter by Due Date')).toBeInTheDocument()
      expect(screen.getByLabelText('Sort By')).toBeInTheDocument()
      expect(screen.getByLabelText('Order')).toBeInTheDocument()
    })

    it('should have proper button roles', () => {
      render(<TodoListView {...getDefaultProps()} />)

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle workflow: filter, sort, reset', async () => {
      const user = userEvent.setup()
      render(<TodoListView {...getDefaultProps()} hasActiveFilters={true} />)

      // Change filter
      await user.selectOptions(
        screen.getByLabelText('Filter by Status'),
        'completed'
      )
      expect(mockSetFilterStatus).toHaveBeenCalledWith('completed')

      // Change sort
      await user.selectOptions(screen.getByLabelText('Sort By'), 'due_date')
      expect(mockSetSortBy).toHaveBeenCalledWith('due_date')

      // Reset filters
      await user.click(screen.getByRole('button', { name: /reset filters/i }))
      expect(mockResetFilters).toHaveBeenCalled()
    })

    it('should handle workflow: type task, add task', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<TodoListView {...getDefaultProps()} />)

      // Type in input
      const input = screen.getByPlaceholderText('What needs to be done?')
      await user.type(input, 'New task')

      // Rerender with updated newTodo value
      rerender(<TodoListView {...getDefaultProps()} newTodo='New task' />)

      // Click add button
      await user.click(screen.getByRole('button', { name: /add task/i }))
      expect(mockHandleAddTodo).toHaveBeenCalledWith('list-1', 'New task')
    })
  })
})
