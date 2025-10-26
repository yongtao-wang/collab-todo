import atexit

from config import get_config
from core.coordinator import Coordinator
from core.pubsub_listener import PubSubListener
from core.state_manager import ConnectionManager, StateManager
from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from handlers.connection_handler import register_connection_handlers
from handlers.item_handler import register_item_handlers
from handlers.list_handler import register_list_handlers
from models.item import ItemRepository
from models.list import ListRepository
from redis import Redis
from services.item_service import ItemService
from services.list_service import ListService
from services.permission_service import PermissionService
from supabase import create_client
from utils.logger import get_logger
from worker.supabase_writer import SupabaseWriter

load_dotenv()

logger = get_logger(__name__)


def create_app():

    # Initialize Flask app
    app = Flask(__name__)

    # Load configuration
    config = get_config()
    app.config.from_object(config)
    app.config["JWT_SECRET_KEY"] = config.JWT_SECRET_KEY

    CORS(app)
    JWTManager(app)

    # Initialize Redis client
    redis_client = Redis.from_url(
        config.REDIS_URL,
        decode_responses=False,  # Keep binary for Lua scripts
    )

    # Test Redis connection
    try:
        redis_client.ping()
        logger.info('Redis connection established')
    except Exception as e:
        logger.error('Redis connection failed: %s', e)
        raise

    # Initialize SocketIO
    socketio = SocketIO(
        app,
        cors_allowed_origins=config.SOCKETIO_CORS_ORIGINS,
        async_mode='gevent',
        ping_timeout=60,
        ping_interval=15,
    )
    app.socketio = socketio
    logger.info('SocketIO initialized')

    # Initialize Supabase client
    supabase_client = create_client(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY)
    logger.info('Supabase client initialized')

    # Initialize repositories
    item_repo = ItemRepository(supabase_client)
    list_repo = ListRepository(supabase_client)

    # Initialize state managers
    state_manager = StateManager()
    connection_manager = ConnectionManager()

    # Initialize coordinator (stateless, no SocketIO)
    coordinator = Coordinator(
        redis_client=redis_client,
        state_manager=state_manager,
        item_repo=item_repo,
        list_repo=list_repo,
        socketio=socketio,
    )
    logger.info('Coordinator initialized')

    # Initialize Supabase writer worker
    supabase_writer = SupabaseWriter(
        supabase_client=supabase_client, max_queue_size=config.WRITER_QUEUE_SIZE
    )
    supabase_writer.start()
    logger.info('Supabase writer started')

    # Initialize services
    permission_service = PermissionService(list_repo)
    item_service = ItemService(
        coordinator=coordinator, supabase_writer=supabase_writer, socketio=socketio
    )
    list_service = ListService(
        coordinator=coordinator,
        list_repo=list_repo,
        supabase_writer=supabase_writer,
        socketio=socketio,
    )
    logger.info('Services initialized')

    # Initialize Pub/Sub listener
    pubsub_listener = PubSubListener(
        redis_client=redis_client, coordinator=coordinator, socketio=socketio
    )
    pubsub_listener.start()
    logger.info('Pub/Sub listener started')

    # Register WebSocket handlers
    register_connection_handlers(
        socketio=socketio,
        connection_manager=connection_manager,
    )

    register_item_handlers(
        socketio=socketio,
        connection_manager=connection_manager,
        item_service=item_service,
        permission_service=permission_service,
    )

    register_list_handlers(
        socketio=socketio,
        connection_manager=connection_manager,
        list_service=list_service,
        permission_service=permission_service,
    )

    logger.info('WebSocket handlers registered')

    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health_check():
        """Health check endpoint for load balancers"""
        try:
            # Check Redis
            redis_client.ping()
            redis_ok = True
        except Exception:
            redis_ok = False

        # Check Supabase writer
        writer_stats = supabase_writer.get_stats()
        writer_ok = writer_stats['running']

        # Check Pub/Sub listener
        listener_ok = pubsub_listener._running

        # Overall health
        healthy = redis_ok and writer_ok and listener_ok

        return {
            'status': 'healthy' if healthy else 'unhealthy',
            'redis': 'ok' if redis_ok else 'error',
            'writer': writer_stats,
            'pubsub_listener': 'running' if listener_ok else 'stopped',
            'connections': connection_manager.get_stats(),
        }, (200 if healthy else 503)

    @app.route('/metrics', methods=['GET'])
    def metrics():
        """Metrics endpoint for monitoring"""
        return {
            'writer': supabase_writer.get_stats(),
            'connections': connection_manager.get_stats(),
            'cache': {'cached_lists': len(state_manager.state)},
        }

    @app.route('/cache', methods=['GET'])
    def show_cache():
        """Show current L1 cache"""
        return {'cache': state_manager.state}

    @app.route('/cache/flush', methods=['GET'])
    def cache_flush():
        """Clean up all L1 cache"""
        state_manager.flush_all()
        return 'done'

    # Graceful shutdown
    def cleanup():
        """Cleanup resources on shutdown"""
        logger.info('Starting graceful shutdown...')

        try:
            pubsub_listener.stop()
            logger.info('Pub/Sub listener stopped')
        except Exception as e:
            logger.error('Error stopping Pub/Sub listener: %s', e)

        try:
            supabase_writer.stop()
            logger.info('Supabase writer stopped')
        except Exception as e:
            logger.error('Error stopping Supabase writer: %s', e)

        try:
            redis_client.close()
            logger.info('Redis connection closed')
        except Exception as e:
            logger.error('Error closing Redis: %s', e)

        logger.info('Graceful shutdown complete')

    atexit.register(cleanup)
    app.cleanup = cleanup

    logger.info('Application initialized successfully')

    return app


if __name__ == '__main__':
    config = get_config()
    app = create_app()
    app.socketio.run(
        app,
        host='0.0.0.0',
        port=config.PORT,
        debug=config.DEBUG,
        allow_unsafe_werkzeug=False,
    )
