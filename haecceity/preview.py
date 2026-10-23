#!/usr/bin/env python3
"""Local preview with cross-origin isolation and fresh development assets."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
parser=argparse.ArgumentParser()
parser.add_argument('--directory',default=str(Path(__file__).resolve().parent))
parser.add_argument('--port',type=int,default=8080)
args=parser.parse_args()
print(f'Haecceity: http://localhost:{args.port}/index.html',flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),partial(Handler,directory=args.directory)).serve_forever()
