# syntax=docker/dockerfile:1.7

FROM node:22.11-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:22.11-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22.11-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:22.11-alpine AS production
WORKDIR /app
ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn \
    NODE_OPTIONS="--enable-source-maps"
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1
CMD ["node", "dist/main.js"]
