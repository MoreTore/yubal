#!/bin/sh
set -e

# Copy default beets config if not present
if [ ! -f /app/beets/config.yaml ]; then
    mkdir -p /app/beets
    cp /app/beets-default/config.yaml /app/beets/config.yaml
    echo "Initialized default beets config"
fi

exec "$@"
