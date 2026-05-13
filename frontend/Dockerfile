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

# Set them as ENV variables for Vite to pick up during build
# We only set VITE_WEBHOOK_URL here because we want to override it in production.
# Other variables will be read from the .env file copied above.
ENV VITE_WEBHOOK_URL=$VITE_WEBHOOK_URL

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