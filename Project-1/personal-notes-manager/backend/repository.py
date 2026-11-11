
import json
import os
import threading
import tempfile

FILE_PATH = os.path.join(os.path.dirname(__file__), "notes.json")
_lock = threading.Lock()

def _ensure_file():
    if not os.path.exists(FILE_PATH):
        with open(FILE_PATH, 'w') as f:
            json.dump([], f)

def read_all():
    _ensure_file()
    with _lock:
        with open(FILE_PATH, 'r') as f:
            return json.load(f)

def write_all(notes):
    _ensure_file()
    with _lock:
        dir_name = os.path.dirname(FILE_PATH)
        fd, tmp_path = tempfile.mkstemp(dir=dir_name)
        try:
            with os.fdopen(fd, 'w') as tmp:
                json.dump(notes, tmp, indent=2)
            os.replace(tmp_path, FILE_PATH)
        except:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            raise
        # Aliases for main.py
get_all_notes = read_all
save_all_notes = write_all
update_note = write_all