import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/community',
        destination: '/records',
        permanent: true,
      },
      {
        source: '/community/:path*',
        destination: '/records',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
