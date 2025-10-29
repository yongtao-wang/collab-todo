import logging
import os

from config import get_config


def get_logger(name: str, log_level: str = None) -> logging.Logger:
    logger = logging.getLogger(name)
    config = get_config()
    logger.setLevel(log_level if log_level else config.LOG_LEVEL)

    if not logger.handlers:
        stream_handler = logging.StreamHandler()
        os.makedirs(config.LOG_FOLDER, exist_ok=True)
        file_handler = logging.FileHandler(
            os.path.join(config.LOG_FOLDER, config.LOG_FILE)
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
