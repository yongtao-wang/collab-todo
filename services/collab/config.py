import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


@dataclass
class Config:
    """Centralized configuration for the application"""

    # Environment
    ENV: str = os.getenv('ENV', 'development')
    DEBUG: bool = ENV != 'production'
    PORT: int = int(os.getenv('PORT', 7788))

    # JWT
    JWT_SECRET_KEY: str = os.getenv('JWT_SECRET_KEY', 'dev-secret')

    # Supabase
    SUPABASE_URL: str = os.getenv('SUPABASE_URL')
    SUPABASE_SECRET_KEY: str = os.getenv('SUPABASE_SECRET_KEY')

    # Redis
    REDIS_URL: str = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    REDIS_STATE_KEY_PATTERN: str = 'todo:state:{list_id}'
    REDIS_PUBSUB_CHANNEL: str = 'todo:updates'

    # SocketIO
    SOCKETIO_PING_INTERVAL: int = 15
    SOCKETIO_PING_TIMEOUT: int = 60
    SOCKETIO_CORS_ORIGINS: str = os.getenv('SOCKETIO_CORS_ORIGINS', '*')

    # Supabase Writer
    WRITER_QUEUE_SIZE = int(os.getenv('WRITER_QUEUE_SIZE', 1000))

    # Logging
    LOG_LEVEL: str = 'INFO' if ENV == 'production' else 'DEBUG'
    LOG_FOLDER: str = 'log/'
    LOG_FILE: str = 'collab.log'


_config: Config | None = None


def get_config() -> Config:
    global _config
    if not _config:
        _config = Config()
    return _config
