/**
 * Error Boundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 * 
 * @see https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */

'use client'

import { Component, ErrorInfo, ReactNode } from 'react'

import { createLogger } from '@/utils/logger'

const logger = createLogger('ErrorBoundary')

interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode
  
  /** Optional fallback UI to display when an error occurs */
  fallback?: ReactNode
  
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  
  /** Optional identifier for this boundary (useful for debugging) */
  boundaryName?: string
}

interface ErrorBoundaryState {
  /** Whether an error has been caught */
  hasError: boolean
  
  /** The error that was caught */
  error: Error | null
  
  /** Additional error information from React */
  errorInfo: ErrorInfo | null
}

/**
 * Error Boundary class component
 * 
 * @example
 * ```tsx
 * <ErrorBoundary boundaryName="TodoList">
 *   <TodoListContainer />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  /**
   * Update state when an error is caught
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    }
  }

  /**
   * Log error details and call optional error handler
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { boundaryName, onError } = this.props
    
    // Log the error
    logger.error(
      `Error caught in ${boundaryName || 'ErrorBoundary'}:`,
      error,
      errorInfo
    )
    
    // Update state with error info
    this.setState({ errorInfo })
    
    // Call optional error handler
    onError?.(error, errorInfo)
    
    // In production, you might want to send this to an error tracking service
    // e.g., Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } })
  }

  /**
   * Reset error state to retry rendering
   */
  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state
    const { children, fallback, boundaryName } = this.props

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <svg
                className="w-8 h-8 text-red-500 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h2 className="text-xl font-bold text-gray-900">
                Something went wrong
              </h2>
            </div>

            <p className="text-gray-600 mb-4">
              {boundaryName
                ? `An error occurred in ${boundaryName}`
                : 'We encountered an unexpected error'}
            </p>

            {process.env.NODE_ENV === 'development' && error && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                  Error Details (Development Only)
                </summary>
                <div className="bg-red-50 border border-red-200 rounded p-3 text-xs overflow-auto">
                  <p className="font-mono text-red-800 mb-2">
                    <strong>Error:</strong> {error.message}
                  </p>
                  {errorInfo && (
                    <pre className="font-mono text-red-700 whitespace-pre-wrap">
                      {errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return children
  }
}

/**
 * Hook-style wrapper for functional components
 * 
 * @example
 * ```tsx
 * export default function App() {
 *   return (
 *     <ErrorBoundary boundaryName="App">
 *       <YourApp />
 *     </ErrorBoundary>
 *   )
 * }
 * ```
 */
export default ErrorBoundary
