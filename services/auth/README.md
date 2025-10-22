# Authentication Service

A Flask-based authentication microservice for the Collaborative Todo application. Provides user registration, login, JWT token management, and session handling with Supabase as the database backend.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)
- [Configuration](#configuration)
- [Security](#security)
- [Development](#development)
- [Testing](#testing)

## Features

- [x] User registration with email/password
- [x] Secure password hashing with bcrypt
- [x] JWT-based authentication (access + refresh tokens)
- [x] CSRF protection for refresh tokens
- [x] Token refresh mechanism
- [x] Protected endpoints with `@jwt_required()`
- [x] CORS support for cross-origin requests
- [x] Request validation with Marshmallow schemas
- [x] Structured logging
- [x] Clean architecture with service/repository layers
- [x] Rate limiting to prevent abuse and brute force attacks
- [x] CI/CD pipeline and Docker script

## Tech Stack

- **Framework**: Flask 3.1+
- **Authentication**: Flask-JWT-Extended
- **Password Hashing**: bcrypt
- **Database**: Supabase (PostgreSQL)
- **Validation**: Marshmallow
- **CORS**: Flask-CORS
- **Environment Management**: python-dotenv
- **Testing**: pytest

## Architecture

The service follows a layered architecture pattern:

```bash
├── routes/          # API endpoints (presentation layer)
├── services/        # Business logic layer
├── models/          # Data access layer (repositories)
├── schemas/         # Request/response validation
├── utils/           # Utilities (logging, constants, etc.)
├── config.py        # Configuration management
└── main.py          # Application entry point
```

### Key Components

- **Routes**: Handle HTTP requests/responses and JWT token management
- **Services**: Implement business logic (e.g., user authentication)
- **Models**: Interface with Supabase database
- **Schemas**: Validate and serialize request/response data
- **Config**: Environment-based configuration

## Getting Started

### Prerequisites

- Python 3.13+
- Supabase account and project
- `uv` for virtual environment management

### Installation

1. **Clone the repository**

   ```bash
   cd services/auth
   ```

2. **Create and activate virtual environment**

   ```bash
   uv venv # Will create default environment .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install dependencies**

   ```bash
   uv sync   
   ```

4. **Set up environment variables**

   Create a `.env` file in the `services/auth` directory:

   ```yaml
   # Supabase Configuration
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SECRET_KEY=your_service_role_key_here
   
   # JWT Configuration
   JWT_SECRET_KEY=your-secret-key-here
   
   # Flask Configuration
   FLASK_ENV=development
   ENV=production
   PORT=5566
   ```

5. **Run the application on local machine**

   ```bash
   uv run python main.py
   ```

   The server will start at `http://localhost:5566`

## Docker

You can run the authentication service in a Docker container for easier deployment and environment consistency.

### 1. Create a Dockerfile

If not present, create a `Dockerfile` in the `services/auth` directory:

```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY . /app
RUN pip install --upgrade pip && pip install -e .
ENV PYTHONUNBUFFERED=1
CMD ["python", "main.py"]
```

### 2. Build the Docker image

```bash
docker build -t collab-auth .
```

### 3. Configure environment variables

Copy your `.env` file into the Docker build context (same folder as Dockerfile). For production, you can use Docker secrets or environment variables.

### 4. Run the Docker container

```bash
docker run --env-file .env -p 5566:5566 collab-auth
```

The service will be available at `http://localhost:5566`.

#### Notes

- For development, mount your code for live reload:

  ```bash
  docker run --env-file .env -p 5566:5566 -v $(pwd):/app collab-auth
  ```

- For production, set `FLASK_ENV=production` and `DEBUG=False` in `.env`.

---

## CI/CD Pipeline

The authentication service includes a comprehensive CI/CD pipeline using GitHub Actions.

> [!NOTE]
> Currently CI/CD will not be triggered automatically. It is for demonstration purposes only.

### Pipeline Stages

#### 1. **Test** (Runs on all branches)

- Linting with flake8
- Unit and integration tests with pytest
- Code coverage reporting to Codecov
- PostgreSQL service container for tests

#### 2. **Build** (Runs on push to `master` or `develop`)

- Builds Docker image
- Pushes to GitHub Container Registry (ghcr.io)
- Tags images appropriately:
  - `latest` - Latest master build
  - `develop` - Latest develop build
  - `master-{sha}` / `develop-{sha}` - Commit-specific builds

#### 3. **Deploy to Staging** (Runs on push to `develop`)

- Deploys to staging environment
- Runs smoke tests
- Environment: `staging`

#### 4. **Deploy to Production** (Runs on push to `master`)

- Deploys to production environment
- Runs smoke tests
- Sends deployment notifications
- Environment: `production`

### Required GitHub Secrets

Configure these secrets in your GitHub repository:

| Secret                | Description                     | Required For                        |
| --------------------- | ------------------------------- | ----------------------------------- |
| `SUPABASE_URL`        | Supabase project URL            | Testing                             |
| `SUPABASE_SECRET_KEY` | Supabase service role key       | Testing                             |
| `CODECOV_TOKEN`       | Codecov upload token            | Coverage reporting                  |
| `SLACK_WEBHOOK`       | Slack webhook for notifications | Deployment notifications (optional) |

### Deployment Setup

#### GitHub Container Registry

The pipeline automatically builds and pushes Docker images to GitHub Container Registry.

**Pull the image:**

```bash
docker pull ghcr.io/your-username/collab-todo/auth-service:latest
```

**Run the image:**

```bash
docker run -p 5566:5566 \
  -e SUPABASE_URL=your_url \
  -e SUPABASE_SECRET_KEY=your_key \
  -e JWT_SECRET_KEY=your_secret \
  ghcr.io/your-username/collab-todo/auth-service:latest
```

#### Deployment Targets

The pipeline includes placeholder deployment steps. Configure for your platform:

**AWS ECS:**

```yaml
- name: Deploy to AWS ECS
  run: |
    aws ecs update-service \
      --cluster ${{ secrets.ECS_CLUSTER }} \
      --service auth-service \
      --force-new-deployment
```

**Kubernetes:**

```yaml
- name: Deploy to Kubernetes
  run: |
    kubectl set image deployment/auth-service \
      auth-service=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest \
      --namespace=production
```

**Google Cloud Run:**

```yaml
- name: Deploy to Cloud Run
  run: |
    gcloud run deploy auth-service \
      --image=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest \
      --region=us-central1 \
      --platform=managed
```

**Railway/Render/Fly.io:**

```yaml
- name: Deploy to Railway
  run: railway up --service auth-service
```

### Environment Configuration

#### Staging Environment

- URL: `https://auth-staging.yourdomain.com`
- Branch: `develop`
- Auto-deploys on merge to develop

#### Production Environment

- URL: `https://auth.yourdomain.com`
- Branch: `master`
- Auto-deploys on merge to master
- Requires approval (configured in GitHub environment settings)

### Monitoring Deployments

#### View Workflow Runs

Go to: `https://github.com/your-username/collab-todo/actions`

#### Check Deployment Status

```bash
# View recent deployments
gh run list --workflow=ci.yaml

# View specific run
gh run view <run-id>

# Watch logs in real-time
gh run watch
```

#### Rollback

```bash
# List previous image tags
docker images ghcr.io/your-username/collab-todo/auth-service

# Deploy previous version
kubectl set image deployment/auth-service \
  auth-service=ghcr.io/your-username/collab-todo/auth-service:master-abc123
```

### Local Docker Build

Build and test the Docker image locally:

```bash
# Build
docker build -t auth-service:local .

# Run with environment variables
docker run -p 5566:5566 \
  --env-file .env \
  auth-service:local

# Test health check
curl http://localhost:5566/health
```

---

## API Endpoints

### Base URL

```bash
http://localhost:5566/auth
```

### 1. Register User

Create a new user account.

**Endpoint**: `POST /auth/register`

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response** (201 Created):

```json
{
  "message": "User registered",
  "id": "uuid-here"
}
```

**Error Responses**:

- `400 Bad Request`: Email already registered or validation error
- `500 Internal Server Error`: Server error

### 2. Login

Authenticate and receive access token + refresh token (in cookie).

**Endpoint**: `POST /auth/login`

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response** (200 OK):

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "uuid-here"
}
```

**Cookies Set**:

- `refresh_token_cookie`: HTTPOnly cookie with refresh token
- `csrf_refresh_token`: CSRF token for refresh endpoint

**Error Responses**:

- `404 Not Found`: Email not found
- `401 Unauthorized`: Invalid password
- `400 Bad Request`: Validation error

### 3. Refresh Token

Get a new access token using refresh token.

**Endpoint**: `POST /auth/refresh`

**Headers**:

- `X-CSRF-TOKEN`: CSRF token from `csrf_refresh_token` cookie

**Cookies Required**:

- `refresh_token_cookie`: Refresh token from login

**Response** (200 OK):

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses**:

- `401 Unauthorized`: Invalid or expired refresh token
- `422 Unprocessable Entity`: Missing CSRF token

### 4. Get Current User

Validate access token and get user info.

**Endpoint**: `GET /auth/me`

**Headers**:

```bash
Authorization: Bearer <access_token>
```

**Response** (200 OK):

```json
{
  "user_id": "uuid-here"
}
```

**Error Responses**:

- `401 Unauthorized`: Invalid or expired access token
- `422 Unprocessable Entity`: Missing authorization header

### 5. Logout

Invalidate refresh token and clear cookies.

**Endpoint**: `POST /auth/logout`

**Headers**:

```bash
Authorization: Bearer <access_token>
```

**Response** (200 OK):

```json
{
  "message": "Logout successfully, token unset."
}
```

**Error Responses**:

- `401 Unauthorized`: Invalid access token
- `500 Internal Server Error`: Logout failed

## Configuration

### Environment Variables

| Variable                    | Description                   | Default      | Required       |
| --------------------------- | ----------------------------- | ------------ | -------------- |
| `SUPABASE_URL`              | Supabase project URL          | -            | ✅              |
| `SUPABASE_SECRET_KEY`       | Supabase service role key     | -            | ✅              |
| `JWT_SECRET_KEY`            | Secret key for JWT signing    | `dev-secret` | ✅ (production) |
| `JWT_ACCESS_TOKEN_EXPIRES`  | Access token expiry (minutes) | `15`         | ❌              |
| `JWT_REFRESH_TOKEN_EXPIRES` | Refresh token expiry (days)   | `30`         | ❌              |
| `PORT`                      | Server port                   | `5566`       | ❌              |
| `DEBUG`                     | Debug mode                    | `False`      | ❌              |
| `LOG_LEVEL`                 | Logging level                 | `INFO`       | ❌              |

### Token Configuration

- **Access Token**: Short-lived (default: 15 minutes), sent in response body
- **Refresh Token**: Long-lived (default: 30 days), stored in HTTPOnly cookie
- **CSRF Token**: Protects refresh endpoint from CSRF attacks

## Security

### Password Security

- Passwords are hashed using **bcrypt** with salt
- Maximum password length: 72 bytes (bcrypt limitation)
- Validation enforced at schema level

### Token Security

- **JWT Tokens**: Signed with `JWT_SECRET_KEY`
- **HTTPOnly Cookies**: Refresh tokens stored in HTTPOnly cookies (not accessible via JavaScript)
- **CSRF Protection**: Refresh endpoint requires CSRF token
- **Token Expiry**: Access tokens expire after 15 minutes, refresh tokens after 30 days

### CORS Configuration

- Enabled with `supports_credentials=True`
- Allows cross-origin requests from frontend
- Configure allowed origins in production

### Rate Limiting

The service implements rate limiting to prevent abuse and brute force attacks:

| Endpoint              | Rate Limit                 | Purpose                              |
| --------------------- | -------------------------- | ------------------------------------ |
| `POST /auth/register` | 10 per minute              | Prevent spam registrations           |
| `POST /auth/login`    | 10 per minute              | Prevent brute force password attacks |
| `POST /auth/refresh`  | 30 per minute              | Prevent token refresh abuse          |
| Global Default        | 2000 per day, 100 per hour | Overall API protection               |

**Rate Limit Headers**: When rate limited, responses include:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time when limit resets
- `Retry-After`: Seconds to wait before retrying (when limited)

**Rate Limit Response** (429 Too Many Requests):

```json
{
  "error": "429 Too Many Requests: 5 per 1 minute"
}
```

## Development

### Project Structure

```bash
services/auth/
├── main.py                 # Application entry point
├── config.py               # Configuration management
├── routes/
│   └── auth_routes.py      # Authentication endpoints
├── services/
│   └── auth_service.py     # Authentication business logic
├── models/
│   └── user.py             # User repository
├── schemas/
│   └── auth_schemas.py     # Request/response schemas
├── utils/
│   ├── logger.py           # Logging configuration
│   └── constants.py        # Constants and enums
├── tests/                  # Test suite, unit tests
│   └── integration         # Integration tests
├── .env                    # Environment variables (not in git)
├── .flake8                 # flake8 linter configuration
├── pyproject.toml          # Project dependencies
├── Dockerfile              # Docker script
├── ci.yaml                 # CI/CD script (disabled for now)
├── pytest.ini              # pytest configuration
└── README.md               # This file
```

### Code Style

- Follow PEP 8 guidelines, flake8 as server linter
- Use `isort` for import sorting
- Type hints encouraged for better IDE support

## Testing

### Run Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html

# Run specific test file
pytest tests/test_auth_routes.py
pytest ./tests/test_auth_routes.py::TestAuthRoutes::test_register_success

# Run with verbose output
pytest -v
```

### Test Structure

```bash
tests/
├── conftest.py            # Pytest fixtures
├── test_auth_routes.py    # Route tests
├── test_auth_service.py   # Service tests
└── test_user_repository.py # Repository tests
```

### Writing Tests

Example test:

```python
def test_register_user(client):
    response = client.post('/auth/register', json={
        'email': 'test@example.com',
        'password': 'password123',
        'name': 'Test User'
    })
    assert response.status_code == 201
    assert 'id' in response.json
```

## Troubleshooting

### Common Issues

#### 1. `SUPABASE_URL is required` error

- Ensure `.env` file exists in `services/auth/`
- Check that `SUPABASE_URL` is set correctly

#### 2. `bcrypt: no backends available` error

- Install bcrypt: `pip install bcrypt`

#### 3. `Password cannot be longer than 72 bytes` error

- Bcrypt limitation, enforce max 72 characters in validation

#### 4. `OPTIONS` requests receiving 400 errors

- CORS preflight issue, ensure `flask-cors` is installed and configured

#### 5. Auto-reload not working

- Set `debug=True` in `app.run()` or `DEBUG=True` in `.env`

## Contributing

1. Create a feature branch
2. Write tests for new features
3. Ensure all tests pass: `pytest`
4. Follow code style guidelines
5. Submit a pull request

## License

This project is part of the Collaborative Todo application.

---

For issues or questions, please open an issue in the repository.
