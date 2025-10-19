import { TodoItem, TodoList } from '@/types/todo'

import { create } from 'zustand'

interface TodoState {
  lists: Record<string, TodoList>
  activeListId: string | null
  filterStatus: string
  filterDueDate: string
  sortBy: 'name' | 'due_date' | 'status'
  sortOrder: 'asc' | 'desc'
  isConnected: boolean

  // actions
  setLists: (lists: Record<string, TodoList>) => void
  setActiveListId: (id: string | null) => void
  setFilterStatus: (v: string) => void
  setFilterDueDate: (v: string) => void
  setSortBy: (v: 'name' | 'due_date' | 'status') => void
  setSortOrder: (v: 'asc' | 'desc') => void
  setIsConnected: (v: boolean) => void
  
  // List operations
  addList: (list: TodoList) => void
  updateList: (listId: string, updates: Partial<TodoList>) => void
  removeList: (listId: string) => void
  
  // Item operations
  addItem: (listId: string, item: TodoItem) => void
  updateItem: (listId: string, itemId: string, updates: Partial<TodoItem>) => void
  removeItem: (listId: string, itemId: string) => void
  
  // Bulk operations
  setListSnapshot: (listId: string, listName: string, items: Record<string, TodoItem>, rev: number) => void
  updateListRev: (listId: string, rev: number) => void
  
  // Reset filters
  resetFilters: () => void
}

export const useTodoStore = create<TodoState>((set) => ({
  lists: {},
  activeListId: null,
  filterStatus: 'all',
  filterDueDate: 'all',
  sortBy: 'name',
  sortOrder: 'asc',
  isConnected: false,

  setLists: (lists) => set({ lists }),
  setActiveListId: (id) => set({ activeListId: id }),
  setFilterStatus: (v) => set({ filterStatus: v }),
  setFilterDueDate: (v) => set({ filterDueDate: v }),
  setSortBy: (v) => set({ sortBy: v }),
  setSortOrder: (v) => set({ sortOrder: v }),
  setIsConnected: (v) => set({ isConnected: v }),
  
  // List operations
  addList: (list) => set((state) => ({
    lists: {
      ...state.lists,
      [list.listId]: list,
    },
  })),
  
  updateList: (listId, updates) => set((state) => ({
    lists: {
      ...state.lists,
      [listId]: {
        ...state.lists[listId],
        ...updates,
      },
    },
  })),
  
  removeList: (listId) => set((state) => {
    const { [listId]: removed, ...rest } = state.lists
    return { lists: rest }
  }),
  
  // Item operations
  addItem: (listId, item) => set((state) => {
    const list = state.lists[listId]
    if (!list) return state
    
    return {
      lists: {
        ...state.lists,
        [listId]: {
          ...list,
          todos: {
            ...list.todos,
            [item.id]: item,
          },
        },
      },
    }
  }),
  
  updateItem: (listId, itemId, updates) => set((state) => {
    const list = state.lists[listId]
    if (!list) return state
    
    return {
      lists: {
        ...state.lists,
        [listId]: {
          ...list,
          todos: {
            ...list.todos,
            [itemId]: {
              ...list.todos[itemId],
              ...updates,
            },
          },
        },
      },
    }
  }),
  
  removeItem: (listId, itemId) => set((state) => {
    const list = state.lists[listId]
    if (!list) return state
    
    const { [itemId]: removed, ...remainingTodos } = list.todos
    
    return {
      lists: {
        ...state.lists,
        [listId]: {
          ...list,
          todos: remainingTodos,
        },
      },
    }
  }),
  
  // Bulk operations
  setListSnapshot: (listId, listName, items, rev) => set((state) => ({
    lists: {
      ...state.lists,
      [listId]: {
        listId,
        listName,
        todos: items,
        rev,
      },
    },
  })),
  
  updateListRev: (listId, rev) => set((state) => {
    const list = state.lists[listId]
    if (!list) return state
    
    return {
      lists: {
        ...state.lists,
        [listId]: {
          ...list,
          rev,
        },
      },
    }
  }),
  
  // Reset filters
  resetFilters: () => set({
    filterStatus: 'all',
    filterDueDate: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
  }),
}))