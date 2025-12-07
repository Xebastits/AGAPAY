/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pino-pretty"],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com', // Firebase
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io', // IPFS
      },
      {
        protocol: 'https',
        hostname: 'd391b93f5f62d9c15f67142e43841da5.ipfscdn.io', // Thirdweb Gateway
      },
      // --- ADD THIS BLOCK ---
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com', // Cloudinary
      },
    ],
  },
};

export default nextConfig;