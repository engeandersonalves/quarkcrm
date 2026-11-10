"use client";

import { Check, ChevronRight, ClipboardList, Loader2, MessageCircle, Plus, Search, Star, Tag, Ticket, Trash2, X, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BrandLogo } from "@/components/app/brand";
import { Glyph, type GlyphId } from "@/components/app/ios-glyphs";
import type { PublicCompany } from "@/components/capture/funnel";
import { supabase } from "@/lib/supabase/client";
import {
  KIND_LABEL,
  THEMES,
  kindOf,
  normalizeCode,
  pctText,
  quoteSummary,
  segmentOf,
  soldLabel,
  stackPct,
  totalPct,
  type Campaign,
  type CartItem,
  type Coupon,
  type StoreProduct,
} from "@/lib/store";
import { ChargerArt, MotoArt, PlaceArt } from "./art";
import { Sheet } from "./blocks";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ================================================================ estado */

interface StoreCtx {
  company: PublicCompany;
  campaign: Campaign | null;
  coupons: Coupon[];
  cart: CartItem[];
  coupon: Coupon | null;
  setCoupon: (c: Coupon | null) => void;
  has: (key: string) => boolean;
  toggle: (item: CartItem) => void;
  add: (item: CartItem) => void;
  remove: (key: string) => void;
  clear: () => void;
  open: () => void;
  extra: number;
  waLink: (text: string) => string | null;
  owner: string;
}
const Ctx = createContext<StoreCtx | null>(null);
export const useStore = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore fora do StoreProvider");
  return c;
};

const CART_KEY = "quark-loja-cotacao";
const COUPON_KEY = "quark-loja-cupom";

export function StoreProvider({ company, campaign, coupons, children }: { company: PublicCompany; campaign: Campaign | null; coupons: Coupon[]; children: ReactNode }) {
  const params = useSearchParams();
  const [owner, setOwner] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [coupon, setCouponState] = useState<Coupon | null>(null);
  const [isOpen, setOpen] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setCart(JSON.parse(raw) as CartItem[]);
      const c = localStorage.getItem(COUPON_KEY);
      if (c) setCouponState(JSON.parse(c) as Coupon);
      // Vendedor que mandou o link (?v=) fica guardado na navegação entre produtos
      const v = params.get("v");
      if (v) localStorage.setItem("quark-loja-vendedor", v);
      setOwner(v ?? localStorage.getItem("quark-loja-vendedor") ?? "");
    } catch {
      /* navegação privada */
    }
    loaded.current = true;
  }, [params]);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      if (coupon) localStorage.setItem(COUPON_KEY, JSON.stringify(coupon));
      else localStorage.removeItem(COUPON_KEY);
    } catch {
      /* navegação privada */
    }
  }, [cart, coupon]);

  const wa = (company.whatsapp ?? "").replace(/\D/g, "");
  const waLink = useCallback((text: string) => (wa ? `https://wa.me/${wa.length <= 11 ? `55${wa}` : wa}?text=${encodeURIComponent(text)}` : null), [wa]);
  const live = campaign && new Date(campaign.ends_at).getTime() > Date.now() ? campaign : null;

  const value: StoreCtx = {
    company,
    campaign: live,
    coupons,
    cart,
    coupon,
    setCoupon: setCouponState,
    has: (key) => cart.some((c) => c.key === key),
    toggle: (item) => setCart((c) => (c.some((x) => x.key === item.key) ? c.filter((x) => x.key !== item.key) : [...c, item])),
    add: (item) => setCart((c) => [...c.filter((x) => x.key !== item.key), item]),
    remove: (key) => setCart((c) => c.filter((x) => x.key !== key)),
    clear: () => setCart([]),
    open: () => setOpen(true),
    extra: live?.extra_pct ?? 0,
    waLink,
    owner,
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="theme-dark ios-app text-white">
        <CartSheet open={isOpen} onClose={() => setOpen(false)} />
      </div>
    </Ctx.Provider>
  );
}

/** Item da cotação a partir de um produto. */
export function itemOf(p: StoreProduct, extra: number): CartItem {
  const detail = p.specs.slice(0, 2).map((s) => s.value).join(" · ") || p.subtitle || "";
  return { key: `p:${p.id}`, kind: kindOf(p.category), title: p.name, detail, pct: totalPct(p.discount_pct, extra) || undefined, image: p.images[0] };
}

/* ============================================================ imagens */

const MATERIAL_GLYPH: Record<string, GlyphId> = { cabos: "integracao", disjuntores: "engrenagem", dps: "alerta", quadros: "painel", conectores: "plugue", aterramento: "raio", eletrodutos: "codigo", iluminacao: "sol" };
const SERVICE_GLYPH: Record<string, GlyphId> = { projeto: "propostas", homologacao: "documentos", limpeza: "chave", monitoramento: "sol", ampliacao: "relatorios", condominio: "plugue", gestao: "integracao", laudo: "alerta" };

/** Foto do produto ou, sem foto, uma ilustração do tipo de produto. */
export function ProductImage({ p, className, index = 0 }: { p: StoreProduct; className?: string; index?: number }) {
  const src = p.images[index];
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={p.name} loading="lazy" className={cx("h-full w-full object-cover", className)} />;
  const slug = p.id.split("-").slice(1).join("-");
  let art: ReactNode;
  if (p.category === "kit") art = <PlaceArt place={/off/.test(p.id) || /bateria/i.test(p.badge ?? "") ? "offgrid" : (p.place ?? "casa")} className="h-full w-full" />;
  else if (p.category === "carregador") art = <ChargerArt kind={/dc|rápido/i.test(`${p.name} ${p.badge ?? ""}`) ? "DC" : "AC"} className="h-[78%] w-[78%]" />;
  else if (p.category === "moto") {
    const id = /urbana/i.test(p.name) ? "m-urb" : /city/i.test(p.name) ? "m-city" : /sport/i.test(p.name) ? "m-sport" : /cargo/i.test(p.name) ? "m-cargo" : "m-urb";
    art = <MotoArt id={id} className="h-[86%] w-[92%]" />;
  } else {
    const g = (p.category === "material" ? MATERIAL_GLYPH : SERVICE_GLYPH)[slug] ?? (p.category === "material" ? "pacote" : "chave");
    art = (
      <span className="ios-tile h-[46%] w-[46%] rounded-[22%]">
        <Glyph id={g} className="relative h-[58%] w-[58%] drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
      </span>
    );
  }
  return <div className={cx("grid h-full w-full place-items-center bg-[radial-gradient(120%_90%_at_50%_0%,#2a2a2e,#0b0b0c_70%)]", className)}>{art}</div>;
}

/* ========================================================= peças */

export function OffBadge({ pct, className, big }: { pct: number; className?: string; big?: boolean }) {
  if (!pct) return null;
  return (
    <span className={cx("inline-flex items-center rounded-[8px] bg-[#FF3B30] font-extrabold text-white tabular-nums shadow-[0_4px_14px_-4px_rgba(255,59,48,0.8)]", big ? "px-2.5 py-1 text-[15px]" : "px-1.5 py-0.5 text-[12px]", className)}>
      -{pct}%
    </span>
  );
}

export function Stars({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-[1px]">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(value) ? "fill-[#FFD60A] text-[#FFD60A]" : "fill-white/15 text-white/15"} />
      ))}
    </span>
  );
}

/** Cartão de produto (vitrine). */
export function ProductCard({ p, compact }: { p: StoreProduct; compact?: boolean }) {
  const { extra, has, toggle } = useStore();
  const pct = totalPct(p.discount_pct, extra);
  const key = `p:${p.id}`;
  const on = has(key);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[22px] bg-[#1C1C1E] transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,1)]">
      <Link href={`/loja/p/${p.id}`} className="relative block aspect-square overflow-hidden">
        <ProductImage p={p} className="transition duration-500 group-hover:scale-[1.04]" />
        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1">
          <OffBadge pct={pct} />
          {p.badge && <span className="rounded-[8px] bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-[#F3EA3B] backdrop-blur">{p.badge}</span>}
        </div>
        {p.flash && (
          <span className="absolute top-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-full bg-[#FF9F0A] text-black shadow-lg">
            <Zap className="h-4 w-4 fill-black" />
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
        <Link href={`/loja/p/${p.id}`} className={cx("text-[14px] leading-snug font-medium text-white", compact ? "line-clamp-2" : "line-clamp-2 sm:text-[15px]")}>
          {p.name}
        </Link>
        {!compact && p.subtitle && <p className="mt-0.5 line-clamp-1 text-[12px] text-[#8E8E93]">{p.subtitle}</p>}
        {p.sold > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#8E8E93]">
            {p.rating > 0 && <Stars value={p.rating} size={11} />}
            <span>{soldLabel(p.sold)}</span>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {pct > 0 ? (
            <span className="text-[13px] font-bold text-[#FF453A]">{pct}% OFF na cotação</span>
          ) : (
            <span className="text-[13px] font-semibold text-[#9BD373]">Cotação grátis</span>
          )}
        </div>
        <button
          onClick={() => toggle(itemOf(p, extra))}
          className={cx(
            "mt-auto flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition active:scale-[0.97]",
            "mt-3",
            on ? "bg-[#30D158]/15 text-[#30D158]" : "bg-[#F3EA3B] text-black hover:brightness-105",
          )}
        >
          {on ? <Check className="h-4 w-4" strokeWidth={3} /> : <Plus className="h-4 w-4" strokeWidth={3} />}
          {on ? "Na cotação" : "Pedir cotação"}
        </button>
      </div>
    </article>
  );
}

/* ====================================================== contagem regressiva */

function useNow(ms = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function Countdown({ to, className, light }: { to: string; className?: string; light?: boolean }) {
  const now = useNow();
  const left = now === null ? null : Math.max(0, new Date(to).getTime() - now);
  const parts = left === null ? ["--", "--", "--", "--"] : [Math.floor(left / 86400000), Math.floor(left / 3600000) % 24, Math.floor(left / 60000) % 60, Math.floor(left / 1000) % 60].map((n) => String(n).padStart(2, "0"));
  const showDays = parts[0] !== "00" && parts[0] !== "--";
  return (
    <span className={cx("inline-flex items-center gap-1 font-mono tabular-nums", className)} aria-label="Tempo restante da oferta">
      {(showDays ? parts : parts.slice(1)).map((v, i, a) => (
        <span key={i} className="inline-flex items-center gap-1">
          <span className={cx("grid min-w-[26px] place-items-center rounded-[6px] px-1 py-0.5 text-[13px] font-bold", light ? "bg-[#fff] text-black" : "bg-black text-white")}>
            {v}
            {showDays && i === 0 ? "d" : ""}
          </span>
          {i < a.length - 1 && <span className="font-bold opacity-70">:</span>}
        </span>
      ))}
    </span>
  );
}

/** Faixa da campanha no topo (Black Friday, Natal…). */
export function CampaignStrip() {
  const { campaign } = useStore();
  if (!campaign) return null;
  const t = THEMES[campaign.theme] ?? THEMES.custom;
  return (
    <div className="relative overflow-hidden" style={{ background: `linear-gradient(90deg, ${t.from}, ${t.to})` }}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-x-3 gap-y-1 px-4 py-2 text-[12px] font-semibold sm:text-[13px]">
        <span className="flex items-center gap-2" style={{ color: t.ink }}>
          <span className="rounded-[6px] px-1.5 py-0.5 text-[11px] font-black tracking-[0.08em] whitespace-nowrap text-black" style={{ background: t.ink }}>
            {t.tag}
          </span>
          <span className="hidden text-white sm:inline">{campaign.title}</span>
          {campaign.extra_pct > 0 && <span className="whitespace-nowrap text-white">+{campaign.extra_pct}% OFF</span>}
        </span>
        <span className="flex items-center gap-2 text-white">
          <span className="hidden sm:inline">Termina em</span>
          <Countdown to={campaign.ends_at} light />
        </span>
      </div>
    </div>
  );
}

/** Cupom em formato de ticket. */
export function CouponTicket({ c }: { c: Coupon }) {
  const { coupon, setCoupon } = useStore();
  const on = coupon?.code === c.code;
  return (
    <div className="relative flex h-[84px] w-[230px] shrink-0 overflow-hidden rounded-[14px] bg-gradient-to-r from-[#FF453A] to-[#FF9F0A] text-white">
      <div className="flex w-[78px] flex-col items-center justify-center border-r-2 border-dashed border-white/50">
        <span className="text-[24px] leading-none font-black">{c.discount_pct}%</span>
        <span className="text-[11px] font-bold">OFF</span>
      </div>
      <span className="absolute top-1/2 left-[71px] h-3.5 w-3.5 -translate-y-[calc(50%+42px)] rounded-full bg-black" />
      <span className="absolute top-1/2 left-[71px] h-3.5 w-3.5 translate-y-[calc(-50%+42px)] rounded-full bg-black" />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3">
        <p className="truncate font-mono text-[14px] font-extrabold tracking-wide">{c.code}</p>
        <p className="line-clamp-1 text-[11px] text-white/85">{c.description || "Em toda a cotação"}</p>
        <button onClick={() => setCoupon(on ? null : c)} className={cx("h-7 self-start rounded-full px-3 text-[12px] font-bold", on ? "bg-black/30 text-white" : "bg-[#fff] text-[#FF3B30]")}>
          {on ? "✓ Aplicado" : "Pegar cupom"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================== topo */

export function StoreHeader({ query, onQuery }: { query?: string; onQuery?: (q: string) => void }) {
  const { cart, open, company } = useStore();
  const router = useRouter();
  const [q, setQ] = useState(query ?? "");
  useEffect(() => setQ(query ?? ""), [query]);
  const submit = () => (onQuery ? onQuery(q) : router.push(`/loja${q ? `?q=${encodeURIComponent(q)}` : ""}#resultados`));
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/85 backdrop-blur-2xl backdrop-saturate-150">
      <CampaignStrip />
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-5 sm:px-6">
        <Link href="/loja" className="flex shrink-0 items-end gap-1.5" aria-label={company.company_name || "Loja"}>
          <BrandLogo className="h-7 sm:h-8" />
          <span className="mb-0.5 hidden rounded-full bg-[#F3EA3B] px-1.5 py-0.5 text-[9px] font-black tracking-[0.12em] text-black sm:inline">LOJA</span>
        </Link>
        <form
          className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-[#1C1C1E] pr-1 pl-4 ring-1 ring-white/[0.06] focus-within:ring-[#F3EA3B]/60"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Search className="h-4 w-4 shrink-0 text-[#8E8E93]" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              onQuery?.(e.target.value);
            }}
            placeholder="Buscar kits, motos, carregadores…"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-[#6C6C70] outline-none"
            enterKeyHint="search"
          />
          <button className="hidden h-8 rounded-full bg-[#F3EA3B] px-4 text-[13px] font-bold text-black sm:block">Buscar</button>
        </form>
        <button onClick={open} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1C1C1E] sm:w-auto sm:gap-2 sm:px-4 sm:[display:flex]" aria-label="Minha cotação">
          <ClipboardList className="h-5 w-5" />
          <span className="hidden text-[14px] font-semibold sm:inline">Minha cotação</span>
          {cart.length > 0 && <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#FF3B30] px-1 text-[11px] font-bold text-white tabular-nums sm:static">{cart.length}</span>}
        </button>
      </div>
    </header>
  );
}

/* ========================================================== cotação */

function CartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cart, remove, clear, coupon, setCoupon, campaign, owner, waLink, coupons } = useStore();
  const [form, setForm] = useState({ name: "", phone: "", city: "", email: "", notes: "", website: "" });
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const opened = useRef(Date.now());
  useEffect(() => {
    if (open) opened.current = Date.now();
  }, [open]);

  const best = useMemo(() => cart.reduce((m, i) => Math.max(m, i.pct ?? 0), 0), [cart]);
  const valid = form.name.trim().length >= 2 && form.phone.replace(/\D/g, "").length >= 10 && cart.length > 0;

  const apply = async () => {
    const c = normalizeCode(code);
    if (!c) return;
    setChecking(true);
    setCodeMsg("");
    try {
      const { data, error } = await supabase().rpc("store_check_coupon", { p_code: c });
      if (error || !data) setCodeMsg("Cupom inválido ou expirado.");
      else {
        setCoupon(data as Coupon);
        setCode("");
      }
    } catch {
      setCodeMsg("Não foi possível conferir agora.");
    } finally {
      setChecking(false);
    }
  };

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setError("");
    const summary = quoteSummary(cart, form.notes.trim(), coupon, campaign?.name ?? null);
    try {
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          city: form.city.trim(),
          email: form.email.trim(),
          notes: summary,
          segment: segmentOf(cart),
          source: "Loja online",
          temperature: "quente",
          owner,
          website: form.website,
          elapsed: Date.now() - opened.current,
        }),
      });
      if (!res.ok) throw new Error();
      if (coupon) void supabase().rpc("store_use_coupon", { p_code: coupon.code });
      setDone(summary);
      clear();
      setCoupon(null);
    } catch {
      setError("Não conseguimos enviar agora. Tente de novo ou chame no WhatsApp.");
    } finally {
      setBusy(false);
    }
  };

  const input = "h-12 w-full rounded-[14px] bg-[rgba(118,118,128,0.18)] px-4 text-[16px] text-white placeholder:text-[#6C6C70] outline-none focus:ring-2 focus:ring-[#F3EA3B]/60";

  if (done) {
    const link = waLink(`Olá! Acabei de pedir uma cotação pela loja online.\n\n${done}\n\nMeu nome: ${form.name}`);
    return (
      <Sheet open={open} onClose={() => { setDone(null); onClose(); }} title="">
        <div className="pb-2 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#30D158]/15" style={{ animation: "ios-bounce .5s both" }}>
            <Check className="h-10 w-10 text-[#30D158]" strokeWidth={3} />
          </div>
          <p className="mt-5 text-[26px] font-bold tracking-tight">Pedido enviado!</p>
          <p className="mx-auto mt-2 max-w-sm text-[15px] text-[#AEAEB2]">Seu desconto está garantido. Um consultor vai falar com você em breve pelo WhatsApp {form.phone}.</p>
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#30D158] text-[16px] font-semibold text-black">
              <MessageCircle className="h-5 w-5" /> Adiantar pelo WhatsApp
            </a>
          )}
          <button onClick={() => { setDone(null); onClose(); }} className="mt-2 h-12 w-full rounded-full bg-[#2C2C2E] text-[15px] font-semibold">
            Continuar navegando
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Minha cotação"
      footer={
        cart.length > 0 && (
          <>
            {error && <p className="mb-2 text-center text-[13px] text-[#FF453A]">{error}</p>}
            <button onClick={submit} disabled={!valid || busy} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#F3EA3B] text-[16px] font-bold text-black transition disabled:opacity-40">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Tag className="h-5 w-5" />}
              Garantir meu desconto
            </button>
            <p className="mt-2 text-center text-[12px] text-[#6C6C70]">Cotação grátis e sem compromisso. Um consultor envia o valor final.</p>
          </>
        )
      }
    >
      {cart.length === 0 ? (
        <div className="py-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/[0.06]">
            <ClipboardList className="h-8 w-8 text-[#8E8E93]" />
          </div>
          <p className="mt-4 text-[17px] font-semibold">Sua cotação está vazia</p>
          <p className="mt-1 text-[14px] text-[#8E8E93]">Toque em “Pedir cotação” nos produtos que você quer.</p>
          <button onClick={onClose} className="mt-5 h-11 rounded-full bg-[#fff] px-6 text-[15px] font-semibold text-black">
            Ver ofertas
          </button>
        </div>
      ) : (
        <>
          <ul className="overflow-hidden rounded-[20px] bg-[#2C2C2E]/60">
            {cart.map((c, i) => (
              <li key={c.key} className="relative flex items-center gap-3 px-3 py-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-black">
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Tag className="h-5 w-5 text-[#636366]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold tracking-[0.04em] text-[#8E8E93] uppercase">{KIND_LABEL[c.kind]}</p>
                  <p className="line-clamp-2 text-[14px] leading-snug font-semibold">{c.title}</p>
                  {(c.pct || coupon) && (
                    <p className="mt-0.5 text-[12px] font-bold text-[#FF453A]">
                      {pctText(coupon ? stackPct(c.pct ?? 0, coupon.discount_pct) : (c.pct ?? 0))}% OFF{coupon ? " com cupom" : ""}
                    </p>
                  )}
                </div>
                <button onClick={() => remove(c.key)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#FF453A] hover:bg-[#FF453A]/10" aria-label={`Remover ${c.title}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
                {i < cart.length - 1 && <span className="absolute right-0 bottom-0 left-[76px] h-[0.5px] bg-white/[0.1]" />}
              </li>
            ))}
          </ul>

          {/* cupom */}
          <div className="mt-4 rounded-[20px] bg-[#2C2C2E]/60 p-3">
            {coupon ? (
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-gradient-to-br from-[#FF453A] to-[#FF9F0A]">
                  <Ticket className="h-5 w-5 text-white" />
                </span>
                <div className="flex-1">
                  <p className="font-mono text-[15px] font-bold">{coupon.code}</p>
                  <p className="text-[12px] text-[#30D158]">+{coupon.discount_pct}% OFF aplicado</p>
                </div>
                <button onClick={() => setCoupon(null)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10" aria-label="Remover cupom">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input value={code} onChange={(e) => setCode(normalizeCode(e.target.value))} placeholder="Tem um cupom?" className={cx(input, "h-11 font-mono uppercase")} onKeyDown={(e) => e.key === "Enter" && apply()} />
                  <button onClick={apply} disabled={!code || checking} className="h-11 shrink-0 rounded-[14px] bg-[#fff] px-4 text-[14px] font-bold text-black disabled:opacity-40">
                    {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
                  </button>
                </div>
                {codeMsg && <p className="mt-1.5 text-[12px] text-[#FF453A]">{codeMsg}</p>}
                {coupons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {coupons.slice(0, 3).map((c) => (
                      <button key={c.code} onClick={() => setCoupon(c)} className="rounded-full bg-[#FF453A]/15 px-2.5 py-1 font-mono text-[12px] font-bold text-[#FF6961]">
                        {c.code} · {c.discount_pct}%
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {(best > 0 || coupon) && (
            <div className="mt-3 flex items-center justify-between rounded-[16px] bg-[#FF453A]/10 px-4 py-3">
              <span className="text-[14px] text-[#FFB3AE]">Desconto garantido de até</span>
              <span className="text-[20px] font-black text-[#FF453A]">{pctText(stackPct(best, coupon?.discount_pct ?? 0))}% OFF</span>
            </div>
          )}

          <p className="mt-6 mb-2 text-[13px] font-semibold tracking-[0.04em] text-[#8E8E93] uppercase">Seus dados</p>
          <div className="grid gap-2.5">
            <input className={input} placeholder="Seu nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
            <input className={input} placeholder="WhatsApp com DDD" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
            <div className="grid grid-cols-2 gap-2.5">
              <input className={input} placeholder="Cidade" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} autoComplete="address-level2" />
              <input className={input} placeholder="E-mail (opcional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
            </div>
            <textarea
              className={cx(input, "h-24 resize-none py-3")}
              placeholder={cart.some((c) => c.kind === "material") ? "Quantidades e medidas dos materiais, melhor horário…" : "Algo que devemos saber? Melhor horário para contato…"}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <input tabIndex={-1} autoComplete="off" className="hidden" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} aria-hidden />
          </div>
        </>
      )}
    </Sheet>
  );
}

/** Barra flutuante "Minha cotação" (celular e computador). */
export function FloatingCart() {
  const { cart, open, coupon } = useStore();
  const best = cart.reduce((m, i) => Math.max(m, i.pct ?? 0), 0);
  if (!cart.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <button onClick={open} className="liquid-glass pointer-events-auto mx-auto flex h-[62px] w-full max-w-md items-center gap-3 rounded-full pr-2 pl-5 text-left">
        <ClipboardList className="h-5 w-5 text-[#F3EA3B]" />
        <span className="flex-1">
          <span className="block text-[15px] font-semibold">
            {cart.length} {cart.length === 1 ? "item" : "itens"} na cotação
          </span>
          {(best > 0 || coupon) && <span className="block text-[12px] font-semibold text-[#FF6961]">até {pctText(stackPct(best, coupon?.discount_pct ?? 0))}% OFF garantido</span>}
        </span>
        <span className="inline-flex h-12 items-center gap-1 rounded-full bg-[#F3EA3B] px-5 text-[15px] font-bold text-black">
          Finalizar <ChevronRight className="h-4 w-4" />
        </span>
      </button>
    </div>
  );
}
