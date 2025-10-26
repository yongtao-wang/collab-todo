from dataclasses import asdict, dataclass
from typing import Any, Dict, List

from supabase import Client
from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class TodoItem:
    id: str
    list_id: str
    name: str
    description: str = ""
    status: str = "not_started"
    done: bool = False
    due_date: str | None = None
    media_url: str | None = None
    created_at: str | None = None
    updated_at: str | None = None

    def to_dict(self) -> dict:
        """Convert to dict for JSON serialization (WebSocket/Redis)"""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> 'TodoItem':
        """Create from dict (Redis/handler data)"""
        return cls(**{k: v for k, v in data.items() if k in cls.__annotations__})


class ItemRepository:
    """Repository for todo_items table operations"""

    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
        self.table_name = 'todo_items'

    def create(self, item: TodoItem) -> TodoItem:
        """Create a new item in Supabase."""
        try:
            response = self.supabase.table(self.table_name).insert(item).execute()

            if not response.data:
                raise ValueError("No data returned from Supabase")

            logger.info(f"Created item: {item['id']}")
            return TodoItem.from_dict(response.data[0])

        except Exception as e:
            logger.error("Failed to create item %s: %s", item.id, e)
            raise

    def update(self, item_id: str, updates: Dict[str, Any]) -> TodoItem | None:
        """Update an existing item."""
        try:
            # Remove None values
            updates = {k: v for k, v in updates.items() if v is not None}

            response = (
                self.supabase.table(self.table_name)
                .update(updates)
                .eq('id', item_id)
                .execute()
            )

            if not response.data:
                logger.warning("Item not found: %s", item_id)
                return None

            logger.info("Updated item: %s", item_id)
            return TodoItem.from_dict(response.data[0])

        except Exception as e:
            logger.error("Failed to update item %s: %s", item_id, e)
            raise

    def delete(self, item_id: str, soft_delete: bool = True) -> bool:
        """Delete an item."""
        try:
            if soft_delete:
                # Soft delete: mark as deleted
                response = (
                    self.supabase.table(self.table_name)
                    .update({'is_deleted': True})
                    .eq('id', item_id)
                    .execute()
                )
            else:
                # Hard delete: remove from database
                response = (
                    self.supabase.table(self.table_name)
                    .delete()
                    .eq('id', item_id)
                    .execute()
                )

            if not response.data:
                logger.warning("Item not deleted %s", item_id)

            logger.info("Deleted item: %s (soft=%s)", item_id, soft_delete)
            return True

        except Exception as e:
            logger.error("Failed to delete item %s: %s", item_id, e)
            raise

    def get_by_id(self, item_id: str) -> TodoItem | None:
        """Get item by ID."""
        try:
            response = (
                self.supabase.table(self.table_name)
                .select('*')
                .eq('id', item_id)
                .eq('is_deleted', False)
                .execute()
            )

            if not response.data:
                return None

            return TodoItem.from_dict(response.data[0])

        except Exception as e:
            logger.error("Failed to get item %s: %s", item_id, e)
            raise

    def get_by_list_id(
        self, list_id: str, include_deleted: bool = False
    ) -> List[TodoItem]:
        """Get all items in a list."""
        try:
            query = (
                self.supabase.table(self.table_name).select('*').eq('list_id', list_id)
            )

            if not include_deleted:
                query = query.eq('is_deleted', False)

            response = query.execute()

            items = [TodoItem.from_dict(d) for d in response.data]
            logger.debug(f"Fetched {len(items)} items for list {list_id}")
            return items

        except Exception as e:
            logger.error(f"Failed to get items for list {list_id}: {e}")
            raise

    def bulk_create(self, items: List[TodoItem]) -> List[TodoItem]:
        """Create multiple items in one transaction."""
        try:
            data = [item.to_dict() for item in items]
            response = self.supabase.table(self.table_name).insert(data).execute()

            logger.info(f"Bulk created {len(items)} items")
            return [TodoItem.from_dict(d) for d in response.data]

        except Exception as e:
            logger.error(f"Failed to bulk create items: {e}")
            raise

    def get_by_status(self, list_id: str, status: str) -> List[TodoItem]:
        """Get items by status."""
        try:
            response = (
                self.supabase.table(self.table_name)
                .select('*')
                .eq('list_id', list_id)
                .eq('status', status)
                .eq('is_deleted', False)
                .execute()
            )

            return [TodoItem.from_dict(data) for data in response.data]

        except Exception as e:
            logger.error(f"Failed to get items by status: {e}")
            raise
