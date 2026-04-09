# Build frontend
FROM node:20-slim AS frontend-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# Production
FROM node:20-slim
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ .
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

COPY --from=frontend-build /app/client/dist ./public

EXPOSE 3000
CMD ["sh", "-c", "\
  if [ -z \"$DATABASE_URL\" ]; then \
    export DATABASE_URL=\"${DATABASE_PRIVATE_URL:-${RAILWAY_DATABASE_URL:-}}\"; \
  fi; \
  if [ -z \"$DATABASE_URL\" ]; then \
    echo 'FATAL: DATABASE_URL is not set. Add a Postgres database in Railway and link it to this service.'; \
    echo 'Available env vars:'; env | grep -i 'database\\|postgres\\|pg' | sed 's/=.*/=***/' || true; \
    exit 1; \
  fi; \
  echo \"DATABASE_URL is set (${#DATABASE_URL} chars)\"; \
  npx prisma migrate deploy && npx tsx src/index.ts"]
