# syntax=docker/dockerfile:1.7
# Multi-stage production build for RentHub web (React + Vite)

ARG NODE_VERSION=20-alpine
ARG NGINX_VERSION=1.27-alpine

# ---------- Stage 1: install ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

ENV HUSKY=0
RUN npm ci --include=dev --workspaces --include-workspace-root

# ---------- Stage 2: build ----------
FROM node:${NODE_VERSION} AS build
WORKDIR /repo

ENV HUSKY=0
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY package.json package-lock.json ./
COPY apps/web ./apps/web

# Build-time API URL (baked into the bundle)
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

WORKDIR /repo/apps/web
RUN npm run build

# ---------- Stage 3: nginx ----------
FROM nginx:${NGINX_VERSION} AS runtime

# Run as non-root for least-privilege
RUN apk add --no-cache curl \
  && rm -rf /usr/share/nginx/html/*

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
