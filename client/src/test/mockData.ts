import { TodoItem, TodoList } from '@/types/todo'

export const mockTodoItem: TodoItem = {
  id: 'todo-1',
  list_id: 'list-1',
  name: 'Test Todo',
  description: 'Test Description',
  done: false,
  status: 'not_started',
  due_date: null,
  media_url: null,
  is_deleted: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

export const mockCompletedTodo: TodoItem = {
  id: 'todo-2',
  list_id: 'list-1',
  name: 'Completed Todo',
  description: 'Already done',
  done: true,
  status: 'completed',
  due_date: null,
  media_url: null,
  is_deleted: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
}

export const mockTodoWithDueDate: TodoItem = {
  id: 'todo-3',
  list_id: 'list-1',
  name: 'Todo with due date',
  description: null,
  done: false,
  status: 'in_progress',
  due_date: '2024-12-31T23:59:59Z',
  media_url: null,
  is_deleted: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

export const mockTodoList: TodoList = {
  listId: 'list-1',
  listName: 'Test List',
  todos: {
    'todo-1': mockTodoItem,
    'todo-2': mockCompletedTodo,
    'todo-3': mockTodoWithDueDate,
  },
}

export const mockEmptyList: TodoList = {
  listId: 'list-2',
  listName: 'Empty List',
  todos: {},
}

export const mockLists: Record<string, TodoList> = {
  'list-1': mockTodoList,
  'list-2': mockEmptyList,
}
