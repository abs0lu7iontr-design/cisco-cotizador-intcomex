# ============================================================================
# CISCO AUTOMATED v2.1 - MULTI-STAGE DOCKERFILE FOR CLOUD DEPLOYMENT
# ============================================================================

# Stage 1: Build Frontend Application
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build production bundle
COPY . .
RUN npm run build

# Stage 2: Production Web Server
FROM nginx:alpine AS runner
WORKDIR /usr/share/nginx/html

# Clean default static assets
RUN rm -rf ./*

# Copy build artifacts from builder stage
COPY --from=builder /app/dist ./

# Copy custom nginx configuration for SPA routing & security headers
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    client_max_body_size 50M; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    gzip on; \
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml; \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
