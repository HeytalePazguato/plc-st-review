# syntax=docker/dockerfile:1.7

# Build stage: install deps and compile TS. The parser is WebAssembly
# (`web-tree-sitter` + the grammar's `.wasm`), so there's no native build
# toolchain to install and nothing to patch or rebuild.
FROM node:20-bookworm AS builder

WORKDIR /build

COPY package.json package-lock.json* ./

RUN npm ci

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
COPY docker-entrypoint.sh /usr/local/bin/plc-st-review-entrypoint
RUN chmod +x /usr/local/bin/plc-st-review-entrypoint

ENV NODE_ENV=production

ENTRYPOINT ["/usr/local/bin/plc-st-review-entrypoint"]
