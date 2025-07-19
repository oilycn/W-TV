import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 启用 standalone 输出模式 (Docker 优化)
  output: 'standalone',
  
  // 优化构建性能
  experimental: {
    // 启用 SWC 压缩器 (比 Terser 快)
    swcMinify: true,
    // 启用并行构建
    cpus: Math.max(1, (require('os').cpus().length || 1) - 1),
  },

  // 生产环境优化
  compiler: {
    // 移除 console.log (减少包大小)
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },

  // 图片优化
  images: {
    // Docker 环境下禁用图片优化 (减少构建时间)
    unoptimized: true,
  },

  // 减少构建输出
  eslint: {
    // 构建时忽略 ESLint 错误 (加快构建)
    ignoreDuringBuilds: true,
  },
  
  typescript: {
    // 构建时忽略 TypeScript 错误 (加快构建，但不推荐生产环境)
    // ignoreBuildErrors: true,
  },

  // PWA 配置保持不变
  // ... 其他配置
};

export default nextConfig;