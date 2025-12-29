# Dockerfile

# 1. Installer stage: Install dependencies
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json ./
RUN npm install

# 2. Builder stage: Build the application
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3. Production stage: Create the final, minimal image
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 【重要修改区域开始】
# 首先，将应用程序的所有核心文件拷贝进来
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

# 【关键修复】
# 将 /app 目录下的所有文件和目录的所有权更改为 nextjs 用户。
# 这样，nextjs 用户就有了对这些文件的读写权限，包括创建缓存目录。
RUN chown -R nextjs:nodejs /app

# Next.js 建议创建 .next/cache 目录并设置适当的权限，
# 以确保在运行时不会遇到权限问题。
# 通常，这个目录在 standalone 输出中不会直接包含，是运行时创建的。
# 所以我们确保它的父目录 (.next) 权限正确即可。
# 如果想更明确，可以创建它并设置权限
# RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next/cache
# 实际操作中，上面的 chown -R /app 已经包含了对 .next 及其子目录的权限设置，通常足够了。
# 【重要修改区域结束】

# Set the correct user
USER nextjs

# The port the app will run on
EXPOSE 3000
ENV PORT 3000

# Start the app
CMD ["node", "server.js"]
