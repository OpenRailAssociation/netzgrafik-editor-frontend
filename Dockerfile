FROM node:22.21-alpine as build

WORKDIR /build
COPY *.json *.js ./
RUN npm clean-install
COPY src/ ./src
RUN npm run build

FROM ghcr.io/nginxinc/nginx-unprivileged:1.25.3-alpine-slim

ADD --chmod=755 https://github.com/kyubisation/angular-server-side-configuration/releases/download/v17.0.2/ngssc_64bit /usr/sbin/ngssc

# Add ngssc script
ADD --chmod=755 docker/99-ngssc.sh /docker-entrypoint.d/

# Add nginx configuration
ADD docker/nginx-angular.conf /etc/nginx/conf.d/default.conf

# copy built application from build stage
COPY --from=build --chown=nginx:nginx --chmod=755 /build/dist/netzgrafik-frontend /usr/share/nginx/html

# Validate the nginx configuration
RUN nginx -t
