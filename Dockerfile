ARG node=22.12-slim

FROM node:${node} AS otd-base

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

# Production image, copy all the files and run next
FROM otd-base AS otd-runner
WORKDIR /app

ENV NODE_ENV=production
ENV NUXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nuxtjs

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nuxtjs:nodejs .next

COPY --from=otd-builder --chown=nuxtjs:nodejs /app/.output ./

USER nuxtjs

EXPOSE 8080
ENV PORT=8080
ENV HOST="0.0.0.0"

HEALTHCHECK --interval=60m --timeout=3s CMD curl -f http://localhost:8080/ || exit 1

CMD ["node", "server/index.mjs"]
