import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Origin Supabase (API, Storage signed URL, Realtime) untuk CSP.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();
const supabaseWs = supabaseOrigin.replace(/^https:/, "wss:");

const csp = [
  "default-src 'self'",
  // Next.js memakai skrip inline; 'unsafe-eval' hanya untuk dev (HMR).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`.trim(),
  // Pratinjau PDF (iframe) memakai URL bertanda waktu / blob.
  `frame-src 'self' blob: data: ${supabaseOrigin}`.trim(),
  "object-src 'self' blob: data:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Kamera dipakai untuk scan QR; fitur lain dimatikan.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      {
        source: "/peminjaman-inaktif",
        destination: "/peminjaman",
      },
      {
        source: "/peminjaman-saya",
        destination: "/peminjaman",
      },
      {
        source: "/daftar-dokumen",
        destination: "/dokumen",
      },
    ];
  },
};

export default nextConfig;
