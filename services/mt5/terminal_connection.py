"""Der SDK-Terminalpfad ist positional; vor dem Workerstart die tatsächliche Instanz prüfen."""
from pathlib import Path


def initialize_terminal(api, path, *, timeout=5000, portable=False, **credentials):
    path = Path(path).resolve()
    # path= wird vom nativen SDK nicht als Terminalauswahl ausgewertet (MQL5 initialize-Dokumentation).
    if not api.initialize(str(path), timeout=timeout, portable=portable, **credentials):
        return False
    terminal = api.terminal_info()
    if (terminal is None or Path(terminal.path).resolve() != path.parent
            or (portable and Path(terminal.data_path).resolve() != path.parent)):
        api.shutdown()
        raise ValueError('terminal_path_mismatch')
    return True
