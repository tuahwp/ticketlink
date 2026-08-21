/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Tell Next.js NOT to bundle these packages — they must run as native Node.js modules.
  // Prisma and pg use native bindings that break when bundled by webpack/turbopack.
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "pg-native",
  ],
};

export default nextConfig;
