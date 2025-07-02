/** @type {import('next').NextConfig} */
const withPWAInit = require("@ducanh2912/next-pwa");

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
});

const nextConfig = {
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
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
};

module.exports = withPWA(nextConfig);
