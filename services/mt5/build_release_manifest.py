"""Hashmanifest für ein vollständiges, unveränderliches Worker-Codeverzeichnis."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path


def git_bytes(directory, revision, name):
    return subprocess.check_output(['git', 'show', f'{revision}:services/mt5/{name}'], cwd=directory.parent.parent)


def runtime_name(name):
    return name.endswith('.py') and not name.startswith('test_') and name != Path(__file__).name


def manifest(directory, revision=None):
    if revision:
        paths = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', revision, '--', 'services/mt5'], cwd=directory.parent.parent).decode().splitlines()
        names = sorted(Path(path).name for path in paths if runtime_name(Path(path).name))
        read = lambda name: git_bytes(directory, revision, name)
    else:
        names = sorted(path.name for path in directory.glob('*.py') if runtime_name(path.name))
        # GitHub raw liefert Commit-Bytes, nicht die durch autocrlf veränderte Windows-Arbeitskopie.
        read = lambda name: (directory / name).read_bytes().replace(b'\r\n', b'\n')
    return {'version': 1, 'files': {name: hashlib.sha256(read(name)).hexdigest() for name in names}}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=Path(__file__).with_name('release_manifest.json'))
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--commit', type=lambda value: value if re.fullmatch('[a-f0-9]{40}', value) else parser.error('full commit SHA required'))
    args = parser.parse_args()
    directory = Path(__file__).parent
    encoded = (json.dumps(manifest(directory, args.commit), indent=2) + '\n').encode()
    if args.check or args.commit:
        actual = git_bytes(directory, args.commit, 'release_manifest.json') if args.commit else args.output.read_bytes().replace(b'\r\n', b'\n')
        if actual != encoded:
            raise SystemExit('Release manifest does not match runtime files')
    else:
        args.output.write_bytes(encoded)
    script = git_bytes(directory, args.commit, 'deploy_release.ps1') if args.commit else (directory / 'deploy_release.ps1').read_bytes().replace(b'\r\n', b'\n')
    print('Manifest SHA256 ' + hashlib.sha256(encoded).hexdigest())
    print('Deploy script SHA256 ' + hashlib.sha256(script).hexdigest())
