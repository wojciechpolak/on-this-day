ARG node=20.17-slim

FROM node:${node}
RUN apt update -y
RUN apt-get clean
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 otd
WORKDIR /app
COPY --chown=otd:nodejs *.json .
COPY --chown=otd:nodejs src src
RUN npm ci --omit=dev
USER otd
ENV APP_PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=60m --timeout=3s CMD curl -f http://localhost:8080/ || exit 1
CMD ["npm", "start"]
