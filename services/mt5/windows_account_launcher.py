"""Isolierter Task-Scheduler-Start je VPS-Konto; ohne --execute nur Monitoring."""
import argparse
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid


def launch(account_id, execute=False, root=Path(r'C:\MMT')):
    account_id = str(uuid.UUID(account_id))
    private = root / 'private' / 'accounts' / account_id
    settings = dict(line.split('=', 1) for line in (private / 'worker.env').read_text(encoding='utf-8-sig').splitlines()
                    if line.strip() and not line.startswith('#'))
    allowed = {'MT5_ACCOUNT_ID', 'MT5_TERMINAL_PATH', 'MT5_WORKER_URL', 'MT5_WORKER_TOKEN',
               'MT5_ALLOW_LIVE', 'MT5_JOURNAL_PATH', 'MT5_SERVER_TIME_OFFSET_SEC'}
    terminal = root / 'accounts' / account_id / 'terminal64.exe'
    if (set(settings) - allowed or settings.get('MT5_ACCOUNT_ID') != account_id
            or Path(settings.get('MT5_TERMINAL_PATH', '')).resolve() != terminal.resolve()
            or Path(settings.get('MT5_JOURNAL_PATH', '')).resolve() != (private / 'execution.sqlite3').resolve()):
        raise ValueError('account_configuration_mismatch')
    if execute and settings.get('MT5_ALLOW_LIVE') != 'true':
        raise ValueError('execution_not_enabled_in_private_configuration')
    os.environ.update(settings)
    if not execute:
        os.environ['MT5_ALLOW_LIVE'] = 'false'
    import certifi
    os.environ['SSL_CERT_FILE'] = certifi.where()
    runtime = root / 'app' / 'services' / 'mt5'
    os.chdir(runtime)
    sys.path.insert(0, str(runtime))
    ini = terminal.parent / ('trading.ini' if execute else 'read-only.ini')
    subprocess.Popen([str(terminal), '/portable', '/config:' + str(ini)], creationflags=0x08000000)
    time.sleep(10)
    sys.argv = [str(runtime / 'worker.py')] + ([] if execute else ['--monitor'])
    from worker import main
    from worker_lock import terminal_worker_lock, terminal_lock_path
    with terminal_worker_lock(terminal_lock_path(terminal)):
        return main()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--account-id', required=True, type=lambda v: str(uuid.UUID(v)))
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    private = Path(r'C:\MMT\private\accounts') / args.account_id
    sys.stdout = (private / 'worker.stdout.log').open('a', encoding='utf-8', buffering=1)
    sys.stderr = (private / 'worker.stderr.log').open('a', encoding='utf-8', buffering=1)
    raise SystemExit(launch(args.account_id, args.execute))
