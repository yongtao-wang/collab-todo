import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import type { ChangeEvent } from 'react'
import type { TodoItem } from '@/types/todo'
import TodoModal from './TodoModal'
import { mockTodoItem } from '@/test/mockData'

vi.mock('react-datepicker', () => ({
  default: ({
    selected,
    onChange,
    placeholderText,
  }: {
    selected?: Date | string | null
    onChange: (date: Date | null) => void
    placeholderText?: string
  }) => (
    <input
      type='text'
      value={selected ? new Date(selected).toISOString().split('T')[0] : ''}
      onChange={(e: ChangeEvent<HTMLInputElement>) =>
        onChange(e.target.value ? new Date(e.target.value) : null)
      }
      placeholder={placeholderText}
      data-testid='date-picker'
    />
  ),
}))


describe('TodoModal', () => {
  const mockOnUpdate = vi.fn()
  const mockOnDelete = vi.fn()
  const mockOnClose = vi.fn()
  const mockConfirm = vi.fn()

  let mockTodo: TodoItem

  const renderModal = (todo: TodoItem, isOpen = true) => {
    return render(
      <TodoModal
        isOpen={isOpen}
        onClose={mockOnClose}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        todo={todo}
      />
    )
  }

  beforeEach(() => {
    // Create a fresh mockTodo for each test
    mockTodo = {...mockTodoItem}
    
    global.confirm = mockConfirm
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = renderModal(mockTodo, false)
      expect(container.firstChild).toBeNull()
    })

    it('should render when isOpen is true', () => {
      renderModal(mockTodo)
      expect(screen.getByText('Edit Todo')).toBeInTheDocument()
    })

    it('should display todo information', () => {
      renderModal(mockTodo)

      const nameInput = screen.getByDisplayValue('Test Todo')
      const descriptionTextarea = screen.getByDisplayValue('Test Description')

      expect(nameInput).toBeInTheDocument()
      expect(descriptionTextarea).toBeInTheDocument()
    })

    it('should display metadata information', () => {
      renderModal(mockTodo)

      expect(screen.getByText(/Created:/)).toBeInTheDocument()
      expect(screen.getByText(/Updated:/)).toBeInTheDocument()
    })

    it('should show checked done checkbox when todo is done', () => {
      const doneTodo = { ...mockTodo, done: true, status: 'completed' as const }
      render(
        <TodoModal
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          todo={doneTodo}
        />
      )

      const doneCheckbox = screen.getByRole('checkbox', {
        name: /Mark as done/i,
      })
      expect(doneCheckbox).toBeChecked()
    })

    it('should show unchecked done checkbox when todo is not done', () => {
      renderModal(mockTodo)

      const doneCheckbox = screen.getByRole('checkbox', {
        name: /Mark as done/i,
      })
      expect(doneCheckbox).not.toBeChecked()
    })
  })

  describe('Form editing', () => {
    it('should update name field', async () => {
      renderModal(mockTodo)

      const nameInput = screen.getByDisplayValue('Test Todo')
      fireEvent.change(nameInput, { target: { value: 'Updated Todo' } })

      expect(nameInput).toHaveValue('Updated Todo')
    })

    it('should update description field', async () => {
      renderModal(mockTodo)

      const descriptionTextarea = screen.getByDisplayValue('Test Description')
      fireEvent.change(descriptionTextarea, {
        target: { value: 'Updated description' },
      })

      expect(descriptionTextarea).toHaveValue('Updated description')
    })

    it('should update status field', async () => {
      renderModal(mockTodo)

      const statusSelect = screen.getByRole('combobox')
      fireEvent.change(statusSelect, { target: { value: 'completed' } })

      expect(statusSelect).toHaveValue('completed')
    })

    it('should update done checkbox', async () => {
      renderModal(mockTodo)

      const doneCheckbox = screen.getByRole('checkbox', {
        name: /Mark as done/i,
      })
      fireEvent.click(doneCheckbox)

      expect(doneCheckbox).toBeChecked()
    })

    it('should update due date', async () => {
      renderModal(mockTodo)

      const datePicker = screen.getByTestId('date-picker')
      fireEvent.change(datePicker, { target: { value: '2025-01-01' } })

      await waitFor(() => {
        expect(datePicker).toHaveValue('2025-01-01')
      })
    })
  })

  describe('Done checkbox and status synchronization', () => {
    it('should set status to completed when done is checked', async () => {
      renderModal(mockTodo)

      const doneCheckbox = screen.getByRole('checkbox', {
        name: /Mark as done/i,
      })
      const statusSelect = screen.getByRole('combobox')

      fireEvent.click(doneCheckbox)

      await waitFor(() => {
        expect(statusSelect).toHaveValue('completed')
      })
    })

    it('should set status to in_progress when done is unchecked', async () => {
      const doneTodo = { ...mockTodo, done: true, status: 'completed' as const }
      render(
        <TodoModal
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          todo={doneTodo}
        />
      )

      const doneCheckbox = screen.getByRole('checkbox', {
        name: /Mark as done/i,
      })
      const statusSelect = screen.getByRole('combobox')

      fireEvent.click(doneCheckbox)

      await waitFor(() => {
        expect(statusSelect).toHaveValue('in_progress')
      })
    })

    it('should check done checkbox when status changes to completed', async () => {
      renderModal(mockTodo)

      const statusSelect = screen.getByRole('combobox')
      const doneCheckbox = screen.getByRole('checkbox', {
        name: /Mark as done/i,
      })

      fireEvent.change(statusSelect, { target: { value: 'completed' } })

      await waitFor(() => {
        expect(doneCheckbox).toBeChecked()
      })
    })
  })

  describe('Save functionality', () => {
    it('should save changes when save button is clicked', async () => {
      renderModal(mockTodo)

      const nameInput = screen.getByDisplayValue('Test Todo')
      fireEvent.change(nameInput, { target: { value: 'Updated Todo' } })

      const saveButton = screen.getByRole('button', { name: /Save/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Updated Todo',
          })
        )
      })

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should not save when name is empty', async () => {
      renderModal(mockTodo)

      const nameInput = screen.getByDisplayValue('Test Todo')
      fireEvent.change(nameInput, { target: { value: '' } })

      const saveButton = screen.getByRole('button', { name: /Save/i })
      fireEvent.click(saveButton)

      expect(mockOnUpdate).not.toHaveBeenCalled()
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should save with all updated fields', async () => {
      renderModal(mockTodo)

      const nameInput = screen.getByDisplayValue('Test Todo')
      const descInput = screen.getByDisplayValue('Test Description')
      const statusSelect = screen.getByRole('combobox')
      const doneCheckbox = screen.getByRole('checkbox', { name: /Mark as done/i })

      fireEvent.change(nameInput, {
        target: { value: 'New Name' },
      })
      fireEvent.change(descInput, {
        target: { value: 'New Description' },
      })
      fireEvent.change(statusSelect, {
        target: { value: 'completed' },
      })

      await waitFor(() => {
        expect(doneCheckbox).toBeChecked()
        expect(statusSelect).toHaveValue('completed')
      })

      const saveButton = screen.getByRole('button', { name: /Save/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Name',
            description: 'New Description',
            status: 'completed',
            done: true,
          })
        )
      })
    })

    it('should handle null due date', async () => {
      const todoWithoutDate = { ...mockTodo, due_date: null }
      render(
        <TodoModal
          isOpen={true}
          onClose={mockOnClose}
          todo={todoWithoutDate}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      const saveButton = screen.getByRole('button', { name: /Save/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            due_date: null,
          })
        )
      })
    })
  })

  describe('Delete functionality', () => {
    it('should delete todo when confirmed', async () => {
      mockConfirm.mockReturnValue(true)

      renderModal(mockTodo)

      const deleteButton = screen.getByRole('button', { name: /Delete/i })
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalledWith(
          'Are you sure you want to delete this todo?'
        )
      })

      expect(mockOnDelete).toHaveBeenCalledWith('todo-1')
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should not delete todo when cancelled', async () => {
      mockConfirm.mockReturnValue(false)

      renderModal(mockTodo)

      const deleteButton = screen.getByRole('button', { name: /Delete/i })
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalled()
      })

      expect(mockOnDelete).not.toHaveBeenCalled()
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('Modal closing', () => {
    it('should close modal when cancel button is clicked', () => {
      renderModal(mockTodo)

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should close modal when close button (X) is clicked', () => {
      renderModal(mockTodo)

      const closeButtons = screen.getAllByRole('button')
      const closeButton = closeButtons.find(btn => 
        btn.querySelector('svg') && btn.closest('.border-b')
      )
      
      expect(closeButton).toBeDefined()
      fireEvent.click(closeButton!)

      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Keyboard shortcuts', () => {
    it('should close modal when Escape key is pressed', async () => {
      renderModal(mockTodo)

      fireEvent.keyDown(document, { key: 'Escape' })

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })

    it('should not close modal when other keys are pressed', () => {
      renderModal(mockTodo)

      fireEvent.keyDown(document, { key: 'Enter' })
      fireEvent.keyDown(document, { key: 'Space' })
      fireEvent.keyDown(document, { key: 'a' })

      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('Form state synchronization', () => {
    it('should sync form state when todo prop changes', () => {
      const { rerender } = render(
        <TodoModal
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          todo={mockTodo}
        />
      )

      expect(screen.getByDisplayValue('Test Todo')).toBeInTheDocument()

      const newTodo: TodoItem = {
        ...mockTodo,
        id: 'todo-2',
        name: 'Different Todo',
        description: 'Different description',
      }

      rerender(
        <TodoModal
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          todo={newTodo}
        />
      )

      expect(screen.getByDisplayValue('Different Todo')).toBeInTheDocument()
      expect(
        screen.getByDisplayValue('Different description')
      ).toBeInTheDocument()
    })

    it('should handle empty description', () => {
      const todoWithoutDescription = { ...mockTodo, description: '' }
      render(
        <TodoModal
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          todo={todoWithoutDescription}
        />
      )

      const descriptionTextarea =
        screen.getByPlaceholderText(/Add a description/i)
      expect(descriptionTextarea).toHaveValue('')
    })

    it('should handle missing due date', () => {
      const todoWithoutDate = { ...mockTodo, due_date: null }
      render(
        <TodoModal
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          todo={todoWithoutDate}
        />
      )

      const datePicker = screen.getByTestId('date-picker')
      expect(datePicker).toHaveValue('')
    })
  })

  describe('Status options', () => {
    it('should render all status options', () => {
      renderModal(mockTodo)

      const statusSelect = screen.getByRole('combobox')
      const options = statusSelect.querySelectorAll('option')

      expect(options).toHaveLength(3)
      expect(options[0]).toHaveValue('not_started')
      expect(options[1]).toHaveValue('in_progress')
      expect(options[2]).toHaveValue('completed')
    })

    it('should display correct status labels', () => {
      renderModal(mockTodo)

      const statusSelect = screen.getByRole('combobox')
      const options = statusSelect.querySelectorAll('option')

      expect(options[0]).toHaveTextContent('Not Started')
      expect(options[1]).toHaveTextContent('In Progress')
      expect(options[2]).toHaveTextContent('Completed')
    })
  })

  describe('Edge cases', () => {
    it('should handle very long todo names', () => {
      const longName = 'A'.repeat(500)
      const longNameTodo = { ...mockTodo, name: longName }
      render(
        <TodoModal
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          todo={longNameTodo}
        />
      )

      const nameInput = screen.getByDisplayValue(longName)
      expect(nameInput).toBeInTheDocument()
    })

    it('should handle very long descriptions', () => {
      const longDesc = 'B'.repeat(5000)
      const longDescTodo = { ...mockTodo, description: longDesc }
      render(
        <TodoModal
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          todo={longDescTodo}
        />
      )

      const descriptionTextarea = screen.getByDisplayValue(longDesc)
      expect(descriptionTextarea).toBeInTheDocument()
    })

    it('should handle special characters in name', () => {
      const specialName = '<script>alert("XSS")</script>'
      const specialTodo = { ...mockTodo, name: specialName }
      render(
        <TodoModal
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          todo={specialTodo}
        />
      )

      const nameInput = screen.getByDisplayValue(specialName)
      expect(nameInput).toBeInTheDocument()
    })

    it('should handle past due dates', () => {
      const pastDateTodo = { ...mockTodo, due_date: '2020-01-01T00:00:00Z' }
      render(
        <TodoModal
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
          todo={pastDateTodo}
        />
      )

      expect(screen.getByTestId('date-picker')).toBeInTheDocument()
    })
  })
})