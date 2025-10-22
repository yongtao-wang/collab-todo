import logging
import os

from utils import constants

LOG_FILE_NAME = 'auth'


def get_logger(name: str = 'auth', log_level: str = None) -> logging.Logger:
    logger = logging.getLogger(name)
    default_level = logging.DEBUG if os.getenv('ENV') != 'production' else logging.INFO
    logger.setLevel(log_level if log_level else default_level)

    if not logger.handlers:
        stream_handler = logging.StreamHandler()
        log_dir = os.path.join(constants.LOG_DIR, 'log')
        os.makedirs(log_dir, exist_ok=True)
        file_handler = logging.FileHandler(os.path.join(log_dir, f'{LOG_FILE_NAME}.log'))
        formatter = logging.Formatter(
            '[%(asctime)s] %(levelname)s [%(name)s]: %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S',
        )
        stream_handler.setFormatter(formatter)
        file_handler.setFormatter(formatter)
        logger.addHandler(stream_handler)
        logger.addHandler(file_handler)
        logger.propagate = False
    else:
        logger.propagate = True

    return logger


# Usage:
# logger = get_logger(__name__, 'INFO")
# logger.info("Logger initialized.")
