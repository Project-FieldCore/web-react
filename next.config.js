/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained Node server for EC2/systemd (see docs/DEPLOY_EC2.md).
  output: 'standalone',
};
module.exports = nextConfig;
