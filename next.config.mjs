/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: { serverActions: {}, instrumentationHook: true }
};
export default nextConfig;
