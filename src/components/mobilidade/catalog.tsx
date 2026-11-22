"use client";

import {
  BatteryCharging,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
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
import { CATALOG_ID, MOB_HOURS, MOB_WHATSAPP, SCOOTERS as LAUNCH_MODELS, brl0, mergeGallery, type GalleryPhoto, type ModelId, type Scooter } from "@/lib/catalog-mobilidade";

/**
 * Catálogo online da Quark Mobilidade: vitrine limpa, foto em primeiro lugar, parcela em
 * 21x, preço à vista e estoque. Ao tocar, abre a ficha da scooter com a reserva.
 * O acesso continua liberado por cadastro (nome, WhatsApp e e-mail): cada visita,
 * clique e reserva aparece no CRM.
 */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const GREEN = "#1F9D55";
const STORE = `quark-catalogo-${CATALOG_ID}`;
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ============================================================ acesso */

type Access = { token: string; name: string; visits: number; offline?: boolean };

function readAccess(): Access | null {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Access) : null;
  } catch {
    return null;
  }
}
function saveAccess(a: Access | null) {
  try {
    if (a) localStorage.setItem(STORE, JSON.stringify(a));
    else localStorage.removeItem(STORE);
  } catch {
    /* navegação privada */
  }
}
const device = () => (typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches ? "celular" : "computador");
const post = (body: Record<string, unknown>) => fetch("/api/public/catalogo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });

/** Seções vistas, tempo de leitura e cliques vão para a ficha do lead no CRM. */
function useTracking(token: string) {
  const send = useCallback((kind: "section" | "time" | "click" | "interest", detail = "", value = 0) => post({ action: "track", token, kind, detail, value }).catch(() => {}), [token]);
  useEffect(() => {
    let acc = 0;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") acc += 5;
      if (acc >= 20) {
        void send("time", "leitura", acc);
        acc = 0;
      }
    }, 5000);
    const flush = () => {
      if (acc > 0) void send("time", "leitura", acc);
      acc = 0;
    };
    window.addEventListener("pagehide", flush);
    return () => {
      clearInterval(t);
      window.removeEventListener("pagehide", flush);
    };
  }, [send]);
  return send;
}

type ExtraPhotos = Partial<Record<ModelId, { url: string; caption: string | null }[]>>;

/** Catálogo online. `models`: modelos cadastrados no CRM (vazio = os do catálogo estático). */
export function MobilidadeCatalog({ whatsapp, photos = {}, models }: { whatsapp: string | null; photos?: ExtraPhotos; models?: Scooter[] }) {
  const [access, setAccess] = useState<Access | null>(null);
  const [ready, setReady] = useState(false);
  const list = models?.length ? models : LAUNCH_MODELS;

  useEffect(() => {
    const a = readAccess();
    setReady(true);
    if (!a) return;
    setAccess(a);
    if (a.offline) return;
    const key = `${STORE}-sessao`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* navegação privada */
    }
    post({ action: "visit", token: a.token, device: device() })
      .then(async (r) => {
        if (r.status === 404) {
          saveAccess(null);
          setAccess(null);
          return;
        }
        const j = (await r.json().catch(() => null)) as { visits?: number } | null;
        if (j?.visits) {
          const next = { ...a, visits: j.visits };
          saveAccess(next);
          setAccess(next);
        }
      })
      .catch(() => {});
  }, []);

  const wa = useMemo(() => {
    const d = (whatsapp ?? "").replace(/\D/g, "");
    return d ? (d.length <= 11 ? `55${d}` : d) : MOB_WHATSAPP;
  }, [whatsapp]);

  if (!ready) return <div className="min-h-dvh bg-[#F6F7F5]" />;
  if (!access)
    return (
      <Gate
        models={list}
        onAccess={(a) => {
          saveAccess(a);
          try {
            sessionStorage.setItem(`${STORE}-sessao`, "1");
          } catch {
            /* navegação privada */
          }
          setAccess(a);
          window.scrollTo(0, 0);
        }}
      />
    );
  return <Store access={access} wa={wa} models={list} photos={photos} />;
}

/* ============================================================ peças */

function Logo({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/mob/ic/logo.png" alt="Quark Mobilidade" className={cx("h-8 w-auto", className)} />;
}

function BlackTag({ className, inverse }: { className?: string; inverse?: boolean }) {
  return <span className={cx("inline-flex items-center rounded-[6px] px-2 py-[3px] text-[10.5px] font-black tracking-[0.12em] uppercase", inverse ? "bg-[#F3E93B] text-black" : "bg-black text-[#F3E93B]", className)}>Black</span>;
}

function Countdown() {
  const bf = useBf();
  if (!bf?.left || bf.phase !== "durante") return null;
  const { d, h, m, s } = bf.left;
  const cell = (v: number, u: string) => (
    <span className="inline-flex items-baseline gap-0.5">
      <b className="tabular-nums">{String(v).padStart(2, "0")}</b>
      <span className="text-[10px] font-semibold opacity-60">{u}</span>
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px]">
      {d > 0 && cell(d, "d")} {cell(h, "h")} {cell(m, "m")} {cell(s, "s")}
    </span>
  );
}

/** Situação do estoque de um modelo. */
function stockOf(s: Scooter) {
  const n = s.stock;
  if (n == null) return { label: "Estoque limitado", tone: "amber" as const, n: null, out: false };
  if (n <= 0) return { label: "Esgotado", tone: "gray" as const, n: 0, out: true };
  if (n <= 3) return { label: n === 1 ? "Última unidade" : `Últimas ${n} unidades`, tone: "red" as const, n, out: false };
  return { label: `${n} unidades em estoque`, tone: "amber" as const, n, out: false };
}

const subline = (s: Scooter) => [s.table.Motor, s.table.Bateria, s.table.Autonomia && !/^[—–-]+$/.test(s.table.Autonomia) ? s.table.Autonomia : ""].filter((x) => x && !/^[—–-]+$/.test(x)).join(" · ");

/* ============================================================ portão */

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

function Gate({ onAccess, models }: { onAccess: (a: Access) => void; models: Scooter[] }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const valid = f.name.trim().length >= 2 && f.phone.replace(/\D/g, "").length >= 10 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setErr("");
    let owner = "";
    try {
      owner = new URLSearchParams(window.location.search).get("v") ?? "";
    } catch {
      /* sem parâmetros */
    }
    try {
      const r = await post({ action: "register", catalog: CATALOG_ID, name: f.name.trim(), phone: f.phone, email: f.email.trim(), owner, device: device(), website: f.website });
      const j = (await r.json().catch(() => null)) as { token?: string; visits?: number; offline?: boolean; error?: string } | null;
      if (!r.ok || !j?.token) throw new Error(j?.error || "Não conseguimos liberar o acesso agora. Tente de novo.");
      onAccess({ token: j.token, name: f.name.trim().split(/\s+/)[0], visits: j.visits ?? 1, offline: j.offline });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const input = "h-14 w-full rounded-[14px] bg-[#F4F6F2] px-4 text-[16.5px] text-[#0B1A12] ring-1 ring-[#0B1A12]/[0.08] placeholder:text-[#0B1A12]/40 outline-none transition focus:bg-white focus:ring-2 focus:ring-[#1F9D55]";
  const preview = models.slice(0, 4);

  return (
    <div className="min-h-dvh bg-[#F6F7F5] font-[family-name:var(--font-outfit)] text-[#0B1A12] antialiased">
      <div className="mx-auto grid min-h-dvh max-w-6xl content-start gap-8 px-4 pt-5 pb-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:content-center lg:gap-14">
        <div className="bf-rise">
          <div className="flex items-center justify-between">
            <Logo />
            <BlackTag />
          </div>
          <h1 className="mt-8 text-[44px] leading-[0.95] font-bold tracking-[-0.045em] sm:text-[68px]">
            Scooters elétricas
            <br />
            <span style={{ color: GREEN }}>em até 21x.</span>
          </h1>
          <p className="mt-4 max-w-lg text-[16.5px] leading-snug text-[#0B1A12]/65 sm:text-[18px]">1.000W, sem CNH e sem placa, com garantia e entrega montada. Estoque limitado no preço de Black Friday.</p>
          <div className="mt-6 grid max-w-lg grid-cols-4 gap-2">
            {preview.map((s) => (
              <div key={s.id} className="aspect-square overflow-hidden rounded-[16px] bg-white ring-1 ring-[#0B1A12]/[0.06]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image} alt={s.name} className="h-full w-full object-contain p-2 blur-[1.5px]" />
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={submit} noValidate className="rounded-[28px] bg-white p-6 shadow-[0_30px_70px_-40px_rgba(11,26,18,0.45)] ring-1 ring-[#0B1A12]/[0.06] sm:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-[16px] bg-[#EAF6EC] text-[#1F9D55]">
            <Lock className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-[26px] leading-tight font-bold tracking-[-0.03em]">Ver preços e estoque</h2>
          <p className="mt-1 text-[15px] text-[#0B1A12]/55">Informe seus dados para abrir o catálogo. Leva 10 segundos.</p>
          <div className="mt-5 grid gap-2.5">
            <label className="sr-only" htmlFor="c-name">
              Nome
            </label>
            <input id="c-name" className={input} placeholder="Seu nome" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <label className="sr-only" htmlFor="c-phone">
              WhatsApp
            </label>
            <input id="c-phone" className={input} placeholder="WhatsApp com DDD" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: maskPhone(e.target.value) })} />
            <label className="sr-only" htmlFor="c-email">
              E-mail
            </label>
            <input id="c-email" className={input} placeholder="Seu melhor e-mail" type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <input tabIndex={-1} autoComplete="off" className="hidden" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} aria-hidden />
          </div>
          {err && <p className="mt-3 rounded-[12px] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#A12A17]">{err}</p>}
          <button disabled={!valid || busy} className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#0B1A12] text-[17px] font-bold text-white transition active:scale-[0.98] disabled:opacity-40">
            {busy ? "Abrindo…" : "Abrir o catálogo"}
            {!busy && <ChevronRight className="h-5 w-5" />}
          </button>
          <p className="mt-4 flex items-start gap-2 text-[12.5px] text-[#0B1A12]/50">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1F9D55]" strokeWidth={3} /> Sem compromisso. Seus dados ficam só com a Quark, para o nosso atendimento.
          </p>
        </form>
      </div>
    </div>
  );
}

/* ============================================================ vitrine */

function Store({ access, wa, models, photos }: { access: Access; wa: string; models: Scooter[]; photos: ExtraPhotos }) {
  const track = useTracking(access.token);
  const [open, setOpen] = useState<Scooter | null>(null);
  const bf = useBf();
  const waLink = (text: string) => `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
  const first = access.name || "";

  // Abre a ficha pelo endereço (#a2) e mantém o "voltar" do celular fechando a ficha.
  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(location.hash.replace(/^#/, ""));
      setOpen(models.find((m) => m.id === id) ?? null);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [models]);
  const pushed = useRef(false);
  const show = (s: Scooter) => {
    void track("click", `ver ${s.name}`);
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

  return (
    <div className="min-h-dvh bg-[#F6F7F5] font-[family-name:var(--font-outfit)] text-[#0B1A12] antialiased">
      {/* faixa Black */}
      {bf && (
        <div className="bg-black text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2 text-[12.5px] sm:justify-between">
            <span className="flex items-center gap-2 font-semibold">
              <BlackTag inverse />
              <span className="hidden sm:inline">{bf.phase === "durante" ? "Preços de Black Friday · estoque limitado" : "Black Friday começa em breve"}</span>
            </span>
            <span className="flex items-center gap-2 text-[#F3E93B]">
              <span className="text-white/60">{bf.phase === "durante" ? "termina em" : "começa em"}</span> <Countdown />
            </span>
          </div>
        </div>
      )}

      {/* topo */}
      <header className="sticky top-0 z-30 border-b border-[#0B1A12]/[0.06] bg-[#F6F7F5]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo className="h-7 sm:h-8" />
          <a
            href={waLink(`Olá! Sou ${first || "cliente"} e estou vendo o catálogo de scooters.`)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void track("click", "whatsapp topo")}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-4 text-[14px] font-bold text-[#06210F]"
          >
            <MessageCircle className="h-4 w-4" /> <span className="hidden sm:inline">Falar no</span> WhatsApp
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6 pb-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-[#0B1A12]/50">{first ? `Olá, ${first}!` : "Catálogo"}</p>
            <h1 className="text-[28px] leading-tight font-bold tracking-[-0.03em] sm:text-[34px]">Scooters elétricas 1.000W</h1>
          </div>
          <p className="text-[13px] text-[#0B1A12]/50">
            {models.length} modelos · sem CNH e sem placa · entrega montada
          </p>
        </div>

        {/* grade */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-sec="vitrine">
          {models.map((s) => (
            <ProductCard key={s.id} s={s} black={!!bf} onOpen={() => show(s)} />
          ))}
        </div>

        {/* garantias */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              [ShieldCheck, "Garantia de 90 dias", "contra defeitos de fábrica"],
              [Truck, "Entrega montada", "grátis em Maceió"],
              [CreditCard, "Até 21x no cartão", "pode usar mais de um cartão"],
              [Zap, "Sem CNH e sem placa", "autopropelido · Res. 996/2023"],
            ] as [LucideIcon, string, string][]
          ).map(([I, t, x]) => (
            <div key={t} className="rounded-[18px] bg-white p-4 ring-1 ring-[#0B1A12]/[0.06]">
              <I className="h-5 w-5" style={{ color: GREEN }} />
              <p className="mt-2 text-[14px] leading-tight font-bold">{t}</p>
              <p className="text-[12.5px] text-[#0B1A12]/55">{x}</p>
            </div>
          ))}
        </div>

        <footer className="mt-10 text-center text-[12.5px] leading-relaxed text-[#0B1A12]/45">
          Preços e estoque sujeitos a alteração sem aviso. Parcelamento no cartão de crédito com acréscimo da operadora; o valor à vista é para PIX.
          <br />
          {MOB_HOURS}.
        </footer>
      </main>

      {open && <ProductSheet s={open} photos={photos[open.id] ?? []} black={!!bf} access={access} waLink={waLink} track={track} onClose={close} />}
    </div>
  );
}

function ProductCard({ s, black, onOpen }: { s: Scooter; black: boolean; onOpen: () => void }) {
  const st = stockOf(s);
  return (
    <article className={cx("group flex flex-col overflow-hidden rounded-[20px] bg-white ring-1 ring-[#0B1A12]/[0.06] transition hover:-translate-y-0.5 hover:shadow-[0_22px_40px_-28px_rgba(11,26,18,0.5)]", st.out && "opacity-70")}>
      <button type="button" onClick={onOpen} className="flex flex-1 flex-col text-left" aria-label={`Ver ${s.name}`}>
        <div className="relative m-2 aspect-[4/3.4] overflow-hidden rounded-[16px] bg-[#F4F5F2]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.image} alt={s.name} loading="lazy" className="absolute inset-0 h-full w-full object-contain p-3 transition duration-500 group-hover:scale-[1.04]" />
          {black && <BlackTag className="absolute top-2.5 left-2.5" />}
          {st.n != null && st.n > 0 && st.n <= 3 && <span className="absolute top-2.5 right-2.5 rounded-[6px] bg-[#E5484D] px-2 py-[3px] text-[10.5px] font-bold text-white">Últimas</span>}
          {st.out && <span className="absolute inset-x-0 bottom-0 bg-black/70 py-1.5 text-center text-[12px] font-bold text-white">Esgotado</span>}
        </div>
        <div className="flex flex-1 flex-col px-3.5 pt-1 pb-3 text-center">
          <p className="line-clamp-2 text-[12.5px] leading-snug font-bold tracking-[0.01em] uppercase sm:text-[13.5px]">Scooter elétrica {s.name}</p>
          <p className="mt-0.5 line-clamp-1 text-[11.5px] text-[#0B1A12]/50">{subline(s)}</p>
          <div className="mt-auto pt-2.5">
            <p className="text-[12px] font-semibold text-[#0B1A12]/55">{s.installments}x de</p>
            <p className="text-[24px] leading-none font-extrabold tracking-[-0.03em] tabular-nums sm:text-[27px]" style={{ color: GREEN }}>
              {money(s.installment)}
            </p>
            <p className="mt-1 text-[12.5px] text-[#0B1A12]/60">
              ou <b className="text-[#0B1A12]">{brl0(s.cash)}</b> à vista
            </p>
          </div>
        </div>
      </button>
      <div className="px-3 pb-3">
        <button type="button" onClick={onOpen} disabled={st.out} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-[12px] bg-[#0B1A12] text-[14px] font-bold text-white transition active:scale-[0.98] disabled:bg-[#0B1A12]/30">
          {st.out ? "Esgotado" : "Reservar"}
        </button>
        <p className={cx("mt-2 flex items-center justify-center gap-1.5 text-[11.5px] font-semibold", st.tone === "red" ? "text-[#D23B31]" : st.tone === "gray" ? "text-[#0B1A12]/45" : "text-[#B86E00]")}>
          <span className={cx("h-1.5 w-1.5 rounded-full", st.tone === "red" ? "animate-pulse bg-[#E5484D]" : st.tone === "gray" ? "bg-[#0B1A12]/30" : "bg-[#F5A524]")} />
          {st.label}
        </p>
      </div>
    </article>
  );
}

/* ============================================================ ficha + reserva */

const SPEC_ICONS: Record<string, LucideIcon> = { bolt: Zap, battery: BatteryCharging, route: Route, brake: Gauge, weight: Weight, lock: Lock, shield: ShieldCheck, gear: Gauge };

function ProductSheet({
  s,
  photos,
  black,
  access,
  waLink,
  track,
  onClose,
}: {
  s: Scooter;
  photos: { url: string; caption: string | null }[];
  black: boolean;
  access: Access;
  waLink: (t: string) => string;
  track: (kind: "click" | "interest", detail?: string) => Promise<unknown>;
  onClose: () => void;
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
  const [busy, setBusy] = useState(false);
  const st = stockOf(s);
  const touch = useRef<number | null>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step !== "ficha") actionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);
  const rows = Object.entries(s.table).filter(([, v]) => v && !/^[—–-]+$/.test(String(v).trim()));

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
  const reserve = async () => {
    setBusy(true);
    await track("interest", `${s.name}${color ? ` (${color})` : ""} · reserva · ${pay === "cartao" ? "cartão" : "PIX"}`).catch(() => {});
    setBusy(false);
    setStep("ok");
    window.open(
      waLink(`Olá! Sou ${access.name || "cliente"} e quero reservar a scooter elétrica ${s.name}${color ? ` na cor ${color}` : ""}, no ${payText}. Pode confirmar a disponibilidade e a entrega?`),
      "_blank",
      "noopener",
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0B1A12]/50 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal aria-label={`Scooter ${s.name}`}>
      <div onClick={(e) => e.stopPropagation()} className="bf-rise relative flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[28px] bg-white font-[family-name:var(--font-outfit)] text-[#0B1A12] shadow-2xl sm:rounded-[28px]">
        <button type="button" onClick={onClose} aria-label="Fechar" className="absolute top-3 right-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow ring-1 ring-[#0B1A12]/10">
          <X className="h-5 w-5" />
        </button>
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[1.15fr_1fr] md:overflow-hidden">
          {/* fotos */}
          <div className="bg-[#F4F5F2] md:flex md:flex-col md:overflow-hidden">
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
              <img key={shots[i].src} src={shots[i].src} alt={`${s.name}${shots[i].caption ? ` · ${shots[i].caption}` : ""}`} className={cx("absolute inset-0 h-full w-full", shots[i].fit === "cover" ? "object-cover" : "object-contain p-6")} />
              {black && <BlackTag className="absolute top-4 left-4" />}
              {shots.length > 1 && (
                <>
                  <button type="button" aria-label="Foto anterior" onClick={() => go(-1)} className="absolute top-1/2 left-3 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow ring-1 ring-[#0B1A12]/10">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button type="button" aria-label="Próxima foto" onClick={() => go(1)} className="absolute top-1/2 right-3 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow ring-1 ring-[#0B1A12]/10">
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
              <p className="text-[12px] font-bold tracking-[0.16em] uppercase" style={{ color: GREEN }}>
                {s.kicker}
              </p>
              <h2 className="mt-1 text-[30px] leading-tight font-bold tracking-[-0.03em]">Scooter elétrica {s.name}</h2>
              {s.pitch && <p className="mt-1.5 text-[15px] leading-relaxed text-[#0B1A12]/60">{s.pitch}</p>}

              <div className="mt-5 rounded-[20px] bg-[#F6F8F4] p-4 ring-1 ring-[#0B1A12]/[0.05]">
                <p className="text-[13px] font-semibold text-[#0B1A12]/55">{s.installments}x no cartão de</p>
                <p className="text-[36px] leading-none font-extrabold tracking-[-0.03em] tabular-nums" style={{ color: GREEN }}>
                  {money(s.installment)}
                </p>
                <p className="mt-2 text-[15px]">
                  ou <b>{brl0(s.cash)}</b> à vista no PIX
                </p>
                <p className={cx("mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold", st.tone === "red" ? "text-[#D23B31]" : st.tone === "gray" ? "text-[#0B1A12]/45" : "text-[#B86E00]")}>
                  <span className={cx("h-2 w-2 rounded-full", st.tone === "red" ? "animate-pulse bg-[#E5484D]" : st.tone === "gray" ? "bg-[#0B1A12]/30" : "bg-[#F5A524]")} />
                  {st.label}
                </p>
              </div>

              {step === "ficha" && (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {s.specs
                      .filter((x) => x.value && !/^[—–-]+$/.test(x.value))
                      .slice(0, 6)
                      .map((x) => {
                        const I = SPEC_ICONS[x.icon] ?? Zap;
                        return (
                          <div key={x.label} className="rounded-[14px] bg-white px-3 py-2.5 ring-1 ring-[#0B1A12]/[0.07]">
                            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-[#0B1A12]/50 uppercase">
                              <I className="h-3.5 w-3.5" style={{ color: GREEN }} /> {x.label}
                            </p>
                            <p className="mt-0.5 text-[14.5px] leading-tight font-bold">{x.value}</p>
                          </div>
                        );
                      })}
                  </div>
                  {rows.length > 0 && (
                    <dl className="mt-4 divide-y divide-[#0B1A12]/[0.06] rounded-[16px] ring-1 ring-[#0B1A12]/[0.06]">
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
                  <p className="text-[16px] font-bold">Reserve a sua</p>
                  <p className="text-[13.5px] text-[#0B1A12]/55">Sem pagamento agora: confirmamos a disponibilidade e a entrega pelo WhatsApp.</p>
                  {colors.length > 0 && (
                    <>
                      <p className="mt-4 mb-2 text-[13px] font-semibold text-[#0B1A12]/60">Cor</p>
                      <div className="flex flex-wrap gap-2">
                        {colors.map((c) => (
                          <button key={c} type="button" onClick={() => setColor(c)} className={cx("h-10 rounded-full px-4 text-[14px] font-semibold ring-1 transition", c === color ? "bg-[#0B1A12] text-white ring-[#0B1A12]" : "bg-white ring-[#0B1A12]/15")}>
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
                      <button key={k} type="button" onClick={() => setPay(k)} className={cx("rounded-[14px] px-3 py-3 text-left ring-1 transition", pay === k ? "bg-[#EAF6EC] ring-2 ring-[#1F9D55]" : "bg-white ring-[#0B1A12]/15")}>
                        <span className="block text-[15px] font-bold tabular-nums">{a}</span>
                        <span className="block text-[12px] text-[#0B1A12]/55">{b}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === "ok" && (
                <div ref={actionRef} className="mt-5 scroll-mt-4 rounded-[20px] bg-[#EAF6EC] p-5 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#1F9D55] text-white">
                    <Check className="h-6 w-6" strokeWidth={3} />
                  </span>
                  <p className="mt-3 text-[18px] font-bold">Reserva enviada!</p>
                  <p className="mt-1 text-[14px] text-[#0B1A12]/65">Abrimos o WhatsApp com a sua reserva. Se não abriu, toque no botão abaixo.</p>
                </div>
              )}
            </div>

            {/* ação */}
            <div className="sticky bottom-0 mt-auto border-t border-[#0B1A12]/[0.06] bg-white/95 p-4 backdrop-blur sm:px-7">
              {step === "ficha" && (
                <button
                  type="button"
                  disabled={st.out}
                  onClick={() => {
                    void track("click", `reservar ${s.name}`);
                    setStep("reserva");
                  }}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#0B1A12] text-[16px] font-bold text-white transition active:scale-[0.98] disabled:bg-[#0B1A12]/30"
                >
                  {st.out ? "Esgotado" : "Reservar esta scooter"}
                </button>
              )}
              {step === "reserva" && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep("ficha")} className="h-14 rounded-full px-5 text-[15px] font-semibold ring-1 ring-[#0B1A12]/15">
                    Voltar
                  </button>
                  <button type="button" disabled={busy} onClick={reserve} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-[#25D366] text-[16px] font-bold text-[#06210F] transition active:scale-[0.98] disabled:opacity-60">
                    {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />} Confirmar reserva
                  </button>
                </div>
              )}
              {step === "ok" && (
                <a
                  href={waLink(`Olá! Sou ${access.name || "cliente"} e quero reservar a scooter elétrica ${s.name}${color ? ` na cor ${color}` : ""}, no ${payText}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] text-[16px] font-bold text-[#06210F]"
                >
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

