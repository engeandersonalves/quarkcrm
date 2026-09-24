import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans, Sora } from "next/font/google";
import { Toaster } from "sonner";
import { Dialogos } from "@/components/dialogo";
import { Shell } from "@/components/shell";
import { DadosProvider } from "@/lib/store";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-cp", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Quark Locações", template: "%s · Quark Locações" },
  description: "Orçamentos, locações, estoque e financeiro de andaimes e equipamentos",
  applicationName: "Quark Locações",
  appleWebApp: { capable: true, title: "Quark Locações", statusBarStyle: "black-translucent" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0d0b2b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} ${sora.variable} ${mono.variable}`}>
      <body className="min-h-dvh font-sans">
        <DadosProvider>
          <Shell>{children}</Shell>
        </DadosProvider>
        <Dialogos />
        <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "var(--font-jakarta)" } }} />
      </body>
    </html>
  );
}
