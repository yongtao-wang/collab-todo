import os
from enum import Enum

# Set to the parent folder of current file
LOG_DIR = os.path.dirname(os.path.abspath(os.path.join(__file__, os.pardir)))

# Redis key patterns
REDIS_STATE_KEY = 'todo:state:{list_id}'
REDIS_EPOCH_KEY = 'todo:server_epoch'


# Socket error message
class ErrorMessage:
    """Error messages for collaboration service"""

    UNAUTHORIZED = 'Unauthorized access'
    LIST_NOT_FOUND = 'List not found'
    PERMISSION_DENIED = 'Permission denied'
    INVALID_DATA = 'Invalid data provided'
    OUT_OF_SYNC = 'List/item out of sync'


# Socket events (matching your client-side constants)
class SocketEvents:
    """Socket.IO event names"""

    # Connection events
    CONNECT = 'connect'
    DISCONNECT = 'disconnect'

    # Incoming events
    JOIN = 'join'
    JOIN_LIST = 'join_list'
    CREATE_LIST = 'create_list'
    ADD_ITEM = 'add_item'
    UPDATE_ITEM = 'update_item'
    DELETE_ITEM = 'delete_item'
    SHARE_LIST = 'share_list'

    # Outgoing events
    LIST_SNAPSHOT = 'list_snapshot'
    LIST_SYNCED = 'list_synced'
    LIST_CREATED = 'list_created'
    LIST_SHARE_SUCCESS = 'list_share_success'
    LIST_SHARED_WITH_YOU = 'list_shared_with_you'

    # Redis Pub/Sub events
    ITEM_ADDED = 'item_added'
    ITEM_UPDATED = 'item_updated'
    ITEM_DELETED = 'item_deleted'

    # Error events
    ERROR = 'error'
    ACTION_ERROR = 'action_error'
    PERMISSION_ERROR = 'permission_error'
    AUTH_ERROR = 'auth_error'


# Supabase async writer operations
class SupabaseWriterOperations:
    UPDATE_ITEM = 'update_item'
    ADD_ITEM = 'add_item'
    DELETE_ITEM = 'delete_item'
    UPDATE_LIST = 'update_list'
    CREATE_LIST = 'create_list'
    ADD_OR_UPDATE_MEMBER = 'upsert_member'
    REMOVE_MEMBER = 'remove_member'


class RegexLiteral:
    ROLE_REGEX = r'^(owner|editor|viewer)$'
    STATUS_REGEX = r'^(not_started|in_progress|completed)$'


# User roles
class UserRole(Enum):
    OWNER = 'owner'
    EDITOR = 'editor'
    VIEWER = 'viewer'

    @classmethod
    def can_edit(cls, role: str) -> bool:
        """Check if role has edit permissions"""
        return role in [cls.OWNER.value, cls.EDITOR.value]

    @classmethod
    def get_highest_role(cls, roles: list[str]) -> str:
        """Get highest role from a list"""
        if cls.OWNER.value in roles:
            return cls.OWNER.value
        if cls.EDITOR.value in roles:
            return cls.EDITOR.value
        if cls.VIEWER.value in roles:
            return cls.VIEWER.value
        return ''
