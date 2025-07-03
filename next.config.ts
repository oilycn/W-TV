
import type {NextConfig} from 'next';

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Wildcard for all hostnames
      },
      {
        protocol: 'http',
        hostname: '**', // Wildcard for all hostnames
      },
    ],
  },
};

export default withPWA(nextConfig);
