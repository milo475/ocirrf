# ursGAL — multi-stage Docker build (V4-15).
# Context нь repo-гийн ROOT байх ёстой (frontend-ийг хамт build хийдэг):
#   docker build -f backend/Dockerfile .

# ── 1. Build: backend + frontend ──
FROM node:20-slim AS build
# bcrypt зэрэг native модулийн нөөц build (prebuilt олдохгүй үед)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY backend/package*.json backend/
RUN cd backend && npm ci

COPY frontend/package*.json frontend/
RUN cd frontend && npm ci

COPY backend backend
RUN cd backend && npx prisma generate && npm run build

COPY frontend frontend
RUN cd frontend && npm run build

# ── 2. Runtime ──
FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app/backend

# Бүтэн node_modules — prisma CLI (migrate deploy) + tsx (seed) runtime-д хэрэгтэй
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/src/generated ./src/generated
COPY backend/package*.json ./
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./
COPY backend/scripts ./scripts
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
# SPA — backend __dirname-ээс ../../frontend/dist гэж уншина
COPY --from=build /app/frontend/dist ../frontend/dist

EXPOSE 3000
CMD ["sh", "./docker-entrypoint.sh"]
