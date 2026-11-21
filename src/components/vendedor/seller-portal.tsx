"use client";

import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  ChevronDown,
  Copy,
  Download,
  Gift,
  Handshake,
  LayoutGrid,
  Link2,
  Loader2,
  LogOut,
  MessageCircle,
  Send,
  Share2,
  ShieldCheck,
  Trophy,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { GalleryPhoto, Scooter } from "@/lib/catalog-mobilidade";
import { toPortrait } from "@/lib/moto-customers-db";
import { SELLER_ARTS, SELLER_CAMPAIGN, campaignEnded } from "@/lib/seller-materials";

/**
 * Área do vendedor parceiro: catálogo para divulgar (fotos, ficha e textos prontos),
 * indicação de clientes, histórico com comissões e perfil com foto.
 */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const GREEN = "#1F9D55";
const DARK = "linear-gradient(150deg,#123A26 0%,#0B1A12 70%)";
const GRAD = "linear-gradient(95deg,#1FA06A 0%,#4FC38A 40%,#9FDB7C 70%,#D8E83C 100%)";
const CARD = "rounded-[26px] bg-white ring-1 ring-[#0B1A12]/[0.07] shadow-[0_18px_40px_-30px_rgba(16,52,32,0.45)]";
const FIELD = "mt-1.5 h-13 w-full rounded-2xl bg-[#F4F7F1] px-4 text-[16px] ring-1 ring-[#0B1A12]/[0.08] outline-none transition placeholder:text-[#0B1A12]/35 focus:bg-white focus:ring-2 focus:ring-[#1F9D55]";
const SESSION = "quark-seller";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: v % 1 ? 2 : 0 });
const digits = (v: string) => v.replace(/\D/g, "");
const maskPhone = (v: string) => {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
};
const firstName = (n: string) => n.trim().split(/\s+/)[0] || "";

type Status = "nova" | "contato" | "negociacao" | "fechada" | "perdida";
interface Referral {
  id: string;
  name: string;
  phone: string;
  model: string | null;
  status: Status;
  commission: number | null;
  paid: boolean;
  created_at: string;
  updated_at: string;
}
interface Seller {
  id: string;
  name: string;
  phone: string;
  ref: string;
  photo: string | null;
  city: string | null;
  instagram: string | null;
  commission: string | null;
  since: string;
}
type Session = { seller: Seller; referrals: Referral[]; creds: { phone: string; pin: string } };
type Extra = Record<string, { url: string; caption: string | null }[]>;
type Tab = "catalogo" | "indicar" | "historico" | "perfil";

const STATUS: Record<Status, { label: string; cls: string }> = {
  nova: { label: "Recebida", cls: "bg-[#EEF2FF] text-[#3343A8]" },
  contato: { label: "Em contato", cls: "bg-[#FFF6DA] text-[#8A6100]" },
  negociacao: { label: "Negociando", cls: "bg-[#FFEFD9] text-[#9A4B00]" },
  fechada: { label: "Fechada", cls: "bg-[#E6F6EA] text-[#1F7A45]" },
  perdida: { label: "Não fechou", cls: "bg-[#F1F3EF] text-[#0B1A12]/55" },
};

const ERRORS: Record<string, string> = {
  nao_encontrado: "Telefone ou código não conferem. Confira e tente de novo.",
  bloqueado: "Muitas tentativas. Aguarde 15 minutos e tente de novo.",
  indisponivel: "A área do vendedor ainda não está ativa. Fale com a Quark.",
  acesso: "Sua sessão expirou. Entre de novo.",
  dados: "Confira o nome e o WhatsApp do cliente.",
  repetida: "Você já indicou esse cliente nos últimos 30 dias.",
  limite: "Muitas indicações hoje. Tente de novo amanhã.",
  imagem: "Não foi possível usar essa foto. Tente outra.",
};

async function call(body: Record<string, unknown>) {
  const res = await fetch("/api/public/vendedor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({ ok: false, error: "erro" }))) as { ok?: boolean; error?: string; seller?: Seller; referrals?: Referral[] };
}

/* ------------------------------------------------------------------ raiz */

export function SellerPortal({ models, photos, whatsapp }: { models: Scooter[]; photos: Extra; whatsapp: string | null }) {
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<"restoring" | "login" | "home">("restoring");

  const login = useCallback(async (phone: string, pin: string): Promise<string | null> => {
    try {
      const j = await call({ action: "login", phone, pin });
      if (!j.ok || !j.seller) return ERRORS[j.error ?? ""] ?? "Não foi possível entrar agora. Tente de novo.";
      setSession({ seller: j.seller, referrals: j.referrals ?? [], creds: { phone, pin } });
      try {
        sessionStorage.setItem(SESSION, JSON.stringify({ phone, pin }));
      } catch {}
      setPhase("home");
      return null;
    } catch {
      return "Sem conexão. Tente de novo.";
    }
  }, []);

  useEffect(() => {
    let saved: { phone?: string; pin?: string } | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(SESSION) ?? "null");
    } catch {}
    if (saved?.phone && saved.pin) login(saved.phone, saved.pin).then((e) => e && setPhase("login"));
    else setPhase("login");
  }, [login]);

  const logout = () => {
    try {
      sessionStorage.removeItem(SESSION);
    } catch {}
    setSession(null);
    setPhase("login");
  };

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#F7F9F4] text-[#0B1A12] antialiased" style={{ fontFamily: "var(--font-jakarta), -apple-system, system-ui, sans-serif" }}>
      <div aria-hidden className="h-[5px]" style={{ background: GRAD }} />
      {phase === "restoring" ? (
        <div className="grid min-h-[70dvh] place-items-center">
          <Loader2 className="h-7 w-7 animate-spin text-[#0B1A12]/30" />
        </div>
      ) : phase === "login" || !session ? (
        <Login onLogin={login} whatsapp={whatsapp} />
      ) : (
        <Home session={session} setSession={setSession} models={models} photos={photos} whatsapp={whatsapp} onLogout={logout} reload={() => login(session.creds.phone, session.creds.pin)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ login */

function Login({ onLogin, whatsapp }: { onLogin: (phone: string, pin: string) => Promise<string | null>; whatsapp: string | null }) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const wa = digits(whatsapp ?? "");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (digits(phone).length < 10) return setErr("Digite o seu WhatsApp com DDD.");
    if (pin.length !== 4) return setErr("Digite o código de 4 números que a Quark enviou para você.");
    setErr(null);
    setBusy(true);
    const e2 = await onLogin(phone, pin);
    setBusy(false);
    if (e2) setErr(e2);
  };

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mob/ic/logo.png" alt="Quark Mobilidade" className="h-9 w-auto" />
      <section className="mt-8 overflow-hidden rounded-[30px] px-6 py-7 text-white" style={{ background: DARK }}>
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#D8E83C] ring-1 ring-white/15">
          <Handshake className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-[28px] leading-tight font-extrabold tracking-[-0.03em]">Área do vendedor</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-white/75">Catálogo completo para divulgar, indicações e comissões num lugar só.</p>
      </section>
      <form onSubmit={submit} noValidate className={cx(CARD, "mt-4 p-6")}>
        <label htmlFor="sv-phone" className="block text-[13px] font-semibold text-[#0B1A12]/70">
          Seu WhatsApp
        </label>
        <input id="sv-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(82) 9 0000-0000" className={cx(FIELD, "tabular-nums")} />
        <label htmlFor="sv-pin" className="mt-4 block text-[13px] font-semibold text-[#0B1A12]/70">
          Código de acesso
        </label>
        <input id="sv-pin" inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={pin} onChange={(e) => setPin(digits(e.target.value).slice(0, 4))} placeholder="4 números" className={cx(FIELD, "text-center text-[22px] font-bold tracking-[0.5em] placeholder:text-[16px] placeholder:font-normal placeholder:tracking-normal")} />
        <div aria-live="polite">{err && <p className="mt-4 rounded-2xl bg-[#FDECEA] px-4 py-3 text-[13.5px] text-[#A12A17]">{err}</p>}</div>
        <button type="submit" disabled={busy} className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0B1A12] text-[16px] font-bold text-white disabled:opacity-70">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Entrar <ArrowRight className="h-5 w-5" /></>}
        </button>
        {wa.length >= 10 && (
          <a href={`https://wa.me/${wa.length <= 11 ? `55${wa}` : wa}?text=${encodeURIComponent("Olá! Quero ser vendedor parceiro da Quark Mobilidade / recuperar meu código de acesso.")}`} target="_blank" rel="noopener noreferrer" className="mt-3 block text-center text-[13.5px] font-semibold text-[#1F7A45]">
            Não tem código? Fale com a Quark
          </a>
        )}
      </form>
    </main>
  );
}

/* ------------------------------------------------------------------ início */

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "catalogo", label: "Catálogo", icon: LayoutGrid },
  { id: "indicar", label: "Indicar", icon: Send },
  { id: "historico", label: "Indicações", icon: Users },
  { id: "perfil", label: "Perfil", icon: UserRound },
];

function Home({ session, setSession, models, photos, whatsapp, onLogout, reload }: { session: Session; setSession: (s: Session) => void; models: Scooter[]; photos: Extra; whatsapp: string | null; onLogout: () => void; reload: () => Promise<string | null> }) {
  const { seller, referrals } = session;
  const [tab, setTab] = useState<Tab>("catalogo");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/scooters?v=${seller.ref}`;
  const stats = useMemo(() => {
    const closed = referrals.filter((r) => r.status === "fechada");
    return {
      total: referrals.length,
      open: referrals.filter((r) => r.status === "nova" || r.status === "contato" || r.status === "negociacao").length,
      closed: closed.length,
      toReceive: closed.filter((r) => !r.paid).reduce((t, r) => t + (Number(r.commission) || 0), 0),
      received: closed.filter((r) => r.paid).reduce((t, r) => t + (Number(r.commission) || 0), 0),
    };
  }, [referrals]);

  const go = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="mx-auto max-w-5xl px-4 pt-5 pb-16">
      <header className="flex items-center justify-between gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mob/ic/logo.png" alt="Quark Mobilidade" className="h-9 w-auto" />
        <button type="button" onClick={onLogout} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13.5px] font-semibold ring-1 ring-[#0B1A12]/10">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </header>

      {/* boas-vindas */}
      <section className="relative mt-5 overflow-hidden rounded-[30px] p-5 text-white sm:p-7" style={{ background: DARK }}>
        <div aria-hidden className="absolute -top-24 -right-20 h-72 w-72 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(216,232,60,0.2), transparent)" }} />
        <div className="relative flex items-center gap-4">
          <button type="button" onClick={() => go("perfil")} className="relative h-[84px] w-[64px] shrink-0 overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/20" aria-label="Trocar foto do perfil">
            {seller.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserRound className="mx-auto h-8 w-8 text-white/50" />
            )}
          </button>
          <div className="min-w-0">
            <p className="text-[12px] font-bold tracking-[0.2em] text-[#D8E83C] uppercase">Vendedor parceiro</p>
            <h1 className="mt-1 truncate text-[26px] leading-tight font-extrabold tracking-[-0.03em]">Olá, {firstName(seller.name)}!</h1>
            {seller.commission && <p className="mt-0.5 text-[13.5px] text-white/70">Sua comissão: {seller.commission}</p>}
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { k: "Indicações", v: String(stats.total), icon: Users },
            { k: "Em andamento", v: String(stats.open), icon: Handshake },
            { k: "Fechadas", v: String(stats.closed), icon: Trophy },
            { k: "A receber", v: brl(stats.toReceive), icon: Wallet },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl bg-white/[0.07] p-3.5 ring-1 ring-white/10">
              <x.icon className="h-4 w-4 text-[#9FDB7C]" />
              <p className="mt-2 text-[22px] leading-none font-extrabold tabular-nums">{x.v}</p>
              <p className="mt-1 text-[12px] text-white/60">{x.k}</p>
            </div>
          ))}
        </div>
        <LinkBox link={link} seller={seller} />
      </section>

      {/* abas */}
      <nav className="sticky top-2 z-20 mt-5 flex gap-1 overflow-x-auto rounded-full bg-white/90 p-1 shadow-[0_10px_30px_-20px_rgba(16,52,32,0.5)] ring-1 ring-[#0B1A12]/[0.06] backdrop-blur [scrollbar-width:none] sm:inline-flex" aria-label="Seções">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => go(t.id)} aria-current={tab === t.id ? "page" : undefined} className={cx("inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition", tab === t.id ? "bg-[#0B1A12] text-white" : "text-[#0B1A12]/60 hover:text-[#0B1A12]")}>
            <t.icon className="h-4 w-4" /> {t.label}
            {t.id === "historico" && stats.total > 0 && <span className={cx("rounded-full px-1.5 text-[11px] tabular-nums", tab === t.id ? "bg-white/15" : "bg-[#0B1A12]/[0.07]")}>{stats.total}</span>}
          </button>
        ))}
      </nav>

      {tab === "catalogo" && <Catalog models={models} photos={photos} link={link} seller={seller} />}
      {tab === "indicar" && <Refer models={models} creds={session.creds} onDone={async () => { await reload(); }} goHistory={() => go("historico")} />}
      {tab === "historico" && <History referrals={referrals} stats={stats} goRefer={() => go("indicar")} />}
      {tab === "perfil" && <Profile seller={seller} link={link} creds={session.creds} whatsapp={whatsapp} onPhoto={(photo) => setSession({ ...session, seller: { ...seller, photo } })} />}
    </main>
  );
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {
      window.prompt("Copie o texto:", text);
    }
  };
  return { copied, copy };
}

function LinkBox({ link, seller }: { link: string; seller: Seller }) {
  const { copied, copy } = useCopy();
  const share = async () => {
    const text = `Conheça as scooters elétricas da Quark: sem CNH, sem placa e com garantia. Fale comigo! ${link}`;
    try {
      if (navigator.share) return await navigator.share({ title: "Scooters elétricas Quark", text, url: link });
    } catch {
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  return (
    <div className="relative mt-4 rounded-2xl bg-white p-3.5 text-[#0B1A12]">
      <p className="flex items-center gap-1.5 text-[12px] font-bold tracking-[0.12em] text-[#1F7A45] uppercase">
        <Link2 className="h-3.5 w-3.5" /> Seu link de divulgação
      </p>
      <p className="mt-1 truncate font-mono text-[13.5px] text-[#0B1A12]/70">{link}</p>
      <p className="mt-0.5 text-[12px] text-[#0B1A12]/50">Quem chamar a Quark por esse link aparece como indicação de {firstName(seller.name)}.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => copy("link", link)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#F1F5EE] text-[14px] font-semibold">
          {copied === "link" ? <Check className="h-4 w-4 text-[#1F9D55]" /> : <Copy className="h-4 w-4" />} {copied === "link" ? "Copiado" : "Copiar"}
        </button>
        <button type="button" onClick={share} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0B1A12] text-[14px] font-semibold text-white">
          <Share2 className="h-4 w-4" /> Compartilhar
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ materiais */

async function fileFrom(src: string, name: string) {
  const blob = await (await fetch(src)).blob();
  return new File([blob], name, { type: blob.type || (name.endsWith(".pdf") ? "application/pdf" : "image/jpeg") });
}

/** Envia arquivos pelo menu de compartilhar do celular; sem suporte, baixa os arquivos. */
async function shareFiles(items: { src: string; name: string }[], text: string) {
  try {
    const files = await Promise.all(items.map((i) => fileFrom(i.src, i.name)));
    if (navigator.canShare?.({ files })) {
      await navigator.share({ files, text });
      return;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
  }
  for (const i of items) {
    const a = document.createElement("a");
    a.href = i.src;
    a.download = i.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

function Materials({ link }: { link: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const ended = campaignEnded();
  const run = async (key: string, items: { src: string; name: string }[], text: string) => {
    setBusy(key);
    try {
      await shareFiles(items, text);
    } finally {
      setBusy(null);
    }
  };
  const cat = SELLER_CAMPAIGN.catalog;
  const until = SELLER_CAMPAIGN.until.split("-").reverse().slice(0, 2).join("/");
  const msg = (model?: string) => `${model ? `Scooter elétrica ${model}` : "Scooters elétricas Quark"}: sem CNH, sem placa e com garantia. Veja mais e fale comigo: ${link}`;

  return (
    <section className={cx(CARD, "overflow-hidden")}>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: GREEN }}>
            Materiais de divulgação
          </p>
          <span className={cx("rounded-full px-2.5 py-1 text-[11.5px] font-bold", ended ? "bg-[#FDECEA] text-[#A12A17]" : "bg-[#0B1A12] text-[#D8E83C]")}>
            {SELLER_CAMPAIGN.name} · {ended ? "encerrada" : `até ${until}`}
          </span>
        </div>
        {ended && <p className="mt-3 rounded-2xl bg-[#FFF6DA] px-4 py-3 text-[13.5px] text-[#8A6100]">A campanha terminou. Antes de divulgar estas artes, confirme os preços com a Quark.</p>}

        {/* catálogo em PDF */}
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-[22px] p-4 text-white" style={{ background: DARK }}>
          <span className="grid h-14 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-[11px] font-extrabold tracking-wider text-[#D8E83C] ring-1 ring-white/15">PDF</span>
          <div className="min-w-0 flex-1">
            <p className="text-[16.5px] font-bold">Catálogo completo</p>
            <p className="text-[13px] text-white/65">
              T1, Cappuccino e MZ, com fichas e preços · {cat.pages} páginas · {cat.size}
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
            <a href={cat.src} download={cat.file} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 text-[14px] font-semibold ring-1 ring-white/15">
              <Download className="h-4 w-4" /> Baixar
            </a>
            <button type="button" disabled={!!busy} onClick={() => run("pdf", [{ src: cat.src, name: cat.file }], msg())} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-[14px] font-bold text-[#06210F] disabled:opacity-60">
              {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Enviar
            </button>
          </div>
        </div>
      </div>

      {/* artes por modelo */}
      <div className="grid gap-5 border-t border-[#0B1A12]/[0.06] p-5 sm:grid-cols-2 sm:p-6">
        {SELLER_ARTS.map((g) => (
          <div key={g.model}>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[18px] leading-tight font-extrabold">{g.model}</p>
                <p className="text-[12.5px] text-[#0B1A12]/55">{g.tagline}</p>
              </div>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => run(`all-${g.model}`, g.arts.map((a, i) => ({ src: a.src, name: `Quark-${g.model}-${i + 1}.jpg` })), msg(g.model))}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#25D366] px-3.5 text-[12.5px] font-bold text-[#06210F] disabled:opacity-60"
              >
                {busy === `all-${g.model}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />} Enviar as 2
              </button>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              {g.arts.map((a, i) => (
                <figure key={a.src} className="overflow-hidden rounded-2xl bg-[#F4F6F2] ring-1 ring-[#0B1A12]/[0.06]">
                  <a href={a.src} target="_blank" rel="noopener noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.src} alt={`${g.model} · ${a.label}`} loading="lazy" className="aspect-[9/16] w-full object-cover" />
                  </a>
                  <figcaption className="p-2">
                    <p className="text-center text-[12px] font-semibold text-[#0B1A12]/60">{a.label}</p>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      <a href={a.src} download={`Quark-${g.model}-${a.label.replace(/\s+/g, "-")}.jpg`} aria-label={`Baixar ${a.label} da ${g.model}`} className="flex h-9 items-center justify-center rounded-xl bg-white ring-1 ring-[#0B1A12]/10">
                        <Download className="h-4 w-4" />
                      </a>
                      <button type="button" disabled={!!busy} onClick={() => run(`${g.model}-${i}`, [{ src: a.src, name: `Quark-${g.model}-${i + 1}.jpg` }], msg(g.model))} aria-label={`Enviar ${a.label} da ${g.model}`} className="flex h-9 items-center justify-center rounded-xl bg-[#0B1A12] text-white disabled:opacity-60">
                        {busy === `${g.model}-${i}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="border-t border-[#0B1A12]/[0.06] px-5 py-3 text-[12px] text-[#0B1A12]/50 sm:px-6">
        No celular, “Enviar” abre o WhatsApp, o Instagram e outros apps com a imagem pronta e o seu link na legenda. As artes têm o tamanho certo para stories e status.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ catálogo */

function pitch(m: Scooter, link: string) {
  const t = m.table;
  return [
    `🛵 *Scooter elétrica ${m.name}*${m.kicker ? ` · ${m.kicker}` : ""}`,
    m.pitch,
    "",
    t.Motor && `⚡ Motor: ${t.Motor}`,
    t.Bateria && `🔋 Bateria: ${t.Bateria}`,
    t.Autonomia && `🛣️ Autonomia: ${t.Autonomia}`,
    t.Velocidade && `🏁 Velocidade: ${t.Velocidade}`,
    "",
    "✅ Sem CNH e sem placa (autopropelido)",
    "✅ Garantia de 90 dias",
    "✅ Contrato, comprovante de propriedade e cartão do dono com QR",
    "",
    m.installment > 0 ? `💳 ${m.installments}x de ${brl(m.installment)}${m.cash > 0 ? ` ou ${brl(m.cash)} à vista no PIX` : ""}` : "",
    "",
    `Veja fotos e fale comigo: ${link}`,
  ]
    .filter((x): x is string => typeof x === "string")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function Catalog({ models, photos, link, seller }: { models: Scooter[]; photos: Extra; link: string; seller: Seller }) {
  return (
    <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5">
      <Materials link={link} />
      <section className={cx(CARD, "p-5 sm:p-6")}>
        <p className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: GREEN }}>
          Argumentos que vendem
        </p>
        <ul className="mt-3 grid gap-2.5 text-[14.5px] sm:grid-cols-2">
          {[
            "Sem CNH e sem placa: autopropelido até 1.000 W e 32 km/h (CONTRAN 996/2023)",
            "Economia de até R$ 146 por mês em relação a uma moto a gasolina",
            "Garantia de 90 dias registrada no contrato",
            "Contrato assinado, comprovante de propriedade e cartão do dono com QR",
            "Pagamento em até 21x no cartão ou PIX à vista",
            "Entrega montada e revisada, com suporte em Maceió",
          ].map((x) => (
            <li key={x} className="flex items-start gap-2.5">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" style={{ color: GREEN }} /> {x}
            </li>
          ))}
        </ul>
      </section>
      {models.map((m) => (
        <ModelKit key={m.id} m={m} extra={photos[m.id] ?? []} link={link} seller={seller} />
      ))}
    </div>
  );
}

function ModelKit({ m, extra, link, seller }: { m: Scooter; extra: { url: string; caption: string | null }[]; link: string; seller: Seller }) {
  const { copied, copy } = useCopy();
  const seen = new Set<string>();
  const shots: GalleryPhoto[] = [...m.gallery, ...extra.map((x) => ({ src: x.url, caption: x.caption ?? "", fit: "cover" as const }))].filter((g) => {
    if (!g.src || seen.has(g.src)) return false;
    seen.add(g.src);
    return true;
  });
  if (!shots.length) shots.push({ src: m.image, caption: m.name, fit: "contain" });
  const text = pitch(m, link);
  const rows = Object.entries(m.table).filter(([, v]) => v && String(v).trim());

  const shareWithPhoto = async () => {
    try {
      const res = await fetch(shots[0].src);
      const blob = await res.blob();
      const file = new File([blob], `${m.name}.${blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg"}`, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text, title: m.name });
    } catch {
      /* cai no WhatsApp com texto */
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  return (
    <article className={cx(CARD, "overflow-hidden")}>
      <div className="grid gap-0 lg:grid-cols-[1.1fr_1fr]">
        <div className="bg-[#F4F6F2]">
          <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {shots.map((g, i) => (
              <figure key={g.src} className="relative aspect-[4/3] w-full shrink-0 snap-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.src} alt={`${m.name} ${g.caption}`} loading={i ? "lazy" : undefined} className={g.fit === "contain" ? "h-full w-full object-contain p-5" : "h-full w-full object-cover"} />
                <span className="absolute top-3 left-3 rounded-full bg-[#0B1A12]/75 px-2.5 py-1 text-[11.5px] font-semibold text-white">
                  {i + 1}/{shots.length}
                  {g.caption ? ` · ${g.caption}` : ""}
                </span>
                <a href={g.src} download={`${m.name}-${i + 1}`} className="absolute right-3 bottom-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-bold shadow-md">
                  <Download className="h-4 w-4" /> Baixar foto
                </a>
              </figure>
            ))}
          </div>
          {shots.length > 1 && (
            <p className="flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold text-[#0B1A12]/50">
              <Camera className="h-3.5 w-3.5" /> {shots.length} fotos · deslize para ver e baixar
            </p>
          )}
        </div>
        <div className="flex flex-col p-5 sm:p-6">
          <p className="text-[11.5px] font-bold tracking-[0.18em] uppercase" style={{ color: GREEN }}>
            {m.kicker}
          </p>
          <h2 className="mt-1 text-[28px] leading-tight font-extrabold tracking-[-0.03em]">{m.name}</h2>
          {m.pitch && <p className="mt-1 text-[14.5px] leading-relaxed text-[#0B1A12]/60">{m.pitch}</p>}
          {m.installment > 0 && (
            <p className="mt-3 text-[14px] text-[#0B1A12]/55">
              <b className="text-[22px] font-extrabold text-[#0B1A12]">
                {m.installments}x de {brl(m.installment)}
              </b>
              {m.cash > 0 && <span className="block">ou {brl(m.cash)} à vista no PIX</span>}
            </p>
          )}
          <details className="group mt-3">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 text-[14px] font-semibold text-[#1F7A45] [&::-webkit-details-marker]:hidden">
              Ficha técnica <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <dl className="mt-1 divide-y divide-[#0B1A12]/[0.06] rounded-2xl bg-[#F6F8F4] px-4">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 py-2 text-[13.5px]">
                  <dt className="text-[#0B1A12]/55">{k}</dt>
                  <dd className="text-right font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </details>
          <details className="group mt-1">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 text-[14px] font-semibold text-[#1F7A45] [&::-webkit-details-marker]:hidden">
              Texto pronto para divulgar <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <pre className="mt-1 rounded-2xl bg-[#F6F8F4] p-4 font-sans text-[13px] leading-relaxed whitespace-pre-wrap">{text}</pre>
          </details>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
            <button type="button" onClick={shareWithPhoto} className="col-span-2 flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-[15px] font-bold text-[#06210F]">
              <MessageCircle className="h-5 w-5" /> Divulgar com foto
            </button>
            <button type="button" onClick={() => copy(m.id, text)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#F1F5EE] text-[14px] font-semibold">
              {copied === m.id ? <Check className="h-4 w-4 text-[#1F9D55]" /> : <Copy className="h-4 w-4" />} {copied === m.id ? "Copiado" : "Copiar texto"}
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#F1F5EE] text-[14px] font-semibold">
              <Send className="h-4 w-4" /> Só o texto
            </a>
          </div>
          <p className="mt-2 text-[11.5px] text-[#0B1A12]/45">O texto já leva o seu link: quem chamar por ele aparece como indicação de {firstName(seller.name)}.</p>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ indicar */

function Refer({ models, creds, onDone, goHistory }: { models: Scooter[]; creds: { phone: string; pin: string }; onDone: () => Promise<void>; goHistory: () => void }) {
  const [f, setF] = useState({ name: "", phone: "", model: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.name.trim().length < 2) return setErr("Digite o nome do cliente.");
    if (digits(f.phone).length < 10) return setErr("Digite o WhatsApp do cliente com DDD.");
    setErr(null);
    setBusy(true);
    try {
      const j = await call({ action: "refer", ...creds, name: f.name, clientPhone: f.phone, model: f.model, notes: f.notes });
      if (!j.ok) return setErr(ERRORS[j.error ?? ""] ?? "Não foi possível enviar agora. Tente de novo.");
      setDone(firstName(f.name) || "o cliente");
      setF({ name: "", phone: "", model: "", notes: "" });
      await onDone();
    } catch {
      setErr("Sem conexão. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <section className={cx(CARD, "mx-auto mt-5 max-w-xl p-7 text-center")}>
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full text-[#0B1A12]" style={{ background: GRAD }}>
          <Check className="h-10 w-10" strokeWidth={3} />
        </span>
        <h2 className="mt-5 text-[26px] font-extrabold tracking-[-0.03em]">Indicação enviada!</h2>
        <p className="mx-auto mt-2 max-w-sm text-[15px] text-[#0B1A12]/60">A Quark vai falar com {done}. Acompanhe o andamento na aba Indicações.</p>
        <div className="mt-6 grid gap-2.5">
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setTimeout(() => nameRef.current?.focus(), 50);
            }}
            className="h-13 rounded-2xl bg-[#0B1A12] text-[15px] font-bold text-white"
          >
            Indicar outro cliente
          </button>
          <button type="button" onClick={goHistory} className="h-12 rounded-2xl text-[14px] font-semibold text-[#0B1A12]/65">
            Ver minhas indicações
          </button>
        </div>
      </section>
    );

  return (
    <form onSubmit={submit} noValidate className={cx(CARD, "mx-auto mt-5 max-w-xl p-6")}>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF6EC] px-3 py-1 text-[11px] font-bold tracking-[0.12em] text-[#1F9D55] uppercase">
        <Gift className="h-3.5 w-3.5" /> Nova indicação
      </span>
      <h2 className="mt-3 text-[25px] leading-tight font-extrabold tracking-[-0.03em]">Quem está interessado?</h2>
      <p className="mt-1 text-[14px] text-[#0B1A12]/55">A Quark entra em contato e você acompanha tudo por aqui.</p>
      <label htmlFor="sr-name" className="mt-5 block text-[13px] font-semibold text-[#0B1A12]/70">
        Nome do cliente
      </label>
      <input id="sr-name" ref={nameRef} value={f.name} maxLength={120} autoComplete="off" onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nome e sobrenome" className={FIELD} />
      <label htmlFor="sr-phone" className="mt-4 block text-[13px] font-semibold text-[#0B1A12]/70">
        WhatsApp do cliente
      </label>
      <input id="sr-phone" inputMode="tel" value={f.phone} autoComplete="off" onChange={(e) => setF({ ...f, phone: maskPhone(e.target.value) })} placeholder="(82) 9 0000-0000" className={cx(FIELD, "tabular-nums")} />
      <p className="mt-4 text-[13px] font-semibold text-[#0B1A12]/70">Modelo de interesse (opcional)</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {[...models.map((m) => m.name), "Ainda não sabe"].map((n) => {
          const on = f.model === n;
          return (
            <button key={n} type="button" aria-pressed={on} onClick={() => setF({ ...f, model: on ? "" : n })} className={cx("h-10 rounded-full px-4 text-[13.5px] font-semibold ring-1 transition", on ? "bg-[#0B1A12] text-white ring-[#0B1A12]" : "bg-white text-[#0B1A12]/70 ring-[#0B1A12]/12")}>
              {n}
            </button>
          );
        })}
      </div>
      <label htmlFor="sr-notes" className="mt-4 block text-[13px] font-semibold text-[#0B1A12]/70">
        Observações (opcional)
      </label>
      <textarea id="sr-notes" rows={2} maxLength={600} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Ex.: quer pagar no cartão, prefere ligação à tarde" className={cx(FIELD, "h-auto resize-none py-3")} />
      <div aria-live="polite">{err && <p className="mt-4 rounded-2xl bg-[#FDECEA] px-4 py-3 text-[13.5px] text-[#A12A17]">{err}</p>}</div>
      <button type="submit" disabled={busy} className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0B1A12] text-[16px] font-bold text-white disabled:opacity-70">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Enviar indicação <ArrowRight className="h-5 w-5" /></>}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ histórico */

function History({ referrals, stats, goRefer }: { referrals: Referral[]; stats: { total: number; open: number; closed: number; toReceive: number; received: number }; goRefer: () => void }) {
  const [filter, setFilter] = useState<"todas" | "andamento" | "fechadas">("todas");
  const list = referrals.filter((r) => (filter === "todas" ? true : filter === "fechadas" ? r.status === "fechada" : r.status !== "fechada" && r.status !== "perdida"));
  return (
    <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-4">
      <section className="grid grid-cols-2 gap-3">
        <div className={cx(CARD, "p-4")}>
          <p className="text-[12px] font-bold tracking-[0.1em] text-[#0B1A12]/50 uppercase">A receber</p>
          <p className="mt-1 text-[24px] font-extrabold tabular-nums">{brl(stats.toReceive)}</p>
        </div>
        <div className={cx(CARD, "p-4")}>
          <p className="text-[12px] font-bold tracking-[0.1em] text-[#0B1A12]/50 uppercase">Já recebido</p>
          <p className="mt-1 text-[24px] font-extrabold tabular-nums">{brl(stats.received)}</p>
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["todas", `Todas · ${stats.total}`],
            ["andamento", `Em andamento · ${stats.open}`],
            ["fechadas", `Fechadas · ${stats.closed}`],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} className={cx("h-10 rounded-full px-4 text-[13.5px] font-semibold ring-1", filter === id ? "bg-[#0B1A12] text-white ring-[#0B1A12]" : "bg-white text-[#0B1A12]/65 ring-[#0B1A12]/10")}>
            {label}
          </button>
        ))}
      </div>
      {list.length ? (
        <ul className="grid gap-2.5">
          {list.map((r) => (
            <li key={r.id} className={cx(CARD, "flex flex-wrap items-center gap-3 p-4")}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#EEF7EF] text-[15px] font-bold text-[#1F7A45]">{r.name.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15.5px] font-semibold">{r.name}</p>
                <p className="text-[12.5px] text-[#0B1A12]/55">
                  {maskPhone(r.phone)}
                  {r.model ? ` · ${r.model}` : ""} · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="text-right">
                <span className={cx("rounded-full px-2.5 py-1 text-[12px] font-bold", STATUS[r.status].cls)}>{STATUS[r.status].label}</span>
                {r.status === "fechada" && r.commission ? (
                  <p className="mt-1 text-[12.5px] font-semibold">
                    {brl(Number(r.commission))} · <span className={r.paid ? "text-[#1F7A45]" : "text-[#8A6100]"}>{r.paid ? "pago" : "a receber"}</span>
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <section className={cx(CARD, "p-7 text-center")}>
          <Users className="mx-auto h-8 w-8 text-[#0B1A12]/30" />
          <p className="mt-3 text-[16px] font-semibold">{referrals.length ? "Nada neste filtro." : "Você ainda não fez indicações."}</p>
          <button type="button" onClick={goRefer} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-[#0B1A12] px-5 text-[14px] font-bold text-white">
            <Send className="h-4 w-4" /> Fazer uma indicação
          </button>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ perfil */

function Profile({ seller, link, creds, whatsapp, onPhoto }: { seller: Seller; link: string; creds: { phone: string; pin: string }; whatsapp: string | null; onPhoto: (photo: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const wa = digits(whatsapp ?? "");

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const photo = await toPortrait(file);
      const j = await call({ action: "photo", ...creds, photo });
      if (!j.ok) return setMsg({ ok: false, t: ERRORS[j.error ?? ""] ?? "Não foi possível salvar a foto." });
      onPhoto(photo);
      setMsg({ ok: true, t: "Foto salva." });
    } catch {
      setMsg({ ok: false, t: "Não foi possível usar essa foto. Tente outra." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="mx-auto mt-5 grid max-w-xl grid-cols-[minmax(0,1fr)] gap-4">
      <section className={cx(CARD, "p-6")}>
        <div className="flex items-center gap-5">
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="relative h-[136px] w-[102px] shrink-0 overflow-hidden rounded-2xl bg-[#F1F4EF] ring-1 ring-[#0B1A12]/10" aria-label="Trocar foto">
            {seller.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.photo} alt={`Foto de ${seller.name}`} className="h-full w-full object-cover" />
            ) : (
              <UserRound className="mx-auto h-10 w-10 text-[#0B1A12]/30" />
            )}
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-[#0B1A12]/70 py-1.5 text-[11.5px] font-semibold text-white">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} Foto 3/4
            </span>
          </button>
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <div className="min-w-0">
            <p className="text-[21px] leading-tight font-extrabold tracking-[-0.02em] break-words">{seller.name}</p>
            <p className="mt-1 text-[14px] text-[#0B1A12]/60 tabular-nums">{maskPhone(seller.phone)}</p>
            {seller.city && <p className="text-[14px] text-[#0B1A12]/60">{seller.city}</p>}
            <p className="mt-2 text-[12.5px] text-[#0B1A12]/45">Parceiro desde {new Date(seller.since).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
          </div>
        </div>
        {msg && <p className={cx("mt-4 rounded-2xl px-4 py-3 text-[13.5px]", msg.ok ? "bg-[#EAF6EC] text-[#1F7A45]" : "bg-[#FDECEA] text-[#A12A17]")}>{msg.t}</p>}
        <p className="mt-4 text-[13px] text-[#0B1A12]/55">Sua foto aparece no seu link de divulgação, para o cliente saber quem vai atendê-lo.</p>
      </section>
      <section className={cx(CARD, "p-6")}>
        <Row k="Código do seu link" v={seller.ref} />
        <Row k="Comissão" v={seller.commission || "combinada com a Quark"} />
        {seller.instagram && <Row k="Instagram" v={`@${seller.instagram.replace(/^@/, "")}`} />}
        <Row k="Seu link" v={link} small />
      </section>
      <section className={cx(CARD, "flex items-center gap-4 p-5")}>
        <ShieldCheck className="h-7 w-7 shrink-0" style={{ color: GREEN }} />
        <p className="flex-1 text-[13.5px] text-[#0B1A12]/65">Para mudar nome, telefone ou comissão, ou para trocar o código de acesso, fale com a Quark.</p>
        {wa.length >= 10 && (
          <a href={`https://wa.me/${wa.length <= 11 ? `55${wa}` : wa}?text=${encodeURIComponent(`Olá! Sou o vendedor parceiro ${seller.name} e quero atualizar meus dados.`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#25D366] px-4 text-[13px] font-bold text-[#06210F]">
            <MessageCircle className="h-4 w-4" /> Falar
          </a>
        )}
      </section>
    </div>
  );
}

function Row({ k, v, small }: { k: string; v: ReactNode; small?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#0B1A12]/[0.06] py-3 last:border-0">
      <span className="shrink-0 text-[13.5px] text-[#0B1A12]/55">{k}</span>
      <span className={cx("min-w-0 text-right font-semibold break-all", small ? "text-[12.5px]" : "text-[15px]")}>{v}</span>
    </div>
  );
}
