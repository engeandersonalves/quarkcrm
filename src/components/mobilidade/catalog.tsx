"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GlyphTile, type GlyphId } from "@/components/app/ios-glyphs";
import { useBf } from "@/components/bf/badges";
import {
  CATALOG_ID,
  MOB_HOURS,
  MOB_WHATSAPP,
  SCOOTERS,
  SERVICES,
  TABLE_ROWS,
  VERSUS,
  brl0,
  chargeCost,
  fuelSavings,
  recommend,
  type ModelId,
  type Scooter,
} from "@/lib/catalog-mobilidade";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const GRAD = "bg-[linear-gradient(95deg,#F3E93B_0%,#9FDB7C_45%,#4FC38A_100%)]";
const GT = `${GRAD} bg-clip-text text-transparent`;
const STORE = `quark-catalogo-${CATALOG_ID}`;

/* =============================================================== ícones */

const P: Record<string, ReactNode> = {
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  battery: (
    <>
      <rect x="2.5" y="7" width="17" height="10" rx="2.5" />
      <path d="M22 11v2M6 10.5v3M9.5 10.5v3M13 10.5v3" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
    </>
  ),
  brake: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </>
  ),
  weight: <path d="M6 9h12l2 11H4zM9 9a3 3 0 0 1 6 0" />,
  lock: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="3" />
      <path d="M10 8c1.3-.8 2.7-.8 4 0M9 11c2-1.3 4-1.3 6 0" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
    </>
  ),
  shield: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM8.5 12l2.5 2.5 4.5-5" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  chat: <path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-6.2A8 8 0 1 1 21 12z" />,
  truck: <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-.1M17 19a2 2 0 1 0 0-.1" />,
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19" />
    </>
  ),
  fire: <path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-1 2-2 3-4 3 1-2 0-4-1-6-1 4-5 7-5 13a7 7 0 0 0 7 7z" />,
  lockKey: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  pin: <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
};
function Ico({ n, className, w = 2.2 }: { n: keyof typeof P; className?: string; w?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-5 w-5"} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {P[n]}
    </svg>
  );
}

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
const post = (body: Record<string, unknown>) =>
  fetch("/api/public/catalogo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });

/* ======================================================= página */

export function MobilidadeCatalog({ whatsapp }: { whatsapp: string | null }) {
  const [access, setAccess] = useState<Access | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const a = readAccess();
    if (!a) return setReady(true);
    setAccess(a);
    setReady(true);
    if (a.offline) return;
    // Uma visita por sessão do navegador
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

  if (!ready) return <div className="min-h-dvh bg-[#050706]" />;
  if (!access)
    return (
      <Gate
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
  return <Catalog access={access} wa={wa} />;
}

/* ============================================================ portão */

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function Gate({ onAccess }: { onAccess: (a: Access) => void }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const opened = useRef(0);
  useEffect(() => {
    opened.current = Date.now();
  }, []);
  const okName = f.name.trim().split(/\s+/).length >= 1 && f.name.trim().length >= 2;
  const okPhone = f.phone.replace(/\D/g, "").length >= 10;
  const okEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim());
  const valid = okName && okPhone && okEmail;

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

  const input = "h-14 w-full rounded-[16px] bg-white/[0.07] px-4 text-[17px] text-white ring-1 ring-white/10 placeholder:text-white/35 outline-none transition focus:bg-white/[0.1] focus:ring-2 focus:ring-[#6FBF8E]";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#050706] font-[family-name:var(--font-outfit)] text-white antialiased">
      {/* prévia desfocada ao fundo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mob/trio.jpg" alt="" className="pointer-events-none absolute inset-x-0 bottom-0 w-full object-cover opacity-50 blur-[2px] lg:opacity-70" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#050706_0%,rgba(5,7,6,0.85)_45%,rgba(5,7,6,0.35)_100%)]" />
      <div className="pointer-events-none absolute -top-60 -right-60 h-[800px] w-[800px] rounded-full bg-[radial-gradient(circle,rgba(111,191,142,0.25)_0%,rgba(111,191,142,0)_62%)]" />

      <div className="relative mx-auto grid min-h-dvh max-w-6xl content-start gap-8 px-4 pt-6 pb-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:content-center lg:gap-14">
        <div className="bf-rise">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bf/logo.png" alt="Quark Energia" className="h-8 w-auto sm:h-9" />
          <p className={cx("mt-8 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black tracking-[0.14em] text-[#0A0D0B] uppercase sm:text-[12px]", GRAD)}>Catálogo · Scooters elétricas 1.000W</p>
          <h1 className="mt-4 text-[54px] leading-[0.9] font-bold tracking-[-0.055em] sm:text-[88px]">
            Escolha a sua.
            <br />
            <span className={GT}>Pague em 21x.</span>
          </h1>
          <p className="mt-5 max-w-lg text-[17px] leading-snug text-white/70 sm:text-[20px]">Chega de ônibus lotado e posto de gasolina. Três scooters 1.000W com garantia e entrega montada, com preço de Black Friday.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {SCOOTERS.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3.5 py-2 text-[14px] font-semibold ring-1 ring-white/10">
                <span className="h-2 w-2 rounded-full" style={{ background: s.accent }} />
                {s.name} · <span className="text-[#8FD9A8]">21x {brl0(s.installment)}</span>
              </span>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="relative rounded-[32px] bg-[#111513]/90 p-6 shadow-[0_40px_100px_-30px_rgba(0,0,0,1)] ring-1 ring-white/10 backdrop-blur-xl sm:p-8" noValidate>
          <div className={cx("absolute inset-x-0 top-0 h-1.5 rounded-t-[32px]", GRAD)} />
          <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-[#6FBF8E]/15 text-[#8FD9A8]">
            <Ico n="lockKey" className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-[28px] leading-tight font-bold tracking-[-0.04em]">Acesse o catálogo completo</h2>
          <p className="mt-1.5 text-[15px] text-white/60">Fichas, preços de Black Friday, comparativo e simulador de economia. Leva 10 segundos.</p>
          <div className="mt-6 grid gap-2.5">
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
          {err && <p className="mt-3 rounded-[12px] bg-[#FF453A]/10 px-3 py-2 text-[14px] text-[#FF8A80]">{err}</p>}
          <button disabled={!valid || busy} className={cx("mt-5 inline-flex h-[60px] w-full items-center justify-center gap-2 rounded-full text-[18px] font-bold text-[#0A0D0B] transition active:scale-[0.98] disabled:opacity-40", GRAD)}>
            {busy ? "Liberando…" : "Abrir o catálogo"}
            {!busy && <Ico n="arrow" className="h-5 w-5" w={2.6} />}
          </button>
          <ul className="mt-5 grid gap-1.5 text-[13px] text-white/50">
            <li className="flex items-center gap-2">
              <Ico n="check" className="h-4 w-4 text-[#6FBF8E]" w={3} /> Sem compromisso e sem custo
            </li>
            <li className="flex items-center gap-2">
              <Ico n="check" className="h-4 w-4 text-[#6FBF8E]" w={3} /> Seus dados ficam só com a Quark, para o nosso atendimento
            </li>
          </ul>
        </form>
      </div>
    </div>
  );
}

/* ========================================================= catálogo */

function useTracking(token: string) {
  const send = useCallback((kind: "section" | "time" | "click" | "interest", detail = "", value = 0) => post({ action: "track", token, kind, detail, value }).catch(() => {}), [token]);
  useEffect(() => {
    const seen = new Set<string>();
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-sec]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.sec!;
          if (e.isIntersecting && !seen.has(id)) {
            seen.add(id);
            send("section", id);
          }
        }
      },
      { threshold: 0.35 },
    );
    els.forEach((el) => io.observe(el));
    // Tempo de leitura: a cada 20 s com a aba visível
    let acc = 0;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") acc += 5;
      if (acc >= 20) {
        send("time", "leitura", acc);
        acc = 0;
      }
    }, 5000);
    const flush = () => {
      if (acc > 0) send("time", "leitura", acc);
      acc = 0;
    };
    window.addEventListener("pagehide", flush);
    return () => {
      io.disconnect();
      clearInterval(t);
      window.removeEventListener("pagehide", flush);
    };
  }, [send]);
  return send;
}

function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <p className="flex items-center gap-3 text-[12px] font-bold tracking-[0.18em] uppercase sm:text-[13px]" style={{ color: color ?? "#8FD9A8" }}>
      <span className="h-1 w-8 rounded-full" style={{ background: color ?? "linear-gradient(95deg,#F3E93B,#9FDB7C,#4FC38A)" }} />
      {children}
    </p>
  );
}
function H2({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx("mt-3 text-[38px] leading-[0.95] font-bold tracking-[-0.05em] sm:text-[62px]", className)}>{children}</h2>;
}
function Tape({ items, dark, tilt = 0 }: { items: string[]; dark?: boolean; tilt?: number }) {
  const row = [...items, ...items, ...items, ...items];
  return (
    <div className="overflow-hidden" style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }} aria-hidden>
      <div className={cx("-mx-[4%] py-2.5 whitespace-nowrap", dark ? "bg-[#1A1F1C] text-white" : "bg-[#6FBF8E] text-[#0A0D0B]")}>
        <div className="bf-marquee inline-flex">
          {[0, 1].map((k) => (
            <span key={k} className="inline-flex">
              {row.map((t, i) => (
                <span key={i} className="px-5 text-[12px] font-bold tracking-[0.16em] uppercase sm:text-[14px]">
                  {t} <span className="pl-5 opacity-60">•</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Clock({ small }: { small?: boolean }) {
  const bf = useBf();
  const l = bf?.left;
  const parts: [string, string][] = [
    [l ? String(l.d).padStart(2, "0") : "--", "dias"],
    [l ? String(l.h).padStart(2, "0") : "--", "horas"],
    [l ? String(l.m).padStart(2, "0") : "--", "min"],
    [l ? String(l.s).padStart(2, "0") : "--", "seg"],
  ];
  if (small)
    return (
      <span className="font-semibold text-white tabular-nums">
        {l ? `${l.d > 0 ? `${l.d}d ` : ""}${parts[1][0]}:${parts[2][0]}:${parts[3][0]}` : "--:--:--"}
      </span>
    );
  return (
    <div className="flex items-start gap-1.5 sm:gap-2" role="timer" aria-label="Tempo restante da Black Friday">
      {parts.map(([v, u], i) => (
        <div key={u} className="flex items-start gap-1.5 sm:gap-2">
          <div className="flex flex-col items-center">
            <span className="grid h-[60px] w-[54px] place-items-center rounded-[12px] bg-[#fff] text-[28px] font-bold text-[#0A0D0B] tabular-nums shadow-[0_10px_30px_-10px_rgba(255,255,255,0.45)] sm:h-[74px] sm:w-[66px] sm:text-[36px]">{v}</span>
            <span className="mt-1 text-[10px] font-semibold tracking-[0.14em] text-white/50 uppercase">{u}</span>
          </div>
          {i < 3 && <span className="mt-3 text-[24px] font-bold text-white/35 sm:mt-5">:</span>}
        </div>
      ))}
    </div>
  );
}

/** Foto do produto do catálogo com as bordas esfumadas no fundo preto. */
function ProductShot({ s, className }: { s: Scooter; className?: string }) {
  return (
    <div className={cx("relative", className)}>
      <div className="absolute inset-[10%] rounded-full blur-3xl" style={{ background: `${s.accent}33` }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={s.image} alt={`Scooter elétrica ${s.name}`} className="relative h-full w-full object-contain [mask-image:radial-gradient(closest-side,#000_62%,transparent_100%)]" />
    </div>
  );
}

function Catalog({ access, wa }: { access: Access; wa: string }) {
  const send = useTracking(access.token);
  const [scrolled, setScrolled] = useState(false);
  const [picked, setPicked] = useState<ModelId | null>(null);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 600);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const msg = (model?: Scooter) =>
    model
      ? `Olá! Sou ${access.name} e vi o catálogo da Black Friday. Quero garantir a scooter ${model.name} (21x de ${brl0(model.installment)} ou ${brl0(model.cash)} à vista).`
      : `Olá! Sou ${access.name} e vi o catálogo de scooters da Black Friday. Quero tirar umas dúvidas.`;
  const waLink = (model?: Scooter) => `https://wa.me/${wa}?text=${encodeURIComponent(msg(model))}`;
  const want = (s: Scooter) => {
    setPicked(s.id);
    send("interest", s.name);
    window.open(waLink(s), "_blank");
  };
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#050706] pb-28 font-[family-name:var(--font-outfit)] text-white antialiased selection:bg-[#6FBF8E]/40">
      <Tape items={["Black Friday Quark", "Até 27/11", "21x no cartão", "Entrega montada", "Estoque limitado"]} />
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050706]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-end gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bf/logo.png" alt="Quark" className="h-8 w-auto" />
            <span className="mb-0.5 hidden rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-[0.14em] text-[#9FDB7C] sm:inline">MOBILIDADE</span>
          </div>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Seções">
            {[
              ["modelos", "Modelos"],
              ["economia", "Economia"],
              ["quiz", "Qual é a minha?"],
              ["comparativo", "Comparativo"],
            ].map(([id, l]) => (
              <button key={id} onClick={() => go(id)} className="h-9 rounded-full px-3.5 text-[14px] font-semibold text-white/70 transition hover:bg-white/[0.07] hover:text-white">
                {l}
              </button>
            ))}
          </nav>
          <a href={waLink()} target="_blank" rel="noreferrer" onClick={() => send("click", "whatsapp-topo")} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#6FBF8E] px-4 text-[14px] font-bold text-[#0A0D0B]">
            <Ico n="chat" className="h-4 w-4" /> WhatsApp
          </a>
        </div>
      </header>

      {/* ============================ HERÓI ============================ */}
      <section data-sec="capa" className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-60 -right-40 h-[900px] w-[900px] rounded-full bg-[radial-gradient(circle,rgba(111,191,142,0.24)_0%,rgba(111,191,142,0)_62%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
          <p className="bf-rise inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3.5 py-1.5 text-[13px] font-semibold text-white/85 ring-1 ring-white/10">
            👋 Olá, {access.name}! {access.visits > 1 ? `Que bom te ver de novo.` : "O catálogo é todo seu."}
          </p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <h1 className="bf-rise text-[58px] leading-[0.88] font-bold tracking-[-0.06em] sm:text-[104px]">
              Escolha a sua.
              <br />
              <span className={GT}>Pague em 21x.</span>
            </h1>
            <div className="lg:pb-3">
              <p className="text-[17px] leading-snug text-white/70 sm:text-[19px]">Chega de ônibus lotado e posto de gasolina. Três scooters 1.000W com garantia e entrega montada na sua casa.</p>
              <p className="mt-5 mb-2 text-[12px] font-bold tracking-[0.16em] text-white/50 uppercase">Preço de Black Friday termina em</p>
              <Clock />
            </div>
          </div>
        </div>
        <div className="relative mt-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mob/trio.jpg" alt="Scooters T1, Cappuccino e MZ" className="mx-auto w-full max-w-6xl [mask-image:linear-gradient(180deg,transparent,#000_18%,#000_80%,transparent)]" />
        </div>
        <div id="modelos" className="relative mx-auto -mt-4 grid max-w-6xl scroll-mt-24 grid-cols-3 gap-2 px-4 sm:gap-3 sm:px-6">
          {SCOOTERS.map((s) => (
            <button key={s.id} onClick={() => go(`m-${s.id}`)} className="group rounded-[22px] bg-[#111513] p-3 text-left ring-1 ring-white/[0.07] transition hover:-translate-y-0.5 hover:ring-white/20 sm:p-5">
              <span className="h-1.5 w-8 rounded-full" style={{ background: s.accent, display: "block" }} />
              <p className="mt-2 text-[20px] font-bold tracking-[-0.03em] sm:text-[30px]">{s.name}</p>
              <p className="text-[11px] text-white/50 sm:text-[14px]">21x de</p>
              <p className={cx("text-[22px] leading-none font-bold tracking-[-0.03em] sm:text-[36px]", GT)}>{brl0(s.installment)}</p>
              <p className="mt-2 hidden items-center gap-1 text-[13px] font-semibold text-white/60 group-hover:text-white sm:flex">
                Ver detalhes <Ico n="arrow" className="h-4 w-4" />
              </p>
            </button>
          ))}
        </div>
        <div className="relative mt-10">
          <Tape tilt={-2} items={["Black Friday Quark", "Scooters 1.000W", "Livre do trânsito", "Livre da gasolina"]} />
          <div className="-mt-3">
            <Tape dark tilt={1.5} items={["Garantia em todas", "Entrega montada", "Aceita mais de 1 cartão", "Sem CNH e sem placa*"]} />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* ============================ ESTILO DE VIDA ============================ */}
        <section data-sec="estilo" className="pt-16">
          <div className="relative overflow-hidden rounded-[36px] ring-1 ring-white/[0.06]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mob/estilo.jpg" alt="Casal passeando de scooter elétrica pela cidade" className="h-[360px] w-full object-cover sm:h-[520px]" />
            <div className="absolute inset-0 bg-[linear-gradient(0deg,#050706_0%,rgba(5,7,6,0.55)_45%,transparent_75%)]" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
              <Eyebrow>Imagine sua rotina assim</Eyebrow>
              <H2>
                Livre do trânsito.
                <br />
                <span className={GT}>Livre da gasolina.</span>
              </H2>
            </div>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {[
                { g: "cifrao" as GlyphId, t: `Menos de ${brl0(Math.ceil(chargeCost()))} por carga*`, d: "na tomada da sua casa" },
                { g: "casa" as GlyphId, t: "Estaciona em qualquer canto", d: "e passa no meio do trânsito" },
                { g: "escudo" as GlyphId, t: "Sem CNH e sem placa**", d: "pra você e pra família" },
                { g: "sol" as GlyphId, t: "Com energia solar, R$ 0", d: "o sol do seu telhado abastece" },
              ].map((b) => (
                <li key={b.t} className="flex items-center gap-4 rounded-[24px] bg-[#111513] p-5 ring-1 ring-white/[0.06]">
                  <GlyphTile id={b.g} size="lg" className="!h-12 !w-12 !rounded-[13px]" />
                  <div>
                    <p className="text-[17px] leading-tight font-bold">{b.t}</p>
                    <p className="text-[14px] text-white/55">{b.d}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mob/estilo-2.jpg" alt="Scooter elétrica atravessando a faixa" className="h-full min-h-[160px] w-full rounded-[24px] object-cover" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mob/estilo-3.jpg" alt="Scooter elétrica na cidade" className="h-full min-h-[160px] w-full rounded-[24px] object-cover" />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-white/35">*Estimativa T1: bateria 1,28 kWh, tarifa R$ 1,10/kWh. **Autopropelido conforme o Contran. Fotos ilustrativas de estilo de vida.</p>
        </section>

        {/* ============================ MODELOS ============================ */}
        {SCOOTERS.map((s, i) => (
          <ModelSection key={s.id} s={s} flip={i % 2 === 1} picked={picked === s.id} onWant={() => want(s)} />
        ))}

        {/* ============================ ECONOMIA ============================ */}
        <Savings onCta={() => go("quiz")} />

        {/* ============================ 3X MAIS FORÇA ============================ */}
        <Versus />

        {/* ============================ QUIZ ============================ */}
        <Quiz
          onResult={(id) => send("click", `quiz-${id}`)}
          onWant={(s) => want(s)}
          onSee={(s) => go(`m-${s.id}`)}
        />

        {/* ============================ COMPARATIVO ============================ */}
        <section id="comparativo" data-sec="comparativo" className="scroll-mt-24 pt-20">
          <div className="text-center">
            <p className="text-[12px] font-bold tracking-[0.18em] text-[#8FD9A8] uppercase sm:text-[13px]">Comparativo</p>
            <H2>
              Qual combina <span className={GT}>com você?</span>
            </H2>
          </div>
          <div className="scrollbar-none -mx-4 mt-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[620px] border-separate border-spacing-y-1.5 text-[14px] sm:text-[15px]">
              <thead>
                <tr>
                  <th className="w-[22%]" />
                  {SCOOTERS.map((s) => (
                    <th key={s.id} className="px-2 pb-3 text-center align-bottom">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.image} alt="" className="mx-auto h-24 w-auto object-contain [mask-image:radial-gradient(closest-side,#000_62%,transparent_100%)] sm:h-32" />
                      <span className="mt-1 block text-[20px] font-bold" style={{ color: s.accent }}>
                        {s.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TABLE_ROWS.map((r, i) => (
                  <tr key={r} className={i % 2 ? "" : "bg-white/[0.04]"}>
                    <th className="rounded-l-[12px] px-4 py-3 text-left font-semibold text-white/80">{r}</th>
                    {SCOOTERS.map((s, k) => (
                      <td key={s.id} className={cx("px-2 py-3 text-center font-semibold", k === SCOOTERS.length - 1 && "rounded-r-[12px]")}>
                        {s.table[r]}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th className="rounded-l-[16px] bg-[#6FBF8E]/10 px-4 py-4 text-left text-[13px] font-bold tracking-[0.1em] text-[#8FD9A8] uppercase ring-1 ring-[#6FBF8E]/20">21x no cartão</th>
                  {SCOOTERS.map((s, k) => (
                    <td key={s.id} className={cx("bg-[#6FBF8E]/10 px-2 py-4 text-center", k === SCOOTERS.length - 1 && "rounded-r-[16px]")}>
                      <span className={cx("block text-[26px] leading-none font-bold tracking-[-0.03em]", GT)}>{brl0(s.installment)}</span>
                      <span className="mt-1 block text-[12px] text-white/55">ou {brl0(s.cash)} à vista</span>
                      <button onClick={() => want(s)} className="mt-2.5 inline-flex h-9 items-center rounded-full bg-[#fff] px-4 text-[13px] font-bold text-[#0A0D0B]">
                        Quero a {s.name}
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {[
              ["shield", "Garantia em todas"],
              ["truck", "Entrega montada"],
              ["card", "+ de 1 cartão"],
            ].map(([n, t]) => (
              <span key={t} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#111513] px-5 text-[15px] font-semibold ring-1 ring-white/10">
                <Ico n={n as keyof typeof P} className="h-5 w-5 text-[#8FD9A8]" /> {t}
              </span>
            ))}
          </div>
        </section>

        {/* ============================ QUEM SOMOS ============================ */}
        <section data-sec="quem-somos" className="pt-20">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <Eyebrow>Quem somos</Eyebrow>
              <H2>
                Muito prazer,
                <br />
                <span className={GT}>somos a Quark.</span>
              </H2>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/65">
                Nascemos em Maceió com um propósito simples: fazer a energia limpa caber no bolso e no dia a dia de quem é daqui. Há <b className="text-white">mais de 5 anos</b> levamos o sol para telhados de casas, comércios e empresas de Alagoas, e agora levamos essa mesma energia para as ruas.
              </p>
              <blockquote className="mt-6 rounded-[24px] bg-[#111513] p-5 ring-1 ring-[#6FBF8E]/25">
                <p className="text-[17px] leading-snug font-semibold">“Aqui, você não é mais um pedido. Cada projeto é feito sob medida, instalado com cuidado e acompanhado de perto, do primeiro contato ao pós-venda.”</p>
                <footer className="mt-2 text-[13px] text-white/50">Coordenação técnica de um eletrotécnico graduando em Engenharia Elétrica pela UFAL.</footer>
              </blockquote>
            </div>
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mob/quark-sistema.jpg" alt="Painel solar, inversor e scooter Quark" className="mx-auto w-[80%] [mask-image:radial-gradient(70%_70%_at_50%_50%,#000_55%,transparent_100%)]" />
            </div>
          </div>
          <p className="mt-10 text-[19px] font-bold">O que fazemos por você</p>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((sv, i) => (
              <li key={sv.title} className="flex items-center gap-4 rounded-[22px] bg-[#111513] p-4 ring-1 ring-white/[0.06]">
                <GlyphTile id={(["sol", "documentos", "chave", "plugue", "raio", "estrela"] as GlyphId[])[i]} size="md" className="!h-11 !w-11 !rounded-[12px]" />
                <div>
                  <p className="text-[16px] font-bold">{sv.title}</p>
                  <p className="text-[13px] text-white/55">{sv.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              ["+5 anos", "de energia solar"],
              ["30 dias", "para instalar"],
              ["100%", "projeto sob medida"],
              ["Maceió", "atendimento local"],
            ].map(([b, t]) => (
              <div key={b} className="rounded-[22px] bg-[#111513] p-5 text-center ring-1 ring-white/[0.06]">
                <p className={cx("text-[30px] leading-none font-bold tracking-[-0.04em] sm:text-[38px]", GT)}>{b}</p>
                <p className="mt-1.5 text-[13px] font-semibold text-white/60">{t}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============================ FECHAMENTO ============================ */}
        <section data-sec="fechamento" className="pt-20">
          <div className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,#6FBF8E,#A9DE86)] px-6 py-12 text-[#0A0D0B] sm:px-12 sm:py-16">
            <div className="relative z-10 max-w-xl">
              <p className="text-[13px] font-bold tracking-[0.16em] uppercase opacity-70">Estoque limitado da Black</p>
              <p className="mt-3 text-[42px] leading-[0.92] font-bold tracking-[-0.055em] sm:text-[66px]">Garanta a sua antes que acabe.</p>
              <p className="mt-4 text-[17px] font-medium opacity-80">{access.name}, é só escolher o modelo e falar com a gente. Entregamos montada, pronta para rodar.</p>
              <div className="mt-7 flex flex-wrap gap-2">
                {SCOOTERS.map((s) => (
                  <button key={s.id} onClick={() => want(s)} className="inline-flex h-12 items-center gap-2 rounded-full bg-[#0A0D0B] px-5 text-[15px] font-bold text-white transition active:scale-[0.97]">
                    Quero a {s.name} <Ico n="arrow" className="h-4 w-4" w={2.6} />
                  </button>
                ))}
              </div>
              <p className="mt-5 text-[14px] font-semibold opacity-70">{MOB_HOURS} · @quarkenergia · Maceió, AL</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mob/cappuccino.jpg" alt="" className="pointer-events-none absolute -right-10 bottom-0 hidden h-[110%] w-auto opacity-95 mix-blend-multiply [mask-image:radial-gradient(70%_70%_at_50%_55%,#000_50%,transparent_100%)] lg:block" aria-hidden />
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-12 max-w-6xl px-4 text-[11px] leading-relaxed text-white/35 sm:px-6">
        Preços de Black Friday válidos até 27/11 ou enquanto durar o estoque. Parcelamento em 21x no cartão (aceita mais de um cartão); totais a prazo: T1 R$ 8.085, Cappuccino R$ 9.366, MZ R$ 10.920. Autopropelidos conforme o Contran. Autonomia e recarga
        variam com peso, relevo e uso. Imagens ilustrativas. Quark Energia · Maceió, AL.
      </footer>

      {/* barra fixa */}
      <div className={cx("fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] transition duration-500", scrolled ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0")}>
        <div className="mx-auto flex max-w-xl items-center gap-2 rounded-full bg-[#111513]/92 p-2 pl-5 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.9)] ring-1 ring-white/10 backdrop-blur-xl">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold sm:text-[14px]">Black Friday · estoque limitado</p>
            <p className="truncate text-[12px] text-white/55">
              termina em <Clock small />
            </p>
          </div>
          <a href={waLink(picked ? SCOOTERS.find((s) => s.id === picked) : undefined)} target="_blank" rel="noreferrer" onClick={() => send("click", "whatsapp-barra")} className={cx("inline-flex h-12 shrink-0 items-center gap-2 rounded-full px-5 text-[15px] font-bold text-[#0A0D0B] sm:px-6", GRAD)}>
            <Ico n="chat" className="h-4 w-4" /> Quero a minha
          </a>
        </div>
      </div>
    </div>
  );
}

/* ====================================================== modelo */

function ModelSection({ s, flip, picked, onWant }: { s: Scooter; flip: boolean; picked: boolean; onWant: () => void }) {
  return (
    <section id={`m-${s.id}`} data-sec={`modelo-${s.id}`} className="scroll-mt-24 pt-20">
      <div className="relative overflow-hidden rounded-[36px] bg-[#0b0f0d] ring-1 ring-white/[0.06]">
        <span className="pointer-events-none absolute top-6 right-[-2%] text-[140px] leading-none font-bold tracking-[-0.07em] text-white/[0.035] select-none sm:text-[240px]" aria-hidden>
          {s.name}
        </span>
        <div className={cx("relative grid gap-4 p-6 sm:p-10 lg:grid-cols-2 lg:items-center", flip && "lg:[&>*:first-child]:order-2")}>
          <div>
            <Eyebrow color={s.accent}>{s.kicker}</Eyebrow>
            <h3 className="mt-3 text-[64px] leading-[0.85] font-bold tracking-[-0.06em] sm:text-[96px]">{s.name}</h3>
            <p className="mt-4 max-w-md text-[17px] leading-snug text-white/70 sm:text-[19px]">{s.pitch}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#FF5A3C] px-3.5 py-1.5 text-[13px] font-bold text-white shadow-[0_10px_30px_-8px_rgba(255,90,60,0.8)]">
              <Ico n="fire" className="h-4 w-4" /> Poucas unidades na Black
            </span>
          </div>
          <ProductShot s={s} className="h-[260px] sm:h-[380px]" />
        </div>

        <div className="relative grid grid-cols-2 gap-2 px-6 sm:grid-cols-3 sm:px-10">
          {s.specs.map((sp) => (
            <div key={sp.label} className="flex items-center gap-2.5 rounded-[18px] bg-[#111513] p-3 ring-1 ring-white/[0.07] sm:gap-3 sm:p-3.5">
              <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-[11px] text-[#0A0D0B] sm:h-11 sm:w-11 sm:rounded-[13px]", GRAD)}>
                <Ico n={sp.icon} className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] leading-tight font-bold sm:text-[18px]">{sp.value}</p>
                <p className="text-[11px] leading-tight text-white/50 sm:text-[13px]">{sp.sub}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="relative mt-4 flex items-start gap-2 px-6 text-[15px] text-white/70 sm:px-10">
          <Ico n="check" className="mt-0.5 h-5 w-5 shrink-0 text-[#6FBF8E]" w={3} />
          <span>
            <b style={{ color: s.accent }}>É pra você que</b> {s.forWho}
          </span>
        </p>

        <div className="relative m-6 mt-6 grid gap-4 rounded-[28px] bg-[#111513] p-5 ring-1 ring-[#6FBF8E]/25 sm:m-10 sm:mt-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
          <div>
            <p className="text-[12px] font-bold tracking-[0.16em] text-[#8FD9A8] uppercase">Black Friday · no cartão</p>
            <div className="mt-1 flex items-end gap-3">
              <div className="pb-2 text-[18px] leading-tight font-bold">
                {s.installments}x
                <br />
                <span className="text-[14px] text-white/60">de</span>
              </div>
              <p className={cx("text-[72px] leading-[0.85] font-bold tracking-[-0.06em] sm:text-[100px]", GT)}>
                <span className="mr-1 align-top text-[28px] sm:text-[34px]">R$</span>
                {s.installment}
              </p>
            </div>
            <p className="mt-2 text-[14px] text-white/60">
              ou <b className="text-white">{brl0(s.cash)} à vista</b> · aceita mais de um cartão
            </p>
          </div>
          <div className="grid gap-3">
            <ul className="grid gap-1.5 text-[15px] font-semibold">
              {[
                ["shield", "Garantia"],
                ["truck", "Entrega montada"],
                ["check", "Sem CNH e placa*"],
              ].map(([n, t]) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#6FBF8E]/15 text-[#8FD9A8]">
                    <Ico n={n as keyof typeof P} className="h-4 w-4" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <button onClick={onWant} className={cx("inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-[16px] font-bold whitespace-nowrap text-[#0A0D0B] transition active:scale-[0.97]", GRAD)}>
              {picked ? <Ico n="check" className="h-5 w-5" w={3} /> : null}
              {picked ? "Pedido enviado" : `Quero a ${s.name}`}
              {!picked && <Ico n="arrow" className="h-5 w-5" w={2.6} />}
            </button>
          </div>
        </div>
        <p className="relative -mt-6 px-6 pb-6 text-[11px] text-white/35 sm:-mt-8 sm:px-10 sm:pb-8">*Autopropelido conforme o Contran. Total a prazo {brl0(s.total)}. Imagens ilustrativas.</p>
      </div>
    </section>
  );
}

/* ====================================================== economia */

function Savings({ onCta }: { onCta: () => void }) {
  const [km, setKm] = useState(30);
  const [fuel, setFuel] = useState(6.3);
  const r = fuelSavings({ kmDay: km, fuel });
  const pctFill = ((km - 5) / (120 - 5)) * 100;
  return (
    <section id="economia" data-sec="economia" className="scroll-mt-24 pt-20">
      <div className="grid gap-6 rounded-[36px] bg-[#111513] p-6 ring-1 ring-white/[0.06] sm:p-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div>
          <Eyebrow>Simulador</Eyebrow>
          <H2>
            Quanto você <span className={GT}>deixa de gastar?</span>
          </H2>
          <p className="mt-4 text-[16px] text-white/60">Arraste e veja a diferença entre abastecer uma moto a gasolina e carregar a scooter na tomada.</p>
          <label className="mt-7 block text-[14px] font-semibold text-white/70" htmlFor="km">
            Quantos km você roda por dia?
          </label>
          <p className="mt-1 text-[48px] leading-none font-bold tracking-[-0.05em] tabular-nums">
            {km} <span className="text-[20px] text-white/50">km/dia</span>
          </p>
          <input
            id="km"
            type="range"
            min={5}
            max={120}
            step={5}
            value={km}
            onChange={(e) => setKm(Number(e.target.value))}
            className="mob-range mt-4 w-full"
            style={{ "--p": `${pctFill}%` } as React.CSSProperties}
          />
          <div className="mt-5 flex flex-wrap items-center gap-2 text-[13px] text-white/55">
            Gasolina a
            {[5.9, 6.3, 6.8].map((v) => (
              <button key={v} onClick={() => setFuel(v)} className={cx("h-8 rounded-full px-3 font-semibold tabular-nums", fuel === v ? "bg-[#fff] text-[#0A0D0B]" : "bg-white/[0.07] text-white")}>
                {v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-2.5">
          <div className="flex items-center justify-between rounded-[22px] bg-[#050706]/70 p-5 ring-1 ring-white/[0.06]">
            <div>
              <p className="text-[13px] text-white/50">Moto a gasolina (35 km/l)</p>
              <p className="text-[30px] font-bold text-white/45 line-through decoration-[#FF453A] decoration-[3px]">{brl0(r.gas)}</p>
            </div>
            <span className="text-[12px] text-white/40">por mês</span>
          </div>
          <div className="flex items-center justify-between rounded-[22px] bg-[#050706]/70 p-5 ring-1 ring-white/[0.06]">
            <div>
              <p className="text-[13px] text-white/50">Scooter Quark na tomada</p>
              <p className="text-[30px] font-bold">{brl0(r.electric)}</p>
            </div>
            <span className="text-[12px] text-white/40">por mês</span>
          </div>
          <div className="rounded-[26px] bg-[linear-gradient(135deg,#6FBF8E,#A9DE86)] p-6 text-[#0A0D0B]">
            <p className="text-[13px] font-bold tracking-[0.12em] uppercase opacity-70">Fica no seu bolso</p>
            <p className="mt-1 text-[56px] leading-none font-bold tracking-[-0.05em]">{brl0(r.saved)}</p>
            <p className="mt-1 text-[15px] font-semibold opacity-75">por mês · {brl0(r.year)} por ano</p>
          </div>
          <button onClick={onCta} className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white/[0.07] text-[15px] font-bold ring-1 ring-white/10">
            Descobrir a scooter ideal pra mim <Ico n="arrow" className="h-4 w-4" />
          </button>
          <p className="text-[11px] text-white/35">Estimativa com 22 dias rodados por mês, tarifa de R$ 1,10/kWh e 50 km por carga de 1,28 kWh. Valores reais variam com o uso.</p>
        </div>
      </div>
    </section>
  );
}

/* ====================================================== 3x mais força */

function Versus() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setOn(true), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const bar = (w: number, quark: boolean, label: string) => (
    <div className="h-10 overflow-hidden rounded-[12px] bg-white/[0.05]">
      <div
        className={cx("flex h-full items-center justify-end rounded-[12px] px-4 text-[15px] font-bold transition-[width] duration-[1400ms] ease-out", quark ? "bg-[linear-gradient(90deg,#1FA06A,#9FDB7C,#F3E93B)] text-[#0A0D0B]" : "bg-white/15 text-white")}
        style={{ width: on ? `${w}%` : "8%" }}
      >
        {label}
      </div>
    </div>
  );
  return (
    <section data-sec="diferencial" className="pt-20" ref={ref}>
      <Eyebrow>Por que as nossas são diferentes</Eyebrow>
      <H2>
        Quase <span className={GT}>3x mais força</span>
        <br />
        que as comuns.
      </H2>
      <p className="mt-4 max-w-2xl text-[17px] text-white/60">Muitas scooters por aí têm motor de 350W e baterias pequenas. Sobem ladeira com dificuldade e param no meio do caminho.</p>
      <div className="mt-8 grid gap-6 rounded-[32px] bg-[#111513] p-6 ring-1 ring-white/[0.06] sm:p-9">
        <div className="grid gap-2">
          <p className="text-[17px] font-bold">Potência do motor</p>
          <div className="grid grid-cols-[110px_1fr] items-center gap-3 sm:grid-cols-[140px_1fr]">
            <span className="text-[14px] font-bold text-[#8FD9A8]">Quark</span>
            {bar(100, true, "1.000W")}
            <span className="text-[14px] text-white/60">Scooter comum*</span>
            {bar(35, false, "350W")}
          </div>
        </div>
        <div className="grid gap-2">
          <p className="text-[17px] font-bold">Autonomia por carga</p>
          <div className="grid grid-cols-[110px_1fr] items-center gap-3 sm:grid-cols-[140px_1fr]">
            <span className="text-[14px] font-bold text-[#8FD9A8]">Quark</span>
            {bar(100, true, "50 a 100 km")}
            <span className="text-[14px] text-white/60">Scooter comum*</span>
            {bar(30, false, "~30 km")}
          </div>
        </div>
        <div className="overflow-hidden rounded-[22px] ring-1 ring-white/[0.08]">
          <div className="grid grid-cols-[1fr_1.3fr_1.3fr] bg-white/[0.04] px-4 py-3 text-[13px] font-bold sm:px-6">
            <span />
            <span className="text-[#8FD9A8]">Scooters Quark</span>
            <span className="text-white/60">Comuns*</span>
          </div>
          {VERSUS.map((v) => (
            <div key={v.label} className="grid grid-cols-[1fr_1.3fr_1.3fr] items-center gap-2 border-t border-white/[0.06] px-4 py-3 text-[14px] sm:px-6 sm:text-[15px]">
              <span className="font-bold">{v.label}</span>
              <span className="flex items-center gap-2 font-semibold">
                <Ico n="check" className="h-4 w-4 shrink-0 text-[#6FBF8E]" w={3} />
                {v.quark}
              </span>
              <span className="flex items-center gap-2 text-white/55">
                <Ico n="x" className="h-4 w-4 shrink-0 text-[#FF6B5E]" w={3} />
                {v.common}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-white/35">*Referência: valores típicos de scooters elétricas de entrada vendidas no mercado (motor de 350W). Podem variar por modelo.</p>
      </div>
    </section>
  );
}

/* ====================================================== quiz */

const QUESTIONS = [
  {
    key: "use" as const,
    q: "Pra que você vai usar mais?",
    opts: [
      { v: "trabalho", t: "Trabalho, faculdade e mercado", g: "pacote" as GlyphId },
      { v: "passeio", t: "Passear com estilo, às vezes a dois", g: "estrela" as GlyphId },
      { v: "longo", t: "Rodar o dia todo, entregas e trajetos longos", g: "raio" as GlyphId },
    ],
  },
  {
    key: "km" as const,
    q: "Quantos km por dia, mais ou menos?",
    opts: [
      { v: "curto", t: "Até 30 km", g: "casa" as GlyphId },
      { v: "medio", t: "De 30 a 60 km", g: "relatorios" as GlyphId },
      { v: "longo", t: "Mais de 60 km", g: "alerta" as GlyphId },
    ],
  },
  {
    key: "style" as const,
    q: "E o seu estilo?",
    opts: [
      { v: "pratico", t: "Prático: cesto e garupa", g: "chave" as GlyphId },
      { v: "classico", t: "Clássico: visual retrô", g: "folha" as GlyphId },
      { v: "esportivo", t: "Esportivo: top de linha", g: "chama" as GlyphId },
    ],
  },
];

function Quiz({ onResult, onWant, onSee }: { onResult: (id: ModelId) => void; onWant: (s: Scooter) => void; onSee: (s: Scooter) => void }) {
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState<Record<string, string>>({});
  const done = step >= QUESTIONS.length;
  const best = done ? SCOOTERS.find((s) => s.id === recommend(ans as Parameters<typeof recommend>[0]))! : null;
  useEffect(() => {
    if (best) onResult(best.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [best?.id]);
  return (
    <section id="quiz" data-sec="quiz" className="scroll-mt-24 pt-20">
      <div className="relative overflow-hidden rounded-[36px] bg-[#111513] ring-1 ring-white/[0.06]">
        <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(243,233,59,0.12)_0%,rgba(243,233,59,0)_62%)]" />
        <div className="relative p-6 sm:p-10">
          <Eyebrow>Teste rápido · 3 perguntas</Eyebrow>
          <H2>
            Qual scooter <span className={GT}>é a sua cara?</span>
          </H2>
          <div className="mt-6 flex gap-1.5">
            {QUESTIONS.map((_, i) => (
              <span key={i} className={cx("h-1.5 flex-1 rounded-full transition", i < step || done ? GRAD : "bg-white/10")} />
            ))}
          </div>
          {!done ? (
            <div key={step} className="bf-rise mt-8">
              <p className="text-[24px] font-bold tracking-[-0.03em] sm:text-[30px]">{QUESTIONS[step].q}</p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
                {QUESTIONS[step].opts.map((o) => (
                  <button
                    key={o.v}
                    onClick={() => {
                      setAns({ ...ans, [QUESTIONS[step].key]: o.v });
                      setStep(step + 1);
                    }}
                    className="flex items-center gap-4 rounded-[22px] bg-[#050706]/70 p-4 text-left ring-1 ring-white/[0.08] transition hover:ring-[#6FBF8E]/60 active:scale-[0.98]"
                  >
                    <GlyphTile id={o.g} size="md" className="!h-11 !w-11 !rounded-[12px]" />
                    <span className="text-[16px] leading-snug font-semibold">{o.t}</span>
                  </button>
                ))}
              </div>
              {step > 0 && (
                <button onClick={() => setStep(step - 1)} className="mt-4 text-[14px] font-semibold text-white/50 hover:text-white">
                  ← Voltar
                </button>
              )}
            </div>
          ) : (
            best && (
              <div className="bf-rise mt-8 grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
                <div>
                  <p className="text-[14px] font-bold tracking-[0.12em] text-[#8FD9A8] uppercase">A sua combina com</p>
                  <p className="mt-1 text-[72px] leading-[0.85] font-bold tracking-[-0.06em] sm:text-[96px]" style={{ color: best.accent }}>
                    {best.name}
                  </p>
                  <p className="mt-3 max-w-md text-[17px] text-white/70">É pra você que {best.forWho}</p>
                  <p className="mt-4 text-[15px] text-white/60">
                    21x de <b className={cx("text-[22px]", GT)}>{brl0(best.installment)}</b> ou {brl0(best.cash)} à vista
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <button onClick={() => onWant(best)} className={cx("inline-flex h-14 items-center gap-2 rounded-full px-7 text-[16px] font-bold text-[#0A0D0B]", GRAD)}>
                      Quero a {best.name} <Ico n="arrow" className="h-5 w-5" w={2.6} />
                    </button>
                    <button onClick={() => onSee(best)} className="inline-flex h-14 items-center rounded-full bg-white/[0.07] px-6 text-[15px] font-semibold ring-1 ring-white/10">
                      Ver a ficha
                    </button>
                    <button
                      onClick={() => {
                        setAns({});
                        setStep(0);
                      }}
                      className="inline-flex h-14 items-center px-3 text-[14px] font-semibold text-white/50"
                    >
                      Refazer
                    </button>
                  </div>
                </div>
                <ProductShot s={best} className="h-[260px] sm:h-[340px]" />
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
