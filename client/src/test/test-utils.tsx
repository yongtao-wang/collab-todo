import { RenderOptions, render } from '@testing-library/react'

import { ReactElement } from 'react'

// Re-export everything from testing library
export * from '@testing-library/react'
export { userEvent } from '@testing-library/user-event'

// Custom render function if you need to add providers
export function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { ...options })
}
