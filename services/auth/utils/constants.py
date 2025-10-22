import os
from enum import Enum

API_PREFIX = '/auth'

# Set to the parent folder of current file
LOG_DIR = os.path.dirname(os.path.abspath(os.path.join(__file__, os.pardir)))


class AuthErrorMessage(Enum):
    def to_dict(obj):
        result = {}
        for k, v in obj.__dict__.items():
            if isinstance(v, Enum):
                result[k] = f"{v.__class__.__name__}.{v.name}"
            else:
                result[k] = v
        return result

    EMAIL_ALREADY_REGISTERED = 'Email already registered'
    EMAIL_NOT_FOUND = 'Email not found'
    REFRESH_FAILURE = 'Token refresh failed'
    INVALID_PASSWORD = 'Invalid password'
