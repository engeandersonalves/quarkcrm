import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  // Telas removidas: quem tiver o link antigo cai no Painel.
  async redirects() {
    return ["/ranking", "/prospeccao", "/equipe"].map((source) => ({ source, destination: "/", permanent: false }));
  },
};

export default nextConfig;
