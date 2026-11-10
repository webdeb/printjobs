# ==========================================
# 1. Builder Stage: Build Frontend SPA
# ==========================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy full source and build Vite frontend
ARG VITE_GIT_COMMIT=""
ENV VITE_GIT_COMMIT=${VITE_GIT_COMMIT}
COPY . .
RUN npm run build

# ==========================================
# 2. Production Runner Stage
# ==========================================
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Install runtime dependencies: ffmpeg for Bambu RTSPS snapshot decoding, gosu for clean privilege drop to non-root
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl gosu && \
    rm -rf /var/lib/apt/lists/*

# Environment defaults
ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/data/printjobs.sqlite \
    CACHE_DIR=/data/camera_cache \
    FFMPEG_PATH=ffmpeg

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built frontend assets from builder
COPY --from=builder /app/dist ./dist

# Copy backend server code, entrypoint, and TypeScript type definitions
COPY server ./server
COPY src/types ./src/types
COPY tsconfig.json ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Prepare persistent data folder & permissions for non-root 'node' user
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    mkdir -p /data && \
    chown -R node:node /data /app

# Persistent data volume for SQLite & cache
VOLUME ["/data"]

# API & Web UI: 3001 | Bambu SSDP UDP Discovery: 1990, 2021
EXPOSE 3001 1990/udp 2021/udp

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "start"]
