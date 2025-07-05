# Dockerfile

# 1. Installer stage: Install dependencies
FROM node:18-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json ./
RUN npm install

# 2. Builder stage: Build the application
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# This will trigger the pwa build process as well
RUN npm run build

# 3. Production stage: Create the final, minimal image
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED 1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone output
COPY --from=builder /app/.next/standalone ./
# Copy the public folder for PWA assets, icons, etc.
COPY --from=builder /app/public ./public
# Copy the static assets (built JS, CSS)
COPY --from=builder /app/.next/static ./.next/static

# Set the correct user
USER nextjs

# The port the app will run on
EXPOSE 3000

# Set the port environment variable
ENV PORT 3000

# Start the app
CMD ["node", "server.js"]
