"use client";

import {
  ArrowDown,
  ArrowRight,
  BatteryCharging,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Flame,
  Gift,
  Gauge,
  Loader2,
  Lock,
  MessageCircle,
  Route,
  ShieldCheck,
  Truck,
  Weight,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBf } from "@/components/bf/badges";
import { BF_END_SHORT } from "@/lib/black-friday";
import { prizeByKey } from "@/lib/catalog-wheel";
import { WheelButton, WheelModal, type WonPrize } from "./catalog-wheel";
import { CATALOG_ID, MOB_HOURS, MOB_WHATSAPP, SCOOTERS as LAUNCH_MODELS, brl0, mergeGallery, type GalleryPhoto, type ModelId, type Scooter } from "@/lib/catalog-mobilidade";

/**
 * Catálogo online da Quark Mobilidade: abre direto na vitrine (foto, 21x, à vista e
 * estoque da cota Black). A ficha da scooter tem a reserva: nome + WhatsApp criam o lead
 * no CRM, a reserva desconta 1 do estoque e aparece para os outros visitantes no aviso
 * "acabou de ser reservada" (só reservas reais, sem dados de quem reservou).
 */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const GREEN = "#1F9D55";
const GOLD = "linear-gradient(100deg,#F7E7A1 0%,#E2C35C 45%,#C9A13B 100%)";
const STORE = `quark-catalogo-${CATALOG_ID}`;
const PROFILE = `${STORE}-cliente`;
const PRIZE = `${STORE}-premio`;
const WHEEL_SEEN = `${STORE}-roleta-vista`;
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const goldText = { background: GOLD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } as const;

/* ============================================================ dados locais */

type Access = { token: string; name: string; visits: number; offline?: boolean };
type Profile = { name: string; phone: string };
type Live = { stock: Record<string, number | null>; recent: { id: string; model: string; name: string; at: string }[] };

const load = <T,>(k: string): T | null => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const store = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* navegação privada */
  }
};
const device = () => (typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches ? "celular" : "computador");
const post = (body: Record<string, unknown>) => fetch("/api/public/catalogo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 2) return "agora há pouco";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
};

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

/** Situação do estoque (cota no preço da Black). */
function stockOf(n: number | null | undefined) {
  if (n == null) return { label: "Estoque limitado", short: "", tone: "amber" as const, n: null as number | null, out: false };
  if (n <= 0) return { label: "Esgotado", short: "Esgotado", tone: "gray" as const, n: 0, out: true };
  if (n <= 3) return { label: n === 1 ? "Última unidade no preço Black" : `Restam ${n} unidades no preço Black`, short: n === 1 ? "Última!" : `Restam ${n}`, tone: "red" as const, n, out: false };
  return { label: `${n} unidades no preço Black`, short: "", tone: "amber" as const, n, out: false };
}
const firstName = (v: string) => v.trim().split(" ")[0] ?? "";
const blank = (v?: string) => !v || /^[—–-]+$/.test(v.trim());
const subline = (s: Scooter) => [s.table.Motor, s.table.Bateria, s.table.Autonomia].filter((x) => !blank(x)).join(" · ");
const rangeKm = (s: Scooter) => Math.max(0, ...((s.table.Autonomia ?? "").match(/\d+/g) ?? ["0"]).map(Number));

/* ============================================================ página */

type ExtraPhotos = Partial<Record<ModelId, { url: string; caption: string | null }[]>>;

/** Catálogo online. `models`: modelos cadastrados no CRM (vazio = os do catálogo estático). */
export function MobilidadeCatalog({ whatsapp, photos = {}, models }: { whatsapp: string | null; photos?: ExtraPhotos; models?: Scooter[] }) {
  const base = models?.length ? models : LAUNCH_MODELS;
  const [live, setLive] = useState<Live | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState<Scooter | null>(null);
  const [sort, setSort] = useState<"destaque" | "parcela" | "autonomia">("destaque");
  const [alert, setAlert] = useState<Live["recent"][number] | null>(null);
  const [won, setWon] = useState<WonPrize | null>(null);
  const [wheel, setWheel] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const bf = useBf();

  const wa = useMemo(() => {
    const d = (whatsapp ?? "").replace(/\D/g, "");
    return d ? (d.length <= 11 ? `55${d}` : d) : MOB_WHATSAPP;
  }, [whatsapp]);
  const waLink = useCallback((text: string) => `https://wa.me/${wa}?text=${encodeURIComponent(text)}`, [wa]);

  // Quem já reservou antes volta reconhecido (a visita conta no CRM).
  useEffect(() => {
    const a = load<Access>(STORE);
    setAccess(a);
    setProfile(load<Profile>(PROFILE));
    const w = load<WonPrize>(PRIZE);
    setWon(w);
    let first = false;
    try {
      first = !sessionStorage.getItem(`${STORE}-sessao`);
      sessionStorage.setItem(`${STORE}-sessao`, "1");
    } catch {
      /* navegação privada */
    }
    if (a && !a.offline && first) void post({ action: "visit", token: a.token, device: device() }).catch(() => {});
    // Primeira visita neste aparelho: a roleta se apresenta sozinha depois de alguns segundos.
    if (!w && !load<boolean>(WHEEL_SEEN)) {
      const t = setTimeout(() => {
        if (!location.hash) setWheel(true);
        store(WHEEL_SEEN, true);
      }, 9000);
      return () => clearTimeout(t);
    }
  }, []);

  // Estoque e reservas ao vivo (a cada 30 s): reserva nova vira aviso na tela.
  useEffect(() => {
    let first = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/public/catalogo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "live", catalog: CATALOG_ID }) });
        const j = (await r.json()) as Live;
        if (!j || typeof j !== "object" || !j.stock) return;
        setLive(j);
        const fresh = (j.recent ?? []).filter((x) => !seen.current.has(x.id));
        fresh.forEach((x) => seen.current.add(x.id));
        // Na chegada: só a reserva mais recente, se for das últimas 12 h. Depois: cada reserva nova.
        const show = first ? fresh.filter((x) => Date.now() - new Date(x.at).getTime() < 12 * 3600e3).slice(0, 1) : fresh.slice(0, 1);
        if (show[0]) setTimeout(() => setAlert(show[0]), first ? 3500 : 0);
        first = false;
      } catch {
        /* sem rede: segue com o estoque da página */
      }
    };
    void tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 7000);
    return () => clearTimeout(t);
  }, [alert]);

  const list = useMemo(() => {
    const withStock = base.map((s) => (live && s.id in live.stock ? { ...s, stock: live.stock[s.id] } : s));
    const sorted = [...withStock];
    if (sort === "parcela") sorted.sort((a, b) => a.installment - b.installment);
    if (sort === "autonomia") sorted.sort((a, b) => rangeKm(b) - rangeKm(a));
    // Esgotados vão para o fim.
    return sorted.sort((a, b) => Number(stockOf(a.stock).out) - Number(stockOf(b.stock).out));
  }, [base, live, sort]);

  // Ficha pelo endereço (#a2); o "voltar" do celular fecha a ficha.
  const pushed = useRef(false);
  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(location.hash.replace(/^#/, ""));
      setOpen(base.find((m) => m.id === id) ?? null);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [base]);
  const show = (s: Scooter) => {
    if (access?.token) void post({ action: "track", token: access.token, kind: "click", detail: `ver ${s.name}` }).catch(() => {});
    if (location.hash !== `#${s.id}`) {
      location.hash = s.id;
      pushed.current = true;
    }
    setOpen(s);
  };
  const close = () => {
    if (pushed.current) history.back();
    else if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    pushed.current = false;
    setOpen(null);
  };
  const current = open ? (list.find((x) => x.id === open.id) ?? open) : null;
  const hero = list.find((s) => !stockOf(s.stock).out) ?? list[0];
  const minInstallment = Math.min(...list.map((s) => s.installment).filter((v) => v > 0));

  return (
    <div className="min-h-dvh bg-[#F4F4F0] font-[family-name:var(--font-outfit)] text-[#0B1A12] antialiased">
      {/* faixa Black */}
      {bf && (
        <div className="bg-black text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-[12px] sm:px-6">
            <span className="font-black tracking-[0.18em] uppercase" style={goldText}>
              Black Friday Quark
            </span>
            <span className="flex items-center gap-2">
              <span className="hidden text-white/55 sm:inline">{bf.phase === "durante" ? "Preços especiais terminam em" : "Começa em"}</span>
              <Countdown compact />
            </span>
          </div>
        </div>
      )}

      {/* topo */}
      <header className="sticky top-0 z-30 border-b border-black/[0.05] bg-[#F4F4F0]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mob/ic/logo.png" alt="Quark Mobilidade" className="h-7 w-auto sm:h-8" />
          <a
            href={waLink(`Olá! Estou vendo o catálogo de scooters elétricas${profile?.name ? `, sou ${profile.name}` : ""}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#0B1A12] pr-4 pl-2 text-[13.5px] font-semibold text-white"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#25D366]">
              <MessageCircle className="h-3.5 w-3.5 text-[#06210F]" />
            </span>
            WhatsApp
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {/* destaque */}
        <section className="relative mt-4 overflow-hidden rounded-[32px] bg-[#0A0F0C] text-white sm:mt-6">
          <div className="pointer-events-none absolute -top-40 -right-24 h-[520px] w-[520px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(226,195,92,0.28), rgba(226,195,92,0))" }} />
          <div className="pointer-events-none absolute -bottom-48 -left-24 h-[480px] w-[480px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(79,195,138,0.30), rgba(79,195,138,0))" }} />
          <div className="relative grid items-center gap-2 px-6 pt-8 pb-7 sm:px-10 sm:pt-10 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:py-12">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1.5 text-[11px] font-bold tracking-[0.18em] uppercase ring-1 ring-white/10">
                <Flame className="h-3.5 w-3.5 text-[#E2C35C]" /> {bf ? "Black Friday · cota limitada" : "Scooters elétricas 1.000W"}
              </p>
              <h1 className="mt-4 text-[40px] leading-[0.98] font-bold tracking-[-0.045em] sm:text-[60px]">
                Sem CNH.
                <br />
                Sem placa.
                <br />
                <span style={goldText}>Em até 21x.</span>
              </h1>
              <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-white/65 sm:text-[17px]">
                Scooters elétricas 1.000W com garantia, contrato e entrega montada. A partir de <b className="text-white">21x de {money(minInstallment)}</b>.
              </p>
              {bf && (
                <div className="mt-6">
                  <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-white/45 uppercase">{bf.phase === "durante" ? "Termina em" : "Começa em"}</p>
                  <Countdown />
                </div>
              )}
              <div className="mt-7 flex flex-wrap gap-2">
                <button type="button" onClick={() => document.getElementById("vitrine")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-bold text-[#0B1A12]">
                  Ver as scooters <ArrowDown className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setWheel(true)} className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-bold text-[#0B1A12]" style={{ background: GOLD }}>
                  <Gift className="h-4 w-4" /> {won ? "Ver meu prêmio" : "Gire e ganhe até R$ 300"}
                </button>
              </div>
            </div>
            {hero && (
              <button type="button" onClick={() => show(hero)} className="group relative mx-auto mt-4 aspect-[5/4] w-full max-w-[520px] lg:mt-0" aria-label={`Ver ${hero.name}`}>
                <div className="absolute inset-x-[12%] bottom-[8%] h-[16%] rounded-[50%] bg-black/60 blur-2xl" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hero.image} alt={hero.name} className="relative h-full w-full object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.55)] transition duration-700 group-hover:scale-[1.03]" />
                <span className="absolute bottom-[6%] left-[4%] rounded-[18px] bg-white/95 px-4 py-2.5 text-left text-[#0B1A12] shadow-xl">
                  <span className="block text-[11px] font-bold tracking-[0.12em] text-[#0B1A12]/45 uppercase">{hero.name} · 21x de</span>
                  <span className="block text-[22px] leading-none font-extrabold tabular-nums">{money(hero.installment)}</span>
                </span>
              </button>
            )}
          </div>
        </section>

        {/* vitrine */}
        <div id="vitrine" className="mt-10 flex scroll-mt-20 flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase" style={{ color: GREEN }}>
              {list.length} modelos 1.000W
            </p>
            <h2 className="text-[28px] leading-tight font-bold tracking-[-0.03em] sm:text-[34px]">Escolha a sua.</h2>
          </div>
          <div className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-black/[0.06]" role="tablist" aria-label="Ordenar">
            {(
              [
                ["destaque", "Destaques"],
                ["parcela", "Menor parcela"],
                ["autonomia", "Mais autonomia"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={sort === k} onClick={() => setSort(k)} className={cx("h-9 rounded-full px-3 text-[12.5px] font-semibold transition sm:px-3.5 sm:text-[13px]", sort === k ? "bg-[#0B1A12] text-white" : "text-[#0B1A12]/60 hover:text-[#0B1A12]")}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((s) => (
            <ProductCard key={s.id} s={s} black={!!bf} onOpen={() => show(s)} />
          ))}
        </div>

        {/* confiança */}
        <section className="mt-12 grid gap-1 rounded-[28px] bg-white p-3 ring-1 ring-black/[0.05] sm:grid-cols-4 sm:gap-3 sm:p-6">
          {(
            [
              [ShieldCheck, "Garantia de 90 dias", "contra defeitos de fábrica"],
              [Truck, "Entrega montada", "grátis em Maceió"],
              [CreditCard, "Até 21x no cartão", "pode usar mais de um cartão"],
              [Zap, "Sem CNH e sem placa", "autopropelido · Res. 996/2023"],
            ] as [LucideIcon, string, string][]
          ).map(([I, t, x]) => (
            <div key={t} className="flex items-center gap-3 rounded-[18px] p-2 sm:block">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#EEF6EE]">
                <I className="h-5 w-5" style={{ color: GREEN }} />
              </span>
              <span className="sm:mt-3 sm:block">
                <span className="block text-[14.5px] leading-tight font-bold">{t}</span>
                <span className="block text-[12.5px] text-[#0B1A12]/55">{x}</span>
              </span>
            </div>
          ))}
        </section>

        <footer className="mt-10 text-center text-[12px] leading-relaxed text-[#0B1A12]/45">
          Preços da Black Friday válidos enquanto durar a cota de cada modelo. Parcelamento no cartão de crédito com acréscimo da operadora; o valor à vista é para PIX.
          <br />
          {MOB_HOURS}.
        </footer>
      </main>

      {/* aviso de reserva real */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[72px] z-40 flex justify-center px-4 sm:top-auto sm:bottom-6 sm:justify-start sm:px-6">
        {alert && (
          <div className="bf-rise pointer-events-auto flex max-w-sm items-center gap-3 rounded-[20px] bg-white/95 p-2.5 pr-4 shadow-[0_24px_50px_-20px_rgba(11,26,18,0.55)] ring-1 ring-black/[0.06] backdrop-blur">
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-[#F1F3EE]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={base.find((m) => m.id === alert.model)?.image ?? "/mob/cmp-scooter.webp"} alt="" className="h-full w-full object-contain p-1" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[13.5px] font-bold">
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#E5484D]" /> Scooter {alert.name} reservada
              </span>
              <span className="block text-[12px] text-[#0B1A12]/55">
                {ago(alert.at)} pelo catálogo
                {live && alert.model in live.stock && live.stock[alert.model] != null ? ` · restam ${live.stock[alert.model]}` : ""}
              </span>
            </span>
            <button type="button" aria-label="Fechar aviso" onClick={() => setAlert(null)} className="ml-1 text-[#0B1A12]/35 hover:text-[#0B1A12]">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <WheelButton won={won} onOpen={() => setWheel(true)} />
      <WheelModal
        open={wheel}
        onClose={() => setWheel(false)}
        won={won}
        profile={profile}
        until={BF_END_SHORT}
        spin={async (name, phone) => {
          let owner = "";
          try {
            owner = new URLSearchParams(window.location.search).get("v") ?? "";
          } catch {
            /* sem parâmetros */
          }
          const r = await post({ action: "spin", catalog: CATALOG_ID, name, phone, owner, device: device() });
          const j = (await r.json().catch(() => null)) as { prize?: string; label?: string; code?: string; token?: string; existing?: boolean; error?: string } | null;
          if (!r.ok || !j?.prize || !j.code) throw new Error(j?.error || "Não foi possível girar agora. Tente de novo.");
          return { prize: j.prize, label: j.label ?? prizeByKey(j.prize)?.label ?? "", code: j.code, token: j.token, existing: j.existing };
        }}
        onWon={(w, p, token) => {
          setWon(w);
          store(PRIZE, w);
          setProfile(p);
          store(PROFILE, p);
          store(WHEEL_SEEN, true);
          if (token) {
            const a = { token, name: firstName(p.name), visits: 1 };
            setAccess(a);
            store(STORE, a);
          }
        }}
      />

      {current && (
        <ProductSheet
          won={won}
          s={current}
          photos={photos[current.id] ?? []}
          black={!!bf}
          profile={profile}
          token={access?.token ?? null}
          waLink={waLink}
          onClose={close}
          onReserved={(p, a, stock) => {
            setProfile(p);
            store(PROFILE, p);
            if (a) {
              setAccess(a);
              store(STORE, a);
            }
            if (stock !== undefined) setLive((l) => ({ stock: { ...(l?.stock ?? {}), [current.id]: stock }, recent: l?.recent ?? [] }));
          }}
        />
      )}
    </div>
  );
}

/* ============================================================ peças */

function Countdown({ compact }: { compact?: boolean }) {
  const bf = useBf();
  if (!bf?.left) return null;
  const { d, h, m, s } = bf.left;
  const parts: [number, string][] = [
    [d, "dias"],
    [h, "horas"],
    [m, "min"],
    [s, "seg"],
  ];
  if (compact)
    return (
      <span className="flex items-center gap-1 font-bold tabular-nums">
        {parts.map(([v, u]) => (
          <span key={u} className="rounded-[6px] bg-white/10 px-1.5 py-0.5 text-[12px]">
            {String(v).padStart(2, "0")}
            <span className="ml-0.5 text-[9px] font-semibold text-white/50">{u[0]}</span>
          </span>
        ))}
      </span>
    );
  return (
    <div className="flex gap-2">
      {parts.map(([v, u]) => (
        <span key={u} className="grid w-[62px] place-items-center rounded-[16px] bg-white/[0.07] py-2.5 ring-1 ring-white/10 sm:w-[70px]">
          <span className="text-[24px] leading-none font-bold tabular-nums sm:text-[28px]">{String(v).padStart(2, "0")}</span>
          <span className="mt-1 text-[10px] font-semibold tracking-[0.12em] text-white/45 uppercase">{u}</span>
        </span>
      ))}
    </div>
  );
}

function BlackTag({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-[7px] bg-black px-2 py-[3px] text-[10px] font-black tracking-[0.16em] uppercase", className)}>
      <span style={goldText}>Black</span>
    </span>
  );
}

function StockBar({ n, compact }: { n: number | null | undefined; compact?: boolean }) {
  const st = stockOf(n);
  const pct = st.n == null ? 35 : st.out ? 0 : Math.max(8, Math.min(100, (st.n / Math.max(6, st.n)) * 100));
  const color = st.tone === "red" ? "#E5484D" : st.tone === "gray" ? "rgba(11,26,18,0.25)" : "#E2A93B";
  return (
    <div>
      <div className={cx("overflow-hidden rounded-full bg-[#0B1A12]/[0.07]", compact ? "h-1" : "h-1.5")}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className={cx("mt-1.5 font-semibold", compact ? "text-[11px]" : "text-[13px]", st.tone === "red" ? "text-[#D23B31]" : st.tone === "gray" ? "text-[#0B1A12]/45" : "text-[#A86C00]")}>{st.label}</p>
    </div>
  );
}

function ProductCard({ s, black, onOpen }: { s: Scooter; black: boolean; onOpen: () => void }) {
  const st = stockOf(s.stock);
  const alt = s.gallery.find((g) => g.src !== s.image && g.fit !== "cover")?.src;
  return (
    <article className={cx("group flex flex-col rounded-[26px] bg-white p-2 shadow-[0_1px_2px_rgba(11,26,18,0.04),0_18px_40px_-30px_rgba(11,26,18,0.35)] ring-1 ring-black/[0.04] transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(11,26,18,0.45)]", st.out && "opacity-60")}>
      <button type="button" onClick={onOpen} className="flex flex-1 flex-col text-left" aria-label={`Ver ${s.name}`}>
        <div className="relative aspect-square overflow-hidden rounded-[20px]" style={{ background: "radial-gradient(80% 70% at 50% 58%, #FFFFFF 0%, #EEF0EB 100%)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.image} alt={s.name} loading="lazy" className={cx("absolute inset-0 h-full w-full object-contain p-[9%] mix-blend-multiply transition duration-500", alt ? "group-hover:opacity-0" : "group-hover:scale-[1.05]")} />
          {alt && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={alt} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain p-[9%] opacity-0 mix-blend-multiply transition duration-500 group-hover:opacity-100" />
          )}
          {black && <BlackTag className="absolute top-3 left-3" />}
          {st.short && <span className={cx("absolute top-3 right-3 rounded-[7px] px-2 py-[3px] text-[10.5px] font-bold text-white", st.out ? "bg-[#0B1A12]/60" : "bg-[#E5484D]")}>{st.short}</span>}
        </div>
        <div className="flex flex-1 flex-col px-2.5 pt-3">
          <p className="text-[10.5px] font-bold tracking-[0.16em] uppercase" style={{ color: GREEN }}>
            Scooter elétrica
          </p>
          <h3 className="text-[22px] leading-tight font-bold tracking-[-0.03em] sm:text-[24px]">{s.name}</h3>
          <p className="line-clamp-1 text-[11.5px] text-[#0B1A12]/50">{subline(s)}</p>
          <div className="mt-auto pt-3">
            <p className="text-[11.5px] font-semibold text-[#0B1A12]/50">{s.installments}x de</p>
            <p className="text-[23px] leading-none font-extrabold tracking-[-0.035em] tabular-nums sm:text-[26px]">{money(s.installment)}</p>
            <p className="mt-1 text-[12px] text-[#0B1A12]/55">
              ou <b className="text-[#0B1A12]">{brl0(s.cash)}</b> à vista
            </p>
          </div>
        </div>
      </button>
      <div className="px-2.5 pt-3 pb-2">
        <StockBar n={s.stock} compact />
        <button type="button" onClick={onOpen} disabled={st.out} className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-[14px] bg-[#0B1A12] text-[14px] font-bold text-white transition active:scale-[0.98] disabled:bg-[#0B1A12]/25">
          {st.out ? "Esgotado" : "Reservar"} {!st.out && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
        </button>
      </div>
    </article>
  );
}

/* ============================================================ ficha + reserva */

const SPEC_ICONS: Record<string, LucideIcon> = { bolt: Zap, battery: BatteryCharging, route: Route, brake: Gauge, weight: Weight, lock: Lock, shield: ShieldCheck, gear: Gauge };

function ProductSheet({
  won,
  s,
  photos,
  black,
  profile,
  token,
  waLink,
  onClose,
  onReserved,
}: {
  won: WonPrize | null;
  s: Scooter;
  photos: { url: string; caption: string | null }[];
  black: boolean;
  profile: Profile | null;
  token: string | null;
  waLink: (t: string) => string;
  onClose: () => void;
  onReserved: (p: Profile, a: Access | null, stock?: number | null) => void;
}) {
  const shots: GalleryPhoto[] = useMemo(() => {
    const g = mergeGallery(s.gallery.length ? s.gallery : [{ src: s.image, caption: s.name, fit: "contain" }], photos);
    return g.length ? g : [{ src: s.image, caption: s.name, fit: "contain" }];
  }, [s, photos]);
  const [i, setI] = useState(0);
  const [step, setStep] = useState<"ficha" | "reserva" | "ok">("ficha");
  const colors = s.colors?.length ? s.colors : [];
  const [color, setColor] = useState(colors[0] ?? "");
  const [pay, setPay] = useState<"cartao" | "pix">("cartao");
  const [name, setName] = useState(profile?.name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const st = stockOf(s.stock);
  const touch = useRef<number | null>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  const rows = Object.entries(s.table).filter(([, v]) => !blank(v));
  const valid = name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10;

  useEffect(() => {
    if (step !== "ficha") actionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const go = (d: number) => setI((x) => (x + d + shots.length) % shots.length);
  const payText = pay === "cartao" ? `cartão em ${s.installments}x de ${money(s.installment)}` : `PIX à vista (${brl0(s.cash)})`;
  const prize = prizeByKey(won?.prize);
  const prizeText = won && prize ? ` Ganhei na roleta: ${won.label} (código ${won.code}).` : "";
  const message = () => `Olá! Sou ${name.trim() || "cliente"} e reservei a scooter elétrica ${s.name}${color ? ` na cor ${color}` : ""}, no ${payText}.${prizeText} Pode confirmar a disponibilidade e a entrega?`;

  const reserve = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr("");
    // Abre a aba já no clique (o navegador bloqueia janelas abertas depois de esperar a rede).
    const tab = window.open("about:blank", "_blank");
    try {
      let owner = "";
      try {
        owner = new URLSearchParams(window.location.search).get("v") ?? "";
      } catch {
        /* sem parâmetros */
      }
      const r = await post({ action: "reserve", catalog: CATALOG_ID, token, name: name.trim(), phone, model: s.id, modelName: s.name, color, pay: pay === "cartao" ? `cartão ${s.installments}x` : "PIX à vista", coupon: won ? `${won.code} ${prize?.kind === "cupom" ? `R$${prize.value}` : (prize?.short[0] ?? "")}`.trim() : "", owner, device: device(), website });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; token?: string; stock?: number | null; error?: string } | null;
      if (!r.ok) {
        tab?.close();
        if (j?.stock === 0) onReserved({ name: name.trim(), phone }, null, 0);
        throw new Error(j?.error || "Não foi possível reservar agora. Tente de novo.");
      }
      onReserved({ name: name.trim(), phone }, j?.token ? { token: j.token, name: name.trim().split(/\s+/)[0], visits: 1 } : null, j?.stock);
      setStep("ok");
      if (tab) tab.location.href = waLink(message());
      else window.open(waLink(message()), "_blank", "noopener");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const input = "h-12 w-full rounded-[14px] bg-[#F4F5F1] px-4 text-[16px] ring-1 ring-black/[0.07] placeholder:text-[#0B1A12]/40 outline-none transition focus:bg-white focus:ring-2 focus:ring-[#1F9D55]";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0B1A12]/55 backdrop-blur-[3px] sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal aria-label={`Scooter ${s.name}`}>
      <div onClick={(e) => e.stopPropagation()} className="bf-rise relative flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[30px] bg-white font-[family-name:var(--font-outfit)] text-[#0B1A12] shadow-2xl sm:rounded-[30px]">
        <button type="button" onClick={onClose} aria-label="Fechar" className="absolute top-3 right-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow ring-1 ring-black/10">
          <X className="h-5 w-5" />
        </button>
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[1.15fr_1fr] md:overflow-hidden">
          {/* fotos */}
          <div className="md:flex md:flex-col md:overflow-hidden" style={{ background: "radial-gradient(80% 70% at 50% 55%, #FFFFFF 0%, #ECEEE8 100%)" }}>
            <div
              className="relative aspect-[4/3.3] md:aspect-auto md:flex-1"
              onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (touch.current == null) return;
                const dx = e.changedTouches[0].clientX - touch.current;
                if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
                touch.current = null;
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={shots[i].src} src={shots[i].src} alt={`${s.name}${shots[i].caption ? ` · ${shots[i].caption}` : ""}`} className={cx("absolute inset-0 h-full w-full", shots[i].fit === "cover" ? "object-cover" : "object-contain p-6 mix-blend-multiply")} />
              {black && <BlackTag className="absolute top-4 left-4" />}
              {shots.length > 1 && (
                <>
                  <button type="button" aria-label="Foto anterior" onClick={() => go(-1)} className="absolute top-1/2 left-3 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow ring-1 ring-black/10">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button type="button" aria-label="Próxima foto" onClick={() => go(1)} className="absolute top-1/2 right-3 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow ring-1 ring-black/10">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-1 text-[11.5px] font-semibold text-white tabular-nums">
                    {i + 1}/{shots.length}
                  </span>
                </>
              )}
            </div>
            {shots.length > 1 && (
              <div className="flex gap-2 overflow-x-auto px-3 pb-3 [scrollbar-width:none]">
                {shots.map((g, k) => (
                  <button key={g.src} type="button" onClick={() => setI(k)} aria-label={`Foto ${k + 1}`} className={cx("h-16 w-16 shrink-0 overflow-hidden rounded-[12px] bg-white ring-2 transition", k === i ? "ring-[#0B1A12]" : "ring-transparent opacity-70")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.src} alt="" className={cx("h-full w-full", g.fit === "cover" ? "object-cover" : "object-contain p-1")} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* dados */}
          <div className="flex flex-col md:overflow-y-auto">
            <div className="p-5 sm:p-7">
              <p className="text-[11.5px] font-bold tracking-[0.18em] uppercase" style={{ color: GREEN }}>
                {s.kicker}
              </p>
              <h2 className="mt-1 text-[32px] leading-tight font-bold tracking-[-0.035em]">Scooter elétrica {s.name}</h2>
              {step === "ficha" && s.pitch && <p className="mt-1.5 text-[15px] leading-relaxed text-[#0B1A12]/60">{s.pitch}</p>}

              <div className={cx("mt-5 rounded-[22px] bg-[#0A0F0C] p-5 text-white", step !== "ficha" && "hidden")}>
                <p className="text-[12.5px] font-semibold text-white/55">{s.installments}x no cartão de</p>
                <p className="text-[38px] leading-none font-extrabold tracking-[-0.035em] tabular-nums" style={goldText}>
                  {money(s.installment)}
                </p>
                <p className="mt-2 text-[15px] text-white/80">
                  ou <b className="text-white">{brl0(s.cash)}</b> à vista no PIX
                </p>
                {won && prize && (
                  <p className="mt-3 flex items-center gap-2 rounded-[12px] bg-white/[0.08] px-3 py-2 text-[13.5px] ring-1 ring-white/10">
                    <Gift className="h-4 w-4 shrink-0 text-[#E2C35C]" />
                    {prize.kind === "cupom" ? (
                      <span>
                        Com o seu cupom: <b style={goldText}>{brl0(Math.max(0, s.cash - prize.value))}</b> à vista
                      </span>
                    ) : (
                      <span>
                        + <b style={goldText}>{won.label}</b> de brinde
                      </span>
                    )}
                  </p>
                )}
                <div className="mt-4 rounded-[14px] bg-white p-3">
                  <StockBar n={s.stock} />
                </div>
              </div>

              {step === "ficha" && (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {s.specs
                      .filter((x) => !blank(x.value))
                      .slice(0, 6)
                      .map((x) => {
                        const I = SPEC_ICONS[x.icon] ?? Zap;
                        return (
                          <div key={x.label} className="rounded-[16px] bg-[#F6F7F3] px-3 py-2.5">
                            <p className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.08em] text-[#0B1A12]/45 uppercase">
                              <I className="h-3.5 w-3.5" style={{ color: GREEN }} /> {x.label}
                            </p>
                            <p className="mt-0.5 text-[14.5px] leading-tight font-bold">{x.value}</p>
                          </div>
                        );
                      })}
                  </div>
                  {rows.length > 0 && (
                    <dl className="mt-4 divide-y divide-black/[0.05] rounded-[18px] ring-1 ring-black/[0.06]">
                      {rows.map(([k, v]) => (
                        <div key={k} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-[14px]">
                          <dt className="text-[#0B1A12]/55">{k}</dt>
                          <dd className="text-right font-semibold">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <ul className="mt-4 grid gap-1.5 text-[13.5px] text-[#0B1A12]/70">
                    {["Garantia de 90 dias e manual do proprietário", "Contrato e cartão do proprietário com QR de autenticidade", "Entrega montada e revisada"].map((t) => (
                      <li key={t} className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0" style={{ color: GREEN }} strokeWidth={3} /> {t}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {step === "reserva" && (
                <div ref={actionRef} className="mt-5 scroll-mt-4">
                  <p className="text-[17px] font-bold">Reserve a sua {s.name}</p>
                  <p className="text-[13.5px] text-[#0B1A12]/55">Sem pagamento agora. A unidade sai da cota e confirmamos a entrega pelo WhatsApp.</p>
                  <div className="mt-4 grid gap-2">
                    <label className="sr-only" htmlFor="r-name">
                      Seu nome
                    </label>
                    <input id="r-name" className={input} placeholder="Seu nome" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                    <label className="sr-only" htmlFor="r-phone">
                      WhatsApp
                    </label>
                    <input id="r-phone" className={input} placeholder="WhatsApp com DDD" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} />
                    <input tabIndex={-1} autoComplete="off" className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden />
                  </div>
                  {colors.length > 0 && (
                    <>
                      <p className="mt-4 mb-2 text-[13px] font-semibold text-[#0B1A12]/60">Cor</p>
                      <div className="flex flex-wrap gap-2">
                        {colors.map((c) => (
                          <button key={c} type="button" onClick={() => setColor(c)} className={cx("h-10 rounded-full px-4 text-[14px] font-semibold ring-1 transition", c === color ? "bg-[#0B1A12] text-white ring-[#0B1A12]" : "bg-white ring-black/15")}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <p className="mt-4 mb-2 text-[13px] font-semibold text-[#0B1A12]/60">Como prefere pagar</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["cartao", `${s.installments}x de ${money(s.installment)}`, "no cartão de crédito"],
                        ["pix", brl0(s.cash), "à vista no PIX"],
                      ] as const
                    ).map(([k, a, b]) => (
                      <button key={k} type="button" onClick={() => setPay(k)} className={cx("rounded-[16px] px-3 py-3 text-left ring-1 transition", pay === k ? "bg-[#EEF6EE] ring-2 ring-[#1F9D55]" : "bg-white ring-black/15")}>
                        <span className="block text-[15px] font-bold tabular-nums">{a}</span>
                        <span className="block text-[12px] text-[#0B1A12]/55">{b}</span>
                      </button>
                    ))}
                  </div>
                  {won && prize && (
                    <p className="mt-4 flex items-center gap-2 rounded-[14px] bg-[#FBF5DF] px-3 py-2.5 text-[13.5px] ring-1 ring-[#E2C35C]/50">
                      <Gift className="h-4 w-4 shrink-0 text-[#A8821E]" /> Prêmio aplicado: <b>{won.label}</b> · {won.code}
                    </p>
                  )}
                  {err && <p className="mt-3 rounded-[12px] bg-[#FDECEA] px-3 py-2 text-[13.5px] text-[#A12A17]">{err}</p>}
                </div>
              )}

              {step === "ok" && (
                <div ref={actionRef} className="mt-5 scroll-mt-4 rounded-[22px] bg-[#EEF6EE] p-5 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#1F9D55] text-white">
                    <Check className="h-6 w-6" strokeWidth={3} />
                  </span>
                  <p className="mt-3 text-[19px] font-bold">Reserva feita, {name.trim().split(/\s+/)[0]}!</p>
                  <p className="mt-1 text-[14px] text-[#0B1A12]/65">A sua {s.name} está separada. Abrimos o WhatsApp para confirmar a entrega; se não abriu, toque no botão abaixo.</p>
                </div>
              )}
            </div>

            {/* ação */}
            <div className="sticky bottom-0 mt-auto border-t border-black/[0.05] bg-white/95 p-4 backdrop-blur sm:px-7">
              {step === "ficha" && (
                <button type="button" disabled={st.out} onClick={() => setStep("reserva")} className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#0B1A12] text-[16px] font-bold text-white transition active:scale-[0.98] disabled:bg-[#0B1A12]/25">
                  {st.out ? "Esgotado no preço Black" : "Reservar esta scooter"} {!st.out && <ArrowRight className="h-5 w-5" />}
                </button>
              )}
              {step === "reserva" && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep("ficha")} className="h-14 rounded-full px-5 text-[15px] font-semibold ring-1 ring-black/15">
                    Voltar
                  </button>
                  <button type="button" disabled={busy || !valid} onClick={reserve} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-[#25D366] text-[16px] font-bold text-[#06210F] transition active:scale-[0.98] disabled:opacity-50">
                    {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />} Confirmar reserva
                  </button>
                </div>
              )}
              {step === "ok" && (
                <a href={waLink(message())} target="_blank" rel="noopener noreferrer" className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] text-[16px] font-bold text-[#06210F]">
                  <MessageCircle className="h-5 w-5" /> Abrir o WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
