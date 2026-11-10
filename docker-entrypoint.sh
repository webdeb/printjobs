#!/bin/sh
set -e

# Ensure persistent /data volume is owned by non-root 'node' user (migrates root-owned bind mounts cleanly)
if [ "$(id -u)" = "0" ]; then
  mkdir -p /data /data/camera_cache
  chown -R node:node /data
  exec gosu node "$@"
fi

exec "$@"
