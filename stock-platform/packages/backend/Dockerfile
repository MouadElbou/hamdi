# ── Stage 1: Install dependencies ────────────────────────────────
FROM node:20.11-alpine AS deps
WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

# Install all workspace dependencies (needed for build)
RUN npm ci --workspace=@stock/shared --workspace=@stock/backend --include-workspace-root

# ── Stage 2: Build ───────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

# Copy shared source and build it
COPY packages/shared/ ./packages/shared/
RUN npm run build -w @stock/shared

# Copy backend source (including prisma schema)
COPY packages/backend/ ./packages/backend/

# Generate Prisma client and build TypeScript
RUN npx prisma generate --schema=packages/backend/prisma/schema.prisma
RUN npm run build -w @stock/backend

# ── Stage 3: Production image ───────────────────────────────────
FROM node:20.11-alpine AS production
WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Copy root workspace config
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

# Install production dependencies only
RUN npm ci --workspace=@stock/shared --workspace=@stock/backend --include-workspace-root --omit=dev

# Copy built shared package
COPY --from=builder /app/packages/shared/dist/ ./packages/shared/dist/

# Copy built backend
COPY --from=builder /app/packages/backend/dist/ ./packages/backend/dist/

# Copy Prisma schema + migrations + generated client
COPY --from=builder /app/packages/backend/prisma/ ./packages/backend/prisma/
COPY --from=builder /app/packages/backend/node_modules/.prisma/ ./packages/backend/node_modules/.prisma/
COPY --from=builder /app/node_modules/.prisma/ ./node_modules/.prisma/

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
EXPOSE 3001

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy --schema=packages/backend/prisma/schema.prisma && node packages/backend/dist/server.js"]
