# ==========================================
# 1. Builder Stage: Build Frontend SPA
# ==========================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy full source and build Vite frontend
COPY . .
RUN npm run build

# ==========================================
# 2. Production Runner Stage
# ==========================================
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Install runtime dependencies: ffmpeg for Bambu RTSPS snapshot decoding
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl && \
    rm -rf /var/lib/apt/lists/*

# Environment defaults
ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/data/printjobs.sqlite \
    CACHE_DIR=/data/camera_cache \
    FFMPEG_PATH=ffmpeg

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend assets from builder
COPY --from=builder /app/dist ./dist

# Copy backend server code and TypeScript type definitions
COPY server ./server
COPY src/types ./src/types
COPY tsconfig.json ./

# Prepare persistent data folder
RUN mkdir -p /data && chown -R node:node /data /app

# Run as non-root user
# USER node

# Persistent data volume for SQLite & cache
VOLUME ["/data"]

# API & Web UI: 3001 | Bambu SSDP UDP Discovery: 1990, 2021
EXPOSE 3001 1990/udp 2021/udp

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["npm", "start"]
