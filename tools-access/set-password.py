"""Run from any directory to update the browser access password."""
import getpass
import hashlib
import json
import pathlib
import secrets

password = getpass.getpass('New tools password: ')
if not password:
    raise SystemExit('Password must not be empty.')
if password != getpass.getpass('Confirm password: '):
    raise SystemExit('Passwords do not match.')
salt = secrets.token_bytes(16)
iterations = 210000
config = dict(salt=salt.hex(), iterations=iterations,
              verifier=hashlib.pbkdf2_hmac('sha256', password.encode(), salt, iterations).hex())
pathlib.Path(__file__).with_name('config.js').write_text(
    '// Browser-only access barrier, not server authentication. Change with set-password.py.\n'
    + 'window.TOOLS_ACCESS_CONFIG = ' + json.dumps(config, indent=2) + ';\n')
print('Updated tools password. Publish config.js with the website; existing unlocks expire.')
