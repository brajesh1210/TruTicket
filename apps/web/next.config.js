/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@supabase/ssr"],
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;