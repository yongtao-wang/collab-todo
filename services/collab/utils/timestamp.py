from datetime import datetime


def now_iso():
    return datetime.now().isoformat()
