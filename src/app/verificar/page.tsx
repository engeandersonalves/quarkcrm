import { ShieldCheck } from "lucide-react";
import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { CodeForm, VerifyShell } from "@/components/verificar/verify-view";

export const metadata: Metadata = {
  title: { absolute: "Verificar cartão do proprietário · Quark Mobilidade" },
  description: "Confira se o cartão do proprietário ou o comprovante de compra da scooter é original.",
  robots: { index: false, follow: false },
  other: { google: "notranslate" },
};

export const viewport: Viewport = { themeColor: "#F7F9F4" };

export default async function VerifyHome({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const code = (c ?? "").replace(/[^0-9a-fA-F-]/g, "");
  if (code) redirect(`/verificar/${encodeURIComponent(code.toLowerCase())}`);
  return (
    <VerifyShell>
      <section className="mt-8 rounded-[30px] bg-white p-6 ring-1 ring-[#0B1A12]/[0.06] shadow-[0_20px_50px_-35px_rgba(16,52,32,0.45)]">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#0B1A12] text-[#A9DE86]">
          <ShieldCheck className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-[26px] leading-tight font-extrabold tracking-tight">Verificar cartão do proprietário</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#0B1A12]/65">Aponte a câmera para o QR code do verso do cartão, ou digite o código impresso logo abaixo dele.</p>
        <CodeForm />
      </section>
    </VerifyShell>
  );
}
