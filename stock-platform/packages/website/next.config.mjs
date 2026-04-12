/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone is only useful for production deployment — skip it in dev
  // to avoid stale production chunks conflicting with the dev compiler
  ...(process.env.NODE_ENV === "production" ? { output: "standalone" } : {}),
  transpilePackages: ["@stock/shared"],
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
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
              const apiOrigin = apiUrl ? new URL(apiUrl).origin : "";
              const isDev = process.env.NODE_ENV !== "production";
              // Next.js requires 'unsafe-inline' for inline scripts (RSC payloads, hydration).
              // In dev mode, 'unsafe-eval' is also needed for hot-reload / source-maps.
              const scriptSrc = isDev
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
                : "script-src 'self' 'unsafe-inline'";
              return (
                `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'` +
                (apiOrigin ? " " + apiOrigin : "") +
                "; font-src 'self' https://fonts.gstatic.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; frame-src 'self' https://www.google.com;"
              );
            })(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
