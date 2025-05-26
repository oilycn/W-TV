
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
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
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.ffzy888.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'img.ffzy888.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.bdzyimg1.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'img.bdzyimg1.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;

