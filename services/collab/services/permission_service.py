from models.list import ListRepository
from utils.constants import UserRole
from utils.logger import get_logger

logger = get_logger(__name__)


class PermissionService:
    """Handles permission checks and business rules"""

    def __init__(self, list_repository: ListRepository):
        self.list_repo = list_repository

    def get_user_permission(self, list_id: str, user_id: str) -> str | None:
        """
        Get user's permission role for a list.

        Args:
            list_id (str): The ID of the list.
            user_id (str): The ID of the user.
        Returns:
            'owner', 'editor', 'viewer', or None
        """
        member = self.list_repo.get_member(list_id, user_id)
        return member['role'] if member else None

    def can_view(self, list_id: str, user_id: str) -> bool:
        """Check if a user can view this list or items in the list"""
        permission = self.get_user_permission(list_id, user_id)
        return True if permission else False

    def can_edit(self, list_id: str, user_id: str) -> bool:
        """Check if user can edit this list or items in the list"""
        permission = self.get_user_permission(list_id, user_id)
        return UserRole.can_edit(permission) if permission else False

    def require_edit_permission(self, list_id: str, user_id: str):
        """Raise error if user cannot edit list or items in the list"""
        if not self.can_edit(list_id, user_id):
            raise PermissionError(f'User {user_id} cannot edit list {list_id}')

    def require_view_permission(self, list_id: str, user_id: str):
        """Raise error if user does not have view accessibility to a list"""
        if not self.can_view(list_id, user_id):
            raise PermissionError(f'User {user_id} cannot view list {list_id}')
