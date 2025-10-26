from functools import wraps

from core.state_manager import ConnectionManager
from flask import request
from flask_socketio import emit
from pydantic import ValidationError
from utils.constants import SocketEvents as se
from utils.logger import get_logger

logger = get_logger(__name__)


def require_conn(connection_manager: ConnectionManager):
    """
    Decorator factory that injects connection_manager.
    Ensures that a user_id presents in connection pool.

    Usage:
        # In main.py:
        require_auth = require_conn(connection_manager)

        # In handlers:
        @socketio.on('update_item')
        @require_auth
        def handle_update(user_id, data):
            # user_id is injected
            ...
    """

    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            sid = request.sid
            user_id = connection_manager.get_user_id(sid)

            if not user_id:
                logger.warning('Unauthorized request from sid=%s', sid)
                emit(se.AUTH_ERROR, {'message': 'Unauthorized request'}, to=sid)
                return

            # Inject user_id as first argument
            return f(user_id, *args, **kwargs)

        return wrapper

    return decorator


def validate_event_data(schema):
    def decorator(f):
        def wrapper(user_id, payload, *args, **kwargs):
            try:
                data = schema(**payload)
            except ValidationError as e:
                emit(
                    'error',
                    {
                        'message': f'Invalid data in schema {schema.__name__}, payload: {payload}',
                        'errors': e.errors(),
                    },
                )
                return
            return f(user_id, data, *args, **kwargs)

        return wrapper

    return decorator
