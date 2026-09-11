import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@hugeicons/react",
      "@hugeicons/core-free-icons",
      "date-fns",
      "@tanstack/react-query",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "**.insforge.app",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],    
  },
  allowedDevOrigins: [
    "yolande-sistroid-jenee.ngrok-free.dev"
  ],
};

export default nextConfig;
