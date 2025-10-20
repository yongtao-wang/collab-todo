export interface TodoItem {
  id: string
  list_id: string
  name: string
  description: string | null
  due_date: string | null
  status: 'not_started' | 'in_progress' | 'completed'
  done: boolean
  media_url: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface TodoList {
  listId: string
  listName: string
  todos: Record<string, TodoItem>
}
