"""Pytest configuration and fixtures for integration tests."""

import os
from unittest.mock import MagicMock, patch

import pytest
from main import create_app


@pytest.fixture
def app():
    """Create and configure a Flask app instance for testing."""
    # Set test environment variables
    os.environ['ENV'] = 'test'
    os.environ['JWT_SECRET_KEY'] = 'test-secret-key-for-testing-only'
    os.environ['SUPABASE_URL'] = 'https://test.supabase.co'
    os.environ['SUPABASE_SECRET_KEY'] = 'test-key'

    # Mock Supabase client to prevent real network calls
    with patch('main.create_client') as mock_create_client:
        mock_supabase = MagicMock()
        mock_create_client.return_value = mock_supabase

        app = create_app()
        app.config['TESTING'] = True
        app.config['JWT_COOKIE_CSRF_PROTECT'] = False  # Disable CSRF for testing

        yield app


@pytest.fixture
def client(app):
    """Create a test client for the Flask app."""
    return app.test_client()


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client."""
    mock = MagicMock()
    mock.table.return_value = mock
    mock.select.return_value = mock
    mock.eq.return_value = mock
    mock.insert.return_value = mock
    return mock


@pytest.fixture
def sample_user_data():
    """Sample user data for testing."""
    return {
        'id': 'user-123',
        'email': 'test@example.com',
        'name': 'Test User',
        'encrypted_password': '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYFj.N8I7Uu',  # "password123"
    }
