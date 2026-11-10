/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The live preview is served from *.e2b.app. Allow it for dev requests.
  allowedDevOrigins: ["*.e2b.app"],
};

module.exports = nextConfig;
