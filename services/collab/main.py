import json
import logging
import os
import uuid
from functools import wraps

import redis
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, decode_token
from flask_socketio import SocketIO, emit, join_room
from jwt import ExpiredSignatureError
from supabase import Client, create_client

load_dotenv()


ENV = os.getenv('ENV')

# Configure logging
logger = logging.getLogger(__name__)
log_formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s - %(message)s'
)
logger.setLevel(logging.DEBUG if ENV != 'production' else logging.INFO)

stream_handler = logging.StreamHandler()
stream_handler.setFormatter(log_formatter)
file_handler = logging.FileHandler('log/collab_service.log')
file_handler.setFormatter(log_formatter)
logger.addHandler(stream_handler)
logger.addHandler(file_handler)

# Configure Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

# Configure Redis
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
REDIS_STATE_KEY = 'todo:state:{list_id}'
REDIS_EPOCH_KEY = 'todo:server_epoch'
r = redis.Redis.from_url(REDIS_URL, decode_responses=True)

app = Flask(__name__)
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-secret")
CORS(app)
JWTManager(app)

# TODO: provide feasible allowed origins
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="gevent",
    ping_interval=15,
    ping_timeout=60,
)

# Local cache：list_id -> {rev, list_name, items: {item_id: {...}}}
STATE = {}
ACTIVE_CONN = {}

SERVER_EPOCH = r.get(REDIS_EPOCH_KEY)
if not SERVER_EPOCH:
    SERVER_EPOCH = str(uuid.uuid4())[:8]
    r.set(REDIS_EPOCH_KEY, SERVER_EPOCH)


def ensure_user_list(user_id: str):
    """Return list_id. If user doesn't have any list, create an empty one."""
    try:
        res = (
            supabase.table("todo_lists")
            .select("id")
            .eq("owner_id", user_id)
            .eq("is_deleted", False)
            .execute()
        )
        if res.data:
            return [li['id'] for li in res.data]

        # Create an empty list
        new_list = {
            "name": "My TODOs",
            "owner_id": user_id,
            "is_deleted": False,
        }
        inserted = supabase.table("todo_lists").insert(new_list).execute()
        list_id = inserted.data[0]["id"]
        new_owner = {'list_id': list_id, 'user_id': user_id, 'role': 'owner'}
        supabase.table('todo_list_members').insert(new_owner).execute()

        logger.info('Created new list for user %s: %s', user_id, list_id)
        return list_id
    except Exception as e:
        logger.error('Error in ensure_user_list for user %s: %s', user_id, str(e))
        raise


def ensure_accessible_todo_list_ids(user_id: str):
    """
    Ensure user has access to all owned and shared lists
    """
    # Get owned lists
    owned_res = (
        supabase.table('todo_lists')
        .select('id')
        .eq('owner_id', user_id)
        .eq('is_deleted', False)
        .execute()
    )
    owned_ids = [r['id'] for r in owned_res.data] if owned_res.data else []
    # Get shared lists
    shared_res = (
        supabase.table("todo_list_members")
        .select("list_id")
        .eq("user_id", user_id)
        .execute()
    )
    shared_ids = [r["list_id"] for r in shared_res.data] if shared_res.data else []

    # Merge & deduplicate
    accessible_ids = list(set(owned_ids + shared_ids))

    # If user has none → create one default
    if not accessible_ids:
        new_list_id = ensure_user_list(user_id)
        accessible_ids.append(new_list_id)

    return accessible_ids


def ensure_list_in_state(list_id: str):
    redis_key = REDIS_STATE_KEY.format(list_id=list_id)
    if r.exists(redis_key):
        state_data = r.hgetall(redis_key)
        STATE[list_id] = {
            "rev": int(state_data.get("rev", 1)),
            "items": json.loads(state_data.get("items", "{}")),
            "list_name": state_data.get("list_name", ""),
        }
        return

    STATE[list_id] = {"rev": 1, "items": {}}
    # Load list info from Supabase
    list_res = (
        supabase.table('todo_lists')
        .select('name')
        .eq('id', list_id)
        .eq('is_deleted', False)
        .execute()
    )
    if list_res.data:
        STATE[list_id]['list_name'] = list_res.data[0]['name']
    # Load items from Supabase
    res = (
        supabase.table("todo_items")
        .select("*")
        .eq("list_id", list_id)
        .eq("is_deleted", False)
        .execute()
    )
    for item in res.data:
        STATE[list_id]["items"][item["id"]] = item
    r.hset(
        redis_key,
        mapping={
            "rev": STATE[list_id]["rev"],
            "list_name": STATE[list_id]["list_name"],
            "items": json.dumps(STATE[list_id]["items"]),
        },
    )


def get_user_highest_role(list_id: str, user_id: str):
    role = (
        supabase.table('todo_list_members')
        .select('role')
        .eq('list_id', list_id)
        .eq('user_id', user_id)
        .execute()
    )
    roles = [r['role'] for r in role.data]
    if 'owner' in roles:
        return 'owner'
    if 'editor' in roles:
        return 'editor'
    if 'viewer' in roles:
        return 'viewer'
    return ''


def persist_state(list_id: str):
    redis_key = REDIS_STATE_KEY.format(list_id=list_id)
    r.hset(
        redis_key,
        mapping={
            "rev": STATE[list_id]["rev"],
            "list_name": STATE[list_id].get("list_name", ""),
            "items": json.dumps(STATE[list_id]["items"]),
        },
    )


def check_user_can_edit_list(list_id: str, user_id: str) -> bool:
    user_role = get_user_highest_role(list_id, user_id)
    if user_role not in ['owner', 'editor']:
        return False
    return True


def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        sid = request.sid
        user_id = ACTIVE_CONN.get(sid)
        if not user_id:
            emit('error', {'message': 'Unauthorized'}, to=request.sid)
            return
        return f(user_id, *args, **kwargs)

    return wrapper


@app.route("/")
def index():
    return "Realtime TODO (Phase 0, Supabase) running."


@app.route("/debug/state")
def debug_state():
    return jsonify(
        {lid: {"rev": v["rev"], "items": len(v["items"])} for lid, v in STATE.items()}
    )


@socketio.on('connect')
def handle_connect(auth):
    token = auth.get('token') if auth else None
    if not token:
        logger.error('Missing token, rejecting connection')
        return False
    try:
        decoded = decode_token(token)
        if decoded.get('type') != 'access':
            emit(
                'error',
                {'message': 'Invalid token type. Should pass in a valid access token'},
            )
        user_id = decoded['sub']
        request.user_id = user_id
        logger.info('User %s connected via WebSocket', user_id)
    except ExpiredSignatureError:
        logger.exception('Token expired')
        emit('auth_error', {'message': 'Token expired'}, to=request.sid)
        return False
    except Exception as e:
        logger.error('Invalid token: %s', str(e))
        return False
    ACTIVE_CONN[request.sid] = user_id


@socketio.on('disconnect')
def handle_disconnect():
    ACTIVE_CONN.pop(request.sid, None)


@socketio.on("join")
@require_auth
def handle_join(user_id, data):
    client_epoch = data.get('epoch', '')
    client_state = data.get('revState', {})
    if not user_id:
        emit("action_error", {"message": "Missing user_id"}, to=request.sid)
        return

    try:
        # Join user's room
        join_room(f'user_{user_id}')
        list_ids = ensure_accessible_todo_list_ids(user_id)
        for list_id in list_ids:
            ensure_list_in_state(list_id)
            join_room(list_id)
            emit('join_list', {'list_id': list_id})
            logger.info('User %s join list %s', user_id, list_id)
            current_rev = STATE[list_id]['rev']
            # Simplify rev comparing. No Operational Transform or CRDT.
            # At this point, timely sequence is not necessary for rev.
            if (
                client_epoch != SERVER_EPOCH
                or client_state.get(list_id, 0) != current_rev
            ):
                response_data = {
                    "list_id": list_id,
                    'list_name': STATE[list_id]['list_name'],
                    "rev": current_rev,
                    "items": STATE[list_id]["items"],
                    'server_epoch': SERVER_EPOCH,
                }
                emit("list_snapshot", response_data, to=request.sid)
            else:
                emit('list_synced', {'rev': current_rev})
    except Exception as e:
        logger.error('Error in handle_join: %s', str(e))
        emit("action_error", {"message": f"Failed to join: {str(e)}"}, to=request.sid)


@socketio.on("item_add")
@require_auth
def handle_add(user_id, data):
    list_id = data.get("list_id")

    if not check_user_can_edit_list(list_id, user_id):
        emit(
            'permission_error',
            {'message': 'Permission denied: user is not authorized to edit'},
            to=request.sid,
        )
        logger.exception(
            'Permission denied: user %s is not authorized to edit list %s',
            user_id,
            list_id,
        )
        return

    try:
        name = data.get("name") or ""
        description = data.get("description") or ""
        due_date = data.get("due_date")
        media_url = data.get("media_url")
        ensure_list_in_state(list_id)

        item_id = str(uuid.uuid4())
        item = {
            "id": item_id,
            "list_id": list_id,
            "name": name,
            "description": description,
            "due_date": due_date,
            "status": "not_started",
            "done": False,
            "media_url": media_url,
            "is_deleted": False,
        }

        # Local cache then save to Supabase
        STATE[list_id]["items"][item_id] = item
        STATE[list_id]["rev"] += 1
        res = supabase.table("todo_items").insert(item).execute()
        item['created_at'] = res.data[0]['created_at']
        item['updated_at'] = res.data[0]['updated_at']

        emit("item_added", {"rev": STATE[list_id]["rev"], "item": item}, to=list_id)
        logger.info('Added new item in list %s by user %s', list_id, user_id)
        persist_state(list_id)
    except Exception as e:
        logger.debug('Failed to add new item to list %s: %e', list_id, str(e))


@socketio.on("item_update")
@require_auth
def handle_update(user_id, data):
    list_id = data.get("list_id")
    if not check_user_can_edit_list(list_id, user_id):
        emit(
            'permission_error',
            {'message': 'Permission denied: user is not authorized to edit'},
            to=request.sid,
        )
        logger.exception(
            'Permission denied: user %s is not authorized to edit list %s',
            user_id,
            list_id,
        )
        return

    item_id = data.get("item_id")
    ensure_list_in_state(list_id)
    if item_id not in STATE[list_id]["items"]:
        return
    item = STATE[list_id]["items"][item_id]

    try:
        # Update field
        for field in ["name", "description", "status", "done", "due_date", "media_url"]:
            if field in data:
                item[field] = data[field]
        STATE[list_id]["rev"] += 1

        res = (
            supabase.table("todo_items")
            .update(
                {
                    "name": item["name"],
                    "description": item["description"],
                    "status": item["status"],
                    "done": item["done"],
                    "due_date": item["due_date"],
                    "media_url": item["media_url"],
                }
            )
            .eq("id", item_id)
            .execute()
        )

        item['created_at'] = res.data[0]['created_at']
        item['updated_at'] = res.data[0]['updated_at']
        STATE[list_id][item_id] = item

        emit(
            "item_updated",
            {"rev": STATE[list_id]["rev"], "item": item, "list_id": list_id},
            to=list_id,
        )
        logger.info('Updated item in list %s by user %s', list_id, user_id)
        persist_state(list_id)
    except Exception as e:
        logger.exception('Failed to update list %s: %s', list_id, str(e))


@socketio.on("item_delete")
@require_auth
def handle_delete(user_id, data):
    list_id = data.get("list_id")
    if not check_user_can_edit_list(list_id, user_id):
        emit(
            'permission_error',
            {'message': 'Permission denied: user is not authorized to edit'},
            to=request.sid,
        )
        logger.exception(
            'Permission denied: user %s is not authorized to edit list %s',
            user_id,
            list_id,
        )
        return

    try:
        item_id = data.get("item_id")
        ensure_list_in_state(list_id)

        STATE[list_id]["items"].pop(item_id, None)
        STATE[list_id]["rev"] += 1

        supabase.table("todo_items").update({"is_deleted": True}).eq(
            "id", item_id
        ).execute()
        emit(
            "item_deleted",
            {"rev": STATE[list_id]["rev"], "item_id": item_id, "list_id": list_id},
            to=list_id,
        )
        logger.info('Deleted an item in list %s by user %s', list_id, user_id)
        persist_state(list_id)
    except Exception as e:
        logger.error('Failed to delete item in list %s: %s', list_id, str(e))


@socketio.on('list_share')
@require_auth
def handle_share(user_id, data):
    list_id = data.get('list_id')
    shared_user_id = data.get('shared_user_id')
    role = data.get('role', 'viewer')  # Default to viewer
    owner_user_id = user_id

    if not list_id or not shared_user_id:
        emit(
            "action_error",
            {"message": "Missing list_id or shared_user_id"},
            to=request.sid,
        )
        logger.exception(
            'Permission denied: user %s is not authorized to share list %s',
            user_id,
            list_id,
        )
        return

    try:
        # Verify the list exists
        list_res = (
            supabase.table("todo_lists")
            .select("id, owner_id")
            .eq("id", list_id)
            .eq("is_deleted", False)
            .execute()
        )

        if not list_res.data:
            emit(
                "action_error",
                {"message": "Sharing List Error: List not found"},
                to=request.sid,
            )
            return

        list_owner = list_res.data[0]["owner_id"]

        # Verify the requesting user has permission to share (must be owner)
        if list_owner != owner_user_id:
            emit(
                "permission_error",
                {"message": "Sharing List Error: Only the list owner can share"},
            )
            return

        # Check if user is trying to share with themselves
        if shared_user_id == owner_user_id:
            emit(
                "action_error",
                {"message": "Sharing List Error: Cannot share with yourself"},
                to=request.sid,
            )
            return

        # Check if the user already has access
        existing = (
            supabase.table("todo_list_members")
            .select("*")
            .eq("list_id", list_id)
            .eq("user_id", shared_user_id)
            .execute()
        )

        if existing.data:
            # Update existing membership
            supabase.table("todo_list_members").update({"role": role}).eq(
                "list_id", list_id
            ).eq("user_id", shared_user_id).execute()

            message = f"Updated permissions for user {shared_user_id} to {role}"
        else:
            # Create new membership
            new_member = {"list_id": list_id, "user_id": shared_user_id, "role": role}
            supabase.table("todo_list_members").insert(new_member).execute()

            message = f"Shared list with user {shared_user_id} as {role}"

        # Notify the owner that sharing was successful
        emit(
            "share_success",
            {
                "message": message,
                "list_id": list_id,
                "shared_user_id": shared_user_id,
                "role": role,
            },
            to=request.sid,
        )

        # Notify the shared user by emitting message to the user-specific room
        emit(
            'list_shared_with_you',
            {
                'list_id': list_id,
                'role': role,
                'shared_by': owner_user_id,
                'message': f'{owner_user_id} shared a list with you.',
            },
            room=f'user_{shared_user_id}',
        )

        logger.info(
            'List %s shared by user %s to %s as %s',
            list_id,
            owner_user_id,
            shared_user_id,
            role,
        )

    except Exception as e:
        logger.error('Error sharing list %s: %s', list_id, str(e))
        emit("error", {"message": f"Failed to share list: {str(e)}"}, to=request.sid)


@socketio.on("list_create")
@require_auth
def handle_create_list(user_id, data):
    list_name = data.get("name") or "Untitled List"

    if not user_id:
        emit("error", {"message": "Missing user_id"}, to=request.sid)
        logger.error('Failed to create new list: missing user_id')
        return

    try:
        # Create new list
        new_list = {
            "name": list_name,
            "owner_id": user_id,
            "is_deleted": False,
        }
        inserted = supabase.table("todo_lists").insert(new_list).execute()
        list_id = inserted.data[0]["id"]

        # Add owner as member
        new_owner = {'list_id': list_id, 'user_id': user_id, 'role': 'owner'}
        supabase.table('todo_list_members').insert(new_owner).execute()

        # Initialize in state
        ensure_list_in_state(list_id)

        # Join the room
        join_room(list_id)

        # Send snapshot to client
        response_data = {
            "list_id": list_id,
            "name": list_name,
            "rev": STATE[list_id]["rev"],
            "items": STATE[list_id]["items"],
        }
        emit("list_created", response_data, to=request.sid)
        logger.info('User %s created new list %s: %s', user_id, list_name, list_id)

    except Exception as e:
        logger.error('Failed to create new list %s', str(e))
        emit("error", {"message": f"Failed to create list: {str(e)}"}, to=request.sid)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 7788))
    debug = False if ENV == 'production' else True
    socketio.run(
        app, host="0.0.0.0", port=port, debug=debug, allow_unsafe_werkzeug=False
    )
