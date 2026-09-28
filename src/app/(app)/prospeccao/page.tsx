"use client";

import {
  Check,
  Clock,
  Copy,
  Crosshair,
  Download,
  Earth,
  ExternalLink,
  Globe,
  Loader2,
  LocateFixed,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Radar,
  Route,
  Search,
  Sparkles,
  Star,
  UserPlus,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { useReward } from "@/components/app/rewards";
import { Button, Segmented, cx } from "@/components/ui";
import { downloadCsv } from "@/lib/csv";
import { formatPhone, onlyDigits, whatsappUrl } from "@/lib/format";
import { notify, useLive } from "@/lib/live";
import { brl, fmtNum } from "@/lib/pricing";
import {
  NICHES,
  distanceKm,
  estimateConsumption,
  googleEarthUrl,
  googleMapsUrl,
  instagramHandle,
  nicheOf,
  prospectScore,
  tileOf,
  type Contacts,
  type Prospect,
  type Size,
} from "@/lib/prospect";
import { quickEstimate } from "@/lib/quick-estimate";
import { supabase } from "@/lib/supabase/client";

/** Ícones das redes (o lucide não traz mais marcas). */
function Instagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}
function Facebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z" />
    </svg>
  );
}

const TILE = (z: number, x: number, y: number) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
/** R$ compacto para os blocos pequenos (R$ 11,7 mil). */
const brlShort = (v: number) => (v >= 10000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : brl(v).replace(/,\d{2}$/, ""));
const STATE_KEY = "quark.prospect.state";
const RADII = [1, 3, 5, 10];
type Sort = "potencial" | "distancia" | "nome";
type Center = { lat: number; lon: number; label: string };
type Result = { provider: "osm" | "google"; center: Center; results: Prospect[]; niche: string; radiusKm: number; at: number };
type Enriched = Partial<Pick<Prospect, "email" | "instagram" | "facebook" | "whatsapp" | "phone">> & { done?: boolean };

const TIER_STYLE = {
  quente: { label: "Quente", cls: "bg-rose-500/15 text-rose-600 ring-rose-500/30", dot: "#f43f5e" },
  morno: { label: "Morno", cls: "bg-amber-500/15 text-amber-700 ring-amber-500/30", dot: "#f59e0b" },
  frio: { label: "Frio", cls: "bg-sky-500/15 text-sky-700 ring-sky-500/30", dot: "#0ea5e9" },
} as const;

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/* ------------------------------------------------------------------ satélite */

/** Recorte de satélite (Esri World Imagery) centrado no ponto: 3×3 tiles e mira no telhado. */
function RoofThumb({ lat, lon, z = 19, className }: { lat: number; lon: number; z?: number; className?: string }) {
  // Só carrega as imagens quando o card aparece na tela (listas com centenas de comércios).
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setSeen(true), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  const t = tileOf(lat, lon, z);
  const tx = Math.floor(t.x);
  const ty = Math.floor(t.y);
  // Posição do ponto dentro do mosaico de 768px (tile central = 256..512).
  const px = 256 + (t.x - tx) * 256;
  const py = 256 + (t.y - ty) * 256;
  return (
    <div ref={ref} className={cx("relative overflow-hidden bg-[#1C1234]", className)}>
      {seen && (
        <div className="absolute top-1/2 left-1/2 h-[768px] w-[768px]" style={{ transform: `translate(${-px}px, ${-py}px)` }}>
          {[-1, 0, 1].map((dy) =>
            [-1, 0, 1].map((dx) => (
              <div
                key={`${dx}${dy}`}
                className="absolute h-64 w-64 bg-cover"
                style={{ left: (dx + 1) * 256, top: (dy + 1) * 256, backgroundImage: `url("${TILE(z, tx + dx, ty + dy)}")` }}
              />
            )),
          )}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[#F3EA3B]/90 shadow-[0_0_0_4px_rgba(0,0,0,0.25)]">
        <span className="absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F3EA3B]" />
      </div>
    </div>
  );
}

/** Mapa de satélite da área buscada, com os comércios marcados por potencial. */
function AreaMap({
  center,
  radiusKm,
  items,
  active,
  onPick,
}: {
  center: Center;
  radiusKm: number;
  items: { p: Prospect; tier: keyof typeof TIER_STYLE }[];
  active: string | null;
  onPick: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { w, h } = size;
  const half = Math.max(1, Math.min(w, h) / 2 - 18);
  // Zoom em que o raio cabe no mapa.
  const z = Math.max(11, Math.min(18, Math.floor(Math.log2((half * 156543.03 * Math.cos((center.lat * Math.PI) / 180)) / (radiusKm * 1000)))));
  const c = tileOf(center.lat, center.lon, z);
  const mpp = (156543.03 * Math.cos((center.lat * Math.PI) / 180)) / 2 ** z;
  const rPx = (radiusKm * 1000) / mpp;
  const tiles: { x: number; y: number; left: number; top: number }[] = [];
  if (w && h) {
    const x0 = Math.floor(c.x - w / 2 / 256);
    const x1 = Math.floor(c.x + w / 2 / 256);
    const y0 = Math.floor(c.y - h / 2 / 256);
    const y1 = Math.floor(c.y + h / 2 / 256);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push({ x, y, left: (x - c.x) * 256 + w / 2, top: (y - c.y) * 256 + h / 2 });
  }
  const pos = (lat: number, lon: number) => {
    const t = tileOf(lat, lon, z);
    return { left: (t.x - c.x) * 256 + w / 2, top: (t.y - c.y) * 256 + h / 2 };
  };
  return (
    <div ref={ref} className="relative h-full min-h-[320px] overflow-hidden rounded-3xl bg-[#0E0A1C] ring-1 ring-white/10">
      {tiles.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${t.x}-${t.y}`} src={TILE(z, t.x, t.y)} alt="" draggable={false} className="absolute h-64 w-64 max-w-none opacity-90 select-none" style={{ left: t.left, top: t.top }} />
      ))}
      <div className="pointer-events-none absolute inset-0 bg-[#07060F]/35" />
      {w > 0 && (
        <>
          <div
            className="pointer-events-none absolute rounded-full border border-dashed border-[#F3EA3B]/60 bg-[#F3EA3B]/[0.04]"
            style={{ left: w / 2 - rPx, top: h / 2 - rPx, width: rPx * 2, height: rPx * 2 }}
          />
          <div className="pointer-events-none absolute overflow-hidden rounded-full" style={{ left: w / 2 - rPx, top: h / 2 - rPx, width: rPx * 2, height: rPx * 2 }}>
            <div className="radar-sweep absolute inset-0 rounded-full opacity-60" />
          </div>
          <span className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-4 ring-white/30" style={{ left: w / 2, top: h / 2 }} />
        </>
      )}
      {w > 0 &&
        items.map(({ p, tier }) => {
          const at = pos(p.lat, p.lon);
          if (at.left < -10 || at.top < -10 || at.left > w + 10 || at.top > h + 10) return null;
          const on = active === p.id;
          return (
            <button
              key={p.id}
              type="button"
              title={p.name}
              onClick={() => onPick(p.id)}
              className={cx("absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white transition-transform hover:scale-150", on ? "z-10 h-4 w-4 scale-150" : "h-3 w-3")}
              style={{ left: at.left, top: at.top, background: TIER_STYLE[tier].dot, boxShadow: on ? `0 0 0 6px ${TIER_STYLE[tier].dot}55` : undefined }}
            />
          );
        })}
      <div className="absolute right-3 bottom-3 left-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/80">
        <div className="flex gap-2 rounded-full bg-black/45 px-3 py-1.5 backdrop-blur">
          {(Object.keys(TIER_STYLE) as (keyof typeof TIER_STYLE)[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: TIER_STYLE[k].dot }} />
              {TIER_STYLE[k].label}
            </span>
          ))}
        </div>
        <span className="rounded-full bg-black/45 px-3 py-1.5 backdrop-blur">Raio de {radiusKm} km · imagens Esri</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ página */

export default function ProspeccaoPage() {
  const { user, profile, settings } = useApp();
  const { reward } = useReward();
  const [region, setRegion] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(3);
  const [niche, setNiche] = useState("supermercado");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const [enriched, setEnriched] = useState<Record<string, Enriched>>({});
  const [enriching, setEnriching] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("potencial");
  const [onlyPhone, setOnlyPhone] = useState(false);
  const [onlySocial, setOnlySocial] = useState(false);
  const [onlyLong, setOnlyLong] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"lista" | "mapa">("lista");
  const tariff = settings.defaults.tariff ?? 0.95;

  // Retoma a última busca (útil ao voltar de um lead).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { result: Result; region: string; niche: string; radiusKm: number; sizes: Record<string, Size>; enriched: Record<string, Enriched> };
        setResult(s.result);
        setRegion(s.region);
        setNiche(s.niche);
        setRadiusKm(s.radiusKm);
        setSizes(s.sizes ?? {});
        setEnriched(s.enriched ?? {});
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (!region && settings.city) setRegion(settings.city);
  }, [settings.city]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!result) return;
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({ result, region, niche, radiusKm, sizes, enriched }));
    } catch {}
  }, [result, sizes, enriched]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leads existentes para marcar "já é lead".
  const { data: leads } = useLive(
    async () => {
      const { data } = await supabase().from("leads").select("id,name,phone").order("created_at", { ascending: false }).limit(3000);
      return (data ?? []) as { id: string; name: string; phone: string | null }[];
    },
    [],
    ["leads"],
  );
  const leadIndex = useMemo(() => {
    const byPhone = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const l of leads ?? []) {
      const d = onlyDigits(l.phone).slice(-8);
      if (d.length === 8) byPhone.set(d, l.id);
      if (l.name) byName.set(norm(l.name), l.id);
    }
    return { byPhone, byName };
  }, [leads]);

  const search = async (override?: { lat: number; lon: number }) => {
    const at = override ?? coords;
    if (!at && !region.trim()) return toast.error("Informe a cidade ou o bairro");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/prospect/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: region.trim(), lat: at?.lat, lon: at?.lon, radiusKm, niche }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Falha na busca");
      setResult({ ...json, niche, radiusKm, at: Date.now() });
      setSelected(new Set());
      setActive(null);
      if (!json.results.length) toast("Nenhum comércio encontrado", { description: "Aumente o raio ou troque o nicho." });
      else toast.success(`${json.results.length} comércios no radar`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na busca");
    } finally {
      setLoading(false);
    }
  };

  const locate = () => {
    if (!navigator.geolocation) return toast.error("Seu navegador não permite localização");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const at = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCoords(at);
        setRegion("Minha localização");
        search(at);
      },
      () => {
        setLocating(false);
        toast.error("Não consegui sua localização. Digite o bairro.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  /* -------- enriquecimento dos resultados -------- */
  const rows = useMemo(() => {
    if (!result) return [];
    return result.results.map((raw) => {
      const e = enriched[raw.id] ?? {};
      const p: Prospect = {
        ...raw,
        email: raw.email ?? e.email ?? null,
        instagram: raw.instagram ?? e.instagram ?? null,
        facebook: raw.facebook ?? e.facebook ?? null,
        whatsapp: raw.whatsapp ?? e.whatsapp ?? null,
        phone: raw.phone ?? e.phone ?? null,
      };
      const n = nicheOf(p.niche) ?? nicheOf(result.niche)!;
      const size = sizes[p.id] ?? "M";
      const consumption = estimateConsumption(n, p.hoursWeek, size);
      const bill = Math.round(consumption.kwh * tariff + 30);
      const est = quickEstimate({ bill, tariff, connectionType: "tri" });
      const score = prospectScore(consumption.kwh, p);
      const dist = distanceKm(result.center, p);
      const d8 = onlyDigits(p.phone).slice(-8);
      const leadId = saved[p.id] ?? (d8.length === 8 ? leadIndex.byPhone.get(d8) : undefined) ?? leadIndex.byName.get(norm(p.name));
      return { p, n, size, consumption, bill, est, score, dist, leadId, enrichedDone: !!e.done };
    });
  }, [result, enriched, sizes, tariff, saved, leadIndex]);

  const visible = useMemo(() => {
    const q = norm(query);
    const list = rows.filter(
      (r) =>
        (!onlyPhone || r.p.phone || r.p.whatsapp) &&
        (!onlySocial || r.p.email || r.p.instagram || r.p.facebook) &&
        (!onlyLong || (r.p.hoursWeek ?? 0) >= 70) &&
        (!q || norm(r.p.name).includes(q) || norm(r.p.address).includes(q)),
    );
    return list.sort((a, b) => (sort === "distancia" ? a.dist - b.dist : sort === "nome" ? a.p.name.localeCompare(b.p.name) : b.score.score - a.score.score || a.dist - b.dist));
  }, [rows, onlyPhone, onlySocial, onlyLong, query, sort]);

  const stats = useMemo(() => {
    const withPhone = rows.filter((r) => r.p.phone || r.p.whatsapp).length;
    const hot = rows.filter((r) => r.score.tier === "quente").length;
    const kwh = rows.reduce((s, r) => s + r.consumption.kwh, 0);
    const savings = rows.reduce((s, r) => s + r.est.monthlySavings, 0);
    return { withPhone, hot, kwh, savings, fresh: rows.filter((r) => !r.leadId).length };
  }, [rows]);

  const enrich = useCallback(async (p: Prospect) => {
    if (!p.website) return;
    setEnriching(p.id);
    try {
      const res = await fetch("/api/prospect/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: p.website }) });
      const json = (await res.json().catch(() => ({}))) as { contacts?: Contacts; error?: string };
      if (!res.ok || !json.contacts) throw new Error(json.error ?? "Não consegui ler o site");
      const c = json.contacts;
      setEnriched((m) => ({
        ...m,
        [p.id]: { email: c.emails[0] ?? null, instagram: instagramHandle(c.instagram), facebook: c.facebook, whatsapp: c.whatsapp, phone: c.phones[0] ?? null, done: true },
      }));
      const found = [c.emails[0] && "e-mail", c.instagram && "Instagram", c.facebook && "Facebook", (c.whatsapp || c.phones[0]) && "telefone"].filter(Boolean);
      if (found.length) toast.success(`Achei ${found.join(", ")}`);
      else toast("O site não mostra contatos públicos");
    } catch (e) {
      setEnriched((m) => ({ ...m, [p.id]: { ...m[p.id], done: true } }));
      toast.error(e instanceof Error ? e.message : "Falha ao ler o site");
    } finally {
      setEnriching(null);
    }
  }, []);

  const pitchFor = (r: (typeof rows)[number]) =>
    `Olá, tudo bem? Aqui é ${profile?.full_name?.split(" ")[0] ? `${profile.full_name.split(" ")[0]}, da` : "da"} ${settings.company_name}. ` +
    `Vi que a ${r.p.name} tem ${r.n.pitch} — normalmente isso pesa muito na conta de luz. ` +
    `Fiz uma simulação rápida: um negócio desse porte pode economizar cerca de ${brl(r.est.monthlySavings)} por mês com energia solar. ` +
    `Posso te mostrar em 5 minutos como fica para vocês?`;

  const leadPayload = (r: (typeof rows)[number]) => ({
    name: r.p.name,
    phone: r.p.phone ?? (r.p.whatsapp ? `+${r.p.whatsapp}` : null),
    email: r.p.email,
    city: r.p.city ?? (result?.center.label.split(",")[0] || null),
    address: r.p.address,
    source: "Prospecção ativa",
    status: "novo",
    segment: "solar",
    temperature: r.score.tier,
    connection_type: "tri",
    consumption_kwh: r.consumption.kwh,
    avg_bill: r.bill,
    tariff,
    owner_id: user.id,
    notes: [
      `🎯 Prospecção ativa · ${r.n.emoji} ${r.n.label}`,
      `Consumo estimado: ${fmtNum(r.consumption.min)}–${fmtNum(r.consumption.max)} kWh/mês (porte ${r.size}) · economia ~${brl(r.est.monthlySavings)}/mês`,
      r.p.hours && `Horário: ${r.p.hours}`,
      r.p.website && `Site: ${r.p.website}`,
      r.p.instagram && `Instagram: @${r.p.instagram}`,
      r.p.facebook && `Facebook: ${r.p.facebook}`,
      r.p.rating != null && `Google: ${r.p.rating}★ (${r.p.reviews ?? 0} avaliações)`,
      `Telhado: ${googleMapsUrl(r.p.lat, r.p.lon)}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  const saveLeads = async (list: (typeof rows)[number][]) => {
    const todo = list.filter((r) => !r.leadId);
    if (!todo.length) return toast("Esses comércios já estão nos seus leads");
    setSaving(true);
    const { data, error } = await supabase().from("leads").insert(todo.map(leadPayload)).select("id,name");
    setSaving(false);
    if (error) return toast.error(error.message);
    const map: Record<string, string> = {};
    (data ?? []).forEach((d: { id: string }, i: number) => {
      map[todo[i].p.id] = d.id;
      notify("lead", d.id);
      reward("lead", d.id);
    });
    setSaved((s) => ({ ...s, ...map }));
    setSelected(new Set());
    toast.success(todo.length === 1 ? "Lead criado — cadência iniciada" : `${todo.length} leads criados — cadência iniciada`, {
      action: todo.length === 1 ? { label: "Abrir", onClick: () => (window.location.href = `/leads/${data?.[0]?.id}`) } : undefined,
    });
  };

  const selectedRows = visible.filter((r) => selected.has(r.p.id));
  const routeUrl = (list: (typeof rows)[number][]) => {
    const pts = [...list].sort((a, b) => a.dist - b.dist).slice(0, 10);
    if (!pts.length) return null;
    const dest = pts[pts.length - 1].p;
    const way = pts.slice(0, -1).map((r) => `${r.p.lat},${r.p.lon}`);
    return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lon}${way.length ? `&waypoints=${encodeURIComponent(way.join("|"))}` : ""}&travelmode=driving`;
  };
  const exportCsv = (list: (typeof rows)[number][]) =>
    downloadCsv(
      `prospeccao-${result?.niche ?? "lista"}.csv`,
      ["Nome", "Nicho", "Telefone", "E-mail", "Instagram", "Facebook", "Site", "Endereço", "Horário", "Consumo kWh/mês", "Conta estimada", "Economia/mês", "Potencial", "Distância km", "Latitude", "Longitude"],
      list.map((r) => [
        r.p.name,
        r.n.label,
        r.p.phone ?? r.p.whatsapp,
        r.p.email,
        r.p.instagram && `@${r.p.instagram}`,
        r.p.facebook,
        r.p.website,
        r.p.address,
        r.p.hours,
        r.consumption.kwh,
        r.bill,
        Math.round(r.est.monthlySavings),
        `${r.score.tier} (${r.score.score})`,
        r.dist.toFixed(1),
        r.p.lat,
        r.p.lon,
      ]),
    );

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const focus = (id: string) => {
    setActive(id);
    setView("lista");
    requestAnimationFrame(() => document.getElementById(`pc-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const currentNiche = nicheOf(niche)!;

  return (
    <div className="mx-auto max-w-7xl pb-28">
      {/* ------------------------------------------------ hero + busca */}
      <section className="relative overflow-hidden rounded-[28px] bg-[#07060F] p-5 text-white shadow-2xl ring-1 ring-white/10 sm:p-8">
        <div className="pointer-events-none absolute -top-40 -right-24 h-[420px] w-[420px] rounded-full bg-[#6CC690]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[380px] w-[380px] rounded-full bg-[#F3EA3B]/10 blur-3xl" />
        <div className="pointer-events-none absolute top-6 right-6 hidden h-44 w-44 rounded-full ring-1 ring-white/10 lg:block">
          <div className="absolute inset-6 rounded-full ring-1 ring-white/10" />
          <div className="absolute inset-14 rounded-full ring-1 ring-white/10" />
          <div className="radar-sweep absolute inset-0 rounded-full" />
          <span className="radar-ping absolute top-10 left-24 h-2.5 w-2.5 rounded-full bg-[#F3EA3B]" />
          <span className="radar-ping absolute top-28 left-12 h-2 w-2 rounded-full bg-[#9BD373] [animation-delay:0.8s]" />
          <span className="radar-ping absolute top-20 left-32 h-2 w-2 rounded-full bg-rose-400 [animation-delay:1.4s]" />
        </div>

        <div className="relative max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[#F3EA3B] uppercase ring-1 ring-white/15">
            <Radar className="h-3.5 w-3.5" /> Radar de prospecção
          </p>
          <h1 className="mt-3 text-3xl leading-[1.05] font-bold tracking-tight sm:text-[44px]">
            Encontre quem <span className="bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] bg-clip-text text-transparent">gasta mais luz</span> na sua região.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/65 sm:text-base">
            Comércios por nicho, foto de satélite do telhado, consumo estimado pelo tipo de negócio e horário, e os contatos para você abordar agora.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
          className="relative mt-6 grid gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10 backdrop-blur-xl sm:p-4"
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex h-12 flex-1 items-center gap-2 rounded-xl bg-white/10 px-3 ring-1 ring-white/15 focus-within:ring-[#F3EA3B]/70">
              <MapPin className="h-4 w-4 shrink-0 text-[#F3EA3B]" />
              <input
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setCoords(null);
                }}
                placeholder="Bairro, cidade — ex.: Jatiúca, Maceió"
                aria-label="Região"
                className="h-full w-full min-w-0 bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
              />
              {coords && <span className="shrink-0 rounded-full bg-[#9BD373]/20 px-2 py-0.5 text-[10px] font-semibold text-[#9BD373]">GPS</span>}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={locate}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white/15 sm:flex-none"
              >
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                <span>Perto de mim</span>
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] px-6 text-sm font-bold text-[#1C1234] shadow-[0_10px_30px_-10px_rgba(243,234,59,0.7)] transition hover:brightness-105 disabled:opacity-60 sm:flex-none"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Escanear
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-white/50">Raio</span>
            {RADII.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadiusKm(r)}
                className={cx("h-8 rounded-full px-3 font-semibold ring-1 transition", radiusKm === r ? "bg-white text-[#1C1234] ring-white" : "bg-white/5 text-white/75 ring-white/15 hover:bg-white/10")}
              >
                {r} km
              </button>
            ))}
          </div>

          <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-2 pb-1 sm:flex-wrap">
              {NICHES.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setNiche(n.id)}
                  className={cx(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold ring-1 transition",
                    niche === n.id ? "bg-[#F3EA3B] text-[#1C1234] ring-[#F3EA3B]" : "bg-white/5 text-white/80 ring-white/10 hover:bg-white/10",
                  )}
                >
                  <span className="text-base leading-none">{n.emoji}</span>
                  {n.label}
                </button>
              ))}
            </div>
          </div>
          <p className="flex items-start gap-2 text-[12px] text-white/55">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F3EA3B]" />
            <span>
              <b className="text-white/80">{currentNiche.label}</b> consomem em média ~{fmtNum(currentNiche.kwh)} kWh/mês: {currentNiche.pitch}.
            </span>
          </p>
        </form>
      </section>

      {/* ------------------------------------------------ estados */}
      {loading && (
        <div className="mt-6 grid place-items-center rounded-3xl bg-white p-10 text-center shadow-soft ring-1 ring-ink-200/70">
          <div className="relative h-28 w-28 rounded-full bg-[#07060F] ring-1 ring-ink-200">
            <div className="absolute inset-4 rounded-full ring-1 ring-white/15" />
            <div className="radar-sweep absolute inset-0 rounded-full" />
          </div>
          <p className="mt-4 font-semibold text-ink-900">Escaneando {currentNiche.label.toLowerCase()}…</p>
          <p className="text-sm text-ink-500">Cruzando mapa, horários e contatos em {radiusKm} km.</p>
        </div>
      )}
      {error && !loading && (
        <div className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
          <b>Não deu certo:</b> {error}
        </div>
      )}
      {!result && !loading && !error && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Crosshair, t: "Escolha a área e o nicho", d: "Digite o bairro ou use sua localização. Comece por nichos de alto consumo: supermercados, padarias, açougues, hotéis." },
            { icon: Earth, t: "Veja o telhado antes de ligar", d: "Foto de satélite de cada comércio e atalho para o Google Earth em 3D, para avaliar a área útil." },
            { icon: MessageCircle, t: "Aborde com números", d: "Consumo e economia estimados pelo tipo de negócio e horário, e uma mensagem de WhatsApp pronta." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink-200/70">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#1C1234] text-[#F3EA3B]">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-3 font-semibold text-ink-900">{t}</p>
              <p className="mt-1 text-sm text-ink-500">{d}</p>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------ resultados */}
      {result && !loading && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { k: "No radar", v: fmtNum(rows.length), s: `${stats.fresh} ainda não são leads` },
              { k: "Quentes", v: fmtNum(stats.hot), s: "alto consumo e contato" },
              { k: "Com telefone", v: fmtNum(stats.withPhone), s: `${rows.length ? Math.round((stats.withPhone / rows.length) * 100) : 0}% da lista` },
              { k: "Consumo somado", v: `${fmtNum(Math.round(stats.kwh / 1000))} MWh`, s: "por mês, estimado" },
              { k: "Economia na mesa", v: brlShort(stats.savings), s: "por mês, se todos fecharem", wide: true },
            ].map((x) => (
              <div key={x.k} className={cx("rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-200/70", x.wide && "col-span-2 lg:col-span-1")}>
                <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">{x.k}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-ink-900 tabular-nums">{x.v}</p>
                <p className="text-xs text-ink-500">{x.s}</p>
              </div>
            ))}
          </div>

          <div className="sticky top-2 z-20 mt-4 flex flex-col gap-2 rounded-2xl bg-white/85 p-2 shadow-soft ring-1 ring-ink-200/70 backdrop-blur-xl lg:flex-row lg:items-center">
            <label className="flex h-10 flex-1 items-center gap-2 rounded-xl bg-ink-50 px-3 ring-1 ring-ink-200">
              <Search className="h-4 w-4 text-ink-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar por nome ou rua" className="w-full min-w-0 bg-transparent text-sm outline-none" />
            </label>
            <div className="flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
              {[
                { on: onlyPhone, set: setOnlyPhone, l: "Com telefone", i: Phone },
                { on: onlySocial, set: setOnlySocial, l: "E-mail / redes", i: Instagram },
                { on: onlyLong, set: setOnlyLong, l: "Aberto 70h+/sem", i: Clock },
              ].map(({ on, set, l, i: Icon }) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => set(!on)}
                  className={cx("inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold ring-1 transition", on ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-700 ring-ink-200 hover:ring-ink-300")}
                >
                  <Icon className="h-3.5 w-3.5" /> {l}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <Segmented<Sort>
                size="sm"
                value={sort}
                onChange={setSort}
                options={[
                  { value: "potencial", label: "Potencial" },
                  { value: "distancia", label: "Distância" },
                  { value: "nome", label: "A–Z" },
                ]}
              />
              <div className="lg:hidden">
                <Segmented<"lista" | "mapa">
                  size="sm"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "lista", label: "Lista" },
                    { value: "mapa", label: "Mapa" },
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-ink-500">
            <span>
              {visible.length} de {rows.length} · fonte:{" "}
              <b className="text-ink-700">{result.provider === "google" ? "Google Places" : "OpenStreetMap (grátis)"}</b> · {result.center.label.split(",").slice(0, 2).join(",")}
            </span>
            <button type="button" className="font-semibold text-ink-700 underline-offset-2 hover:underline" onClick={() => setSelected(new Set(visible.filter((r) => !r.leadId).map((r) => r.p.id)))}>
              Selecionar novos
            </button>
            <button type="button" className="font-semibold text-ink-700 underline-offset-2 hover:underline" onClick={() => exportCsv(visible)}>
              Exportar CSV
            </button>
          </div>

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
            <div className={cx("grid content-start gap-3", view === "mapa" && "hidden lg:grid")}>
              {visible.length === 0 && (
                <div className="rounded-2xl bg-white p-8 text-center text-sm text-ink-500 ring-1 ring-ink-200/70">Nenhum comércio com esses filtros. Tire um filtro ou aumente o raio.</div>
              )}
              {visible.map((r) => (
                <ProspectCard
                  key={r.p.id}
                  r={r}
                  active={active === r.p.id}
                  selected={selected.has(r.p.id)}
                  onToggle={() => toggle(r.p.id)}
                  onFocus={() => setActive(r.p.id)}
                  onSize={(s) => setSizes((m) => ({ ...m, [r.p.id]: s }))}
                  onEnrich={() => enrich(r.p)}
                  enriching={enriching === r.p.id}
                  onSave={() => saveLeads([r])}
                  saving={saving}
                  pitch={pitchFor(r)}
                />
              ))}
            </div>
            <div className={cx("lg:block", view === "lista" && "hidden")}>
              <div className="h-[70vh] lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
                <AreaMap center={result.center} radiusKm={result.radiusKm} items={visible.map((r) => ({ p: r.p, tier: r.score.tier }))} active={active} onPick={focus} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ------------------------------------------------ barra de ações em lote */}
      {selectedRows.length > 0 && (
        <div className="fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-2xl bg-[#1C1234]/95 p-2.5 pl-4 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-xl lg:bottom-6">
          <p className="mr-auto text-sm">
            <b>{selectedRows.length}</b> selecionado{selectedRows.length > 1 ? "s" : ""}
          </p>
          <a
            href={routeUrl(selectedRows) ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-[13px] font-semibold ring-1 ring-white/15 hover:bg-white/15"
            title="Rota no Google Maps (até 10 paradas)"
          >
            <Route className="h-4 w-4" /> Rota de visitas
          </a>
          <button type="button" onClick={() => exportCsv(selectedRows)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-[13px] font-semibold ring-1 ring-white/15 hover:bg-white/15">
            <Download className="h-4 w-4" /> CSV
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => saveLeads(selectedRows)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] px-3 text-[13px] font-bold text-[#1C1234] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Virar leads
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="h-9 rounded-xl px-2 text-[13px] text-white/60 hover:text-white">
            Limpar
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ card */

type Row = {
  p: Prospect;
  n: NonNullable<ReturnType<typeof nicheOf>>;
  size: Size;
  consumption: ReturnType<typeof estimateConsumption>;
  bill: number;
  est: ReturnType<typeof quickEstimate>;
  score: ReturnType<typeof prospectScore>;
  dist: number;
  leadId: string | undefined;
  enrichedDone: boolean;
};

function ProspectCard({
  r,
  active,
  selected,
  onToggle,
  onFocus,
  onSize,
  onEnrich,
  enriching,
  onSave,
  saving,
  pitch,
}: {
  r: Row;
  active: boolean;
  selected: boolean;
  onToggle: () => void;
  onFocus: () => void;
  onSize: (s: Size) => void;
  onEnrich: () => void;
  enriching: boolean;
  onSave: () => void;
  saving: boolean;
  pitch: string;
}) {
  const { p, n, consumption, est, score } = r;
  const tier = TIER_STYLE[score.tier];
  const wa = p.whatsapp ? `https://wa.me/${p.whatsapp}?text=${encodeURIComponent(pitch)}` : p.phone ? whatsappUrl(p.phone, pitch) : null;
  const site = p.website && !/instagram\.com|facebook\.com/i.test(p.website) ? p.website : null;
  const canEnrich = !!site && !r.enrichedDone;
  const copyPitch = async () => {
    try {
      await navigator.clipboard.writeText(pitch);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não consegui copiar");
    }
  };

  return (
    <article
      id={`pc-${p.id}`}
      onMouseEnter={onFocus}
      className={cx(
        "group overflow-hidden rounded-3xl bg-white shadow-soft ring-1 transition",
        active ? "ring-2 ring-[#1C1234]" : selected ? "ring-2 ring-[#9BD373]" : "ring-ink-200/70 hover:ring-ink-300",
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[200px_minmax(0,1fr)]">
        {/* Telhado */}
        <div className="relative">
          <RoofThumb lat={p.lat} lon={p.lon} className="h-44 w-full sm:h-full sm:min-h-[220px]" />
          <button
            type="button"
            onClick={onToggle}
            aria-label={selected ? "Desmarcar" : "Selecionar"}
            className={cx("absolute top-3 left-3 grid h-7 w-7 place-items-center rounded-lg ring-2 backdrop-blur transition", selected ? "bg-[#9BD373] text-[#1C1234] ring-[#9BD373]" : "bg-black/35 text-transparent ring-white/70 hover:text-white/70")}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </button>
          <div className="absolute right-3 bottom-3 left-3 flex gap-1.5">
            <a
              href={googleEarthUrl(p.lat, p.lon)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-black/55 text-[11px] font-semibold text-white ring-1 ring-white/20 backdrop-blur hover:bg-black/70"
            >
              <Earth className="h-3.5 w-3.5" /> Earth 3D
            </a>
            <a
              href={p.mapsUrl ?? googleMapsUrl(p.lat, p.lon, p.name)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-black/55 text-[11px] font-semibold text-white ring-1 ring-white/20 backdrop-blur hover:bg-black/70"
            >
              <MapPin className="h-3.5 w-3.5" /> Maps
            </a>
          </div>
        </div>

        <div className="min-w-0 p-4 sm:p-5">
          {/* Cabeçalho */}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset", tier.cls)}>
                  {score.tier === "quente" ? "🔥" : score.tier === "morno" ? "☀️" : "❄️"} {tier.label} · {score.score}
                </span>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600">
                  {n.emoji} {n.label}
                </span>
                {r.leadId && (
                  <Link href={`/leads/${r.leadId}`} className="rounded-full bg-[#9BD373]/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-[#9BD373]/40 hover:underline">
                    ✓ Já é lead
                  </Link>
                )}
              </div>
              <h3 className="mt-1.5 truncate text-lg font-bold tracking-tight text-ink-900">{p.name}</h3>
              <p className="truncate text-[13px] text-ink-500">
                {p.address ?? "Endereço não informado"} · {r.dist < 1 ? `${Math.round(r.dist * 1000)} m` : `${r.dist.toFixed(1)} km`}
              </p>
              {(p.rating != null || p.hours) && (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-ink-500">
                  {p.rating != null && (
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {p.rating.toFixed(1)} ({p.reviews ?? 0})
                    </span>
                  )}
                  {p.hours && (
                    <span className="inline-flex min-w-0 items-center gap-1" title={p.hours}>
                      <Clock className="h-3 w-3 shrink-0" />
                      <span className="truncate">{p.hoursWeek ? `${p.hoursWeek}h/semana` : p.hours}</span>
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Consumo */}
          <div className="mt-3 rounded-2xl bg-gradient-to-br from-[#1C1234] to-[#2a1d4d] p-3.5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-white/55 uppercase">Consumo estimado</p>
                <p className="text-xl font-bold tabular-nums">
                  {fmtNum(consumption.min)}–{fmtNum(consumption.max)} <span className="text-sm font-medium text-white/60">kWh/mês</span>
                </p>
              </div>
              <div className="flex shrink-0 rounded-lg bg-white/10 p-0.5 ring-1 ring-white/10" role="group" aria-label="Porte">
                {(["P", "M", "G"] as Size[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSize(s)}
                    title={s === "P" ? "Pequeno" : s === "M" ? "Médio" : "Grande"}
                    className={cx("h-7 w-7 rounded-md text-xs font-bold transition", r.size === s ? "bg-[#F3EA3B] text-[#1C1234]" : "text-white/70 hover:text-white")}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
              {[
                { k: "Conta", v: brlShort(r.bill) },
                { k: "Economia/mês", v: brlShort(est.monthlySavings), hi: true },
                { k: "Sistema", v: `${est.kwp.toFixed(1)} kWp` },
              ].map((x) => (
                <div key={x.k} className="rounded-xl bg-white/[0.07] px-1.5 py-2">
                  <p className="text-[10px] text-white/55">{x.k}</p>
                  <p className={cx("truncate text-[13px] font-bold tabular-nums", x.hi && "text-[#F3EA3B]")}>{x.v}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-white/50">
              Base {n.label.toLowerCase()} {fmtNum(n.kwh)} kWh × horário {p.hoursWeek ? `${p.hoursWeek}h/sem` : "comercial"} × porte {r.size}. Confirme na conta de luz.
            </p>
          </div>

          {/* Contatos */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.phone && (
              <a href={`tel:${onlyDigits(p.phone)}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink-50 px-2.5 text-[12px] font-semibold text-ink-800 ring-1 ring-ink-200 hover:bg-ink-100">
                <Phone className="h-3.5 w-3.5" /> {formatPhone(p.phone)}
              </a>
            )}
            {p.email && (
              <a href={`mailto:${p.email}`} className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-lg bg-ink-50 px-2.5 text-[12px] font-semibold text-ink-800 ring-1 ring-ink-200 hover:bg-ink-100">
                <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{p.email}</span>
              </a>
            )}
            {p.instagram && (
              <a
                href={`https://instagram.com/${p.instagram}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500/10 to-amber-500/10 px-2.5 text-[12px] font-semibold text-fuchsia-700 ring-1 ring-fuchsia-500/25"
              >
                <Instagram className="h-3.5 w-3.5" /> @{p.instagram}
              </a>
            )}
            {p.facebook && (
              <a
                href={/^https?:/.test(p.facebook) ? p.facebook : `https://facebook.com/${p.facebook}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-500/10 px-2.5 text-[12px] font-semibold text-blue-700 ring-1 ring-blue-500/25"
              >
                <Facebook className="h-3.5 w-3.5" /> Facebook
              </a>
            )}
            {site && (
              <a href={/^https?:/.test(site) ? site : `https://${site}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink-50 px-2.5 text-[12px] font-semibold text-ink-800 ring-1 ring-ink-200 hover:bg-ink-100">
                <Globe className="h-3.5 w-3.5" /> Site <ExternalLink className="h-3 w-3 text-ink-400" />
              </a>
            )}
            {canEnrich && (
              <button
                type="button"
                onClick={onEnrich}
                disabled={enriching}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#F3EA3B]/25 px-2.5 text-[12px] font-bold text-[#1C1234] ring-1 ring-[#e3d82a] hover:bg-[#F3EA3B]/40 disabled:opacity-60"
              >
                {enriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Buscar e-mail e redes no site
              </button>
            )}
            {!p.phone && !p.email && !p.instagram && !site && (
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(`${p.name} ${p.city ?? ""} telefone instagram`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink-50 px-2.5 text-[12px] font-semibold text-ink-700 ring-1 ring-ink-200 hover:bg-ink-100"
              >
                <Search className="h-3.5 w-3.5" /> Pesquisar contatos no Google
              </a>
            )}
          </div>

          {/* Ações */}
          <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
            {wa ? (
              <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-bold text-white shadow-soft hover:brightness-105 sm:flex-none">
                <MessageCircle className="h-4 w-4" /> Abordar no WhatsApp
              </a>
            ) : (
              <Button variant="secondary" onClick={copyPitch} className="flex-1 sm:flex-none">
                <Copy className="h-4 w-4" /> Copiar abordagem
              </Button>
            )}
            {wa && (
              <Button variant="ghost" size="icon" onClick={copyPitch} title="Copiar mensagem" aria-label="Copiar mensagem">
                <Copy className="h-4 w-4" />
              </Button>
            )}
            {r.leadId ? (
              <Link href={`/leads/${r.leadId}`} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-ink-100 px-4 text-sm font-semibold text-ink-800 hover:bg-ink-200 sm:ml-auto sm:flex-none">
                Abrir lead
              </Link>
            ) : (
              <Button onClick={onSave} loading={saving} className="flex-1 sm:ml-auto sm:flex-none">
                <UserPlus className="h-4 w-4" /> Salvar como lead
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
