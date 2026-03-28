ARG build_node=24.14-slim
ARG run_node=24.14-alpine

FROM node:${build_node} AS otd-base

FROM otd-base AS otd-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM otd-base AS otd-builder
WORKDIR /app
COPY --from=otd-deps /app/node_modules ./node_modules
COPY . .
ENV NUXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production image, only ship the bundled Nitro output on a small runtime base.
FROM node:${run_node} AS otd-runner
WORKDIR /app

ENV NODE_ENV=production
ENV NUXT_TELEMETRY_DISABLED=1

RUN addgroup -S nodejs && adduser -S -u 1001 -G nodejs nuxtjs

COPY --from=otd-builder --chown=nuxtjs:nodejs /app/.output ./

USER nuxtjs

EXPOSE 8080
ENV PORT=8080
ENV HOST="0.0.0.0"

HEALTHCHECK --interval=60m --timeout=3s CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/"]

CMD ["node", "server/index.mjs"]
