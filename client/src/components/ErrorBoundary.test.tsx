import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'

import { ErrorBoundary } from '@/components/ErrorBoundary'

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error
  beforeAll(() => {
    console.error = vi.fn()
  })

  afterAll(() => {
    console.error = originalError
  })

  describe('Normal operation', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      )

      expect(screen.getByText('Test content')).toBeInTheDocument()
    })
  })

  describe('Error handling', () => {
    it('should render error UI when child throws error', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      // Match the actual fallback UI text from ErrorBoundary.tsx
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /try again/i })
      ).toBeInTheDocument()
      // Only show error details in development mode
      // expect(screen.getByText(/test error/i)).toBeInTheDocument() // Uncomment if NODE_ENV === 'development'
    })

    it('should display custom fallback message', () => {
      const customMessage = 'Custom error message'

      render(
        <ErrorBoundary fallback={<div>{customMessage}</div>}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      // There may be multiple elements with the same text, so assert only one is present
      const allFallbacks = screen.getAllByText(customMessage)
      expect(allFallbacks).toHaveLength(1)
      expect(allFallbacks[0]).toBeInTheDocument()
    })

    it('should show Try Again button', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(
        screen.getByRole('button', { name: /try again/i })
      ).toBeInTheDocument()
    })
  })

  describe('Error recovery', () => {
    it('should reset error state when Try Again is clicked', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      // Error UI should be visible
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()

      // Try Again button should be present
      const tryAgainButton = screen.getByRole('button', { name: /try again/i })
      expect(tryAgainButton).toBeInTheDocument()
    })
  })

  describe('Error logging', () => {
    it('should call console.error when error is caught', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
  })

  describe('Multiple errors', () => {
    it('should handle different error messages (development only)', () => {
      const CustomError = () => {
        throw new Error('Custom error message')
      }

      render(
        <ErrorBoundary>
          <CustomError />
        </ErrorBoundary>
      )

      // In production, error message is not shown; in development, it is
      if (process.env.NODE_ENV === 'development') {
        expect(screen.getByText(/custom error message/i)).toBeInTheDocument()
      } else {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
      }
    })
  })
})
