FROM node:26.13-alpine AS build

WORKDIR /build
COPY *.json *.js ./
RUN npm clean-install
COPY src/ ./src
RUN npm run build

FROM ghcr.io/nginx/nginx-unprivileged:1.31.9-alpine-slim

COPY --from=ghcr.io/kyubisation/angular-server-side-configuration:22.1.1 /usr/bin/ngssc /usr/sbin/ngssc

# Add ngssc script
ADD --chmod=755 docker/99-ngssc.sh /docker-entrypoint.d/

# Add nginx configuration
ADD docker/nginx-angular.conf /etc/nginx/conf.d/default.conf

# copy built application from build stage
COPY --from=build --chown=nginx:nginx --chmod=755 /build/dist /usr/share/nginx/html

# Validate the nginx configuration
RUN nginx -t
