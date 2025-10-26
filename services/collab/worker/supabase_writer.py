import queue
import threading
import time
from typing import Any, Dict

from models.item import ItemRepository
from models.list import ListRepository
from utils.constants import SupabaseWriterOperations as swo
from utils.logger import get_logger

logger = get_logger(__name__)


class SupabaseWriter:
    """
    Background worker that asynchronously writes updates to Supabase.

    This decouples real-time collaboration (Redis + WebSocket) from
    persistent storage (Supabase), ensuring fast response times.

    TODO: This worker thread is optimal to be refactored into a standalone
          service, or re-built as a message queue for best scalabiltiy,
          as in current design, writer queue will be lost if the server
          goes down.
    """

    def __init__(self, supabase_client, max_queue_size=1000):
        self.supabase = supabase_client
        self.write_queue = queue.Queue(maxsize=max_queue_size)
        self.running = False
        self.worker_thread = None

        # Repositories (models layer)
        self.item_repo = ItemRepository(supabase_client)
        self.list_repo = ListRepository(supabase_client)

        # Stats
        self.writes_processed = 0
        self.writes_failed = 0

    def start(self):
        """Start the background worker thread"""
        if self.running:
            logger.warning("Worker already running")
            return

        self.running = True
        self.worker_thread = threading.Thread(
            target=self._worker_loop, name="SupabaseWriter", daemon=True
        )
        self.worker_thread.start()
        logger.info("Supabase writer started")

    def stop(self):
        """Stop the background worker thread"""
        self.running = False
        if self.worker_thread:
            self.worker_thread.join(timeout=5)
        logger.info(f"Supabase writer stopped. Stats: {self.get_stats()}")

    def queue_write(self, operation: str, data: Dict[str, Any]):
        """
        Queue a write operation.

        Args:
            operation: Type of operation ('update_item', 'add_item', 'delete_item', etc.)
            data: Data for the operation
        """
        try:
            self.write_queue.put_nowait(
                {'operation': operation, 'data': data, 'timestamp': time.time()}
            )
            logger.debug(
                f"Queued {operation}: {data.get('item_id', data.get('list_id'))}"
            )
        except queue.Full:
            logger.error(f"Write queue full! Dropping {operation}")
            # TODO: Write to dead letter queue
            self.writes_failed += 1

    def _worker_loop(self):
        """Main worker loop (runs in background thread)"""
        logger.info("Worker loop started")

        while self.running:
            try:
                # Wait for task with timeout (so we can check self.running)
                task = self.write_queue.get(timeout=1.0)

                # Process the task
                self._process_task(task)
                self.writes_processed += 1

                # Mark task as done
                self.write_queue.task_done()

            except queue.Empty:
                # No tasks, continue loop
                continue
            except Exception as e:
                logger.exception(f"Error in worker loop: {e}")
                # TODO: Write to dead letter queue
                self.writes_failed += 1

        logger.info("Worker loop stopped")

    def _process_task(self, task: Dict[str, Any]):
        """Process a single write task"""
        operation = task['operation']
        data = task['data']

        try:
            if operation == swo.UPDATE_ITEM:
                self._update_item(data)
            elif operation == swo.ADD_ITEM:
                self._add_item(data)
            elif operation == swo.DELETE_ITEM:
                self._delete_item(data)
            elif operation == swo.UPDATE_LIST:
                self._update_list(data)
            elif operation == swo.CREATE_LIST:
                self._create_list(data)
            elif operation == swo.ADD_OR_UPDATE_MEMBER:
                self._upsert_list_member(data)
            elif operation == swo.REMOVE_MEMBER:
                self._remove_list_member(data)
            else:
                logger.warning(f"Unknown operation: {operation}")

        except Exception as e:
            logger.error(f"Failed to process {operation}: {e}")
            # TODO: Write to dead letter queue
            self.writes_failed += 1

    def _update_item(self, data: Dict[str, Any]):
        """Write item update to Supabase"""
        item_id = data['item_id']
        updates = {
            'name': data.get('name'),
            'description': data.get('description'),
            'status': data.get('status'),
            'done': data.get('done'),
            'due_date': data.get('due_date'),
            'media_url': data.get('media_url'),
            'created_at': data.get('created_at'),
            'updated_at': data.get('updated_at'),
        }

        # Remove None values
        updates = {k: v for k, v in updates.items() if v is not None}

        self.item_repo.update(item_id, updates)
        logger.debug(f"Updated item {item_id} in Supabase")

    def _add_item(self, data: Dict[str, Any]):
        """Write new item to Supabase"""
        self.item_repo.create(data)
        logger.debug(f"Created item {data.get('id')} in Supabase")

    def _delete_item(self, data: Dict[str, Any]):
        """Delete item from Supabase"""
        item_id = data['item_id']
        self.item_repo.delete(item_id, soft_delete=True)
        logger.debug(f"Deleted item {item_id} from Supabase")

    def _update_list(self, data: Dict[str, Any]):
        """Write list update to Supabase"""
        list_id = data['list_id']
        updates = {'name': data.get('name'), 'description': data.get('description')}
        updates = {k: v for k, v in updates.items() if v is not None}

        self.list_repo.update(list_id, updates)
        logger.debug(f"Updated list {list_id} in Supabase")

    def _create_list(self, data: Dict[str, Any]):
        """Write new list to Supabase"""
        self.list_repo.create(data)
        logger.debug(f"Created list {data['id']} in Supabase")

    def _upsert_list_member(self, data):
        """Insert or update membership to Supabase"""
        self.list_repo.upsert_member(data['list_id'], data['user_id'], data['role'])
        logger.debug(
            'Updated membership for user %s as role %s, to list %s',
            data['user_id'],
            data['role'],
            data['list_id'],
        )

    def _remove_list_member(self, data):
        """Remove member from Supabase"""
        self.list_repo.remove_member(data['list_id'], data['user_id'])
        logger.debug("Removed member %s from list %s", data['user_id'], data['list_id'])

    def get_stats(self) -> Dict[str, Any]:
        """Get worker statistics"""
        return {
            'running': self.running,
            'queue_size': self.write_queue.qsize(),
            'writes_processed': self.writes_processed,
            'writes_failed': self.writes_failed,
        }
