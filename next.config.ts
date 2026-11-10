import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  // Telas removidas: quem tiver o link antigo cai no Painel.
  async redirects() {
    return [
      ...["/ranking", "/prospeccao", "/equipe", "/loja-gestao"].map((source) => ({ source, destination: "/", permanent: false })),
      // A loja deu lugar à landing da Black Friday
      ...["/loja", "/loja/:path*"].map((source) => ({ source, destination: "/black-friday", permanent: false })),
    ];
  },
};

export default nextConfig;
