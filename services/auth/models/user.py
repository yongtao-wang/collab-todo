from dataclasses import dataclass
from typing import Optional

from supabase import Client


@dataclass
class User:
    """User model"""

    id: str
    email: str
    name: str
    encrypted_password: str


class UserRepository:
    def __init__(self, supabase_client: Client):
        self.db = supabase_client

    def find_by_email(self, email: str) -> Optional[User]:
        """Find user by email address."""
        res = self.db.table('users').select('*').eq('email', email).execute()
        if not res.data:
            return None
        data = res.data[0]
        return User(
            id=data['id'],
            email=data['email'],
            name=data.get('name', ''),
            encrypted_password=data['encrypted_password'],
        )

    def create(self, email: str, encrypted_password: str, name: str) -> str:
        """Create a new user."""
        user = {'email': email, 'encrypted_password': encrypted_password, 'name': name}
        res = self.db.table('users').insert(user).execute()
        return res.data[0]['id']

    def find_by_id(self, user_id: str) -> Optional[User]:
        """Find user by ID."""
        res = self.db.table('users').select('*').eq('id', user_id).execute()
        if not res.data:
            return None
        data = res.data[0]
        return User(
            id=data['id'],
            email=data['email'],
            name=data.get('name', ''),
            encrypted_password=data['encrypted_password'],
        )
