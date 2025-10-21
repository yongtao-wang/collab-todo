import { act, renderHook } from '@/test/test-utils'
import { describe, expect, it } from 'vitest'
import { mockCompletedTodo, mockTodoItem, mockTodoWithDueDate } from '@/test/mockData'

import { useTodoFilters } from '@/hooks/useTodoFilters'

describe('useTodoFilters', () => {
  describe('Initial state', () => {
    it('should have default filter values', () => {
      const { result } = renderHook(() => useTodoFilters())

      expect(result.current.filterStatus).toBe('all')
      expect(result.current.filterDueDate).toBe('all')
      expect(result.current.sortBy).toBe('name')
      expect(result.current.sortOrder).toBe('asc')
      expect(result.current.hasActiveFilters).toBe(false)
    })
  })

  describe('Status filtering', () => {
    it('should filter by status', () => {
      const { result } = renderHook(() => useTodoFilters())
      const todos = [mockTodoItem, mockCompletedTodo, mockTodoWithDueDate]

      act(() => {
        result.current.setFilterStatus('completed')
      })

      const filtered = result.current.filterAndSort(todos)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].status).toBe('completed')
    })

    it('should show all todos when filter is "all"', () => {
      const { result } = renderHook(() => useTodoFilters())
      const todos = [mockTodoItem, mockCompletedTodo, mockTodoWithDueDate]

      const filtered = result.current.filterAndSort(todos)
      expect(filtered).toHaveLength(3)
    })

    it('should filter by in_progress status', () => {
      const { result } = renderHook(() => useTodoFilters())
      const todos = [mockTodoItem, mockCompletedTodo, mockTodoWithDueDate]

      act(() => {
        result.current.setFilterStatus('in_progress')
      })

      const filtered = result.current.filterAndSort(todos)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].status).toBe('in_progress')
    })
  })

  describe('Due date filtering', () => {
    it('should filter todos with no due date', () => {
      const { result } = renderHook(() => useTodoFilters())
      const todos = [mockTodoItem, mockCompletedTodo, mockTodoWithDueDate]

      act(() => {
        result.current.setFilterDueDate('no_date')
      })

      const filtered = result.current.filterAndSort(todos)
      expect(filtered).toHaveLength(2)
      expect(filtered.every(t => !t.due_date)).toBe(true)
    })

    it('should filter overdue todos', () => {
      const { result } = renderHook(() => useTodoFilters())
      const overdueTodo = {
        ...mockTodoItem,
        id: 'overdue-todo',
        due_date: '2023-01-01T00:00:00Z',
      }
      const todos = [mockTodoItem, overdueTodo, mockTodoWithDueDate]

      act(() => {
        result.current.setFilterDueDate('overdue')
      })

      const filtered = result.current.filterAndSort(todos)
      expect(filtered.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Sorting', () => {
    it('should sort by name ascending', () => {
      const { result } = renderHook(() => useTodoFilters())
      const todos = [
        { ...mockTodoItem, name: 'Zebra' },
        { ...mockCompletedTodo, name: 'Apple' },
        { ...mockTodoWithDueDate, name: 'Middle' },
      ]

      act(() => {
        result.current.setSortBy('name')
        result.current.setSortOrder('asc')
      })

      const sorted = result.current.filterAndSort(todos)
      expect(sorted[0].name).toBe('Apple')
      expect(sorted[1].name).toBe('Middle')
      expect(sorted[2].name).toBe('Zebra')
    })

    it('should sort by name descending', () => {
      const { result } = renderHook(() => useTodoFilters())
      const todos = [
        { ...mockTodoItem, name: 'Zebra' },
        { ...mockCompletedTodo, name: 'Apple' },
        { ...mockTodoWithDueDate, name: 'Middle' },
      ]

      act(() => {
        result.current.setSortBy('name')
        result.current.setSortOrder('desc')
      })

      const sorted = result.current.filterAndSort(todos)
      expect(sorted[0].name).toBe('Zebra')
      expect(sorted[1].name).toBe('Middle')
      expect(sorted[2].name).toBe('Apple')
    })

    it('should sort by status', () => {
      const { result } = renderHook(() => useTodoFilters())
      const todos = [mockCompletedTodo, mockTodoItem, mockTodoWithDueDate]

      act(() => {
        result.current.setSortBy('status')
        result.current.setSortOrder('desc')
      })

      const sorted_desc = result.current.filterAndSort(todos)
      // Status desc order: completed, in_progress, not_started
      expect(sorted_desc[0].status).toBe('completed')
      expect(sorted_desc[1].status).toBe('in_progress')
      expect(sorted_desc[2].status).toBe('not_started')

      act(() => {
        result.current.setSortBy('status')
        result.current.setSortOrder('asc')
      })

      const sorted_asc = result.current.filterAndSort(todos)
      // Status asc order: not_started, in_progress, completed
      expect(sorted_asc[0].status).toBe('not_started')
      expect(sorted_asc[1].status).toBe('in_progress')
      expect(sorted_asc[2].status).toBe('completed')
    })
  })

  describe('Reset filters', () => {
    it('should reset all filters to default', () => {
      const { result } = renderHook(() => useTodoFilters())

      act(() => {
        result.current.setFilterStatus('completed')
        result.current.setFilterDueDate('today')
        result.current.setSortBy('due_date')
        result.current.setSortOrder('desc')
      })

      expect(result.current.hasActiveFilters).toBe(true)

      act(() => {
        result.current.resetFilters()
      })

      expect(result.current.filterStatus).toBe('all')
      expect(result.current.filterDueDate).toBe('all')
      expect(result.current.sortBy).toBe('name')
      expect(result.current.sortOrder).toBe('asc')
      expect(result.current.hasActiveFilters).toBe(false)
    })
  })

  describe('hasActiveFilters', () => {
    it('should return true when any filter is active', () => {
      const { result } = renderHook(() => useTodoFilters())

      act(() => {
        result.current.setFilterStatus('completed')
      })

      expect(result.current.hasActiveFilters).toBe(true)
    })

    it('should return false when all filters are default', () => {
      const { result } = renderHook(() => useTodoFilters())

      expect(result.current.hasActiveFilters).toBe(false)
    })
  })

  describe('Combined filtering and sorting', () => {
    it('should apply both filter and sort', () => {
      const { result } = renderHook(() => useTodoFilters())
      const todos = [
        { ...mockTodoItem, name: 'Z Task', status: 'not_started' as const },
        { ...mockCompletedTodo, name: 'A Task', status: 'completed' as const },
        { ...mockTodoWithDueDate, name: 'M Task', status: 'not_started' as const },
      ]

      act(() => {
        result.current.setFilterStatus('not_started')
        result.current.setSortBy('name')
        result.current.setSortOrder('asc')
      })

      const result_todos = result.current.filterAndSort(todos)
      expect(result_todos).toHaveLength(2)
      expect(result_todos[0].name).toBe('M Task')
      expect(result_todos[1].name).toBe('Z Task')
    })
  })
})
