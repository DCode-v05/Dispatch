# syntax=docker/dockerfile:1.7

# Stage 1: Dependencies
FROM node:22.11-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Stage 2: Build
FROM node:22.11-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars must be available at build time so Next.js inlines them into the client bundle.
ARG NEXT_PUBLIC_USER_URL
ARG NEXT_PUBLIC_CHAT_URL
ARG NEXT_PUBLIC_MESSAGE_URL
ARG NEXT_PUBLIC_NOTIF_URL
ARG NEXT_PUBLIC_PRESENCE_URL
ARG NEXT_PUBLIC_CHAT_WS
ARG NEXT_PUBLIC_PRESENCE_WS
ARG NEXT_PUBLIC_NOTIF_WS
ENV NEXT_PUBLIC_USER_URL=$NEXT_PUBLIC_USER_URL
ENV NEXT_PUBLIC_CHAT_URL=$NEXT_PUBLIC_CHAT_URL
ENV NEXT_PUBLIC_MESSAGE_URL=$NEXT_PUBLIC_MESSAGE_URL
ENV NEXT_PUBLIC_NOTIF_URL=$NEXT_PUBLIC_NOTIF_URL
ENV NEXT_PUBLIC_PRESENCE_URL=$NEXT_PUBLIC_PRESENCE_URL
ENV NEXT_PUBLIC_CHAT_WS=$NEXT_PUBLIC_CHAT_WS
ENV NEXT_PUBLIC_PRESENCE_WS=$NEXT_PUBLIC_PRESENCE_WS
ENV NEXT_PUBLIC_NOTIF_WS=$NEXT_PUBLIC_NOTIF_WS

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Production
FROM node:22.11-alpine AS production
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=build --chown=appuser:appgroup /app/public ./public
COPY --from=build --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=build --chown=appuser:appgroup /app/.next/static ./.next/static
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1
CMD ["node", "server.js"]
