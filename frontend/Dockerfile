# ----------------------------
# Stage 1: Build the App
# ----------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build
COPY . .

# Accept VITE variables as build args
ARG VITE_WEBHOOK_URL
ARG VITE_API_TOKEN
ARG VITE_APP_NAME
ARG VITE_APP_DESCRIPTION
ARG VITE_APP_LOGO_URL
ARG VITE_FAVICON_URL

# Set them as ENV variables for Vite to pick up during build
ENV VITE_WEBHOOK_URL=$VITE_WEBHOOK_URL
ENV VITE_API_TOKEN=$VITE_API_TOKEN
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_APP_DESCRIPTION=$VITE_APP_DESCRIPTION
ENV VITE_APP_LOGO_URL=$VITE_APP_LOGO_URL
ENV VITE_FAVICON_URL=$VITE_FAVICON_URL

RUN npm run build
# (This creates a /dist folder with your static site)

# ----------------------------
# Stage 2: Serve with Nginx
# ----------------------------
FROM nginx:alpine

# Copy the built files from Stage 1 to Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]