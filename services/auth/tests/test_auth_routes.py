"""Integration tests for auth routes."""

import json
from unittest.mock import patch

import pytest
from flask_jwt_extended import (create_access_token, create_refresh_token,
                                get_csrf_token)
from main import create_app
from utils.constants import AuthErrorMessage


class TestAuthRoutes:
    """Integration tests for authentication endpoints."""

    @pytest.fixture
    def patched_app(self):
        """Create an isolated app instance for testing"""
        with patch('routes.auth_routes.AuthService') as MockAuthService, patch(
            'routes.auth_routes.get_csrf_token', return_value='mock-csrf-token'
        ):
            mock_service = MockAuthService.return_value
            app = create_app()
            app.config['ENV'] = 'development'  # disable rate limiter
            app.config['TESTING'] = True
            app.config['MOCK_AUTH_SERVICE'] = mock_service
            yield app

    @pytest.fixture
    def client(self, patched_app):
        return patched_app.test_client()

    def test_register_success(self, patched_app, client):
        """Test successful user registration."""
        mock_service = patched_app.config['MOCK_AUTH_SERVICE']
        mock_service.register_user.return_value = ('new-user-123', None)

        resp = client.post(
            '/auth/register',
            json={
                'email': 'newuser@example.com',
                'password': 'SecurePass123',
                'name': 'New User',
            },
        )

        mock_service.register_user.assert_called_once_with(
            'newuser@example.com', 'SecurePass123', 'New User'
        )
        assert resp.status_code == 201
        data = json.loads(resp.data)
        assert data['message'] == 'User registered'
        assert data['id'] == 'new-user-123'

    def test_register_duplicate_email(self, patched_app, client):
        """Test registration with existing email."""
        mock_service = patched_app.config['MOCK_AUTH_SERVICE']
        mock_service.register_user.return_value = (
            None,
            AuthErrorMessage.EMAIL_ALREADY_REGISTERED.value,
        )

        # Make request
        response = client.post(
            '/auth/register',
            json={
                'email': 'existing@example.com',
                'password': 'password123',
                'name': 'Test',
            },
        )

        # Assert
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_register_invalid_email(self, client):
        """Test registration with invalid email format."""
        response = client.post(
            '/auth/register',
            json={'email': 'invalid-email', 'password': 'password123', 'name': 'Test'},
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'errors' in data
        assert 'email' in data['errors']

    def test_register_short_password(self, client):
        """Test registration with password too short."""
        response = client.post(
            '/auth/register',
            json={'email': 'test@example.com', 'password': '123', 'name': 'Test'},
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'errors' in data

    def test_register_missing_email(self, client):
        """Test registration without email."""
        response = client.post(
            '/auth/register', json={'password': 'password123', 'name': 'Test'}
        )

        assert response.status_code == 400

    def test_login_success(self, patched_app, client):
        """Test successful login."""
        with patched_app.app_context():
            mock_service = patched_app.config['MOCK_AUTH_SERVICE']
            mock_service.authenticate_user.return_value = ('user-123', None)

            response = client.post(
                '/auth/login',
                json={'email': 'test@example.com', 'password': 'password123'},
            )

            mock_service.authenticate_user.assert_called_once_with(
                'test@example.com', 'password123'
            )
            assert response.status_code == 200
            data = json.loads(response.data)
            assert 'access_token' in data
            assert data['user_id'] == 'user-123'

    def test_login_invalid_email(self, patched_app, client):
        """Test login with non-existent email."""
        with patched_app.app_context():
            mock_service = patched_app.config['MOCK_AUTH_SERVICE']
            mock_service.authenticate_user.return_value = (
                None,
                AuthErrorMessage.EMAIL_NOT_FOUND.value,
            )

            response = client.post(
                '/auth/login',
                json={'email': 'nonexistent@example.com', 'password': 'password123'},
            )

            mock_service.authenticate_user.assert_called_once_with(
                'nonexistent@example.com', 'password123'
            )
            assert response.status_code == 404
            data = json.loads(response.data)
            assert 'error' in data

    def test_login_invalid_password(self, patched_app, client):
        """Test login with wrong password."""
        with patched_app.app_context():
            mock_service = patched_app.config['MOCK_AUTH_SERVICE']
            mock_service.authenticate_user.return_value = (
                None,
                AuthErrorMessage.INVALID_PASSWORD.value,
            )

            response = client.post(
                '/auth/login',
                json={'email': 'test@example.com', 'password': 'wrongpass'},
            )

            mock_service.authenticate_user.assert_called_once_with(
                'test@example.com', 'wrongpass'
            )
            assert response.status_code == 401
            data = json.loads(response.data)
            assert 'error' in data

    def test_login_missing_fields(self, client):
        """Test login with missing required fields."""
        response = client.post('/auth/login', json={'email': 'test@example.com'})

        assert response.status_code == 400

    def test_me_endpoint_requires_auth(self, client):
        """Test /me endpoint requires authentication."""
        response = client.get('/auth/me')
        assert response.status_code == 401

    def test_me_endpoint_with_valid_token(self, patched_app, client):
        """Test /me endpoint with valid JWT token."""
        with patched_app.app_context():
            test_user_id = 'user-123'
            test_token = create_access_token(identity=test_user_id)

            response = client.get(
                '/auth/me',
                headers={'Authorization': f'Bearer {test_token}'},
            )

            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['user_id'] == test_user_id

    def test_logout_endpoint(self, patched_app, client):
        """Test logout endpoint."""
        with patched_app.app_context():
            test_token = create_access_token(identity='user-123')
            response = client.post(
                '/auth/logout',
                headers={'Authorization': f'Bearer {test_token}'},
            )

            assert response.status_code == 200
            data = json.loads(response.data)
            assert 'Logout successfully' in data['message']

    def test_refresh_success(self, patched_app, client):
        """Test successful refresh with valid refresh token."""
        with patched_app.app_context():
            refresh_token = create_refresh_token(identity='user-123')
            response = client.post(
                '/auth/refresh',
                headers={'Authorization': f'Bearer {refresh_token}'},
            )

            assert response.status_code == 200
            data = json.loads(response.data)
            assert 'access_token' in data

    def test_refresh_missing_token(self, client):
        """Test refresh endpoint without any token should fail."""
        response = client.post('/auth/refresh')
        assert response.status_code == 401

    def test_refresh_with_access_token(self, patched_app, client):
        """Test refresh endpoint using an access token should fail."""
        with patched_app.app_context():
            access_token = create_access_token(identity='user-123')

            response = client.post(
                '/auth/refresh',
                headers={'Authorization': f'Bearer {access_token}'},
            )

            # Some versions return 422, some 401
            assert response.status_code in (401, 422)

    def test_refresh_expired_token(self, patched_app, client):
        """Test refresh with an expired refresh token should fail."""
        from datetime import timedelta

        from flask_jwt_extended import create_refresh_token

        with patched_app.app_context():
            expired_token = create_refresh_token(
                identity='user-123', expires_delta=timedelta(seconds=-1)
            )

            response = client.post(
                '/auth/refresh',
                headers={'Authorization': f'Bearer {expired_token}'},
            )

            assert response.status_code == 401

    def test_refresh_invalid_token(self, client):
        """Test refresh with invalid (tampered) token should fail."""
        invalid_token = 'Bearer this.is.an.invalid.token'
        response = client.post(
            '/auth/refresh',
            headers={'Authorization': invalid_token},
        )

        assert response.status_code in (401, 422)

    def test_refresh_internal_error(self, patched_app, client):
        """Test refresh when internal error occurs (create_access_token fails)."""
        with patch(
            'routes.auth_routes.create_access_token', side_effect=Exception('Boom')
        ):
            with patched_app.app_context():
                valid_refresh_token = create_refresh_token(identity='user-123')
                response = client.post(
                    '/auth/refresh',
                    headers={'Authorization': f'Bearer {valid_refresh_token}'},
                )

                assert response.status_code == 500
                data = json.loads(response.data)
                assert 'error' in data

    def test_refresh_with_cookie_csrf(self, patched_app, client):
        """Test refresh endpoint using cookie + CSRF header (browser-style)."""
        with patched_app.app_context():
            refresh_token = create_refresh_token(identity='user-123')
            csrf_token = get_csrf_token(refresh_token)

            # Set refresh token cookie before sending request
            client.set_cookie(
                key='refresh_token_cookie',  # Flask-JWT-Extended’s default cookie name
                value=refresh_token,
            )

            response = client.post(
                '/auth/refresh',
                headers={'X-CSRF-TOKEN': csrf_token},
            )

            assert response.status_code == 200
            data = json.loads(response.data)
            assert 'access_token' in data

    def test_refresh_cookie_missing_csrf(self, patched_app, client):
        """Test refresh using cookie but missing CSRF header should fail."""
        with patched_app.app_context():
            refresh_token = create_refresh_token(identity='user-123')
            client.set_cookie('refresh_token_cookie', refresh_token)

            response = client.post('/auth/refresh')  # no X-CSRF-TOKEN header

            assert response.status_code in (401, 422)

    def test_refresh_cookie_invalid_csrf(self, patched_app, client):
        """Test refresh with cookie but invalid CSRF header should fail."""
        with patched_app.app_context():
            refresh_token = create_refresh_token(identity='user-123')
            client.set_cookie('refresh_token_cookie', refresh_token)

            response = client.post(
                '/auth/refresh',
                headers={'X-CSRF-TOKEN': 'wrong-token'},
            )

            assert response.status_code in (401, 422)

    def test_refresh_cookie_expired_token(self, patched_app, client):
        """Test refresh with expired refresh token stored in cookie."""
        with patched_app.app_context():
            from datetime import timedelta

            from jwt import ExpiredSignatureError

            expired_refresh = create_refresh_token(
                identity='user-123',
                expires_delta=timedelta(seconds=-1),
            )
            with pytest.raises(ExpiredSignatureError):
                get_csrf_token(expired_refresh)
