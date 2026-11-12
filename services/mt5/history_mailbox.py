"""Lokaler Weckauftrag aus dem bestehenden Poll; im Leerlauf kein Netz-/Brokerzugriff."""
from datetime import datetime
import os
from pathlib import Path


def read_text(path):
    try:return path.read_text(encoding='ascii')
    except FileNotFoundError:return None


class HistoryMailbox:
    def __init__(self, path=None):
        journal=Path(os.environ.get('MT5_JOURNAL_PATH',Path(__file__).with_name('execution.sqlite3')))
        self.path=Path(path) if path else journal.with_name('history.request')
        self.done=self.path.with_suffix('.done')

    def request(self, value):
        if value is None:return
        if not isinstance(value,str) or len(value)>40 or datetime.fromisoformat(value.replace('Z','+00:00')).tzinfo is None:
            raise ValueError('invalid_history_request')
        if read_text(self.path)!=value:
            temporary=self.path.with_suffix('.tmp')
            temporary.write_text(value,encoding='ascii')
            temporary.replace(self.path)

    def pending(self):
        value=read_text(self.path)
        return value if value and value!=read_text(self.done) else None

    def finish(self, value):
        self.done.write_text(value,encoding='ascii')
