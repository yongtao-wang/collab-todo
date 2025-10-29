# tests/test_item_service.py
from unittest.mock import Mock, patch

import pytest
from flask import Flask
from schemas.item_schema import AddItemSchema
from services.item_service import ItemService
from utils.constants import SocketEvents as se
from utils.constants import SupabaseWriterOperations as swo


@pytest.fixture(scope="module")
def app():
    return Flask(__name__)


@pytest.fixture
def mock_coordinator():
    return Mock()


@pytest.fixture
def mock_supabase_writer():
    return Mock()


@pytest.fixture
def mock_socketio():
    return Mock()


@pytest.fixture
def item_service(mock_coordinator, mock_supabase_writer, mock_socketio):
    return ItemService(
        coordinator=mock_coordinator,
        supabase_writer=mock_supabase_writer,
        socketio=mock_socketio,
    )


class TestItemService:
    def test_add_item(self, item_service, mock_coordinator, mock_supabase_writer):
        """Test adding a new item"""
        list_id = 'list-123'
        user_id = 'user-456'
        data = AddItemSchema(
            list_id=list_id,
            name='Test Item',
            description='Test Description',
            status='not_started',
            done=False,
            due_date=None,
            media_url=None,
        )

        # Setup mock
        mock_coordinator.check_and_load_list_cache.return_value = {'items': {}}
        mock_coordinator.add_item.return_value = 1.0

        # Execute
        result = item_service.add_item(list_id, user_id, data)

        # Verify
        assert result['name'] == 'Test Item'
        assert result['description'] == 'Test Description'
        assert result['list_id'] == list_id
        assert 'id' in result
        assert 'created_at' in result

        # Verify coordinator was called
        mock_coordinator.check_and_load_list_cache.assert_called_once_with(list_id)
        mock_coordinator.add_item.assert_called_once()

        # Verify supabase writer was called
        mock_supabase_writer.queue_write.assert_called_once()
        call_args = mock_supabase_writer.queue_write.call_args
        assert call_args[0][0] == swo.ADD_ITEM

    def test_update_item_success(self, item_service, mock_coordinator, mock_socketio):
        """Test updating an item with valid revision"""
        list_id = 'list-123'
        item_id = 'item-456'
        user_id = 'user-789'
        client_rev = 2.0

        current_item = {'id': item_id, 'name': 'Old Name', 'done': False}

        # Setup mock
        mock_coordinator.check_and_load_list_cache.return_value = {
            'items': {item_id: current_item}
        }
        mock_coordinator.get_item_cache.return_value = (current_item, 1.0)
        mock_coordinator.update_item.return_value = 2.5

        # Execute
        updates = {'name': 'New Name', 'done': True}
        result = item_service.update_item(
            list_id, item_id, user_id, updates, client_rev
        )

        # Verify
        assert result['name'] == 'New Name'
        assert result['done'] is True
        mock_coordinator.update_item.assert_called_once()

    def test_update_item_conflict(
        self, item_service, mock_coordinator, mock_socketio, app
    ):
        """Test updating item with outdated revision sends snapshot"""
        list_id = 'list-123'
        item_id = 'item-456'
        user_id = 'user-789'
        client_rev = 1.0
        server_rev = 5.0

        current_item = {'id': item_id, 'name': 'Current Name'}
        snapshot = {
            'list_id': list_id,
            'items': {item_id: current_item},
            'rev': server_rev,
        }

        # Setup mock
        mock_coordinator.get_item_cache.return_value = (current_item, server_rev)
        mock_coordinator.check_and_load_list_cache.return_value = snapshot

        # Execute with request context
        with app.test_request_context(), patch(
            'services.item_service.request'
        ) as mock_request:
            mock_request.sid = 'socket-123'

            # Call the method (it should not raise, but handle via emits)
            result = item_service.update_item(
                list_id, item_id, user_id, {'name': 'New'}, client_rev
            )

            # Verify no update occurred (returns None on conflict)
            assert result is None

            # Verify snapshot was sent
            mock_socketio.emit.assert_any_call(
                se.LIST_SNAPSHOT, snapshot, to='socket-123'
            )

            # Verify error was emitted with correct data and target
            expected_error_data = {
                'message': f'Item {item_id} out of sync: client rev {client_rev}, server rev {server_rev}'
            }
            mock_socketio.emit.assert_any_call(
                se.ACTION_ERROR, expected_error_data, to='socket-123'
            )

    def test_update_item_not_found(self, item_service, mock_coordinator):
        """Test updating non-existent item raises error"""
        list_id = 'list-123'
        item_id = 'nonexistent'
        user_id = 'user-789'

        # Setup mock
        mock_coordinator.check_and_load_list_cache.return_value = {'items': {}}
        mock_coordinator.get_item_cache.return_value = (None, 0)

        # Execute & verify
        with pytest.raises(ValueError, match='not found'):
            item_service.update_item(list_id, item_id, user_id, {'name': 'New'}, 1.0)

    def test_delete_item(self, item_service, mock_coordinator, mock_supabase_writer):
        """Test deleting an item"""
        list_id = 'list-123'
        item_id = 'item-456'
        user_id = 'user-789'

        # Setup mock
        mock_coordinator.check_and_load_list_cache.return_value = {
            'items': {item_id: {}}
        }
        mock_coordinator.delete_item.return_value = 3.0

        # Execute
        item_service.delete_item(list_id, item_id, user_id)

        # Verify
        mock_coordinator.delete_item.assert_called_once_with(list_id, item_id)

        # Verify soft delete queued for supabase
        mock_supabase_writer.queue_write.assert_called_once()
        call_args = mock_supabase_writer.queue_write.call_args
        assert call_args[0][0] == swo.DELETE_ITEM
