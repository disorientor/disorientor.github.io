#!/bin/sh
set -eu
HAECCEITY_WEB_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PORT=8080
while lsof -i :"$PORT" >/dev/null 2>&1; do
    PORT=$((PORT + 1))
done
(sleep 1 && open "http://localhost:$PORT/index.html") &
exec python3 "$HAECCEITY_WEB_DIR/preview.py" --directory "$HAECCEITY_WEB_DIR" --port "$PORT"
