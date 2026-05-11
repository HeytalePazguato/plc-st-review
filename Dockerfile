# syntax=docker/dockerfile:1.7

# Build stage: install deps (with native build toolchain), apply patch, compile TS.
FROM node:20-bookworm AS builder

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        build-essential \
        python3 \
        ca-certificates \
        git \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY package.json package-lock.json* ./
COPY patches ./patches

RUN npm install --ignore-scripts \
 && npx patch-package \
 && npm rebuild tree-sitter tree-sitter-iec61131-3-st

COPY tsconfig.json ./
COPY src ./src

RUN npx tsc -p tsconfig.json

# Runtime stage: small Node image, copy built dist + node_modules.
FROM node:20-bookworm-slim AS runtime

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates git \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/package.json ./package.json

ENV NODE_ENV=production

ENTRYPOINT ["node", "/app/dist/cli.js"]
