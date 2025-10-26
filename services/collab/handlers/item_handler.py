from core.state_manager import ConnectionManager
from flask_socketio import SocketIO, emit
from middleware.middleware import require_conn, validate_event_data
from schemas.item_schema import AddItemSchema, DeleteItemSchema, UpdateItemSchema
from services.item_service import ItemService
from services.permission_service import PermissionService
from utils.constants import SocketEvents as se
from utils.logger import get_logger

logger = get_logger(__name__)


def register_item_handlers(
    socketio: SocketIO,
    connection_manager: ConnectionManager,
    item_service: ItemService,
    permission_service: PermissionService,
):
    """Register item-related WebSocket event handlers"""

    require_auth = require_conn(connection_manager)

    @socketio.on(se.ADD_ITEM)
    @require_auth
    @validate_event_data(AddItemSchema)
    def handle_add_item(user_id, data: AddItemSchema):
        """Add a new todo item to a list"""
        try:
            permission_service.require_edit_permission(data.list_id, user_id)
            item = item_service.add_item(data.list_id, user_id, data)
            logger.info(
                'User %s added item %s to list %s', user_id, item['id'], data.list_id
            )
        except PermissionError as e:
            emit(se.PERMISSION_ERROR, {'message': str(e)})
        except ValueError as e:
            emit(se.ACTION_ERROR, {'message': str(e)})
        except Exception as e:
            emit(se.ERROR, {'message': 'Failed to add item'})
            logger.error('Error in add_item: %s', e, exec_info=True)

    @socketio.on(se.UPDATE_ITEM)
    @require_auth
    @validate_event_data(UpdateItemSchema)
    def handle_update_item(user_id, data: UpdateItemSchema):
        try:
            permission_service.require_edit_permission(data.list_id, user_id)
            data_dict = data.model_dump(exclude_unset=True)
            updates = {}
            for field in [
                "name",
                "description",
                "status",
                "done",
                "due_date",
                "media_url",
            ]:
                if field in data_dict:
                    updates[field] = data_dict[field]

            item = item_service.update_item(
                data.list_id, data.item_id, user_id, updates, data.rev
            )
            logger.info(
                'Updated item %s by user %s in list %s',
                item['id'],
                user_id,
                data.list_id,
            )
        except PermissionError as e:
            emit(se.PERMISSION_ERROR, {'message': str(e)})
        except ValueError as e:
            emit(se.ACTION_ERROR, {'message': str(e)})
        except Exception as e:
            emit(se.ERROR, {'message': 'Failed to update item'})
            logger.error('Error updating item: %s', e, exec_info=True)

    @socketio.on(se.DELETE_ITEM)
    @require_auth
    @validate_event_data(DeleteItemSchema)
    def handle_delete_item(user_id, data: DeleteItemSchema):
        try:
            permission_service.require_edit_permission(data.list_id, user_id)
            item_service.delete_item(data.list_id, data.item_id, user_id)
            logger.info(
                'Deleted item %s by user %s in list %s',
                data.item_id,
                user_id,
                data.list_id,
            )
        except PermissionError as e:
            emit(se.PERMISSION_ERROR, {'message': str(e)})
        except ValueError as e:
            emit(se.ACTION_ERROR, {'message': str(e)})
        except Exception as e:
            emit(se.ERROR, {'message': 'Failed to delete item'})
            logger.error('Error deleting item: %s', e, exec_info=True)
