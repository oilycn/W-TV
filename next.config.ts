
import type {NextConfig} from 'next';
import withPWAInit from "@ducanh2912/next-pwa";
import defaultRuntimeCaching from "@ducanh2912/next-pwa/cache";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /\.(?:m3u8|ts)$/i,
      handler: 'NetworkOnly',
      options: {
        cacheName: 'streaming-media',
      },
    },
    ...defaultRuntimeCaching,
  ],
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
