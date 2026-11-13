"""Release-Hashes müssen trotz Windows-autocrlf den GitHub-Commit-Bytes entsprechen."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

from build_release_manifest import manifest, git_bytes


class ReleaseManifestTest(unittest.TestCase):
    def test_crlf_working_tree_matches_lf_git_blobs(self):
        fixtures = Path(__file__).resolve().parents[2] / '.debug/mt5-release-deploy'
        fixtures.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=fixtures) as temporary:
            root = Path(temporary)
            directory = root / 'services/mt5'
            directory.mkdir(parents=True)
            (directory / 'worker.py').write_bytes(b'VALUE = 1\r\nVALUE2 = 2\r\n')
            (directory / 'windows_account_launcher.py').write_bytes(b'VALUE = 3\n')
            (directory / 'deploy_release.ps1').write_bytes(b"Write-Output 'fixture'\r\n")
            expected = manifest(directory)
            self.assertEqual(expected['files']['worker.py'], hashlib.sha256(b'VALUE = 1\nVALUE2 = 2\n').hexdigest())
            encoded = (json.dumps(expected, indent=2) + '\n').encode()
            (directory / 'release_manifest.json').write_bytes(encoded)

            def git(*args):
                return subprocess.check_output(['git', *args], cwd=root, stderr=subprocess.DEVNULL)

            git('init', '-q')
            git('config', 'core.autocrlf', 'true')
            git('add', 'services/mt5')
            git('-c', 'user.name=Release Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture')
            revision = git('rev-parse', 'HEAD').decode().strip()
            self.assertEqual(manifest(directory, revision), expected)
            self.assertEqual(git_bytes(directory, revision, 'deploy_release.ps1'), b"Write-Output 'fixture'\n")
            self.assertEqual(git_bytes(directory, revision, 'release_manifest.json'), encoded)


if __name__ == '__main__':
    unittest.main()
