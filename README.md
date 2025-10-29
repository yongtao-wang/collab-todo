# Collab Todo

A real-time collaborative todo list application where multiple users can create, edit, and share todo lists with instant synchronization.

## Features

- **Real-time Collaboration** - Edit todo lists simultaneously with other users
- **Instant Sync** - WebSocket-based updates across all connected clients
- **Offline Support** - Local caching with automatic conflict resolution
- **List Sharing** - Share todo lists with other users via unique codes
- **User Authentication** - Secure JWT-based authentication

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS, Socket.IO Client
- **Backend**: Flask, Flask-SocketIO, Python 3.13
- **Database**: Supabase (PostgreSQL)
- **Cache/Message Broker**: Redis
- **Authentication**: JWT with Flask-JWT-Extended

## Installation

### Using Docker (Recommended)

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd collab-todo
   ```

2. **Set up environment variables**

   Create `.env` files for each service:

   - `services/auth/.env`

     ```env
     ENV=development
     SUPABASE_URL=your_supabase_url
     SUPABASE_SECRET_KEY=your_supabase_key
     JWT_SECRET_KEY=your_jwt_secret
     ```

   - `services/collab/.env`

     ```env
     ENV=development
     SUPABASE_URL=your_supabase_url
     SUPABASE_SECRET_KEY=your_supabase_key
     JWT_SECRET_KEY=your_jwt_secret
     REDIS_URL=redis://redis:6379/0
     ENABLE_REDIS_LISTENER=true
     ```

   - `client/.env`
     ```env
     NODE_ENV=development
     NEXT_PUBLIC_AUTH_URL=http://localhost:5566/auth
     NEXT_PUBLIC_SOCKET_URL=http://localhost:7788
     ```
     > Notice! Keep `your_jwt_secret` the same value to both services.

3. **Build and run with Docker Compose**

   ```bash
   docker compose build
   docker compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Auth Service: http://localhost:5566
   - Collab Service: http://localhost:7788
   - Redis: `docker exec -it todo-redis redis-cli`

### Without Docker

#### Prerequisites

- Node.js 20+
- Python 3.13+
- Redis server
- PostgreSQL database (or Supabase account)

#### 1. Start Redis

```bash
redis-server
```

#### 2. Set up Auth Service

```bash
cd services/auth
pip install uv
uv sync
cp .env.example .env  # Edit with your credentials
uv run main.py
```

#### 3. Set up Collab Service

> In local .env, update value REDIS_URL=redis://localhost:6379/0

```bash
cd services/collab
pip install uv
uv sync
cp .env.example .env  # Edit with your credentials
uv run main.py
```

#### 4. Set up Client

```bash
cd client
npm install
cp .env.example .env  # Edit with your service URLs
npm run dev
```

The application will be available at http://localhost:3000.

## Runtime Status

Auth Service:

- Health check: http://localhost:5566/health
- Readiness check: http://localhost:5566/ready

Collab Service:

- Health check: http://localhost:7788/health
- State manager: http://localhost:7788/cache
- WebSocket rooms: http://localhost:7788/rooms
- Metrics: http://localhost:7788/metrics
- Cache flush: http://localhost:7788/cache/flush visiting this link will clear up all current cache in state manager

## Development

### Running Tests

**Frontend:**

```bash
cd client
npm test              # Watch mode
npm run test:coverage # With coverage
```

**Backend Services:**

```bash
cd services/auth  # or services/collab
uv run pytest
uv run pytest --cov  # With coverage
```

### Viewing Logs

With Docker:

```bash
docker logs -f todo-client
docker logs -f todo-auth
docker logs -f todo-collab
docker logs -f todo-redis
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
