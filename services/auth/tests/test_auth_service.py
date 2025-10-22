"""Unit tests for AuthService."""

from unittest.mock import Mock

import bcrypt
import pytest
from models.user import User
from services.auth_service import AuthService
from utils.constants import AuthErrorMessage


class TestAuthService:
    @pytest.fixture
    def mock_repo(self):
        """Create a mock user repository."""
        return Mock()

    @pytest.fixture
    def service(self, mock_repo):
        """Create an AuthService instance with mock repository."""
        return AuthService(mock_repo)

    def test_register_user_success(self, service, mock_repo):
        """Test successful user registration."""
        # Arrange
        mock_repo.find_by_email.return_value = None
        mock_repo.create.return_value = 'user-123'

        # Act
        user_id, error = service.register_user(
            'test@example.com', 'SecurePass123', 'Test User'
        )

        # Assert
        assert user_id == 'user-123'
        assert error is None
        mock_repo.find_by_email.assert_called_once_with('test@example.com')
        mock_repo.create.assert_called_once()

        # Verify password was hashed
        call_args = mock_repo.create.call_args[0]
        assert call_args[0] == 'test@example.com'
        assert call_args[1] != 'SecurePass123'  # Should be hashed
        assert call_args[2] == 'Test User'

    def test_register_user_duplicate_email(self, service, mock_repo):
        """Test registration fails when email already exists."""
        # Arrange
        existing_user = Mock(id='existing-user')
        mock_repo.find_by_email.return_value = existing_user

        # Act
        user_id, error = service.register_user('test@example.com', 'password', 'Test')

        # Assert
        assert user_id is None
        assert error == AuthErrorMessage.EMAIL_ALREADY_REGISTERED.value
        mock_repo.create.assert_not_called()

    def test_register_user_with_empty_name(self, service, mock_repo):
        """Test registration with empty name defaults to empty string."""
        # Arrange
        mock_repo.find_by_email.return_value = None
        mock_repo.create.return_value = 'user-456'

        # Act
        user_id, error = service.register_user('test@example.com', 'password')

        # Assert
        assert user_id == 'user-456'
        assert error is None
        call_args = mock_repo.create.call_args[0]
        assert call_args[2] == ''  # Empty name

    def test_authenticate_user_success(self, service, mock_repo):
        """Test successful user authentication."""
        # Arrange
        hashed = bcrypt.hashpw(b'correctpass', bcrypt.gensalt()).decode('utf-8')
        mock_user = User(
            id='user-123',
            email='test@example.com',
            name='Test User',
            encrypted_password=hashed,
        )
        mock_repo.find_by_email.return_value = mock_user

        # Act
        user_id, error = service.authenticate_user('test@example.com', 'correctpass')

        # Assert
        assert user_id == 'user-123'
        assert error is None
        mock_repo.find_by_email.assert_called_once_with('test@example.com')

    def test_authenticate_user_invalid_email(self, service, mock_repo):
        """Test authentication fails with non-existent email."""
        # Arrange
        mock_repo.find_by_email.return_value = None

        # Act
        user_id, error = service.authenticate_user(
            'nonexistent@example.com', 'password'
        )

        # Assert
        assert user_id is None
        assert error == AuthErrorMessage.EMAIL_NOT_FOUND.value

    def test_authenticate_user_invalid_password(self, service, mock_repo):
        """Test authentication fails with wrong password."""
        # Arrange
        hashed = bcrypt.hashpw(b'correctpass', bcrypt.gensalt()).decode('utf-8')
        mock_user = User(
            id='user-123',
            email='test@example.com',
            name='Test User',
            encrypted_password=hashed,
        )
        mock_repo.find_by_email.return_value = mock_user

        # Act
        user_id, error = service.authenticate_user('test@example.com', 'wrongpass')

        # Assert
        assert user_id is None
        assert error == 'Invalid password'

    def test_authenticate_user_empty_password(self, service, mock_repo):
        """Test authentication fails with empty password."""
        # Arrange
        hashed = bcrypt.hashpw(b'correctpass', bcrypt.gensalt()).decode('utf-8')
        mock_user = User(
            id='user-123',
            email='test@example.com',
            name='Test User',
            encrypted_password=hashed,
        )
        mock_repo.find_by_email.return_value = mock_user

        # Act
        user_id, error = service.authenticate_user('test@example.com', '')

        # Assert
        assert user_id is None
        assert error == 'Invalid password'
