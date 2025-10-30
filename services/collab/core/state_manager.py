from typing import Dict

from utils.logger import get_logger

logger = get_logger(__name__)


class ConnectionManager:
    def __init__(self):
        self._pool: Dict[str, str] = {}

    def add_connection(self, sid: str, user_id: str):
        """Register a new authenticated connection"""
        self._pool[sid] = user_id
        logger.debug('New connection added to pool, sid=%s, user=%s', sid, user_id)

    def remove_connection(self, sid: str):
        """Remove a connection"""
        self._pool.pop(sid, None)

    def get_user_id(self, sid: str) -> str | None:
        """Get user_id for an active connection"""
        return self._pool.get(sid)

    def get_stats(self) -> dict:
        """Get connection statistics"""
        return {
            'total_connections': len(self._pool),
            'unique_users': len(set(self._pool.values()))
        }

    def get_all_connections(self) -> dict:
        """Get all active connections"""
        return self._pool


class StateManager:
    """L1 cache manager"""

    def __init__(self):
        self.state: Dict[str, dict] = {}

    def has_list(self, list_id: str) -> bool:
        return list_id in self.state

    def get_list_state(self, list_id: str) -> dict:
        _state = self.state.get(list_id, {})
        _state['list_id'] = list_id
        return _state

    def set_list_state(self, list_id: str, state: dict):
        self.state[list_id] = state

    def set_revision(self, list_id: str, rev: float):
        if list_id in self.state:
            self.state[list_id]['rev'] = rev

    def add_item_state(self, list_id: str, item_id: str, item_data: dict):
        if list_id in self.state:
            self.state[list_id]['items'][item_id] = item_data

    def update_item_state(self, list_id: str, item_id: str, item_data: dict):
        if list_id in self.state and item_id in self.state[list_id]['items']:
            self.state[list_id]['items'][item_id].update(item_data)

    def delete_item_state(self, list_id: str, item_id: str):
        if list_id in self.state and item_id in self.state[list_id]['items']:
            del self.state[list_id]['items'][item_id]

    def flush_all(self):
        count = len(self.state)
        self.state.clear()
        logger.info('Flushed all cached states (%d lists)', count)
