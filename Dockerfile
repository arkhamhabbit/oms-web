# syntax=docker/dockerfile:1
# OMS console: one image for any environment. The OMS address is NOT built in; the
# container writes /config.js from its environment each time it starts (deploy/docker-entrypoint.sh).

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# openapi-typescript declares a peer of TypeScript 5 while the project uses 6 (the lockfile pins both);
# newer npm refuses that on a clean install, so peer ranges are not re-checked here.
RUN npm ci --legacy-peer-deps
COPY . .
# `npm run build` also runs generate:api:check, which compares src/api/schema.gen.ts with the
# contract file that lives in the orchestrator repo, outside this build context. That check is
# run on the machine that builds the image (see the Status); here only the compile and bundle.
RUN npx tsc -b && npx vite build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
USER root
RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/oms/security-headers.conf
COPY deploy/docker-entrypoint.sh /docker-entrypoint.d/40-oms-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
# The two files the entrypoint rewrites at start must be writable by the non-root user.
RUN chmod 755 /docker-entrypoint.d/40-oms-config.sh \
 && touch /etc/nginx/oms/csp.conf \
 && chown nginx:nginx /etc/nginx/oms/csp.conf /usr/share/nginx/html/config.js
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
