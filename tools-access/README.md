Tools password screen
=====================

The homepage links and built tool pages use this shared browser-only password
screen. An unlock lasts for the tab's session. Visit `/tools-access/` and choose
LOCK TOOLS to lock that tab again. The main website and games remain public.

To change the password, run `python3 tools-access/set-password.py`, then publish
the updated `config.js`. Password input is hidden and only a salted PBKDF2
verifier is saved. Changing the verifier invalidates previous unlocks.

The tool build scripts include the access screen automatically. Publish the
entire `tools-access` directory along with the generated tool pages and homepage.
The scripts require HTTPS (or localhost for development) and session storage.

This is a casual access barrier, not secure authentication. GitHub Pages serves
the code and tools publicly; visitors can bypass browser checks, and the public
repository also contains source files. Protect sensitive tools with server or
hosting authentication if private access is required.
