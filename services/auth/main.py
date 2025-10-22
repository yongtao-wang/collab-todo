"""
Authentication Service - Main Application Module.

This module serves as the entry point for the Flask-based authentication microservice.
It initializes and configures all necessary components including JWT authentication,
rate limiting, CORS, database connections, and health check endpoints.

The service provides:
- User registration and authentication
- JWT token management (access + refresh tokens)
- Rate limiting for abuse prevention
- Health and readiness monitoring endpoints
- Structured logging and error handling

Environment Variables Required:
    SUPABASE_URL: Supabase project URL
    SUPABASE_SECRET_KEY: Supabase service role key
    JWT_SECRET_KEY: Secret key for JWT token signing
    ENV: Environment (production, development, testing)
    PORT: Server port (default: 5566)
    LOG_LEVEL: Logging level (default: INFO for prod, DEBUG for dev)

Example:
    Run the application:
        $ uv run python main.py

    Or import for testing:
        >>> from main import create_app
        >>> app = create_app()
        >>> client = app.test_client()

Author: Authentication Service Team
Version: 1.0.0
"""

import os

from config import Config
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from supabase import Client, create_client
from utils.logger import get_logger

load_dotenv()


# Initialize rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=['2000 per day', '100 per hour'],
    storage_uri='memory://',
    enabled=True,
)


def create_app():
    """
    Factory function to create and configure the Flask application.

    This function initializes the Flask app with all necessary components:
    - Configuration management (environment-based)
    - CORS (Cross-Origin Resource Sharing)
    - JWT authentication and token management
    - Rate limiting (enabled in production, disabled in dev/test)
    - Database connection (Supabase)
    - Authentication routes blueprint
    - Health and readiness check endpoints
    - Structured logging

    The application follows the application factory pattern, allowing
    multiple instances with different configurations for testing and
    production deployments.

    Returns:
        Flask: Configured Flask application instance ready to serve requests.

    Raises:
        ValueError: If required environment variables are missing or invalid.
        Exception: If database connection fails during initialization.

    Example:
        >>> app = create_app()
        >>> app.run(host='0.0.0.0', port=5566)

        >>> # For testing
        >>> app = create_app()
        >>> client = app.test_client()
        >>> response = client.get('/health')
        >>> assert response.status_code == 200

    Notes:
        - Rate limiting is automatically disabled for non-production environments
        - CORS is enabled with credentials support for frontend integration
        - JWT tokens use HTTP-only cookies for refresh tokens (security)
        - Health checks are available at /health and /ready endpoints
    """
    app = Flask(__name__)
    config = Config.from_env()
    config.validate()
    config.configure_flask(app)
    CORS(app, supports_credentials=True)
    JWTManager(app)
    logger = get_logger(__name__, config.LOG_LEVEL)
    limiter.init_app(app)

    # TODO: Enable Supabase connection pool
    # http_client = httpx.Client(
    #     limits=httpx.Limits(
    #         max_connections=20,        # total max concurrent connections
    #         max_keepalive_connections=10, # persistent connections to keep alive
    #         keepalive_expiry=30.0      # seconds to keep connections open
    #     ),
    #     timeout=httpx.Timeout(10.0, connect=5.0),
    #     headers={"Connection": "keep-alive"},
    # )

    # Configure Supabase
    supabase: Client = create_client(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY)

    # Import blueprint after init limiter
    from routes.auth_routes import create_auth_blueprint

    auth_bp = create_auth_blueprint(supabase, logger, limiter)

    # Register the blueprint with the app
    app.register_blueprint(auth_bp)

    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health_check():
        """
        Health check endpoint for monitoring and load balancers.

        Returns service status and basic system information.
        This endpoint is not rate-limited and does not require authentication.

        Returns:
            200: Service is healthy
                {
                    "status": "healthy",
                    "service": "auth-service",
                    "version": "1.0.0"
                }

        Example:
            >>> curl http://localhost:5566/health
            {"status": "healthy", "service": "auth-service", "version": "1.0.0"}
        """
        return (
            jsonify(
                {'status': 'healthy', 'service': 'auth-service', 'version': '1.0.0'}
            ),
            200,
        )

    # Readiness check endpoint (checks database connectivity)
    @app.route('/ready', methods=['GET'])
    def readiness_check():
        """
        Readiness check endpoint for Kubernetes and container orchestration.

        Verifies that the service can handle requests by checking:
        - Database connectivity (Supabase)

        Returns:
            200: Service is ready to handle requests
                {
                    "status": "ready",
                    "checks": {
                        "database": "ok"
                    }
                }
            503: Service is not ready (database unavailable)
                {
                    "status": "not ready",
                    "checks": {
                        "database": "error"
                    }
                }

        Example:
            >>> curl http://localhost:5566/ready
            {"status": "ready", "checks": {"database": "ok"}}
        """
        checks = {}
        is_ready = True

        # Check database connectivity
        try:
            # Simple query to verify Supabase connection
            supabase.table('users').select('id').limit(1).execute()
            checks['database'] = 'ok'
        except Exception as e:
            logger.error(f"Database health check failed: {str(e)}")
            checks['database'] = 'error'
            is_ready = False

        status_code = 200 if is_ready else 503
        status = 'ready' if is_ready else 'not ready'

        return jsonify({'status': status, 'checks': checks}), status_code

    return app


if __name__ == '__main__':
    app = create_app()
    PORT = os.getenv('PORT') or 5566
    DEBUG = app.config['DEBUG']
    app.run(
        host='0.0.0.0',
        port=PORT,
        load_dotenv=True,
        debug=DEBUG,
    )
