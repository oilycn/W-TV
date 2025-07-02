# Dockerfile for Next.js with standalone output

# 1. Builder stage
# This stage installs dependencies and builds the Next.js application.
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies
# Copy package.json and lock file (if available) for better caching
COPY package.json package-lock.json* ./
# Use npm install to get all dependencies needed for building
RUN npm install

# Copy the rest of the application source code
COPY . .

# Disable Next.js telemetry during the build
ENV NEXT_TELEMETRY_DISABLED 1

# Build the application
# The `next build` command will automatically leverage `output: 'standalone'`
# from your next.config.ts, preparing the app for the final stage.
RUN npm run build

# 2. Production stage
# This stage creates the final, lean production image.
FROM node:20-alpine AS runner
WORKDIR /app

# Set environment variables for production
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
# The default port for Next.js is 3000
ENV PORT 3000

# Create a non-root user and group for better security
RUN addgroup -S nodejs
RUN adduser -S nextjs -G nodejs

# Copy the standalone output from the builder stage.
# This directory contains the server, public assets, static assets,
# and minimal required node_modules.
# We also set the ownership to the non-root user.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to the non-root user
USER nextjs

# Expose the port the app runs on
EXPOSE 3000

# The command to start the Next.js server in standalone mode
CMD ["node", "server.js"]
