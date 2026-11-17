#!/bin/sh
set -eu
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

PORT=8484
while lsof -i :$PORT >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

echo "Starting Haecceity Web on http://localhost:$PORT ..."
(sleep 1 && open "http://localhost:$PORT/index.html") &
exec python3 -m http.server "$PORT" -d "$DIR"
