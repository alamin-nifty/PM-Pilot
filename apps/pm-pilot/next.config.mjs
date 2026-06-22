/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native addon — keep it external to the server bundle
  // (required under Next 16's Turbopack build so the .node binary isn't bundled).
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
