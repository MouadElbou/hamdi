/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone is only useful for production deployment — skip it in dev
  // to avoid stale production chunks conflicting with the dev compiler
  ...(process.env.NODE_ENV === "production" ? { output: "standalone" } : {}),
  transpilePackages: ["@stock/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: (() => {
              const isDev = process.env.NODE_ENV !== "production";
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
              const apiOrigin = apiUrl ? new URL(apiUrl).origin : "";
              // Next.js dev mode needs 'unsafe-eval' for hot module replacement
              const evalDirective = isDev ? " 'unsafe-eval'" : "";
              return (
                `default-src 'self'; script-src 'self' 'unsafe-inline'${evalDirective}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https://picsum.photos https://fastly.picsum.photos https://images.unsplash.com https://lh3.googleusercontent.com; connect-src 'self'` +
                (apiOrigin ? " " + apiOrigin : "") +
                (isDev ? " ws://localhost:3000" : "") +
                "; font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com; frame-src 'self' https://www.google.com;"
              );
            })(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
