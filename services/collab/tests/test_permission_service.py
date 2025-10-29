# tests/test_permission_service.py
from unittest.mock import Mock, patch

import pytest
from services.permission_service import PermissionService


@pytest.fixture
def mock_list_repo():
    return Mock()


@pytest.fixture
def permission_service(mock_list_repo):
    return PermissionService(mock_list_repo)


class TestPermissionService:
    def test_get_user_permission_owner(self, permission_service, mock_list_repo):
        """Test getting owner permission"""
        list_id = 'list-123'
        user_id = 'user-456'

        mock_list_repo.get_member.return_value = {'role': 'owner', 'user_id': user_id}

        result = permission_service.get_user_permission(list_id, user_id)

        assert result == 'owner'
        mock_list_repo.get_member.assert_called_once_with(list_id, user_id)

    def test_get_user_permission_none(self, permission_service, mock_list_repo):
        """Test getting permission for non-member"""
        list_id = 'list-123'
        user_id = 'user-456'

        mock_list_repo.get_member.return_value = None

        result = permission_service.get_user_permission(list_id, user_id)

        assert result is None

    def test_can_view_with_permission(self, permission_service, mock_list_repo):
        """Test can_view returns True for members"""
        list_id = 'list-123'
        user_id = 'user-456'

        mock_list_repo.get_member.return_value = {'role': 'viewer'}

        result = permission_service.can_view(list_id, user_id)

        assert result is True

    def test_can_view_without_permission(self, permission_service, mock_list_repo):
        """Test can_view returns False for non-members"""
        list_id = 'list-123'
        user_id = 'user-456'

        mock_list_repo.get_member.return_value = None

        result = permission_service.can_view(list_id, user_id)

        assert result is False

    def test_can_edit_as_owner(self, permission_service, mock_list_repo):
        """Test can_edit returns True for owner"""
        list_id = 'list-123'
        user_id = 'user-456'

        mock_list_repo.get_member.return_value = {'role': 'owner'}

        with patch('services.permission_service.UserRole') as mock_user_role:
            mock_user_role.can_edit.return_value = True

            result = permission_service.can_edit(list_id, user_id)

            assert result is True

    def test_can_edit_as_viewer(self, permission_service, mock_list_repo):
        """Test can_edit returns False for viewer"""
        list_id = 'list-123'
        user_id = 'user-456'

        mock_list_repo.get_member.return_value = {'role': 'viewer'}

        with patch('services.permission_service.UserRole') as mock_user_role:
            mock_user_role.can_edit.return_value = False

            result = permission_service.can_edit(list_id, user_id)

            assert result is False

    def test_require_edit_permission_success(self, permission_service, mock_list_repo):
        """Test require_edit_permission passes for editor"""
        list_id = 'list-123'
        user_id = 'user-456'

        mock_list_repo.get_member.return_value = {'role': 'editor'}

        with patch('services.permission_service.UserRole') as mock_user_role:
            mock_user_role.can_edit.return_value = True

            # Should not raise
            permission_service.require_edit_permission(list_id, user_id)

    def test_require_edit_permission_fails(self, permission_service, mock_list_repo):
        """Test require_edit_permission raises for non-editor"""
        list_id = 'list-123'
        user_id = 'user-456'

        mock_list_repo.get_member.return_value = None

        with pytest.raises(PermissionError, match='cannot edit'):
            permission_service.require_edit_permission(list_id, user_id)

    def test_require_view_permission_success(self, permission_service, mock_list_repo):
        """Test require_view_permission passes for member"""
        list_id = 'list-123'
        user_id = 'user-456'

        mock_list_repo.get_member.return_value = {'role': 'viewer'}

        # Should not raise
        permission_service.require_view_permission(list_id, user_id)

    def test_require_view_permission_fails(self, permission_service, mock_list_repo):
        """Test require_view_permission raises for non-member"""
        list_id = 'list-123'
        user_id = 'user-456'

        mock_list_repo.get_member.return_value = None

        with pytest.raises(PermissionError, match='cannot view'):
            permission_service.require_view_permission(list_id, user_id)
