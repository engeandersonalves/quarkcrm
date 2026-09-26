import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Quark Lab · Simulador de energia solar", template: "%s · Quark Lab" },
  description: "Simulador de sistemas fotovoltaicos com baterias, cargas flexíveis, zero grid, cortes de geração distribuída e apagões — para estudo e pesquisa.",
  applicationName: "Quark Lab",
  appleWebApp: { capable: true, title: "Quark Lab", statusBarStyle: "black-translucent" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#1C1234",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} ${sora.variable}`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
