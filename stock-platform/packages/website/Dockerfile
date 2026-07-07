# ── Stage 1: Install dependencies ────────────────────────────────
FROM node:20.11-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/website/package.json ./packages/website/

RUN npm ci --workspace=@stock/shared --workspace=@stock/website --include-workspace-root

# ── Stage 2: Build ───────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

# Copy shared source and build
COPY packages/shared/ ./packages/shared/
RUN npm run build -w @stock/shared

# Copy website source
COPY packages/website/ ./packages/website/

# Build Next.js (standalone output enabled in next.config.mjs for production)
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# The website now has its OWN backend at same-origin /api (no external backend).
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_STORE_PHONE=212622265053
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_STORE_PHONE=${NEXT_PUBLIC_STORE_PHONE}

RUN npm run build -w @stock/website

# ── Stage 3: Production image ───────────────────────────────────
FROM node:20.11-alpine AS production
WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Copy standalone output
COPY --from=builder /app/packages/website/.next/standalone/ ./
# Copy static assets and public files
COPY --from=builder /app/packages/website/.next/static/ ./packages/website/.next/static/
COPY --from=builder /app/packages/website/public/ ./packages/website/public/
# Ensure the Prisma client + query-engine binary are present in the image.
# (Next's standalone tracing frequently misses the engine .node file, which
# causes a runtime "Query engine binary not found" crash.)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "packages/website/server.js"]
