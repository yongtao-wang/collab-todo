import uuid

from core.coordinator import Coordinator
from flask import request
from flask_socketio import SocketIO
from models.item import TodoItem
from schemas.item_schema import AddItemSchema
from utils.constants import SocketEvents as se
from utils.constants import SupabaseWriterOperations as swo
from utils.logger import get_logger
from utils.timestamp import now_iso
from worker.supabase_writer import SupabaseWriter

logger = get_logger(__name__)


class ItemService:
    """
    Business logic for todo items.

    Note: Does NOT emit to socketio directly.
    Pub/Sub listener in SyncCoordinator handles broadcasting.
    """

    def __init__(
        self,
        coordinator: Coordinator,
        supabase_writer: SupabaseWriter,
        socketio: SocketIO,
    ):
        self.coordinator = coordinator
        self.supabase_writer = supabase_writer
        self.socketio = socketio

    def add_item(self, list_id: str, user_id: str, data: AddItemSchema) -> dict:
        """
        Add a new item to a list.

        Flow:
        1. Create item with server-generated timestamps
        2. Check if server has loaded L1 cache
        3. Update L1/L2 cache, Redis publishes to Pub/Sub
        4. Queue background write to Supabase
        5. Pub/Sub listener broadcasts to all servers
        """
        self.coordinator.check_and_load_list_cache(list_id)
        now = now_iso()

        # Create item
        item = TodoItem(
            id=str(uuid.uuid4()),
            list_id=list_id,
            name=data.name,
            description=data.description,
            status=data.status,
            done=data.done,
            due_date=data.due_date,
            media_url=data.media_url,
            created_at=now,
            updated_at=now,
        )

        # Update L1 + L2 cache
        self.coordinator.add_item(list_id, item.id, item.to_dict())

        # Queue L3 write (async, non-blocking)
        self.supabase_writer.queue_write(swo.ADD_ITEM, item.to_dict())

        logger.info(f"Added item {item.id} to list {list_id} by user {user_id}")
        return item.to_dict()

    def update_item(
        self, list_id: str, item_id: str, user_id: str, updates: dict, client_rev: float
    ) -> dict:
        """
        Update an existing item.

        Pub/Sub listener broadcasts to all servers.
        """
        self.coordinator.check_and_load_list_cache(list_id)
        # Get current item
        current_item, server_rev = self.coordinator.get_item_cache(list_id, item_id)
        if not current_item:
            raise ValueError(f"Item {item_id} not found")

        # TODO: Here is a major diverge, we can introduce CRDT, Operational Transform,
        #       Last Write Win or any reasonable conflict resolution strategy.
        if client_rev < server_rev:
            # Client outdated, refuse the update, send snapshot and force client to sync
            logger.debug(
                'Item %s out of sync, sending a list snapshot.\nclient rev: %s, server rev: %s',
                item_id,
                client_rev,
                server_rev,
            )
            snapshot = self.coordinator.check_and_load_list_cache(list_id)
            self.socketio.emit(se.LIST_SNAPSHOT, snapshot, to=request.sid)
            self.socketio.emit(
                se.ACTION_ERROR,
                {
                    'message': f'Item {item_id} out of sync: client rev {client_rev}, server rev {server_rev}'
                },
            )
            return

        # Merge updates
        updated_item = {
            **current_item,
            **{k: v for k, v in updates.items() if v is not None},
            'updated_at': now_iso(),
        }

        # Update L1 + L2
        self.coordinator.update_item(list_id, item_id, updated_item)

        # Queue L3 write
        self.supabase_writer.queue_write(
            swo.UPDATE_ITEM,
            {'item_id': item_id, **updates, 'updated_at': updated_item['updated_at']},
        )

        logger.info(f"Updated item {item_id} in list {list_id} by user {user_id}")
        return updated_item

    def delete_item(self, list_id: str, item_id: str, user_id: str):
        """
        Delete an item (soft delete).

        Pub/Sub listener broadcasts to all servers.
        """
        self.coordinator.check_and_load_list_cache(list_id)
        # Update L1 + L2
        self.coordinator.delete_item(list_id, item_id)

        # Queue L3 write
        self.supabase_writer.queue_write(swo.DELETE_ITEM, {'item_id': item_id})

        logger.info(f"Deleted item {item_id} from list {list_id} by user {user_id}")
