import withBundleAnalyzer from '@next/bundle-analyzer';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Strict Mode
  reactStrictMode: true,
  
  // NOTE: 'swcMinify' is removed because it is default in Next.js 15.

  // 2. Remove console logs in production to save bytes
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  // 3. CRITICAL: Force Tree-Shaking for Heavy Libraries
  experimental: {
    optimizePackageImports: [
      "thirdweb",
      "@thirdweb-dev/react",
      "@thirdweb-dev/sdk",
      "firebase/auth", 
      "firebase/firestore",
      "lucide-react",
      "date-fns",
      "@walletconnect/modal-core-html"
    ],
  },

  // 4. Image Optimization
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'ipfs.io' },
      { protocol: 'https', hostname: 'd391b93f5f62d9c15f67142e43841da5.ipfscdn.io' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
    minimumCacheTTL: 60,
  },

  // 5. Suppress specific warnings
  serverExternalPackages: ["pino-pretty"],
};

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})(nextConfig);