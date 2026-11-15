import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { VerifyResultView, VerifyShell, type VerifyResult } from "@/components/verificar/verify-view";
import { hasSupabase } from "@/lib/supabase/env";
import { anonSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Verificar cartão do proprietário · Quark Mobilidade" },
  description: "Confira se o cartão do proprietário ou o comprovante de compra da scooter é original.",
  robots: { index: false, follow: false },
  other: { google: "notranslate" },
};

export const viewport: Viewport = { themeColor: "#F7F9F4" };

async function verify(ref: string): Promise<VerifyResult> {
  const clean = ref.replace(/[^0-9a-fA-F-]/g, "").slice(0, 40);
  if (!hasSupabase || !clean) return { found: false };
  const { data, error } = await anonSupabase().rpc("verify_owner_card", { p_ref: clean });
  if (error || !data || typeof data !== "object") return { found: false };
  return data as VerifyResult;
}

export default async function VerifyPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const [r, h] = await Promise.all([verify(decodeURIComponent(ref)), headers()]);
  return (
    <VerifyShell>
      <VerifyResultView r={r} host={h.get("x-forwarded-host") || h.get("host") || ""} checkedAt={new Date().toISOString()} />
    </VerifyShell>
  );
}
