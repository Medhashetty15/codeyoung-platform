# syntax=docker/dockerfile:1.7
# One build for the whole product (docs/runbook.md):
#   target `api`: API, worker and ops CLI (same image, different command)
#   target `web`: the built web app on Caddy, proxying /api to the API
ARG NODE_IMAGE=node:22.23.0-bookworm-slim
ARG CADDY_IMAGE=caddy:2.11.2-alpine

FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV CI=true NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false

# Manifests only, so dependency layers stay cached while sources change.
FROM base AS manifests
COPY package.json package-lock.json .npmrc ./
COPY packages/time/package.json packages/time/
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

FROM manifests AS deps
RUN --mount=type=cache,target=/root/.npm npm ci

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/api apps/api
COPY apps/web apps/web
RUN npm run build:packages \
 && npm run build -w @app/api \
 && npm run build -w @app/web

# Runtime dependencies of the API only (no web, no dev tools).
FROM manifests AS api-deps
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace @app/api \
 && mkdir -p apps/api/node_modules

FROM ${NODE_IMAGE} AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=api-deps /app/node_modules node_modules
COPY --from=api-deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/packages/time/package.json packages/time/
COPY --from=build /app/packages/time/dist packages/time/dist
COPY --from=build /app/packages/contracts/package.json packages/contracts/
COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
USER node
EXPOSE 3000
# API by default; the worker runs `node apps/api/dist/worker.js`, the CLI `node apps/api/dist/cli.js`.
CMD ["node", "apps/api/dist/main.js"]

# Source maps stay out of the public image.
FROM build AS web-dist
RUN find apps/web/dist -name '*.map' -delete

FROM ${CADDY_IMAGE} AS web
COPY infra/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=web-dist /app/apps/web/dist /srv
EXPOSE 8080
