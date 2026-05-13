FROM node:20-alpine

# Install chromium deps for Baileys (canvas/qrcode optional)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source
COPY . .

# Ensure data directories exist
RUN mkdir -p /app/data/auth

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3002/api/status || exit 1

CMD ["node", "src/index.js"]
