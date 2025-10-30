/**
 * TodoListView Component
 *
 * Main view component for displaying and managing todos within a selected list.
 * Provides comprehensive todo management including filtering, sorting, adding,
 * editing, deleting, and marking todos as complete.
 *
 * @component
 * @example
 * ```tsx
 * <TodoListView
 *   activeList={currentList}
 *   activeTodos={todosObject}
 *   filteredAndSortedTodos={filteredTodos}
 *   newTodo={newTodoText}
 *   setNewTodo={setNewTodoText}
 *   isConnected={socketConnected}
 *   filterStatus={filterStatus}
 *   setFilterStatus={setFilterStatus}
 *   filterDueDate={filterDueDate}
 *   setFilterDueDate={setFilterDueDate}
 *   sortBy={sortBy}
 *   setSortBy={setSortBy}
 *   sortOrder={sortOrder}
 *   setSortOrder={setSortOrder}
 *   hasActiveFilters={hasFilters}
 *   resetFilters={resetFilters}
 *   handleAddTodo={addTodo}
 *   handleUpdateTodo={updateTodo}
 *   handleDeleteTodo={deleteTodo}
 *   toggleDone={toggleDone}
 *   onShareClick={() => setShareModalOpen(true)}
 *   onTodoClick={(todo) => openTodoModal(todo)}
 *   onKeyPress={handleKeyPress}
 * />
 * ```
 *
 * Features:
 * - Display todos with status, name, and due date
 * - Filter by status (all, in progress, not started, done)
 * - Filter by due date (all, overdue, today, this week, this month)
 * - Sort by name, due date, or status (ascending/descending)
 * - Add new todos via input field
 * - Toggle todo completion with checkboxes
 * - Click todos to open detail modal
 * - Share list button
 * - Empty state when no list selected or no todos
 * - Active filter indicators with reset option
 * - Todo count display
 *
 * @param props - Component props
 */
import { FilterDueDate, FilterStatus } from '@/hooks/useTodoFilters'
import { TodoItem, TodoList } from '@/types/todo'

interface TodoListViewProps {
  /** The currently active todo list */
  activeList: TodoList | null
  /** Object containing all todos in the active list keyed by todo ID */
  activeTodos: Record<string, TodoItem>
  /** Array of todos after filtering and sorting */
  filteredAndSortedTodos: TodoItem[]
  /** Current value of the new todo input field */
  newTodo: string
  /** Callback to update new todo input value */
  setNewTodo: (value: string) => void
  /** Whether the WebSocket connection is active */
  isConnected: boolean
  /** Current filter for todo status */
  filterStatus: FilterStatus
  /** Callback to set status filter */
  setFilterStatus: (value: FilterStatus) => void
  /** Current filter for due date */
  filterDueDate: FilterDueDate
  /** Callback to set due date filter */
  setFilterDueDate: (value: FilterDueDate) => void
  /** Current sort field (name, due_date, or status) */
  sortBy: 'name' | 'due_date' | 'status'
  /** Callback to set sort field */
  setSortBy: (value: 'name' | 'due_date' | 'status') => void
  /** Current sort order (ascending or descending) */
  sortOrder: 'asc' | 'desc'
  /** Callback to set sort order */
  setSortOrder: (value: 'asc' | 'desc') => void
  /** Whether any filters are currently active */
  hasActiveFilters: boolean
  /** Callback to reset all filters to default */
  resetFilters: () => void
  /** Callback to add a new todo to a list */
  handleAddTodo: (listId: string, name: string) => void
  /** Callback to update a todo with partial changes */
  handleUpdateTodo: (
    listId: string,
    itemId: string,
    updates: Partial<TodoItem>,
    rev: number
  ) => void
  /** Callback to delete a todo from a list */
  handleDeleteTodo: (listId: string, itemId: string) => void
  /** Callback to toggle a todo's completion status */
  toggleDone: (todo: TodoItem) => void
  /** Callback when the share button is clicked */
  onShareClick: () => void
  /** Callback when a todo is clicked to open details */
  onTodoClick: (todo: TodoItem) => void
  /** Callback for keyboard events (e.g., Enter to add todo) */
  onKeyPress: (e: React.KeyboardEvent) => void
}

export function TodoListView({
  activeList,
  activeTodos,
  filteredAndSortedTodos,
  newTodo,
  setNewTodo,
  isConnected,
  filterStatus,
  setFilterStatus,
  filterDueDate,
  setFilterDueDate,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  hasActiveFilters,
  resetFilters,
  handleAddTodo,
  onShareClick,
  onTodoClick,
  onKeyPress,
}: TodoListViewProps) {
  if (!activeList) {
    return (
      <div className='flex items-center justify-center h-full w-full'>
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
    )
  }

  return (
    <div className='flex-1 overflow-y-auto p-8'>
      <div className='w-full max-w-4xl mx-auto'>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900'>
              {activeList.listName}
            </h1>
            <div className='text-sm text-gray-600 mt-2'>
              {Object.values(activeTodos).length} tasks
            </div>
          </div>

          {/* Share Button */}
          <button
            onClick={onShareClick}
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
              onKeyPress={onKeyPress}
              placeholder='What needs to be done?'
              disabled={!isConnected}
            />
            <button
              className='px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              onClick={() => {
                handleAddTodo(activeList.listId, newTodo)
                setNewTodo('')
              }}
              disabled={!isConnected || !newTodo.trim()}
            >
              Add Task
            </button>
          </div>
        </div>

        {/* Filter and Sort Controls */}
        <div className='bg-white rounded-lg shadow p-4 mb-6'>
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            {/* Filter by Status */}
            <div>
              <label
                htmlFor='filter-status'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                Filter by Status
              </label>
              <select
                id='filter-status'
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(e.target.value as FilterStatus)
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              >
                <option value='all'>All Status</option>
                <option value='not_started'>Not Started</option>
                <option value='in_progress'>In Progress</option>
                <option value='completed'>Completed</option>
              </select>
            </div>

            {/* Filter by Due Date */}
            <div>
              <label
                htmlFor='filter-due-date'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                Filter by Due Date
              </label>
              <select
                id='filter-due-date'
                value={filterDueDate}
                onChange={(e) =>
                  setFilterDueDate(e.target.value as FilterDueDate)
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              >
                <option value='all'>All Dates</option>
                <option value='overdue'>Overdue</option>
                <option value='today'>Today</option>
                <option value='tomorrow'>Tomorrow</option>
                <option value='this_week'>This Week</option>
                <option value='no_date'>No Due Date</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label
                htmlFor='sort-by'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                Sort By
              </label>
              <select
                id='sort-by'
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as 'name' | 'due_date' | 'status')
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              >
                <option value='name'>Name</option>
                <option value='due_date'>Due Date</option>
                <option value='status'>Status</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label
                htmlFor='sort-order'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                Order
              </label>
              <select
                id='sort-order'
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              >
                <option value='asc'>Ascending</option>
                <option value='desc'>Descending</option>
              </select>
            </div>
          </div>

          {/* Results Info and Reset Filters */}
          <div className='mt-4 flex items-center justify-between'>
            <div className='text-sm text-gray-600'>
              Showing{' '}
              <span className='font-semibold'>
                {filteredAndSortedTodos.length}
              </span>{' '}
              of{' '}
              <span className='font-semibold'>
                {Object.values(activeTodos).length}
              </span>{' '}
              tasks
            </div>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className='text-sm text-blue-600 hover:text-blue-700 font-medium'
              >
                Reset Filters & Sorting
              </button>
            )}
          </div>
        </div>

        {/* Todo List */}
        <div className='space-y-3'>
          {filteredAndSortedTodos.length === 0 ? (
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
                {hasActiveFilters
                  ? 'No tasks match your filters'
                  : 'No tasks yet'}
              </h3>
              <p className='text-gray-400'>
                {hasActiveFilters
                  ? 'Try adjusting your filters or reset them'
                  : 'Add your first task to get started!'}
              </p>
            </div>
          ) : (
            filteredAndSortedTodos.map((todo) => (
              <div
                key={todo.id}
                className={`bg-white rounded-lg shadow p-4 border-l-4 transition-all cursor-pointer ${
                  todo.done
                    ? 'border-l-green-500 opacity-75'
                    : 'border-l-blue-500 hover:shadow-md'
                }`}
                onClick={() => onTodoClick(todo)}
              >
                <div className='flex items-center justify-between'>
                  <div className='flex-1'>
                    <h3
                      className={`text-lg font-medium ${
                        todo.done
                          ? 'line-through text-gray-500'
                          : 'text-gray-900'
                      }`}
                    >
                      {todo.name}
                    </h3>
                    {todo.description && (
                      <p className='text-sm text-gray-600 mt-1'>
                        {todo.description}
                      </p>
                    )}
                    <div className='flex items-center space-x-4 mt-2'>
                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          todo.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : todo.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {todo.status === 'completed'
                          ? 'Completed'
                          : todo.status === 'in_progress'
                          ? 'In Progress'
                          : 'Not Started'}
                      </span>

                      {/* Due Date */}
                      {todo.due_date && (
                        <span className='text-xs text-gray-500 flex items-center'>
                          <svg
                            className='w-4 h-4 mr-1'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
                            />
                          </svg>
                          {new Date(todo.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
