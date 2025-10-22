from datetime import timedelta

from flask import Blueprint, jsonify, make_response, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_csrf_token,
    get_jwt_identity,
    jwt_required,
    set_refresh_cookies,
    unset_jwt_cookies,
)
from marshmallow import ValidationError
from models.user import UserRepository
from schemas.auth_schemas import LoginSchema, RegisterSchema
from services.auth_service import AuthService
from utils.constants import API_PREFIX, AuthErrorMessage


def create_auth_blueprint(supabase, logger, limiter):
    """
    Factory function to create and configure the authentication blueprint.

    Initializes all dependencies (repositories, services) and registers
    authentication-related routes including registration, login, token
    refresh, logout, and user identity verification.

    Args:
        supabase: Configured Supabase client instance for database operations.
        logger: Logger instance for structured logging.
        limiter: Flask-Limiter instance, set to None in non-production environment.

    Returns:
        Blueprint: Configured Flask Blueprint with all auth routes registered.

    Routes:
        POST /auth/register: Register a new user
        POST /auth/login: Authenticate and receive tokens
        POST /auth/refresh: Refresh access token
        POST /auth/logout: Invalidate tokens and logout
        GET /auth/me: Get current user identity
    """
    auth_bp = Blueprint('auth', __name__, url_prefix=API_PREFIX)
    # Dependency injection
    user_repo = UserRepository(supabase)
    auth_service = AuthService(user_repo)

    @auth_bp.route('/register', methods=['POST'])
    @limiter.limit('10 per minute')
    def register():
        """
        Register a new user account.

        Creates a new user with email, password, and optional name.
        Validates input using RegisterSchema and returns the created user's ID.

        Request Body (JSON):
            email (str): Valid email address (required).
            password (str): Password (min 6 chars, required).
            name (str): Display name (optional).

        Returns:
            201: User successfully created.
                {
                    "message": "User registered",
                    "id": "user-uuid"
                }
            400: Validation error or email already registered.
                {
                    "error": "Email already registered" | "errors": {...}
                }
            500: Internal server error.

        Security:
            - Password is hashed with bcrypt before storage
            - Email uniqueness is enforced at database level
            - Rate limited to prevent spam registrations

        Example:
            POST /auth/register
            {
                "email": "user@example.com",
                "password": "securePass123",
                "name": "John Doe"
            }
        """
        try:
            data = RegisterSchema().load(request.json)
        except ValidationError as e:
            return jsonify({'errors': e.messages}), 400
        email = data.get('email')
        password = data.get('password')
        name = data.get('name', '')

        user_id, error = auth_service.register_user(email, password, name)

        if error == AuthErrorMessage.EMAIL_ALREADY_REGISTERED.value:
            return jsonify({'error': error}), 400
        if error:
            return jsonify({'error': error}), 500

        logger.info(
            'User registered successfully', extra={'user_id': user_id, 'email': email}
        )
        return jsonify({'message': 'User registered', 'id': user_id}), 201

    @auth_bp.route('/login', methods=['POST'])
    @limiter.limit('10 per minute')
    def login():
        """
        Authenticate user and issue JWT tokens.

        Validates credentials and returns an access token (in response body)
        and refresh token (in secure HTTP-only cookie).

        Request Body (JSON):
            email (str): User's email address (required).
            password (str): User's password (required).

        Returns:
            200: Authentication successful.
                {
                    "access_token": "jwt-token-string",
                    "user_id": "user-uuid"
                }
                Cookies: refresh_token_cookie, csrf_refresh_token
            400: Validation error.
                {
                    "errors": {...}
                }
            401: Invalid credentials.
                {
                    "error": "Invalid password"
                }
            404: Email not found.
                {
                    "error": "Email not found"
                }

        Security:
            - Password verified with bcrypt
            - Refresh token stored in HTTPOnly cookie
            - CSRF protection for refresh endpoint
            - Rate limited to prevent brute force attacks

        Example:
            POST /auth/login
            {
                "email": "user@example.com",
                "password": "securePass123"
            }
        """
        try:
            data = LoginSchema().load(request.json)
        except ValidationError as e:
            return jsonify({'errors': e.messages}), 400

        email = data.get('email')
        password = data.get('password')

        user_id, error = auth_service.authenticate_user(email, password)

        if error == AuthErrorMessage.EMAIL_NOT_FOUND.value:
            return jsonify({'error': error}), 404
        if error:
            return jsonify({'error': error}), 401

        # Token generation (presentation layer concern)
        access_token = create_access_token(identity=user_id)
        refresh_token = create_refresh_token(identity=user_id)

        response = make_response(
            jsonify(
                {
                    'access_token': access_token,
                    'user_id': user_id,
                }
            )
        )
        response.set_cookie(
            'csrf_refresh_token', get_csrf_token(refresh_token), httponly=False
        )
        set_refresh_cookies(response, refresh_token)

        logger.info(
            'User logged in successfully', extra={'user_id': user_id, 'email': email}
        )
        return response

    @auth_bp.route('/refresh', methods=['POST'])
    @limiter.limit("30 per minute")
    @jwt_required(refresh=True)
    def refresh():
        """
        Refresh the access token using a valid refresh token.

        Requires a valid refresh token (provided via HTTP-only cookie).
        Returns a new access token with a 15-minute expiry.

        Headers:
            X-CSRF-TOKEN: CSRF token from csrf_refresh_token cookie (required).

        Cookies:
            refresh_token_cookie: HTTP-only refresh token (required).

        Returns:
            200: Token refreshed successfully.
                {
                    "access_token": "new-jwt-token-string"
                }
            401: Invalid or expired refresh token.
            500: Server error during token refresh.

        Security:
            - Requires valid refresh token in HTTPOnly cookie
            - CSRF token required in header
            - Rate limited to prevent token refresh abuse

        Example:
            POST /auth/refresh
            Headers: X-CSRF-TOKEN: <csrf-token>
            Cookies: refresh_token_cookie=<refresh-token>
        """
        try:
            user_id = get_jwt_identity()
            access_token = create_access_token(
                identity=user_id, expires_delta=timedelta(minutes=15)
            )
            logger.info(f'Token refresh for user id {user_id}')
            return jsonify({'access_token': access_token})
        except Exception as e:
            logger.error('Failed to refresh token for user id %s: %s', user_id, str(e))
            return jsonify({'error': 'Refresh token exception'}), 500

    @auth_bp.route('/logout', methods=['POST'])
    @jwt_required()
    def logout():
        """
        Logout the current user and invalidate tokens.

        Requires a valid access token. Unsets all JWT cookies (access and refresh tokens).

        Headers:
            Authorization: Bearer <access-token> (required).

        Returns:
            200: Logout successful.
                {
                    "message": "Logout successfully, token unset."
                }
            401: Invalid or missing access token.
            500: Server error during logout.

        Example:
            POST /auth/logout
            Headers: Authorization: Bearer <access-token>
        """
        try:
            user_id = get_jwt_identity()
            response = jsonify({"message": "Logout successfully, token unset."})
            unset_jwt_cookies(response)
            logger.info(f'User logout successfully as {user_id}')
            return response
        except Exception as e:
            logger.error('Failed to logout user id %s: %s', user_id, str(e))
            return jsonify({'error': 'Logout failed'}), 500

    @auth_bp.route('/me')
    @jwt_required()
    def me():
        """
        Get the current authenticated user's identity.

        Requires a valid access token. Returns the user ID extracted from the JWT.
        Useful for verifying authentication status and retrieving the current user.

        Headers:
            Authorization: Bearer <access-token> (required).

        Returns:
            200: User identity retrieved successfully.
                {
                    "user_id": "user-uuid"
                }
            401: Invalid or missing access token.

        Security:
            - Requires valid access token
            - Returns only user_id for privacy

        Example:
            GET /auth/me
            Headers: Authorization: Bearer <access-token>
        """
        try:
            user_id = get_jwt_identity()
            logger.info(f'Validated user identity for user id: {user_id}')
            return jsonify({'user_id': user_id})
        except Exception as e:
            logger.error(
                'Failed to validate user identity for user id %s: %s', user_id, str(e)
            )

    return auth_bp
