# Collab Todo - Frontend

A real-time collaborative todo list application built with Next.js and React.

## Features

- **Real-time collaboration** - Multiple users can edit todo lists simultaneously
- **WebSocket communication** - Instant updates via Socket.IO
- **Offline support** - Local caching with IndexedDB
- **List sharing** - Share todo lists with other users
- **Optimistic updates** - Immediate UI feedback with revision-based conflict resolution

## Tech Stack

- **Framework**: Next.js 15 with React 19
- **State Management**: Zustand
- **Real-time**: Socket.IO Client
- **Storage**: LocalForage (IndexedDB)
- **Styling**: Tailwind CSS
- **Testing**: Vitest + React Testing Library

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn

### Environment Variables

Create a `.env.local` file in the root directory:

> ⚠️ Notice: the authentication url has `/auth` as the API prefix

```env
NODE_ENV=development
NEXT_PUBLIC_AUTH_URL=http://localhost:8080/auth
NEXT_PUBLIC_SOCKET_URL=http://localhost:7788
```


### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm run start
```

## Testing

```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests once (CI mode)
npm run test:run

# Generate coverage report
npm run test:coverage
```

## Project Structure

```
src/
├── app/              # Next.js app directory
├── components/       # React components
├── constants/        # Configuration and constants
├── contexts/         # React contexts
├── hooks/            # Custom React hooks
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
└── test/             # Test utilities and mocks
```

## Architecture

### State Management

- **Zustand store** for global state (connection status, auth, errors)
- **Local state** with React hooks for component-specific data
- **IndexedDB** for persistent offline storage

### Real-time Sync

- **Socket.IO** for bidirectional communication
- **Event-driven architecture** with separate hooks for connection (`useSocket`) and sync (`useTodoSync`)
- **Revision-based conflict resolution** to handle concurrent edits

### Key Hooks

- `useSocket` - Manages WebSocket connection lifecycle
- `useTodoSync` - Handles real-time event listeners and state synchronization
- `useAuth` - Authentication and user session management

## License

MIT
