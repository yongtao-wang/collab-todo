import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'

import Sidebar from '@/components/Sidebar'
import { mockLists } from '@/test/mockData'
import userEvent from '@testing-library/user-event'

describe('Sidebar', () => {
  let mockSetActiveListId: ReturnType<typeof vi.fn>
  let mockHandleCreateList: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Create fresh mock functions for each test
    mockSetActiveListId = vi.fn()
    mockHandleCreateList = vi.fn()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const getDefaultProps = () => ({
    lists: mockLists,
    activeListId: 'list-1',
    isConnected: true,
    setActiveListId: mockSetActiveListId,
    handleCreateList: mockHandleCreateList,
  })

  describe('Rendering', () => {
    it('should render sidebar with title', () => {
      render(<Sidebar {...getDefaultProps()} />)

      expect(screen.getByText('My Lists')).toBeInTheDocument()
    })

    it('should display connection status when connected', () => {
      render(<Sidebar {...getDefaultProps()} isConnected={true} />)

      expect(screen.getByText('Connected')).toBeInTheDocument()
    })

    it('should display disconnected status when not connected', () => {
      render(<Sidebar {...getDefaultProps()} isConnected={false} />)

      expect(screen.getByText('Disconnected')).toBeInTheDocument()
    })

    it('should display empty state when no lists', () => {
      render(<Sidebar {...getDefaultProps()} lists={{}} />)

      expect(screen.getByText(/no lists yet/i)).toBeInTheDocument()
    })

    it('should render all lists', () => {
      render(<Sidebar {...getDefaultProps()} />)

      expect(screen.getByText('Test List')).toBeInTheDocument()
      expect(screen.getByText('Empty List')).toBeInTheDocument()
    })

    it('should display task count for each list', () => {
      render(<Sidebar {...getDefaultProps()} />)

      expect(screen.getByText('3 tasks')).toBeInTheDocument()
      expect(screen.getByText('0 tasks')).toBeInTheDocument()
    })

    it('should highlight active list', () => {
      render(<Sidebar {...getDefaultProps()} activeListId="list-1" />)

      const activeButton = screen.getByText('Test List').closest('button')
      expect(activeButton).toHaveClass('bg-blue-50')
    })
  })

  describe('List selection', () => {
    it('should call setActiveListId when list is clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...getDefaultProps()} />)

      const listButton = screen.getByText('Empty List')
      await user.click(listButton)

      expect(mockSetActiveListId).toHaveBeenCalledWith('list-2')
    })
  })

  describe('Create list flow', () => {
    it('should show New List button initially', () => {
      render(<Sidebar {...getDefaultProps()} />)

      expect(screen.getByRole('button', { name: /new list/i })).toBeInTheDocument()
    })

    it('should show input form when New List is clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...getDefaultProps()} />)

      const newListButton = screen.getByRole('button', { name: /new list/i })
      await user.click(newListButton)

      expect(screen.getByPlaceholderText(/list name/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('should create list when Create button is clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...getDefaultProps()} />)

      // Open create form
      await user.click(screen.getByRole('button', { name: /new list/i }))

      // Type list name
      const input = screen.getByPlaceholderText(/list name/i)
      await user.type(input, 'New List')

      // Click create
      await user.click(screen.getByRole('button', { name: /create/i }))

      expect(mockHandleCreateList).toHaveBeenCalledWith('New List')
    })

    it('should create list when Enter is pressed', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...getDefaultProps()} />)

      // Open create form
      await user.click(screen.getByRole('button', { name: /new list/i }))

      // Type list name and press Enter
      const input = screen.getByPlaceholderText(/list name/i)
      await user.type(input, 'New List{Enter}')

      expect(mockHandleCreateList).toHaveBeenCalledWith('New List')
    })

    it('should cancel creation when Cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...getDefaultProps()} />)

      // Open create form
      await user.click(screen.getByRole('button', { name: /new list/i }))

      // Type something
      const input = screen.getByPlaceholderText(/list name/i)
      await user.type(input, 'New List')

      // Click cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      // Should return to button view
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new list/i })).toBeInTheDocument()
      })
      expect(mockHandleCreateList).not.toHaveBeenCalled()
    })

    it('should cancel creation when Escape is pressed', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...getDefaultProps()} />)

      // Open create form
      await user.click(screen.getByRole('button', { name: /new list/i }))

      // Type something and press Escape
      const input = screen.getByPlaceholderText(/list name/i)
      await user.type(input, 'New List{Escape}')

      // Should return to button view
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new list/i })).toBeInTheDocument()
      })
      expect(mockHandleCreateList).not.toHaveBeenCalled()
    })

    it('should not create list with empty name', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...getDefaultProps()} />)

      // Open create form
      await user.click(screen.getByRole('button', { name: /new list/i }))

      // Try to create without typing
      const createButton = screen.getByRole('button', { name: /create/i })
      expect(createButton).toBeDisabled()
    })

    it('should trim whitespace from list name', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...getDefaultProps()} />)

      // Open create form
      await user.click(screen.getByRole('button', { name: /new list/i }))

      // Type list name with whitespace
      const input = screen.getByPlaceholderText(/list name/i)
      await user.type(input, '  New List  {Enter}')

      expect(mockHandleCreateList).toHaveBeenCalledWith('New List')
    })

    it('should clear input after successful creation', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...getDefaultProps()} />)

      // Open create form
      await user.click(screen.getByRole('button', { name: /new list/i }))

      // Type and create
      const input = screen.getByPlaceholderText(/list name/i)
      await user.type(input, 'New List{Enter}')

      // Should return to button view
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new list/i })).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should auto-focus input when create form opens', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...getDefaultProps()} />)

      await user.click(screen.getByRole('button', { name: /new list/i }))

      const input = screen.getByPlaceholderText(/list name/i)
      expect(input).toHaveFocus()
    })

    it('should have proper button roles', () => {
      render(<Sidebar {...getDefaultProps()} />)

      const listButtons = screen.getAllByRole('button')
      expect(listButtons.length).toBeGreaterThan(0)
    })
  })
})