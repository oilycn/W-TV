
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // Add this for optimized Docker builds
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

export default nextConfig;
