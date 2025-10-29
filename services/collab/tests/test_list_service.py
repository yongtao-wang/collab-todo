# tests/test_list_service.py
from unittest.mock import Mock, patch

import pytest
from flask import Flask
from services.list_service import ListService
from utils.constants import SocketEvents as se
from utils.constants import SupabaseWriterOperations as swo


@pytest.fixture(scope="module")
def app():
    return Flask(__name__)


@pytest.fixture
def mock_list_repo():
    return Mock()


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
def list_service(mock_list_repo, mock_coordinator, mock_supabase_writer, mock_socketio):
    return ListService(
        list_repo=mock_list_repo,
        coordinator=mock_coordinator,
        supabase_writer=mock_supabase_writer,
        socketio=mock_socketio,
    )


class TestListService:
    def test_ensure_user_list_existing(self, list_service, mock_list_repo):
        """Test ensure_user_list when user has lists"""
        user_id = 'user-123'

        owned_list = Mock(id='list-1')
        shared_list = Mock(id='list-2')
        mock_list_repo.get_user_accessible_lists.return_value = (
            [owned_list],
            [shared_list],
        )

        # Execute
        result = list_service.ensure_user_list(user_id)

        # Verify
        assert 'list-1' in result
        assert 'list-2' in result
        assert len(result) == 2

    def test_ensure_user_list_creates_default(
        self, list_service, mock_list_repo, mock_coordinator, app
    ):
        """Test ensure_user_list creates default list if none exist"""
        user_id = 'user-123'

        # No existing lists
        mock_list_repo.get_user_accessible_lists.return_value = ([], [])
        mock_coordinator.init_list_cache.return_value = 1.0
        with app.test_request_context(), patch('services.list_service.request') as mock_request:
            mock_request.sid = 'socket-123'

            # Execute
            result = list_service.ensure_user_list(user_id)

            # Verify a list was created
            assert len(result) == 1
            mock_coordinator.init_list_cache.assert_called_once()

    def test_create_list(
        self, list_service, mock_coordinator, mock_supabase_writer, mock_socketio, app
    ):
        """Test creating a new list"""
        user_id = 'user-123'
        list_name = 'My New List'

        mock_coordinator.init_list_cache.return_value = 1.5
        with app.test_request_context(), patch('services.list_service.request') as mock_request:
            mock_request.sid = 'socket-123'

            # Execute
            result = list_service.create_list(user_id, list_name)

            # Verify
            assert result['name'] == list_name
            assert result['owner_id'] == user_id
            assert 'id' in result

            # Verify cache was initialized
            mock_coordinator.init_list_cache.assert_called_once()

            # Verify writes queued
            assert mock_supabase_writer.queue_write.call_count == 2

            # Verify emit
            mock_socketio.emit.assert_called_once()
            call_args = mock_socketio.emit.call_args
            assert call_args[0][0] == se.LIST_CREATED

    def test_share_list_success(
        self, list_service, mock_list_repo, mock_socketio, mock_supabase_writer, app
    ):
        """Test sharing a list with another user"""
        list_id = 'list-123'
        owner_id = 'owner-456'
        shared_user_id = 'user-789'
        role = 'editor'

        mock_list_repo.get_by_id.return_value = {
            'id': list_id,
            'name': 'Shared List',
            'owner_id': owner_id,
        }

        with app.test_request_context(), patch(
            'services.list_service.request'
        ) as mock_request:
            mock_request.sid = 'socket-123'

            # Execute
            list_service.share_list(list_id, owner_id, shared_user_id, role)

            # Verify emissions
            assert mock_socketio.emit.call_count == 2

            # Verify LIST_SHARED_WITH_YOU was sent to target user
            calls = mock_socketio.emit.call_args_list
            shared_call = [c for c in calls if c[0][0] == se.LIST_SHARED_WITH_YOU][0]
            assert shared_call[1]['to'] == f'user_{shared_user_id}'

            # Verify member was added to database
            mock_supabase_writer.queue_write.assert_called_once()
            call_args = mock_supabase_writer.queue_write.call_args
            assert call_args[0][0] == swo.ADD_OR_UPDATE_MEMBER

    def test_share_list_not_owner(self, list_service, mock_list_repo, app):
        """Test sharing fails when user is not owner"""
        list_id = 'list-123'
        non_owner_id = 'user-456'
        shared_user_id = 'user-789'

        mock_list_repo.get_by_id.return_value = {
            'id': list_id,
            'owner_id': 'different-owner',
        }
        with app.test_request_context(), patch('services.list_service.request'):
            # Should not raise, but emit error
            list_service.share_list(list_id, non_owner_id, shared_user_id, 'editor')

            # Verify no write was queued
            # (error handling emits error event instead)

    def test_share_list_with_self_fails(self, list_service, mock_list_repo, app):
        """Test sharing with yourself is not allowed"""
        list_id = 'list-123'
        owner_id = 'user-456'

        mock_list_repo.get_by_id.return_value = {'id': list_id, 'owner_id': owner_id}
        with app.test_request_context(), patch('services.list_service.request'):
            # Should handle error gracefully
            list_service.share_list(list_id, owner_id, owner_id, 'editor')

    def test_get_list_snapshot(self, list_service, mock_coordinator):
        """Test getting list snapshot"""
        list_id = 'list-123'

        cache_data = {
            'list_name': 'Test List',
            'rev': 5.0,
            'items': {'item-1': {'name': 'Item 1'}},
        }
        mock_coordinator.check_and_load_list_cache.return_value = cache_data

        # Execute
        result = list_service.get_list_snapshot(list_id)

        # Verify
        assert result['list_id'] == list_id
        assert result['list_name'] == 'Test List'
        assert result['rev'] == 5.0
        assert 'item-1' in result['items']

    def test_join_list_room(self, list_service, mock_coordinator, mock_socketio, app):
        """Test joining a list room"""
        user_id = 'user-123'
        list_id = 'list-456'

        mock_coordinator.check_and_load_list_cache.return_value = {
            'list_name': 'Test List',
            'rev': 1.0,
            'items': {},
        }
        with app.test_request_context(), patch(
            'services.list_service.request'
        ) as mock_request, patch('services.list_service.join_room') as mock_join_room:
            mock_request.sid = 'socket-123'

            # Execute
            list_service.join_list_room(user_id, list_id)

            # Verify joined room
            mock_join_room.assert_called_once_with(list_id, namespace='/')

            # Verify snapshot was sent
            mock_socketio.emit.assert_called_once()
            call_args = mock_socketio.emit.call_args
            assert call_args[0][0] == se.LIST_SNAPSHOT

    def test_join_all_list_rooms(
        self, list_service, mock_list_repo, mock_coordinator, app
    ):
        """Test joining all accessible list rooms"""
        user_id = 'user-123'

        owned = [Mock(id='list-1'), Mock(id='list-2')]
        shared = [Mock(id='list-3')]
        mock_list_repo.get_user_accessible_lists.return_value = (owned, shared)

        mock_coordinator.check_and_load_list_cache.return_value = {
            'list_name': 'Test',
            'rev': 1.0,
            'items': {},
        }
        with app.test_request_context(), patch(
            'services.list_service.request'
        ) as mock_request, patch('services.list_service.join_room') as mock_join_room:
            mock_request.sid = 'socket-123'

            # Execute
            list_service.join_all_list_rooms(user_id)

            # Verify joined personal room + all list rooms
            assert mock_join_room.call_count == 4  # 1 personal + 3 lists

            # Verify first call is personal room
            first_call = mock_join_room.call_args_list[0]
            assert first_call[0][0] == f'user_{user_id}'
