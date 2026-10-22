import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  // Photo and document uploads go through server actions; Vercel caps request bodies at 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
};

export default nextConfig;
