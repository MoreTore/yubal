# Build frontend
FROM oven/bun:1-alpine AS web
ARG COMMIT_SHA=dev
WORKDIR /app/web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY web/ ./
RUN VITE_COMMIT_SHA=$COMMIT_SHA bun run build

# Builder - install Python deps
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen --no-cache

# Runtime
FROM python:3.12-slim-bookworm
WORKDIR /app

ARG TARGETARCH
ARG COMMIT_SHA=dev

# Install ffmpeg (johnvansickle static) + deno
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl xz-utils unzip \
    && FFMPEG_ARCH=$([ "$TARGETARCH" = "arm64" ] && echo "arm64" || echo "amd64") \
    && curl -L "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-${FFMPEG_ARCH}-static.tar.xz" \
       | tar -xJ --strip-components=1 -C /usr/local/bin/ --wildcards '*/ffmpeg' '*/ffprobe' \
    && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
    && apt-get purge -y curl xz-utils unzip \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.venv /app/.venv
COPY --from=web /app/web/dist ./web/dist
COPY yubal/ ./yubal/
COPY beets/config.yaml /app/beets-default/config.yaml
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    COMMIT_SHA=$COMMIT_SHA \
    YUBAL_HOST=0.0.0.0 \
    YUBAL_PORT=8000 \
    YUBAL_DATA_DIR=/app/data \
    YUBAL_BEETS_DIR=/app/beets \
    YUBAL_YTDLP_DIR=/app/ytdlp

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["python", "-m", "yubal"]
