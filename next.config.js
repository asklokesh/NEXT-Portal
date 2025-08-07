/** @type {import('next').NextConfig} */
const nextConfig = {
 reactStrictMode: true,
 poweredByHeader: false,
 
 // Production optimizations
 compress: true,
 generateEtags: true,
 productionBrowserSourceMaps: false,
 
 // TypeScript and ESLint - allow builds to proceed
 typescript: {
 ignoreBuildErrors: true,
 },
 eslint: {
 ignoreDuringBuilds: true,
 },
 
 // Minimal compiler options
 compiler: {
 removeConsole: process.env.NODE_ENV === 'production',
 },
 
 // Fix for framer-motion and other ESM issues
 transpilePackages: [
 'framer-motion',
 'lucide-react',
 '@tanstack/react-query',
 'react-hot-toast',
 'zustand',
 'zod'
 ],
 
 // Webpack optimizations for module loading
 webpack: (config, { dev, isServer }) => {
 // Fix for undefined module calls and node modules in browser
 if (!isServer) {
  config.resolve.fallback = {
  ...config.resolve.fallback,
  fs: false,
  net: false,
  tls: false,
  dns: false,
  child_process: false,
  crypto: false,
  stream: false,
  path: false,
  os: false,
  zlib: false,
  http: false,
  https: false,
  };
 }

 // Suppress typescript-parser warnings
 config.module.rules.push({
  test: /node_modules\/typescript-parser/,
  use: {
   loader: 'null-loader'
  }
 });
 
 // Better error handling for client-side chunks
 if (!isServer) {
 config.output.strictModuleErrorHandling = true;
 config.output.pathinfo = dev;
 }

 // Fix HMR issues in development - limit concurrent connections
 if (dev && !isServer) {
 // Reduce HMR polling frequency to handle more connections
 config.watchOptions = {
 poll: 2000, // Increased from 1000ms
 aggregateTimeout: 500, // Increased debounce
 ignored: /node_modules/,
 };
 
 // Improve webpack caching for HMR with memory limits
 config.cache = {
 type: 'filesystem',
 maxMemoryGenerations: 1, // Limit memory usage
 buildDependencies: {
 config: [__filename],
 },
 };
 
 // Limit concurrent compilation for stability
 config.parallelism = 2;
 
 // Optimize for multiple users
 config.optimization = {
 ...config.optimization,
 moduleIds: 'deterministic',
 chunkIds: 'deterministic',
 };
 }
 
 // Optimize chunk loading
 if (!dev && !isServer) {
 config.optimization.splitChunks = {
 chunks: 'all',
 cacheGroups: {
 vendor: {
 test: /[\\/]node_modules[\\/]/,
 name: 'vendors',
 chunks: 'all',
 },
 common: {
 name: 'common',
 minChunks: 2,
 chunks: 'all',
 },
 },
 };
 }
 
 return config;
 },
 
 // Experimental features for better caching
 experimental: {
 optimizeCss: true,
 },
 
 // Enhanced caching configuration - optimized for multiple users
 onDemandEntries: {
 maxInactiveAge: 60 * 1000, // Increased from 25s to reduce rebuilds
 pagesBufferLength: 5, // Increased buffer for more concurrent users
 },
 
 // Headers for better caching and performance
 async headers() {
 return [
 {
 source: '/_next/static/:path*',
 headers: [
 {
 key: 'Cache-Control',
 value: 'public, max-age=31536000, immutable',
 },
 ],
 },
 {
 source: '/api/:path*',
 headers: [
 {
 key: 'Cache-Control',
 value: 'no-store, max-age=0',
 },
 ],
 },
 ];
 },
 
 // Minimal redirects
 async redirects() {
 return [
 {
 source: '/',
 destination: '/dashboard',
 permanent: false,
 },
 ];
 },

 // Minimal rewrites for API proxy
 async rewrites() {
 return [
 {
 source: '/api/backstage/:path*',
 destination: `${process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:4402'}/api/:path*`,
 },
 ];
 },
};

module.exports = nextConfig;