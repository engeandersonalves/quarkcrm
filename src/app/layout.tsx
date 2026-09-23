import type { Metadata, Viewport } from "next";
import { Playfair_Display, Plus_Jakarta_Sans, Sora } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: "Quark CRM", template: "%s · Quark CRM" },
  description: "Propostas de energia solar e CRM de vendas",
  applicationName: "Quark CRM",
  appleWebApp: { capable: true, title: "Quark CRM", statusBarStyle: "black-translucent" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0c1220",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} ${sora.variable} ${playfair.variable}`}>
      <body className="min-h-dvh font-sans">
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "var(--font-jakarta)" } }} />
      </body>
    </html>
  );
}
