# syntax=docker/dockerfile:1

# ===========================================================================
# Submitta web — Next.js 16 App Router
#
# Three stages: dependencies, build, runtime. The runtime stage copies the
# standalone output produced by `output: "standalone"` in next.config.ts, so
# the final image contains the server and its traced modules — not the full
# dependency tree, and none of the build toolchain.
#
# Build context is `frontend/`.
# ===========================================================================

ARG NODE_VERSION=22-alpine

# --- Dependencies ----------------------------------------------------------
FROM node:${NODE_VERSION} AS deps

WORKDIR /app

# Manifests only. This layer is rebuilt when a dependency changes and reused
# for every other edit.
COPY package.json package-lock.json ./

# `npm ci` rather than `npm install`: it installs exactly the lockfile and
# fails if package.json has drifted, so the image cannot silently pick up a
# different version from the one that was tested.
RUN npm ci

# --- Build -----------------------------------------------------------------
FROM node:${NODE_VERSION} AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN npm run build

# --- Runtime ---------------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# The standalone server, then the two directories the trace deliberately
# leaves out because a CDN would normally serve them. There is no CDN here,
# so the Node server serves them itself — which it does automatically once
# they sit in these exact locations.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static     ./.next/static
COPY --from=build /app/public           ./public

# `node` (uid 1000) ships with the official image.
USER node

EXPOSE 3000

# Rendering /login proves the Node server is up and serving, not merely that
# the process is alive. wget comes from busybox in the Alpine image.
#
# 127.0.0.1, not localhost: the standalone server binds IPv4 only, while
# `localhost` resolves to ::1 first inside the container — which is refused,
# and would mark a perfectly healthy container unhealthy forever.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD wget --quiet --spider --tries=1 http://127.0.0.1:3000/login || exit 1

# server.js is emitted by the standalone build; it replaces `next start`,
# which would require the Next CLI and therefore the full dependency tree.
CMD ["node", "server.js"]
