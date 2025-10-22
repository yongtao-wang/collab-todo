"""Tests for validation schemas."""

import pytest
from marshmallow import ValidationError
from schemas.auth_schemas import LoginSchema, RegisterSchema


class TestRegisterSchema:
    """Test cases for RegisterSchema validation."""

    def test_valid_registration_data(self):
        """Test schema accepts valid registration data."""
        schema = RegisterSchema()
        data = {
            'email': 'test@example.com',
            'password': 'SecurePass123',
            'name': 'Test User',
        }

        result = schema.load(data)
        assert result['email'] == 'test@example.com'
        assert result['password'] == 'SecurePass123'
        assert result['name'] == 'Test User'

    def test_valid_registration_without_name(self):
        """Test schema accepts registration without name."""
        schema = RegisterSchema()
        data = {'email': 'test@example.com', 'password': 'password123'}

        result = schema.load(data)
        assert result['name'] == ''  # Should default to empty string

    def test_invalid_email_format(self):
        """Test schema rejects invalid email format."""
        schema = RegisterSchema()
        data = {'email': 'not-an-email', 'password': 'password123'}

        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)

        assert 'email' in exc_info.value.messages

    def test_missing_email(self):
        """Test schema rejects missing email."""
        schema = RegisterSchema()
        data = {'password': 'password123'}

        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)

        assert 'email' in exc_info.value.messages

    def test_missing_password(self):
        """Test schema rejects missing password."""
        schema = RegisterSchema()
        data = {'email': 'test@example.com'}

        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)

        assert 'password' in exc_info.value.messages

    def test_password_too_short(self):
        """Test schema rejects password shorter than 6 characters."""
        schema = RegisterSchema()
        data = {'email': 'test@example.com', 'password': '12345'}  # Only 5 characters

        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)

        assert 'password' in exc_info.value.messages

    def test_password_minimum_length(self):
        """Test schema accepts password of exactly 6 characters."""
        schema = RegisterSchema()
        data = {
            'email': 'test@example.com',
            'password': '123456',  # Exactly 6 characters
        }

        result = schema.load(data)
        assert result['password'] == '123456'

    def test_empty_email(self):
        """Test schema rejects empty email."""
        schema = RegisterSchema()
        data = {'email': '', 'password': 'password123'}

        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)

        assert 'email' in exc_info.value.messages


class TestLoginSchema:
    """Test cases for LoginSchema validation."""

    def test_valid_login_data(self):
        """Test schema accepts valid login data."""
        schema = LoginSchema()
        data = {'email': 'test@example.com', 'password': 'password123'}

        result = schema.load(data)
        assert result['email'] == 'test@example.com'
        assert result['password'] == 'password123'

    def test_invalid_email_format(self):
        """Test schema rejects invalid email format."""
        schema = LoginSchema()
        data = {'email': 'invalid-email', 'password': 'password123'}

        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)

        assert 'email' in exc_info.value.messages

    def test_missing_email(self):
        """Test schema rejects missing email."""
        schema = LoginSchema()
        data = {'password': 'password123'}

        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)

        assert 'email' in exc_info.value.messages

    def test_missing_password(self):
        """Test schema rejects missing password."""
        schema = LoginSchema()
        data = {'email': 'test@example.com'}

        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)

        assert 'password' in exc_info.value.messages

    def test_empty_password_allowed(self):
        """Test schema allows empty password (validation happens in service layer)."""
        schema = LoginSchema()
        data = {'email': 'test@example.com', 'password': ''}

        # Login schema doesn't validate password length
        result = schema.load(data)
        assert result['password'] == ''
