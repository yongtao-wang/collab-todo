from core.state_manager import ConnectionManager
from flask_socketio import SocketIO
from middleware.middleware import require_conn, validate_event_data
from schemas.list_schema import CreateListSchema, JoinListSchema, ShareListSchema
from services.list_service import ListService
from services.permission_service import PermissionService
from utils.constants import SocketEvents as se
from utils.logger import get_logger

logger = get_logger(__name__)


def register_list_handlers(
    socketio: SocketIO,
    connection_manager: ConnectionManager,
    list_service: ListService,
    permission_service: PermissionService,
):
    """Register list-related WebSocket event handlers"""

    require_auth = require_conn(connection_manager)

    @socketio.on(se.JOIN)
    @require_auth
    def handle_join(user_id, data=None):
        list_service.join_all_list_rooms(user_id)

    @socketio.on(se.JOIN_LIST)
    @require_auth
    @validate_event_data(JoinListSchema)
    def handle_join_list(user_id, data: JoinListSchema):
        try:
            permission_service.require_view_permission(data.list_id, user_id)
            list_service.join_list_room(user_id, data.list_id)
        except PermissionError as e:
            socketio.emit(se.PERMISSION_ERROR, {'message': str(e)})
            logger.debug('Permission error while joining list room: %s', e)

    @socketio.on(se.CREATE_LIST)
    @require_auth
    @validate_event_data(CreateListSchema)
    def handle_create_list(user_id, data: CreateListSchema):
        list_service.create_list(user_id, data.list_name)

    @socketio.on(se.SHARE_LIST)
    @require_auth
    @validate_event_data(ShareListSchema)
    def handle_share_list(user_id, data: ShareListSchema):
        list_service.share_list(data.list_id, user_id, data.shared_user_id, data.role)
