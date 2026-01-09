# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client

# Copy client package files
COPY client/package.json ./
RUN npm install

# Copy client source and build
COPY client/ ./
RUN npm run build

# Production stage
FROM node:20-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Copy server package files
COPY server/package.json ./
RUN npm install --production

# Copy server source
COPY server/ ./server/

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/client/dist ./client/dist

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start server
CMD ["node", "server/server.js"]

