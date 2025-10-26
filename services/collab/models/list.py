from dataclasses import asdict, dataclass
from typing import List

from utils.logger import get_logger

logger = get_logger(__name__)

# TODO: Migrate to constants as Enum
OWNER = 'owner'
VIEWER = 'viewer'
EDITOR = 'editor'


@dataclass
class TodoList:
    """Represents a todo list"""

    id: str
    name: str
    owner_id: str  # Owner
    is_deleted: bool = False
    created_at: str | None = None  # ISO 8601 string
    updated_at: str | None = None  # ISO 8601 string

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        return {k: v for k, v in data.items() if v is not None}

    @classmethod
    def from_dict(cls, data: dict) -> 'TodoList':
        """Create instance from dictionary"""
        valid_fields = {k: v for k, v in data.items() if k in cls.__annotations__}
        return cls(**valid_fields)


@dataclass
class ListMember:
    """Represents a user's access to a list"""

    list_id: str
    user_id: str
    role: str  # owner, editor, viewer
    created_at: str | None = None

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> 'ListMember':
        """Create instance from dictionary"""
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})


class ListRepository:
    """Repository for todo_lists table operations - DATA ACCESS ONLY"""

    def __init__(self, supabase_client):
        self.supabase = supabase_client
        self.lists_table = 'todo_lists'
        self.members_table = 'todo_list_members'

    # List table CRUD operations
    def create(self, list_dict: dict) -> dict:
        """Create a new list"""
        response = self.supabase.table(self.lists_table).insert(list_dict).execute()
        return response.data[0] if response.data else None

    def update(self, list_id: str, updates: dict) -> dict:
        """Update a list"""
        response = (
            self.supabase.table(self.lists_table)
            .update(updates)
            .eq('id', list_id)
            .execute()
        )
        return response.data[0] if response.data else None

    def delete(self, list_id: str) -> bool:
        """Soft delete a list"""
        self.supabase.table(self.lists_table).update({'is_deleted': True}).eq(
            'id', list_id
        ).execute()
        return True

    def get_by_id(self, list_id: str) -> dict | None:
        """Get list by ID"""
        response = (
            self.supabase.table(self.lists_table)
            .select('*')
            .eq('id', list_id)
            .eq('is_deleted', False)
            .execute()
        )
        return response.data[0] if response.data else None

    def get_user_owned_lists(self, user_id: str) -> List[dict]:
        """Get all lists owned by user"""
        response = (
            self.supabase.table(self.lists_table)
            .select('*')
            .eq('owner_id', user_id)  # Column name is owner_id
            .eq('is_deleted', False)
            .execute()
        )
        return response.data or []

    def get_user_shared_lists(self, user_id: str) -> List[dict]:
        """Get all lists shared to user"""
        response = (
            self.supabase.table(self.members_table)
            .select('role, todo_lists(*)')
            .eq('user_id', user_id)
            .in_('role', [VIEWER, EDITOR])
            .eq('todo_lists.is_deleted', False)
            .execute()
        )
        return [lst['todo_lists'] for lst in response.data] if response.data else []

    def get_user_accessible_lists(self, user_id: str):
        """Get all lists that user is accessible to"""
        response = (
            self.supabase.table(self.members_table)
            .select(f'role, {self.lists_table}(*)')
            .eq('user_id', user_id)
            .eq(f'{self.lists_table}.is_deleted', False)
            .execute()
        )
        if not response.data:
            return [], []
        owned = [
            TodoList.from_dict(d['todo_lists'])
            for d in response.data
            if d['role'] == OWNER
        ]
        shared = [
            TodoList.from_dict(d['todo_lists'])
            for d in response.data
            if d['role'] != OWNER
        ]
        return owned, shared

    # Member table operations (data access)
    def upsert_member(self, list_id: str, user_id: str, role: str) -> dict:
        """Add or update a member to list_members table"""
        from utils.timestamp import now_iso

        data = {
            'list_id': list_id,
            'user_id': user_id,
            'role': role,
            'created_at': now_iso(),
        }
        response = self.supabase.table(self.members_table).upsert(data).execute()
        return response.data[0] if response.data else None

    def remove_member(self, list_id: str, user_id: str) -> bool:
        """Remove a member from list_members table"""
        self.supabase.table(self.members_table).delete().eq('list_id', list_id).eq(
            'user_id', user_id
        ).execute()
        return True

    def get_member(self, list_id: str, user_id: str) -> dict | None:
        """Get member record from list_members table"""
        response = (
            self.supabase.table(self.members_table)
            .select('*')
            .eq('list_id', list_id)
            .eq('user_id', user_id)
            .execute()
        )
        return response.data[0] if response.data else None

    def get_members(self, list_id: str) -> List[dict]:
        """Get all members of a list"""
        response = (
            self.supabase.table(self.members_table)
            .select('*')
            .eq('list_id', list_id)
            .execute()
        )
        return response.data or []
