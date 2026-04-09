# Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# Production
FROM node:20-alpine
WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ .
RUN npx prisma generate

COPY --from=frontend-build /app/client/dist ./public

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy; npx tsx src/index.ts"]
