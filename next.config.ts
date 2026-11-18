import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
