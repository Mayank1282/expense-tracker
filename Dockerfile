# syntax=docker/dockerfile:1
#
# Single-image build for the whole application.
#
# Project 3 learned this the hard way: Render has no PHP runtime, so a Laravel
# app ships as a Docker image or it does not ship. Because Project 4 is a
# monolith, that image contains the frontend too — Vite compiles into
# public/build and nginx serves it from the same container. There is no second
# deployment to keep in step.

# ---------------------------------------------------------------------------
# Stage 1 — build the frontend
# ---------------------------------------------------------------------------
FROM node:24-alpine AS assets

WORKDIR /app

# Dependencies are copied on their own so a change to application code does not
# invalidate the npm install layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY vite.config.js ./
COPY resources ./resources
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 — PHP dependencies
# ---------------------------------------------------------------------------
FROM composer:2 AS vendor

WORKDIR /app

COPY composer.json composer.lock ./

# The MongoDB extension is not present in the composer image, so the platform
# requirement is ignored here and satisfied for real in the runtime stage.
RUN composer install \
        --no-dev \
        --no-scripts \
        --no-interaction \
        --prefer-dist \
        --optimize-autoloader \
        --ignore-platform-req=ext-mongodb

# ---------------------------------------------------------------------------
# Stage 3 — runtime
# ---------------------------------------------------------------------------
# Debian, not Alpine, and for one specific reason.
#
# On Alpine the mongodb extension links against musl's OpenSSL and fails the TLS
# handshake with Atlas — "tlsv1 alert internal error calling hello". The
# container starts, nginx serves, and every database call dies, which is exactly
# what the first deploy did: the site was "live" while nothing could reach the
# database. Debian's OpenSSL negotiates with Atlas correctly. The image is
# larger; a database that connects is worth the megabytes.
FROM php:8.4-fpm AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        nginx \
        supervisor \
        ca-certificates \
        libicu-dev \
        libssl-dev \
        pkg-config \
        autoconf \
        g++ \
        make \
    && docker-php-ext-install intl opcache \
    && pecl install mongodb \
    && docker-php-ext-enable mongodb \
    && update-ca-certificates \
    && sed -i 's/CipherString = DEFAULT@SECLEVEL=2/CipherString = DEFAULT@SECLEVEL=1/' \
        /etc/ssl/openssl.cnf \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

COPY . .
COPY --from=vendor /app/vendor ./vendor
COPY --from=assets /app/public/build ./public/build

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/99-app.ini
COPY docker/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint

RUN mkdir -p storage/framework/cache storage/framework/sessions \
        storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 8080

ENTRYPOINT ["entrypoint"]
