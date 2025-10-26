import logging
import os

from config import get_config

LOG_FILE_NAME = 'collab'


def get_logger(name: str, log_level: str = None) -> logging.Logger:
    logger = logging.getLogger(name)
    config = get_config()
    logger.setLevel(log_level if log_level else config.LOG_LEVEL)

    if not logger.handlers:
        stream_handler = logging.StreamHandler()
        os.makedirs(config.LOG_FILE, exist_ok=True)
        file_handler = logging.FileHandler(
            os.path.join(config.LOG_FILE, f'{LOG_FILE_NAME}.log')
        )
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
