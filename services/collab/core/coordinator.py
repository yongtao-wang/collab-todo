# core/coordinator.py
import json
import time
from typing import Dict, Optional, Tuple

from core.state_manager import StateManager
from flask import request
from flask_socketio import SocketIO
from models.item import ItemRepository
from models.list import ListRepository
from redis import Redis
from utils.constants import SocketEvents as se
from utils.logger import get_logger

logger = get_logger(__name__)


class Coordinator:

    def __init__(
        self,
        redis_client: Redis,
        state_manager: StateManager,
        item_repo: ItemRepository,
        list_repo: ListRepository,
        socketio: SocketIO,
    ):
        self.redis = redis_client
        self.state_manager = state_manager
        self.item_repo = item_repo
        self.list_repo = list_repo
        self.socketio = socketio

        self.lua_scripts = self._load_lua_scripts()

    def _load_lua_scripts(self) -> Dict[str, str]:
        """Load and register Lua scripts with Redis"""
        add_item_script = """
        local list_key = KEYS[1]
        local item_id = ARGV[1]
        local item_data = ARGV[2]
        
        local time_parts = redis.call('TIME')
        local new_rev = tonumber(time_parts[1]) + tonumber(time_parts[2]) / 1000000
        
        local items_json = redis.call('HGET', list_key, 'items')
        local items = {}
        if items_json then
            items = cjson.decode(items_json)
        end
        
        items[item_id] = cjson.decode(item_data)
        
        redis.call('HMSET', list_key, 
            'rev', new_rev,
            'items', cjson.encode(items),
            'updated_at', time_parts[1]
        )
        
        local list_id = string.match(list_key, 'todo:state:(.+)')
        local message = cjson.encode({
            type = 'item_added',
            list_id = list_id,
            item = cjson.decode(item_data),
            rev = new_rev
        })
        redis.call('PUBLISH', 'todo:updates', message)
        
        return new_rev
        """

        update_item_script = """
        local list_key = KEYS[1]
        local item_id = ARGV[1]
        local item_data = ARGV[2]
        
        local time_parts = redis.call('TIME')
        local new_rev = tonumber(time_parts[1]) + tonumber(time_parts[2]) / 1000000
        
        local items_json = redis.call('HGET', list_key, 'items')
        if not items_json then
            return redis.error_reply('List not found')
        end
        
        local items = cjson.decode(items_json)
        if not items[item_id] then
            return redis.error_reply('Item not found')
        end
        
        items[item_id] = cjson.decode(item_data)
        
        redis.call('HMSET', list_key,
            'rev', new_rev,
            'items', cjson.encode(items),
            'updated_at', time_parts[1]
        )
        
        local list_id = string.match(list_key, 'todo:state:(.+)')
        local message = cjson.encode({
            type = 'item_updated',
            list_id = list_id,
            item = cjson.decode(item_data),
            rev = new_rev
        })
        redis.call('PUBLISH', 'todo:updates', message)
        
        return new_rev
        """

        delete_item_script = """
        local list_key = KEYS[1]
        local item_id = ARGV[1]
        
        local time_parts = redis.call('TIME')
        local new_rev = tonumber(time_parts[1]) + tonumber(time_parts[2]) / 1000000
        
        local items_json = redis.call('HGET', list_key, 'items')
        if not items_json then
            return redis.error_reply('List not found')
        end
        
        local items = cjson.decode(items_json)
        if not items[item_id] then
            return redis.error_reply('Item not found')
        end
        
        -- Hard delete from Redis, soft delete in Supabase
        items[item_id] = cjson.null
        
        redis.call('HMSET', list_key,
            'rev', new_rev,
            'items', cjson.encode(items),
            'updated_at', time_parts[1]
        )
        
        local list_id = string.match(list_key, 'todo:state:(.+)')
        local message = cjson.encode({
            type = 'item_deleted',
            list_id = list_id,
            item_id = item_id,
            rev = new_rev
        })
        redis.call('PUBLISH', 'todo:updates', message)
        
        return new_rev
        """

        return {
            'add_item': self.redis.register_script(add_item_script),
            'update_item': self.redis.register_script(update_item_script),
            'delete_item': self.redis.register_script(delete_item_script),
        }

    def check_and_load_list_cache(self, list_id: str) -> dict:
        """Check if list exists in L1, load from L2/L3 if not"""
        if self.state_manager.has_list(list_id):
            return self.state_manager.get_list_state(list_id)

        return self._load_from_redis(list_id)

    def get_item_cache(
        self, list_id: str, item_id: str
    ) -> Tuple[Optional[dict], float]:
        """Get item from cache, returns (item, revision)"""
        state = self.check_and_load_list_cache(list_id)
        item = state['items'].get(item_id)
        return item, state.get('rev', None)

    def add_item(self, list_id: str, item_id: str, item_data: dict) -> float:
        """Add item via Redis Lua script (atomic)"""
        redis_key = f'todo:state:{list_id}'

        try:
            new_rev = self.lua_scripts['add_item'](
                keys=[redis_key], args=[item_id, json.dumps(item_data)]
            )

            self.state_manager.add_item_state(list_id, item_id, item_data)
            self.state_manager.set_revision(list_id, float(new_rev))

            logger.info(
                'Added item %s to list %s, new rev: %s', item_id, list_id, new_rev
            )
            return float(new_rev)

        except Exception as e:
            logger.error('Error adding item %s to list %s: %s', item_id, list_id, e)
            raise

    def update_item(self, list_id: str, item_id: str, item_data: dict) -> float:
        """Update item via Redis Lua script (atomic)"""
        redis_key = f'todo:state:{list_id}'

        try:
            new_rev = self.lua_scripts['update_item'](
                keys=[redis_key], args=[item_id, json.dumps(item_data)]
            )

            self.state_manager.update_item_state(list_id, item_id, item_data)
            self.state_manager.set_revision(list_id, float(new_rev))

            logger.info(
                'Updated item %s in list %s, new rev: %s', item_id, list_id, new_rev
            )
            return float(new_rev)

        except Exception as e:
            logger.error(
                'Error updating item %s in list %s: %s', item_id, list_id, str(e)
            )
            raise

    def delete_item(self, list_id: str, item_id: str) -> float:
        """Delete item via Redis Lua script (atomic, soft delete)"""
        redis_key = f'todo:state:{list_id}'

        try:
            new_rev = self.lua_scripts['delete_item'](keys=[redis_key], args=[item_id])

            self.state_manager.delete_item_state(list_id, item_id)
            self.state_manager.set_revision(list_id, float(new_rev))

            logger.info(
                'Deleted item %s from list %s, new rev: %s', item_id, list_id, new_rev
            )
            return float(new_rev)

        except Exception as e:
            logger.error('Error deleting item %s from list %s: %s', item_id, list_id, e)
            raise

    def init_list_cache(self, list_id: str, list_name: str, owner_id: str) -> float:
        """Initialize new list in L1 + L2 cache"""
        redis_key = f'todo:state:{list_id}'
        ts = time.time()

        initial_state = {
            'rev': ts,
            'list_name': list_name,
            'owner_id': owner_id,
            'items': {},
            'created_at': ts,
        }

        self.redis.hmset(
            redis_key,
            {
                'rev': initial_state['rev'],
                'list_name': list_name,
                'owner_id': owner_id,
                'items': json.dumps({}),
                'created_at': initial_state['created_at'],
            },
        )

        self.state_manager.set_list_state(list_id, initial_state)

        logger.info('Initialized list %s in cache', list_id)
        return ts

    def _load_from_redis(self, list_id: str) -> dict:
        """Load list from L2 (Redis) into L1 cache"""
        redis_key = f'todo:state:{list_id}'
        data = self.redis.hgetall(redis_key)

        if not data:
            logger.debug(
                f'[LOAD_REDIS] Redis L2 cache miss for list {list_id}, falling back to L3'
            )
            return self._load_from_database(list_id)

        state = {
            'rev': float(data.get(b'rev', 0)),
            'list_name': data.get(b'list_name', b'').decode('utf-8'),
            'owner_id': data.get(b'owner_id', b'').decode('utf-8'),
            'items': json.loads(data.get(b'items', b'{}').decode('utf-8')),
        }

        self.state_manager.set_list_state(list_id, state)

        logger.info(
            f'Loaded list {list_id} from Redis into L1 cache '
            f'(rev={state["rev"]}, items_count={len(state["items"])})'
        )
        return state

    def _load_from_database(self, list_id: str) -> dict:
        """Cold start: Load from L3 (Supabase) into L1 + L2"""
        logger.info('Cold start: Loading list %s from database', list_id)

        list_data = self.list_repo.get_by_id(list_id)
        if not list_data:
            raise ValueError(f'List {list_id} not found')

        items = self.item_repo.get_by_list_id(list_id)

        items_dict = {item.id: item.to_dict() for item in items}
        state = {
            'rev': time.time(),
            'list_name': list_data['name'],
            'owner_id': list_data['owner_id'],
            'items': items_dict,
        }

        redis_key = f'todo:state:{list_id}'
        self.redis.hmset(
            redis_key,
            {
                'rev': state['rev'],
                'list_name': state['list_name'],
                'owner_id': state['owner_id'],
                'items': json.dumps(items_dict),
            },
        )

        self.state_manager.set_list_state(list_id, state)

        logger.info('Loaded list %s from database into cache', list_id)
        return state
