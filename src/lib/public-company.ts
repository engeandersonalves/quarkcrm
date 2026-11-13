import "server-only";
import type { PublicCompany } from "@/components/capture/funnel";
import { DEFAULT_CAPTURE, type CapturePrefs, type RoofKey } from "@/lib/defaults";
import { hasSupabase } from "@/lib/supabase/env";
import { anonSupabase } from "@/lib/supabase/server";

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Normaliza o que vem do banco: qualquer campo ausente, nulo ou fora do formato vira o padrão. */
function sanitize(raw: unknown): PublicCompany {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const cap = (r.capture && typeof r.capture === "object" ? r.capture : {}) as Record<string, unknown>;
  const roofRaw = (cap.roofImages && typeof cap.roofImages === "object" ? cap.roofImages : {}) as Record<string, unknown>;
  const roofImages: CapturePrefs["roofImages"] = {};
  for (const k of ["ceramic", "fiber", "metal", "slab", "ground"] as RoofKey[]) {
    const u = str(roofRaw[k]);
    if (u && /^https?:\/\//.test(u)) roofImages[k] = u;
  }
  const url = (v: unknown) => {
    const u = str(v);
    return u && /^https?:\/\//.test(u) ? u : null;
  };
  const svcRaw = (cap.serviceImages && typeof cap.serviceImages === "object" ? cap.serviceImages : {}) as Record<string, unknown>;
  const serviceImages: Record<string, string> = {};
  for (const k of ["solar", "save", "eletroposto", "manutencao", "gestao"]) {
    const u = url(svcRaw[k]);
    if (u) serviceImages[k] = u;
  }
  const gallery = (Array.isArray(r.gallery) ? r.gallery : []).map(url).filter((u): u is string => !!u).slice(0, 12);
  const payments = (Array.isArray(cap.payments) ? cap.payments : [])
    .map((p) => (p && typeof p === "object" ? { title: str((p as Record<string, unknown>).title) ?? "", text: str((p as Record<string, unknown>).text) ?? "" } : null))
    .filter((p): p is { title: string; text: string } => !!p && !!p.title);
  return {
    company_name: str(r.company_name),
    whatsapp: str(r.whatsapp),
    instagram: str(r.instagram),
    city: str(r.city),
    tech_name: str(r.tech_name),
    about: str(r.about),
    gallery,
    warranty_modules_performance_years: num(r.warranty_modules_performance_years),
    tariff: num(r.tariff),
    sunHours: num(r.sunHours),
    fioBTariff: num(r.fioBTariff),
    publicLighting: typeof r.publicLighting === "number" ? r.publicLighting : num(r.publicLighting),
    metaPixelId: /^\d{5,20}$/.test(String(r.metaPixelId ?? "").trim()) ? String(r.metaPixelId).trim() : null,
    gaId: /^G-[A-Z0-9]{4,15}$/i.test(String(r.gaId ?? "").trim()) ? String(r.gaId).trim().toUpperCase() : null,
    capture: {
      roofImages,
      heroImage: url(cap.heroImage) ?? undefined,
      serviceImages,
      paymentTitle: str(cap.paymentTitle) ?? DEFAULT_CAPTURE.paymentTitle,
      payments: payments.length ? payments : DEFAULT_CAPTURE.payments,
    },
  };
}

export async function loadCompany(): Promise<PublicCompany> {
  if (!hasSupabase) return sanitize(null);
  try {
    const { data } = await anonSupabase().rpc("get_public_company");
    return sanitize(data);
  } catch {
    return sanitize(null);
  }
}

