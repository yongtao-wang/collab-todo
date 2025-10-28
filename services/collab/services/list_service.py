import uuid
from typing import List

from core.coordinator import Coordinator
from flask import request
from flask_socketio import SocketIO, join_room
from models.list import ListRepository
from utils.constants import SocketEvents as se
from utils.constants import SupabaseWriterOperations as swo
from utils.logger import get_logger
from utils.timestamp import now_iso
from worker.supabase_writer import SupabaseWriter

logger = get_logger(__name__)


class ListService:
    """Business logic for todo lists"""

    def __init__(
        self,
        list_repo: ListRepository,
        coordinator: Coordinator,
        supabase_writer: SupabaseWriter,
        socketio: SocketIO,
    ):
        self.list_repo = list_repo
        self.coordinator = coordinator
        self.supabase_writer = supabase_writer
        self.socketio = socketio

    def ensure_user_list(self, user_id: str) -> List[str]:
        """Ensure user owned list IDs. Create default if user has none."""
        owned, shared = self.list_repo.get_user_accessible_lists(user_id)
        owned_ids = [lst.id for lst in owned]
        shared_ids = [lst.id for lst in shared]
        all_list_ids = list(set(owned_ids + shared_ids))
        if not all_list_ids:
            logger.info('User %s has no list, creating default', user_id)
            new_list = self.create_list(user_id, 'My TODOs')
            all_list_ids.append(new_list['id'])
        return all_list_ids

    def create_list(self, user_id: str, list_name: str = 'Untitled List') -> dict:
        """Create a new list and add user as the owner"""
        now = now_iso()
        list_id = str(uuid.uuid4())
        list_data = {
            'id': list_id,
            'name': list_name,
            'owner_id': user_id,  # owner
            'created_at': now,
            'updated_at': now,
        }
        rev = self.coordinator.init_list_cache(list_id, list_name, user_id)
        self.supabase_writer.queue_write(swo.CREATE_LIST, list_data)
        self.supabase_writer.queue_write(
            swo.ADD_OR_UPDATE_MEMBER,
            {
                'list_id': list_id,
                'user_id': user_id,
                'role': 'owner',
                'created_at': now,
            },
        )
        self.socketio.emit(
            se.LIST_CREATED,
            {'list_id': list_id, 'list_name': list_name, 'items': {}, 'rev': rev},
            to=request.sid,
        )
        logger.info('User %s created list %s', user_id, list_id)
        return list_data

    def share_list(
        self, list_id: str, owner_user_id: str, shared_user_id: str, role: str
    ):
        """Share a list with another user."""
        try:
            list_data = self.list_repo.get_by_id(list_id)
            if not list_data:
                raise ValueError('List not found for id: %s'.format(list_id))
            if list_data['owner_id'] != owner_user_id:
                raise PermissionError('Only list owner can share')
            if shared_user_id == owner_user_id:
                raise ValueError('Cannot share with yourself')

            self.socketio.emit(
                se.LIST_SHARED_WITH_YOU,
                {
                    'list_id': list_id,
                    'message': f'{owner_user_id} shared a list with you.',
                },
                to=f'user_{shared_user_id}',
            )
            self.socketio.emit(
                se.LIST_SHARE_SUCCESS,
                {
                    'message': f'Successfully shared list with user {shared_user_id} as {role}'
                },
                to=request.sid,
            )
            self.supabase_writer.queue_write(
                swo.ADD_OR_UPDATE_MEMBER,
                {
                    'list_id': list_id,
                    'user_id': shared_user_id,
                    'role': role,
                },
            )
            logger.info(
                'Granted list %s membership to user %s with role %s',
                list_id,
                shared_user_id,
                role,
            )
        except ValueError as e:
            self.socketio.emit(se.ACTION_ERROR, {'message': f'Sharing list error: {e}'})
        except PermissionError as e:
            self.socketio.emit(
                se.PERMISSION_ERROR,
                {'message': f'Permission error when sharing a list: {e}'},
            )
        finally:
            logger.debug(
                'Failed to share list %s from %s to %s: %s',
                list_id,
                owner_user_id,
                shared_user_id,
                e,
            )

    def get_list_snapshot(self, list_id: str) -> dict:
        """Get current state snapshot for a list"""
        cache = self.coordinator.check_and_load_list_cache(list_id)
        return {
            'list_id': list_id,
            'list_name': cache.get('list_name', ''),
            'rev': cache['rev'],
            'items': cache['items'],
        }

    def join_list_room(self, user_id: str, list_id: str) -> None:
        try:
            self.coordinator.check_and_load_list_cache(list_id)
            join_room(list_id, namespace='/')
            logger.info('User %s joined list %s', user_id, list_id)
            response_data = self.get_list_snapshot(list_id)
            self.socketio.emit(se.LIST_SNAPSHOT, response_data, to=request.sid)
        except Exception as e:
            logger.error('Error joining list:', e)
            self.socketio.emit(
                se.ACTION_ERROR,
                {'message': f'Failed to join list {list_id} with exception: {e}'},
                to=request.sid,
            )

    def join_all_list_rooms(self, user_id: str) -> None:
        try:
            join_room(f'user_{user_id}', namespace='/')
            logger.info('User %s joined his personal room', user_id)
            list_ids = self.ensure_user_list(user_id)
            for list_id in list_ids:
                self.join_list_room(user_id, list_id)
        except Exception as e:
            logger.error('Error joining list:', e)
