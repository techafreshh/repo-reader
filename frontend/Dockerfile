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

# Accept VITE variables as build args. The defaults must cover every
# %VITE_*% placeholder in index.html — with .dockerignore keeping local
# .env files out of the image, an unset placeholder breaks `vite build`.
ARG VITE_API_BASE_URL
ARG VITE_APP_NAME=Repo-Reader
ARG VITE_APP_DESCRIPTION="Chat with any codebase..."
ARG VITE_FAVICON_URL=/githubs.svg

# Set them as ENV variables for Vite to pick up during build
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_APP_NAME=$VITE_APP_NAME \
    VITE_APP_DESCRIPTION=$VITE_APP_DESCRIPTION \
    VITE_FAVICON_URL=$VITE_FAVICON_URL

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
