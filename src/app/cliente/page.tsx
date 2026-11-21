import type { Metadata, Viewport } from "next";
import { ClientPortal } from "@/components/cliente/portal";
import { hasSupabase } from "@/lib/supabase/env";
import { anonSupabase } from "@/lib/supabase/server";
import { googleWalletConfig } from "@/lib/wallet-google";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Área do cliente · Quark Mobilidade" },
  description: "Contrato, manual completo e cartão do proprietário da sua scooter Quark, sempre à mão.",
  robots: { index: false, follow: false },
  other: { google: "notranslate" },
};

export const viewport: Viewport = { themeColor: "#F7F9F4" };

async function load() {
  if (!hasSupabase) return { company: { company_name: null, whatsapp: null, instagram: null }, models: [] as string[] };
  const sb = anonSupabase();
  const [c, m] = await Promise.all([sb.rpc("get_public_company"), sb.rpc("get_public_motos")]);
  const company = (c.data ?? {}) as { company_name?: string | null; whatsapp?: string | null; instagram?: string | null };
  const models = Array.isArray(m.data) ? (m.data as { name?: string }[]).map((x) => x.name ?? "").filter(Boolean) : [];
  return { company: { company_name: company.company_name ?? null, whatsapp: company.whatsapp ?? null, instagram: company.instagram ?? null }, models };
}

export default async function ClientePage() {
  const { company, models } = await load();
  return (
    <div translate="no" className="notranslate">
      <ClientPortal company={company} models={models.length ? models : ["T1", "Cappuccino", "MZ"]} wallet={{ google: !!googleWalletConfig() }} />
    </div>
  );
}
