/**
 * Todo Event Constants
 *
 * Centralized definition of all Socket.IO events for the todo feature.
 * This prevents typos and makes refactoring easier.
 */

/**
 * Events received from the server
 */
export const INCOMING_EVENTS = {
  LIST_SNAPSHOT: 'list_snapshot',
  LIST_SYNCED: 'list_synced',
  LIST_CREATED: 'list_created',
  LIST_SHARE_SUCCESS: 'list_share_success',
  LIST_SHARED_WITH_YOU: 'list_shared_with_you',
  ITEM_ADDED: 'item_added',
  ITEM_UPDATED: 'item_updated',
  ITEM_DELETED: 'item_deleted',
} as const

/**
 * Events emitted to the server
 */
export const OUTGOING_EVENTS = {
  JOIN: 'join',
  JOIN_LIST: 'join_list',
  CREATE_LIST: 'create_list',
  ADD_ITEM: 'add_item',
  UPDATE_ITEM: 'update_item',
  DELETE_ITEM: 'delete_item',
  SHARE_LIST: 'share_list',
} as const

/**
 * Socket connection events
 */
export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  ERROR: 'error',
  AUTH_ERROR: 'auth_error',
  PERMISSION_ERROR: 'permission_error',
} as const

// Type exports for type safety
export type IncomingEvents =
  (typeof INCOMING_EVENTS)[keyof typeof INCOMING_EVENTS]
export type OutgoingEvents =
  (typeof OUTGOING_EVENTS)[keyof typeof OUTGOING_EVENTS]
export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS]
