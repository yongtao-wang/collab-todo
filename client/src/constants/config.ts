/**
 * Application Configuration Constants
 *
 * Centralized configuration values to prevent magic numbers/strings
 * and make the application easier to maintain.
 */

/**
 * UI Configuration
 */
export const UI_CONFIG = {
  /** Default duration for toast messages (ms) */
  MESSAGE_DURATION: 5000,

  /** Default duration for error messages (ms) */
  ERROR_DURATION: 5000,

  /** Debounce delay for search/filter inputs (ms) */
  DEBOUNCE_DELAY: 300,

  /** Maximum items to show before pagination */
  MAX_ITEMS_PER_PAGE: 50,

  /** Animation duration for transitions (ms) */
  ANIMATION_DURATION: 200,
} as const

/**
 * Storage Configuration
 */
export const STORAGE_CONFIG = {
  /** LocalForage database name */
  DB_NAME: 'collaborative_todo_app',

  /** LocalForage store name */
  STORE_NAME: 'todo_lists',

  /** Cache expiration time (ms) - 7 days */
  CACHE_EXPIRATION: 7 * 24 * 60 * 60 * 1000,
} as const

/**
 * Socket Configuration
 */
export const SOCKET_CONFIG = {
  /** Use WebSocket transport only (no polling) */
  TRANSPORTS: ['websocket'] as const,

  /** Maximum reconnection attempts */
  RECONNECTION_ATTEMPTS: 10,

  /** Initial reconnection delay (ms) */
  RECONNECTION_DELAY: 2000,

  /** Maximum reconnection delay (ms) */
  RECONNECTION_DELAY_MAX: 10000,

  /** Timeout before connection attempt fails (ms) */
  TIMEOUT: 10000,
} as const

/**
 * Theme/Style Constants
 */
export const THEME = {
  /** Icon sizes */
  ICON_SIZE: {
    SMALL: 'w-4 h-4',
    MEDIUM: 'w-5 h-5',
    LARGE: 'w-6 h-6',
    XLARGE: 'w-8 h-8',
  },

  /** Spacing values */
  SPACING: {
    SMALL: 'p-2',
    MEDIUM: 'p-4',
    LARGE: 'p-6',
    XLARGE: 'p-8',
  },

  /** Border radius */
  RADIUS: {
    SMALL: 'rounded',
    MEDIUM: 'rounded-lg',
    LARGE: 'rounded-xl',
    FULL: 'rounded-full',
  },
} as const

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
  CONNECTION_FAILED: 'Unable to connect to server',
  PERMISSION_DENIED: 'You do not have permission to perform this action',
  NETWORK_ERROR: 'Network error. Please check your connection',
  INVALID_INPUT: 'Invalid input. Please check your data',
  UNKNOWN_ERROR: 'An unexpected error occurred',
} as const
