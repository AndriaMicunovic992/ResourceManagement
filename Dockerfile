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
CMD ["npm", "start"]
