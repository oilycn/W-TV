
# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
# Copy package.json and package-lock.json (if available)
COPY package.json ./
# Prefer package-lock.json if it exists, for reproducible builds
COPY package-lock.json* ./

# Install dependencies using npm ci for cleaner installs if package-lock.json exists
# Otherwise, fall back to npm install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy the rest of the application code
COPY . .

# Build the Next.js application
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
# Optional: Disable Next.js telemetry
# ENV NEXT_TELEMETRY_DISABLED 1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

# Copy standalone output from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Expose port 3000 (Next.js default port for production)
EXPOSE 3000

# Command to run the application using the server.js from standalone output
CMD ["node", "server.js"]
