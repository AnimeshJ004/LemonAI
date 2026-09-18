import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  /**
   * Next.js Router Cache (client-side navigation cache).
   * - dynamic: 30 s  — pages using dynamic data stay fresh 30 s before a background revalidation
   * - static:  300 s — fully-static pages are cached 5 minutes on the client
   *
   * Prevents redundant server round-trips when navigating between routes
   * (e.g., Dashboard → Schedule → Dashboard) within the configured window.
   */
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
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

  /**
   * Cache-Control headers for static assets served by Next.js.
   * Public immutable assets (JS/CSS chunks) get a 1-year CDN cache.
   * API routes explicitly opt out so they are never accidentally cached at the edge.
   */
  async headers() {
    return [
      {
        // Next.js static chunk files — fingerprinted filenames, safe to cache forever
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Public folder assets (icons, images, etc.)
        source: "/public/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        // API routes must never be cached at the CDN/proxy level
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
