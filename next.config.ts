import type { NextConfig } from "next";

// Content Security Policy directives tuned for Clerk, Supabase, Groq, Sentry, Upstash, and Cal.com
const cspDirectives = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.accounts.dev https://challenges.cloudflare.com https://va.vercel-scripts.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' blob: data: https://img.clerk.com https://*.supabase.co https://*.insforge.app https://images.unsplash.com https://*.replicate.delivery https://*.fbcdn.net https://*.cdninstagram.com;
  font-src 'self' https://fonts.gstatic.com data:;
  connect-src 'self' https://*.clerk.accounts.dev https://clerk.com https://*.supabase.co https://*.insforge.app https://api.groq.com https://*.ingest.sentry.io https://*.upstash.io wss://*.supabase.co https://api.cal.com https://api.vapi.ai https://api.resend.com;
  frame-src 'self' https://challenges.cloudflare.com https://cal.com https://*.cal.com;
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, " ").trim();

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: cspDirectives,
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), browsing-topics=()",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
];

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
   * Cache-Control headers for static assets and global security headers (CSP, HSTS, X-Frame-Options).
   */
  async headers() {
    return [
      {
        // Global security headers on all routes
        source: "/:path*",
        headers: securityHeaders,
      },
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
