# tests/test_lua_scripts.py
import json
import time
from pathlib import Path

import pytest
from redis import Redis


# TODO: Improve test isolation
# 1. PubSubListener mock doesn't prevent real listener from processing DB 15 events
#    - Solution: Use separate Redis instance for tests (Docker container)
#    - Or: Add environment check in PubSubListener to skip in test mode
# 2. fakeredis doesn't support TIME command, can't use for Lua script tests
#    - Alternative: Mock TIME in Lua scripts for deterministic testing
# 3. Current workaround: Use DB 15 with caution, ensure no production data there


@pytest.fixture
def redis_client():
    """Provide a Redis client for testing. Skip test if Redis unavailable"""
    try:
        client = Redis.from_url('redis://localhost:6379/15')
        client.ping()
        yield client
        client.flushdb()
        client.close()
    except Exception:
        pytest.skip("Redis not available")


@pytest.fixture
def lua_scripts(redis_client):
    """Load and register Lua scripts"""
    script_dir = Path(__file__).parent.parent / 'core' / 'lua_scripts'

    scripts = {}
    for script_name in ['add_item', 'update_item', 'delete_item']:
        script_path = script_dir / f'{script_name}.lua'
        with open(script_path, 'r') as f:
            scripts[script_name] = redis_client.register_script(f.read())

    return scripts


@pytest.fixture
def sample_list(redis_client):
    """Create a sample list in Redis"""
    list_id = 'test-list-123'
    list_key = f'todo:state:{list_id}'

    redis_client.hset(
        list_key,
        mapping={
            'rev': time.time(),
            'list_name': 'Test List',
            'owner_id': 'user-123',
            'items': json.dumps({}),
            'created_at': time.time(),
        },
    )

    return list_id, list_key


class TestAddItemScript:
    def test_add_item_to_empty_list(self, redis_client, lua_scripts, sample_list):
        """Test adding an item to an empty list"""
        list_id, list_key = sample_list

        item_id = 'item-1'
        item_data = {
            'id': item_id,
            'name': 'Test Item',
            'done': False,
            'list_id': list_id,
        }

        # Execute Lua script
        new_rev = lua_scripts['add_item'](
            keys=[list_key], args=[item_id, json.dumps(item_data)]
        )

        # Verify revision was updated
        assert new_rev is not None
        assert float(new_rev) > 0

        # Verify item was added
        items_json = redis_client.hget(list_key, 'items')
        items = json.loads(items_json)
        assert item_id in items
        assert items[item_id]['name'] == 'Test Item'
        assert items[item_id]['done'] is False

    def test_add_multiple_items(self, redis_client, lua_scripts, sample_list):
        """Test adding multiple items"""
        list_id, list_key = sample_list

        items_to_add = [
            {'id': 'item-1', 'name': 'Item 1', 'done': False},
            {'id': 'item-2', 'name': 'Item 2', 'done': True},
        ]

        for item_data in items_to_add:
            lua_scripts['add_item'](
                keys=[list_key], args=[item_data['id'], json.dumps(item_data)]
            )

        # Verify all items were added
        items_json = redis_client.hget(list_key, 'items')
        items = json.loads(items_json)
        assert len(items) == 2
        assert 'item-1' in items
        assert 'item-2' in items


class TestUpdateItemScript:
    def test_update_existing_item(self, redis_client, lua_scripts, sample_list):
        """Test updating an existing item"""
        list_id, list_key = sample_list

        # First add an item
        item_id = 'item-1'
        initial_data = {'id': item_id, 'name': 'Initial', 'done': False}
        lua_scripts['add_item'](
            keys=[list_key], args=[item_id, json.dumps(initial_data)]
        )

        # Update the item
        updated_data = {'id': item_id, 'name': 'Updated', 'done': True}
        new_rev = lua_scripts['update_item'](
            keys=[list_key], args=[item_id, json.dumps(updated_data)]
        )

        # Verify item was updated
        items_json = redis_client.hget(list_key, 'items')
        items = json.loads(items_json)
        assert items[item_id]['name'] == 'Updated'
        assert items[item_id]['done'] is True
        assert float(new_rev) > 0

    def test_update_nonexistent_item_fails(
        self, redis_client, lua_scripts, sample_list
    ):
        """Test updating a nonexistent item returns error"""
        list_id, list_key = sample_list

        item_data = {'id': 'nonexistent', 'name': 'Test', 'done': False}

        with pytest.raises(Exception) as exc_info:
            lua_scripts['update_item'](
                keys=[list_key], args=['nonexistent', json.dumps(item_data)]
            )

        assert 'Item not found' in str(exc_info.value)

    def test_update_item_in_nonexistent_list_fails(self, redis_client, lua_scripts):
        """Test updating item in nonexistent list returns error"""
        list_key = 'todo:state:nonexistent-list'
        item_data = {'id': 'item-1', 'name': 'Test', 'done': False}

        with pytest.raises(Exception) as exc_info:
            lua_scripts['update_item'](
                keys=[list_key], args=['item-1', json.dumps(item_data)]
            )

        assert 'List not found' in str(exc_info.value)


class TestDeleteItemScript:
    def test_delete_existing_item(self, redis_client, lua_scripts, sample_list):
        """Test deleting an existing item"""
        list_id, list_key = sample_list

        # First add an item
        item_id = 'item-1'
        item_data = {'id': item_id, 'name': 'To Delete', 'done': False}
        lua_scripts['add_item'](keys=[list_key], args=[item_id, json.dumps(item_data)])

        # Delete the item
        new_rev = lua_scripts['delete_item'](keys=[list_key], args=[item_id])

        # Verify item was deleted (set to null)
        items_json = redis_client.hget(list_key, 'items')
        items = json.loads(items_json)
        assert items[item_id] is None  # cjson.null becomes Python None
        assert float(new_rev) > 0

    def test_delete_nonexistent_item_fails(
        self, redis_client, lua_scripts, sample_list
    ):
        """Test deleting a nonexistent item returns error"""
        list_id, list_key = sample_list

        with pytest.raises(Exception) as exc_info:
            lua_scripts['delete_item'](keys=[list_key], args=['nonexistent'])

        assert 'Item not found' in str(exc_info.value)

    def test_delete_item_updates_revision(self, redis_client, lua_scripts, sample_list):
        """Test that deletion updates the revision"""
        list_id, list_key = sample_list

        # Add and then delete an item
        item_id = 'item-1'
        item_data = {'id': item_id, 'name': 'Test', 'done': False}
        lua_scripts['add_item'](keys=[list_key], args=[item_id, json.dumps(item_data)])

        old_rev = float(redis_client.hget(list_key, 'rev'))

        # Delete the item
        new_rev = lua_scripts['delete_item'](keys=[list_key], args=[item_id])

        assert float(new_rev) > old_rev


class TestScriptAtomicity:
    def test_revision_monotonically_increases(
        self, redis_client, lua_scripts, sample_list
    ):
        """Test that revisions always increase"""
        list_id, list_key = sample_list

        revisions = []

        # Add items
        for i in range(5):
            item_data = {'id': f'item-{i}', 'name': f'Item {i}', 'done': False}
            rev = lua_scripts['add_item'](
                keys=[list_key], args=[f'item-{i}', json.dumps(item_data)]
            )
            revisions.append(float(rev))

        # Verify revisions are strictly increasing
        for i in range(1, len(revisions)):
            assert revisions[i] > revisions[i - 1]
