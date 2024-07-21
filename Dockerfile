ARG node=20.17-slim

FROM node:${node}
RUN apt update -y
RUN apt-get clean
WORKDIR /app
COPY *.json .
COPY src src
RUN npm ci
ENV APP_PORT=80
EXPOSE 80
HEALTHCHECK --interval=60m --timeout=3s CMD curl -f http://localhost/ || exit 1
CMD npm start
