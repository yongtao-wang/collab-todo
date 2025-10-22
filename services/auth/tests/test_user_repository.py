"""Unit tests for UserRepository."""

from unittest.mock import MagicMock

import pytest
from models.user import UserRepository


class TestUserRepository:
    @pytest.fixture
    def mock_supabase(self):
        """Create a mock Supabase client."""
        mock = MagicMock()
        return mock

    @pytest.fixture
    def repository(self, mock_supabase):
        """Create a UserRepository instance with mock client."""
        return UserRepository(mock_supabase)

    def test_find_by_email_success(self, repository, mock_supabase):
        """Test finding user by email when user exists."""
        # Arrange
        user_data = {
            'id': 'user-123',
            'email': 'test@example.com',
            'name': 'Test User',
            'encrypted_password': 'hashed_password',
        }
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            user_data
        ]

        # Act
        user = repository.find_by_email('test@example.com')

        # Assert
        assert user is not None
        assert user.id == 'user-123'
        assert user.email == 'test@example.com'
        assert user.name == 'Test User'
        assert user.encrypted_password == 'hashed_password'

        # Verify database calls
        mock_supabase.table.assert_called_once_with('users')
        mock_supabase.table.return_value.select.assert_called_once_with('*')
        mock_supabase.table.return_value.select.return_value.eq.assert_called_once_with(
            'email', 'test@example.com'
        )

    def test_find_by_email_not_found(self, repository, mock_supabase):
        """Test finding user by email when user does not exist."""
        # Arrange
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
            []
        )

        # Act
        user = repository.find_by_email('nonexistent@example.com')

        # Assert
        assert user is None

    def test_find_by_email_without_name(self, repository, mock_supabase):
        """Test finding user when name field is missing."""
        # Arrange
        user_data = {
            'id': 'user-123',
            'email': 'test@example.com',
            'encrypted_password': 'hashed_password',
        }
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            user_data
        ]

        # Act
        user = repository.find_by_email('test@example.com')

        # Assert
        assert user is not None
        assert user.name == ''  # Should default to empty string

    def test_create_user(self, repository, mock_supabase):
        """Test creating a new user."""
        # Arrange
        created_user = {'id': 'new-user-123'}
        mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [
            created_user
        ]

        # Act
        user_id = repository.create('new@example.com', 'hashed_password', 'New User')

        # Assert
        assert user_id == 'new-user-123'

        # Verify insert was called with correct data
        mock_supabase.table.assert_called_once_with('users')
        insert_call_args = mock_supabase.table.return_value.insert.call_args[0][0]
        assert insert_call_args['email'] == 'new@example.com'
        assert insert_call_args['encrypted_password'] == 'hashed_password'
        assert insert_call_args['name'] == 'New User'

    def test_find_by_id_success(self, repository, mock_supabase):
        """Test finding user by ID when user exists."""
        # Arrange
        user_data = {
            'id': 'user-123',
            'email': 'test@example.com',
            'name': 'Test User',
            'encrypted_password': 'hashed_password',
        }
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            user_data
        ]

        # Act
        user = repository.find_by_id('user-123')

        # Assert
        assert user is not None
        assert user.id == 'user-123'
        assert user.email == 'test@example.com'

        # Verify database calls
        mock_supabase.table.return_value.select.return_value.eq.assert_called_once_with(
            'id', 'user-123'
        )

    def test_find_by_id_not_found(self, repository, mock_supabase):
        """Test finding user by ID when user does not exist."""
        # Arrange
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
            []
        )

        # Act
        user = repository.find_by_id('nonexistent-id')

        # Assert
        assert user is None
