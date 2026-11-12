"""Private Worker-Konfiguration nur mit bekannten Schlüsseln laden."""
ALLOWED = frozenset(('MT5_ACCOUNT_ID', 'MT5_TERMINAL_PATH', 'MT5_WORKER_URL', 'MT5_WORKER_TOKEN',
                     'MT5_ALLOW_LIVE', 'MT5_JOURNAL_PATH', 'MT5_SERVER_TIME_OFFSET_SEC'))


def worker_settings(path):
    settings = dict(line.split('=', 1) for line in path.read_text(encoding='utf-8-sig').splitlines()
                    if line.strip() and not line.startswith('#'))
    if set(settings) - ALLOWED:
        raise ValueError('unexpected_worker_configuration')
    return settings
