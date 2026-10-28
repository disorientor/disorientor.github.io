"""Audio helper for Chord Grid: lets the page analyse the chords of a YouTube video it is streaming.

The page plays the video through YouTube's own embedded player, but browsers won't let a page
hear that player's audio, so for analysis it asks this server:  GET /audio?url=<youtube link>
-> the audio bytes, held in memory only. Nothing is saved to disk.

Run:   python3 server.py            (listens on http://localhost:8787)
Needs: yt-dlp on PATH or importable (e.g. `python3 -m pip install -U yt-dlp`).
"""
import os, re, shutil, subprocess, sys, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get('PORT', 8787))
MAX_SECONDS = 20 * 60
ID = re.compile(r'(?:youtu\.be/|youtube\.com/(?:watch\?(?:.*&)?v=|shorts/|embed/|live/)|music\.youtube\.com/watch\?(?:.*&)?v=)([\w-]{11})')


def ytdlp():
    exe = shutil.which('yt-dlp')
    if exe: return [exe]
    try:
        import yt_dlp  # noqa: F401
        return [sys.executable, '-m', 'yt_dlp']
    except ImportError:
        sys.exit('yt-dlp not found. Install it with:  python3 -m pip install -U yt-dlp')


def fetch(vid):
    """Pull one video's audio straight into memory. Nothing is written to disk; the page streams the video itself."""
    # m4a (AAC) decodes in every browser, Safari included; fall back to whatever audio exists.
    cmd = YTDLP + ['-f', 'bestaudio[ext=m4a]/bestaudio', '--no-playlist', '--match-filter', f'duration < {MAX_SECONDS}',
                   '--no-part', '--quiet', '-o', '-', f'https://www.youtube.com/watch?v={vid}']
    # yt-dlp needs a JS runtime for YouTube; it looks for deno by default, so point it at node if that's all there is.
    if not shutil.which('deno') and shutil.which('node'): cmd[len(YTDLP):len(YTDLP)] = ['--js-runtimes', 'node']
    r = subprocess.run(cmd, capture_output=True, timeout=300)
    if r.returncode or not r.stdout:
        err = r.stderr.decode(errors='replace').strip().splitlines()
        raise RuntimeError(err[-1] if err else 'no audio (longer than 20 minutes?)')
    return r.stdout


class Handler(BaseHTTPRequestHandler):
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        # Chrome's Private Network Access: lets the https site talk to this localhost server.
        self.send_header('Access-Control-Allow-Private-Network', 'true')

    def fail(self, code, msg):
        body = msg.encode()
        self.send_response(code); self.cors()
        self.send_header('Content-Type', 'text/plain; charset=utf-8'); self.send_header('Content-Length', str(len(body)))
        self.end_headers(); self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204); self.cors()
        self.send_header('Access-Control-Allow-Methods', 'GET')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == '/ping': return self.fail(200, 'ok')
        if u.path != '/audio': return self.fail(404, 'not found')
        link = urllib.parse.parse_qs(u.query).get('url', [''])[0]
        m = ID.search(link)
        if not m: return self.fail(400, 'That is not a YouTube link.')
        try:
            data = fetch(m.group(1))
        except subprocess.TimeoutExpired:
            return self.fail(504, 'YouTube took too long to answer.')
        except Exception as e:
            return self.fail(502, str(e))
        self.send_response(200); self.cors()
        self.send_header('Content-Type', 'audio/mp4' if data[4:8] == b'ftyp' else 'audio/webm')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers(); self.wfile.write(data)

    def log_message(self, fmt, *args):
        sys.stderr.write('%s\n' % (fmt % args))


YTDLP = ytdlp()
if __name__ == '__main__':
    print(f'Chord Grid audio helper on http://localhost:{PORT}')
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
