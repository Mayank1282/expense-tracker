#!/bin/sh
set -e

# Render (and most PaaS hosts) inject the port to listen on at runtime rather
# than at build time, so nginx is patched here instead of in the image.
PORT="${PORT:-8080}"
sed -i "s/listen 8080;/listen ${PORT};/" /etc/nginx/nginx.conf

# A missing APP_KEY produces an unhelpful decryption error on the first request
# rather than an obvious failure, so it is caught up front.
if [ -z "${APP_KEY}" ]; then
    echo "APP_KEY is not set. Generate one with: php artisan key:generate --show" >&2
    exit 1
fi

if [ -z "${MONGODB_URI}" ]; then
    echo "MONGODB_URI is not set. Point it at your MongoDB Atlas cluster." >&2
    exit 1
fi

# Caches are built at boot, not at build, because they bake in environment
# values that only exist now.
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Indexes only. There are no tables to create in a document store, and the
# migration is written to be safe to re-run.
php artisan migrate --force --no-interaction || echo "Index migration skipped or already applied."

exec supervisord -c /etc/supervisord.conf
