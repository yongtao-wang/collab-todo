import { useCallback, useMemo, useState } from 'react'

import { TodoItem } from '@/types/todo'

export type FilterStatus = 'all' | 'not_started' | 'in_progress' | 'completed'
export type FilterDueDate =
  | 'all'
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'this_week'
  | 'no_date'
export type SortBy = 'name' | 'due_date' | 'status'
export type SortOrder = 'asc' | 'desc'

export interface TodoFilters {
  filterStatus: FilterStatus
  filterDueDate: FilterDueDate
  sortBy: SortBy
  sortOrder: SortOrder
}

export function useTodoFilters() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterDueDate, setFilterDueDate] = useState<FilterDueDate>('all')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  // Memoize date calculations - only recalculate when day changes
  const dateFilters = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    return { today, tomorrow, nextWeek }
  }, [
    // Recalculate only when the date changes (not time)
    new Date().toDateString(),
  ])

  // Reset filters callback
  const resetFilters = useCallback(() => {
    setFilterStatus('all')
    setFilterDueDate('all')
    setSortBy('name')
    setSortOrder('asc')
  }, [])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filterStatus !== 'all' ||
      filterDueDate !== 'all' ||
      sortBy !== 'name' ||
      sortOrder !== 'asc'
    )
  }, [filterStatus, filterDueDate, sortBy, sortOrder])

  // Combined filter and sort function - single pass through data
  const filterAndSort = useCallback(
    (todos: TodoItem[]) => {
      const { today, tomorrow, nextWeek } = dateFilters

      // --- Filter Step ---
      let filtered = todos

      // Filter by status
      if (filterStatus !== 'all') {
        filtered = filtered.filter((todo) => todo.status === filterStatus)
      }

      // Filter by due date
      if (filterDueDate !== 'all') {
        filtered = filtered.filter((todo) => {
          // Handle "no due date" filter
          if (filterDueDate === 'no_date') {
            return !todo.due_date
          }

          // If no due date on todo, exclude it from other filters
          if (!todo.due_date) return false

          const dueDate = new Date(todo.due_date)
          const dateOnly = new Date(
            dueDate.getFullYear(),
            dueDate.getMonth(),
            dueDate.getDate()
          )

          switch (filterDueDate) {
            case 'overdue':
              return dateOnly < today
            case 'today':
              return dateOnly.getTime() === today.getTime()
            case 'tomorrow':
              return dateOnly.getTime() === tomorrow.getTime()
            case 'this_week':
              return dateOnly >= today && dateOnly <= nextWeek
            default:
              return true
          }
        })
      }

      // --- Sort (create copy to avoid mutating input) ---
      const sorted = [...filtered]
      sorted.sort((a, b) => {
        let comparison = 0

        switch (sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name)
            break

          case 'due_date':
            // Handle null/undefined due dates
            if (!a.due_date && !b.due_date) comparison = 0
            else if (!a.due_date) comparison = 1 // No date goes to end
            else if (!b.due_date) comparison = -1 // No date goes to end
            else
              comparison =
                new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
            break

          case 'status':
            const statusOrder: Record<string, number> = {
              not_started: 0,
              in_progress: 1,
              completed: 2,
            }
            comparison = statusOrder[a.status] - statusOrder[b.status]
            break
        }

        return sortOrder === 'asc' ? comparison : -comparison
      })

      return sorted
    },
    [filterStatus, filterDueDate, sortBy, sortOrder, dateFilters]
  )

  return {
    // State
    filterStatus,
    filterDueDate,
    sortBy,
    sortOrder,

    // Setters
    setFilterStatus,
    setFilterDueDate,
    setSortBy,
    setSortOrder,

    // Actions
    resetFilters,

    // Computed
    hasActiveFilters,
    filterAndSort,
  }
}
