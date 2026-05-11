# syntax=docker/dockerfile:1.7
# Multi-stage production build for RentHub API (NestJS)

ARG NODE_VERSION=20-alpine

# ---------- Stage 1: install all deps (incl. dev) ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /repo

# Copy workspace manifests for cache-friendly install
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Disable husky in CI/builds
ENV HUSKY=0
RUN npm ci --include=dev --workspaces --include-workspace-root

# ---------- Stage 2: build ----------
FROM node:${NODE_VERSION} AS build
WORKDIR /repo

ENV HUSKY=0
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY package.json package-lock.json ./
COPY apps/api ./apps/api

WORKDIR /repo/apps/api
RUN npx prisma generate
RUN npm run build

# Prune dev dependencies for the runtime image
WORKDIR /repo
RUN npm prune --omit=dev --workspaces --include-workspace-root

# ---------- Stage 3: runtime ----------
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Non-root user
RUN addgroup -S nodejs && adduser -S -G nodejs -h /app nodejs

# Required runtime artifacts
COPY --from=build --chown=nodejs:nodejs /repo/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=nodejs:nodejs /repo/apps/api/dist ./dist
COPY --from=build --chown=nodejs:nodejs /repo/apps/api/prisma ./prisma
COPY --from=build --chown=nodejs:nodejs /repo/apps/api/package.json ./package.json

# Persisted upload directory
RUN mkdir -p /app/uploads && chown -R nodejs:nodejs /app/uploads
VOLUME ["/app/uploads"]

USER nodejs

EXPOSE 3001

# Use Node's healthcheck — do not depend on curl/wget being present
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Apply pending migrations on container start, then launch the server
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/main.js"]
