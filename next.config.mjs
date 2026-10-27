/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["xlsx", "pdf-lib", "@pdf-lib/fontkit"],
  outputFileTracingIncludes: {
    "/manager/payroll/export": ["./lib/fonts/**/*"],
  },
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
