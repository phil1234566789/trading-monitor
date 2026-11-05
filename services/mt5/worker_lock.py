"""Ein Terminal darf nur von einem Ausführungsworker verwaltet werden."""
from contextlib import contextmanager
import msvcrt
import hashlib
import os
import tempfile
from pathlib import Path


def terminal_lock_path(terminal):
    # Program Files ist nicht beschreibbar; derselbe Terminalpfad braucht trotzdem dieselbe Sperre.
    key=hashlib.sha256(os.path.normcase(str(Path(terminal).resolve())).encode()).hexdigest()
    folder=Path(os.environ.get("LOCALAPPDATA",tempfile.gettempdir())) / "MilkyMetaTrader" / "locks"
    folder.mkdir(parents=True,exist_ok=True)
    return folder / (key+".lock")


@contextmanager
def terminal_worker_lock(path):
    with open(path, 'a+b') as handle:
        if handle.tell() == 0:
            handle.write(b'0')
            handle.flush()
        handle.seek(0)
        try:
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            raise ValueError('terminal_worker_already_running') from None
        try:
            yield
        finally:
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
