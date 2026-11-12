"""Eigener lesender Historienprozess: blockiert weder Tagesstopp noch Entry-Prüfung."""
import argparse
import os
from pathlib import Path
import sys
import uuid
from worker_environment import worker_settings


def launch(account_id, config, root=Path(r'C:\MMT')):
    account_id = str(uuid.UUID(account_id))
    config = Path(config).resolve()
    if not config.is_relative_to((root / 'private').resolve()) or config.name != 'worker.env':
        raise ValueError('history_configuration_not_private')
    settings = worker_settings(config)
    terminal = Path(settings.get('MT5_TERMINAL_PATH', '')).resolve()
    expected = ((root / 'terminal' / 'terminal64.exe').resolve(),
                (root / 'accounts' / account_id / 'terminal64.exe').resolve())
    if terminal not in expected or settings.get('MT5_ACCOUNT_ID', account_id) != account_id:
        raise ValueError('history_account_configuration_mismatch')
    os.environ.update(settings)
    os.environ['MT5_ACCOUNT_ID'] = account_id
    os.environ['MT5_ALLOW_LIVE'] = 'false'
    import certifi
    os.environ['SSL_CERT_FILE'] = certifi.where()
    from history_worker import main
    return main()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--account-id', required=True)
    parser.add_argument('--config', required=True)
    args = parser.parse_args()
    private = Path(r'C:\MMT\private')
    account_id = str(uuid.UUID(args.account_id))
    sys.stdout = (private / ('history-' + account_id + '.stdout.log')).open('a', encoding='utf-8', buffering=1)
    sys.stderr = (private / ('history-' + account_id + '.stderr.log')).open('a', encoding='utf-8', buffering=1)
    raise SystemExit(launch(account_id, args.config))
