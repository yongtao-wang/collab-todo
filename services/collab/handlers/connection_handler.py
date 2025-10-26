from core.state_manager import ConnectionManager
from flask import request
from flask_jwt_extended import decode_token
from flask_socketio import SocketIO, disconnect, emit
from jwt import ExpiredSignatureError, InvalidTokenError
from services.list_service import ListService
from utils.constants import SocketEvents as se
from utils.logger import get_logger

logger = get_logger(__name__)


def register_connection_handlers(
    socketio: SocketIO, connection_manager: ConnectionManager
):
    """Register WebSocket connection handlers"""

    @socketio.on(se.CONNECT)
    def handle_connect(auth):
        """Validate JWT token and register connection"""
        token = auth.get('token') if auth else None
        if not token:
            logger.error('Missing token, rejecting connection')
            return False
        try:
            decoded = decode_token(token)
            if decoded.get('type') != 'access':
                emit(se.ERROR, {'message': 'Missing a valid access token'})
            user_id = decoded['sub']
            request.user_id = user_id
            connection_manager.add_connection(request.sid, user_id)
            logger.info('User %s connected via WebSocket', user_id)
        except ExpiredSignatureError as e:
            logger.debug('Token expired: %s', e)
            emit(
                se.AUTH_ERROR,
                {'message': 'Token expired: %s'.format(e)},
                to=request.sid,
            )
            return False
        except InvalidTokenError as e:
            logger.exception('Invalid token: %s', e)
            return False
        except Exception as e:
            logger.error('Websocket connection Failed: %s', e)
            disconnect()
            return False

    @socketio.on(se.DISCONNECT)
    def handle_disconnect():
        """Remove connection from pool when disconnected"""
        connection_manager.remove_connection(request.sid)
