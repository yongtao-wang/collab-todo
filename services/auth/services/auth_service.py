from typing import Optional, Tuple

import bcrypt
from models.user import User, UserRepository
from utils.constants import AuthErrorMessage
from utils.logger import get_logger

logger = get_logger(__name__)


class AuthService:
    """
    Service layer for authentication-related business logic.

    Handles user registration and authentication operations, including
    password hashing and validation. Acts as an intermediary between
    the presentation layer (routes) and data access layer (repositories).

    Attributes:
        user_repo: Repository instance for user data operations.
    """

    def __init__(self, user_repository: UserRepository):
        """
        Initialize the authentication service.

        Args:
            user_repository: An instance of UserRepository for database operations.
        """
        self.user_repo = user_repository

    def register_user(
        self, email: str, password: str, name: str = ''
    ) -> Tuple[str, Optional[str]]:
        """
        Register a new user with email and password.

        Validates that the email is not already registered, hashes the password
        using bcrypt, and creates a new user record in the database.

        Args:
            email: User's email address (must be unique).
            password: User's plain-text password (will be hashed).
            name: Optional user's display name (default: empty string).

        Returns:
            A tuple containing:
                - user_id (str): The created user's ID if successful, None otherwise.
                - error_message (str): Error message if failed, None otherwise.

        Example:
            >>> user_id, error = auth_service.register_user("user@example.com", "password123", "John Doe")
            >>> if error:
            ...     print(f"Registration failed: {error}")
            ... else:
            ...     print(f"User created with ID: {user_id}")
        """
        # Check if user exists
        existing = self.user_repo.find_by_email(email)
        if existing:
            return None, AuthErrorMessage.EMAIL_ALREADY_REGISTERED.value

        # Hash password
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode(
            'utf-8'
        )

        # Create user
        user_id = self.user_repo.create(email, hashed, name)
        logger.info('Registered new user id %s', user_id)
        return user_id, None

    def authenticate_user(
        self, email: str, password: str
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Authenticate user credentials and return user ID if valid.

        Verifies the provided email exists and the password matches the stored
        hash using bcrypt comparison.

        Args:
            email: User's email address.
            password: User's plain-text password to verify.

        Returns:
            A tuple containing:
                - user_id (str): The user's ID if authentication succeeds, None otherwise.
                - error_message (str): Error message if authentication fails, None otherwise.

        Example:
            >>> user_id, error = auth_service.authenticate_user("user@example.com", "password123")
            >>> if error:
            ...     print(f"Login failed: {error}")
            ... else:
            ...     print(f"Authenticated user: {user_id}")
        """
        user: User = self.user_repo.find_by_email(email)
        if not user:
            return None, AuthErrorMessage.EMAIL_NOT_FOUND.value

        if not bcrypt.checkpw(
            password.encode('utf-8'), user.encrypted_password.encode('utf-8')
        ):
            return None, AuthErrorMessage.INVALID_PASSWORD.value

        logger.info('User authenticated with email: %s', email)
        return user.id, None
