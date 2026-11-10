"use client";

import { ArrowRight, BadgeCheck, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, HandCoins, Home, Leaf, Shield, ShieldCheck, TrendingUp, Truck, Wrench, Zap, type LucideIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BrandLogo } from "@/components/app/brand";
import { GlyphTile, type GlyphId } from "@/components/app/ios-glyphs";
import type { PublicCompany } from "@/components/capture/funnel";
import { BENEFITS, CATEGORIES, FAQ, STEPS, THEMES, WARRANTIES, totalPct, type Campaign, type Category, type Coupon, type Place, type StoreProduct } from "@/lib/store";
import { PlaceArt } from "./art";
import { Builder, SavingsChart, Tile } from "./blocks";
import { CouponTicket, Countdown, FloatingCart, ProductCard, ProductImage, StoreHeader, StoreProvider, cx, useStore } from "./kit";
import Link from "next/link";

type Filter = { cat: Category | "ofertas" | null; place: Place | null };

const BUBBLES: { id: string; label: string; glyph: GlyphId; f: Filter | "monte" }[] = [
  { id: "ofertas", label: "Ofertas", glyph: "estrela", f: { cat: "ofertas", place: null } },
  { id: "casa", label: "Casa", glyph: "painel", f: { cat: "kit", place: "casa" } },
  { id: "comercio", label: "Comércio", glyph: "propostas", f: { cat: "kit", place: "comercio" } },
  { id: "rural", label: "Rural", glyph: "sol", f: { cat: "kit", place: "rural" } },
  { id: "monte", label: "Monte o seu", glyph: "calculadora", f: "monte" },
  { id: "carregador", label: "Eletropostos", glyph: "plugue", f: { cat: "carregador", place: null } },
  { id: "moto", label: "Motos", glyph: "raio", f: { cat: "moto", place: null } },
  { id: "material", label: "Material", glyph: "pacote", f: { cat: "material", place: null } },
  { id: "servico", label: "Serviços", glyph: "chave", f: { cat: "servico", place: null } },
];

const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

export function Shop(props: { company: PublicCompany; products: StoreProduct[]; campaign: Campaign | null; coupons: Coupon[] }) {
  return (
    <StoreProvider company={props.company} campaign={props.campaign} coupons={props.coupons}>
      <ShopInner {...props} />
    </StoreProvider>
  );
}

function ShopInner({ company, products }: { company: PublicCompany; products: StoreProduct[] }) {
  const params = useSearchParams();
  const { extra, campaign, coupons, add, open } = useStore();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [filter, setFilter] = useState<Filter>({ cat: null, place: null });
  const tariff = company.tariff && company.tariff > 0 ? company.tariff : 0.95;
  const sun = company.sunHours && company.sunHours > 0 ? company.sunHours : 5.2;

  useEffect(() => {
    const c = params.get("cat");
    if (c && (c === "ofertas" || CATEGORIES.some((x) => x.id === c))) setFilter({ cat: c as Filter["cat"], place: null });
  }, [params]);

  const offers = useMemo(() => [...products].filter((p) => p.flash || totalPct(p.discount_pct, extra) > 0).sort((a, b) => Number(b.flash) - Number(a.flash) || b.discount_pct - a.discount_pct), [products, extra]);
  const featured = products.filter((p) => p.featured);
  const searching = q.trim().length > 0 || filter.cat !== null;
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const results = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    return products.filter((p) => {
      if (filter.cat === "ofertas" && !(p.flash || totalPct(p.discount_pct, extra) > 0)) return false;
      if (filter.cat && filter.cat !== "ofertas" && p.category !== filter.cat) return false;
      if (filter.place && p.place !== filter.place) return false;
      const hay = norm(`${p.name} ${p.subtitle ?? ""} ${p.badge ?? ""} ${p.specs.map((s) => s.value).join(" ")} ${CATEGORIES.find((c) => c.id === p.category)?.label ?? ""}`);
      return terms.every((t) => hay.includes(t));
    });
  }, [products, q, filter, extra]);

  const pick = (b: (typeof BUBBLES)[number]) => {
    if (b.f === "monte") return go("monte");
    setFilter(b.f);
    setTimeout(() => go("resultados"), 30);
  };

  const label = filter.cat === "ofertas" ? "Ofertas" : filter.cat ? `${CATEGORIES.find((c) => c.id === filter.cat)?.label}${filter.place ? ` · ${filter.place === "casa" ? "Casa" : filter.place === "comercio" ? "Comércio" : "Rural"}` : ""}` : "Resultados";

  return (
    <div className="theme-dark ios-app min-h-dvh overflow-x-clip bg-black pb-28 text-white">
      <StoreHeader query={q} onQuery={(v) => { setQ(v); if (v) setTimeout(() => go("resultados"), 30); }} />

      <main className="mx-auto max-w-7xl px-3 sm:px-6">
        {/* categorias em bolinhas */}
        <nav className="scrollbar-none -mx-3 flex gap-1 overflow-x-auto px-3 pt-4 pb-2 sm:mx-0 sm:justify-between sm:px-0">
          {BUBBLES.map((b) => {
            const on = b.f !== "monte" && filter.cat === b.f.cat && filter.place === b.f.place;
            return (
              <button key={b.id} onClick={() => pick(b)} className="flex w-[74px] shrink-0 flex-col items-center gap-1.5 rounded-2xl py-1.5 transition active:scale-95 sm:w-[86px]">
                <span className={cx("rounded-[16px] p-[2px] transition", on ? "bg-gradient-to-br from-[#F3EA3B] to-[#FF9F0A]" : "bg-transparent")}>
                  <GlyphTile id={b.glyph} size="lg" className="!h-14 !w-14 !rounded-[15px]" />
                </span>
                <span className={cx("text-center text-[12px] leading-tight font-medium", on ? "text-[#F3EA3B]" : "text-[#D1D1D6]")}>{b.label}</span>
              </button>
            );
          })}
        </nav>

        {/* banner */}
        {!searching && <Hero products={featured.length ? featured : products} onMonte={() => go("monte")} onOffers={() => { setFilter({ cat: "ofertas", place: null }); setTimeout(() => go("resultados"), 30); }} />}

        {/* selos */}
        <div className="scrollbar-none -mx-3 mt-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0">
          {[
            { icon: Wrench, c: "#FF9F0A", t: "Instalação inclusa", d: "Equipe própria" },
            { icon: BadgeCheck, c: "#30D158", t: "Projeto e homologação", d: "Cuidamos de tudo" },
            { icon: ShieldCheck, c: "#F3EA3B", t: "Até 30 anos", d: "de garantia" },
            { icon: HandCoins, c: "#FF375F", t: "Financiamento", d: "Parcelas que cabem" },
          ].map((b) => (
            <div key={b.t} className="flex min-w-[170px] items-center gap-2.5 rounded-2xl bg-[#1C1C1E] px-3 py-2.5">
              <b.icon className="h-5 w-5 shrink-0" style={{ color: b.c }} />
              <div className="leading-tight">
                <p className="text-[13px] font-semibold">{b.t}</p>
                <p className="text-[11px] text-[#8E8E93]">{b.d}</p>
              </div>
            </div>
          ))}
        </div>

        {/* cupons */}
        {coupons.length > 0 && !searching && (
          <Block title="Cupons para você" sub="Pegue e use na sua cotação" icon={<span className="text-[18px]">🎟️</span>}>
            <div className="scrollbar-none -mx-3 flex gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
              {coupons.map((c) => (
                <CouponTicket key={c.code} c={c} />
              ))}
            </div>
          </Block>
        )}

        {/* resultados de busca/filtro */}
        {searching && (
          <section id="resultados" className="scroll-mt-36 pt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[22px] font-bold tracking-tight">
                {label} <span className="text-[15px] font-medium text-[#8E8E93]">({results.length})</span>
              </h2>
              <button onClick={() => { setFilter({ cat: null, place: null }); setQ(""); }} className="h-8 rounded-full bg-[#1C1C1E] px-3.5 text-[13px] font-semibold text-[#D1D1D6]">
                Limpar filtros
              </button>
            </div>
            {filter.cat === "kit" && (
              <div className="mb-4 flex gap-2">
                {([null, "casa", "comercio", "rural"] as (Place | null)[]).map((p) => (
                  <button key={String(p)} onClick={() => setFilter({ cat: "kit", place: p })} className={cx("h-8 rounded-full px-3.5 text-[13px] font-semibold", filter.place === p ? "bg-[#F3EA3B] text-black" : "bg-[#1C1C1E] text-[#D1D1D6]")}>
                    {p === null ? "Todos" : p === "casa" ? "Casa" : p === "comercio" ? "Comércio" : "Rural"}
                  </button>
                ))}
              </div>
            )}
            {results.length ? (
              <Grid>
                {results.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </Grid>
            ) : (
              <div className="rounded-[24px] bg-[#1C1C1E] px-6 py-14 text-center">
                <p className="text-[17px] font-semibold">Nada encontrado</p>
                <p className="mt-1 text-[14px] text-[#8E8E93]">Tente outra palavra ou peça uma cotação personalizada.</p>
                <button onClick={() => go("monte")} className="mt-4 h-10 rounded-full bg-[#F3EA3B] px-5 text-[14px] font-bold text-black">
                  Monte seu sistema
                </button>
              </div>
            )}
          </section>
        )}

        {/* ofertas relâmpago */}
        {!searching && offers.length > 0 && (
          <section className="mt-6 overflow-hidden rounded-[26px] bg-gradient-to-br from-[#FF453A] via-[#FF6A1A] to-[#FF9F0A] p-[1.5px]">
            <div className="rounded-[25px] bg-gradient-to-b from-[#2a0d08] to-[#120806] p-3 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                <h2 className="flex items-center gap-2 text-[20px] font-black tracking-tight italic sm:text-[24px]">
                  <Zap className="h-6 w-6 fill-[#FFD60A] text-[#FFD60A]" />
                  OFERTAS <span className="text-[#FFD60A]">RELÂMPAGO</span>
                </h2>
                <div className="flex items-center gap-3">
                  {campaign && <Countdown to={campaign.ends_at} />}
                  <button onClick={() => { setFilter({ cat: "ofertas", place: null }); setTimeout(() => go("resultados"), 30); }} className="flex items-center text-[13px] font-semibold text-[#FFB3AE]">
                    Ver todas <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="scrollbar-none -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1">
                {offers.slice(0, 12).map((p) => (
                  <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[220px]">
                    <ProductCard p={p} compact />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* mais escolhidos */}
        {!searching && featured.length > 0 && (
          <Block title="Mais escolhidos" sub="Os favoritos dos nossos clientes" icon={<span className="text-[18px]">🔥</span>}>
            <Grid>
              {featured.slice(0, 10).map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </Grid>
          </Block>
        )}

        {/* vitrines por categoria */}
        {!searching &&
          CATEGORIES.map((c) => {
            const list = products.filter((p) => p.category === c.id);
            if (!list.length) return null;
            return (
              <Block
                key={c.id}
                id={`cat-${c.id}`}
                title={c.label}
                action={
                  list.length > 5 && (
                    <button onClick={() => { setFilter({ cat: c.id, place: null }); setTimeout(() => go("resultados"), 30); }} className="flex items-center text-[13px] font-semibold text-[#F3EA3B]">
                      Ver todos ({list.length}) <ChevronRight className="h-4 w-4" />
                    </button>
                  )
                }
              >
                <div className="scrollbar-none -mx-3 flex snap-x gap-2.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-5">
                  {list.slice(0, 10).map((p, i) => (
                    <div key={p.id} className={cx("w-[46%] shrink-0 snap-start sm:w-auto", i === 4 && "sm:hidden lg:block", i >= 5 && "sm:hidden")}>
                      <ProductCard p={p} />
                    </div>
                  ))}
                </div>
              </Block>
            );
          })}

        {/* monte o seu */}
        <section id="monte" className="scroll-mt-36 pt-12">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[13px] font-bold tracking-[0.06em] text-[#F3EA3B] uppercase">Monte o seu</p>
              <h2 className="text-[26px] leading-tight font-bold tracking-tight sm:text-[34px]">Seu sistema solar em 4 toques</h2>
            </div>
          </div>
          <Builder tariff={tariff} sun={sun} initialPlace="casa" onAdd={(item) => { add({ ...item, pct: extra || undefined }); open(); }} />
        </section>

        <Persuasion company={company} />
      </main>

      <footer className="mx-auto mt-14 flex max-w-7xl flex-col items-center gap-2 px-4 text-center text-[12px] text-[#6C6C70]">
        <BrandLogo className="h-7 opacity-80" />
        <p>
          {company.company_name || "Quark Energia"}
          {company.city ? ` · ${company.city}` : ""}
          {company.instagram ? ` · ${company.instagram.startsWith("@") ? company.instagram : `@${company.instagram}`}` : ""}
        </p>
        <p className="max-w-xl">Descontos aplicados sobre a cotação feita pelo consultor. Potências e gerações são estimativas confirmadas na visita técnica. Imagens ilustrativas.</p>
      </footer>
      <FloatingCart />
    </div>
  );
}

/* ---------------------------------------------------------------- partes */

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">{children}</div>;
}

function Block({ id, title, sub, icon, action, children }: { id?: string; title: string; sub?: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-36 pt-8">
      <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
        <div>
          <h2 className="flex items-center gap-2 text-[20px] font-bold tracking-tight sm:text-[24px]">
            {icon}
            {title}
          </h2>
          {sub && <p className="text-[13px] text-[#8E8E93]">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Banner rotativo: campanha, monte o seu e produtos em destaque. */
function Hero({ products, onMonte, onOffers }: { products: StoreProduct[]; onMonte: () => void; onOffers: () => void }) {
  const { campaign, extra } = useStore();
  const maxPct = products.reduce((m, p) => Math.max(m, totalPct(p.discount_pct, extra)), 0);
  const slides: ReactNode[] = [];
  if (campaign) {
    const t = THEMES[campaign.theme] ?? THEMES.custom;
    slides.push(
      <div key="camp" className="relative h-full w-full overflow-hidden" style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}>
        {campaign.banner && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={campaign.banner} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        {!campaign.banner && (
          <>
            <div className="pointer-events-none absolute -right-20 -bottom-24 h-[420px] w-[420px] rounded-full blur-[90px]" style={{ background: `${t.ink}33` }} />
            <span className="pointer-events-none absolute right-[4%] bottom-[-18%] hidden text-[340px] leading-none font-black tracking-[-0.06em] text-transparent select-none sm:block" style={{ WebkitTextStroke: `2px ${t.ink}55` }}>
              %
            </span>
            <span className="pointer-events-none absolute top-[12%] right-[30%] hidden rotate-[-8deg] rounded-[10px] px-3 py-1 text-[22px] font-black text-black sm:block" style={{ background: t.ink }}>
              OFF
            </span>
          </>
        )}
        <div className="relative flex h-full flex-col justify-center p-6 sm:p-12 [&>*]:shrink-0">
          <span className="self-start rounded-[8px] px-2.5 py-1 text-[12px] font-black tracking-[0.14em] text-black sm:text-[14px]" style={{ background: t.ink }}>
            {t.tag}
          </span>
          <p className="mt-3 max-w-xl text-[30px] leading-[1] font-black tracking-[-0.03em] sm:text-[60px]">{campaign.title}</p>
          {campaign.subtitle && <p className="mt-2 max-w-md text-[14px] text-white/80 sm:text-[18px]">{campaign.subtitle}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {(maxPct > 0 || campaign.extra_pct > 0) && (
              <span className="text-[22px] font-black sm:text-[34px]" style={{ color: t.ink }}>
                até {Math.max(maxPct, campaign.extra_pct)}% OFF
              </span>
            )}
            <Countdown to={campaign.ends_at} light />
          </div>
          <button onClick={onOffers} className="mt-5 inline-flex h-11 items-center gap-2 self-start rounded-full px-6 text-[15px] font-bold text-black" style={{ background: t.ink }}>
            Ver ofertas <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>,
    );
  }
  slides.push(
    <div key="monte" className="relative h-full w-full overflow-hidden bg-[#0b0b0c]">
      <PlaceArt place="casa" className="absolute inset-y-0 right-0 h-full w-full opacity-90 sm:w-[60%]" />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
      <div className="relative flex h-full flex-col justify-center p-6 sm:p-12 [&>*]:shrink-0">
        <p className="text-[13px] font-bold tracking-[0.1em] text-[#9BD373] uppercase">Energia solar</p>
        <p className="mt-2 max-w-lg text-[30px] leading-[1.02] font-black tracking-[-0.03em] sm:text-[56px]">
          Conta de luz
          <br />
          <span className="bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] bg-clip-text text-transparent">até 95% menor</span>
        </p>
        <p className="mt-2 max-w-md text-[14px] text-white/75 sm:text-[17px]">Monte seu sistema em 1 minuto e receba a cotação com desconto.</p>
        <button onClick={onMonte} className="mt-5 inline-flex h-11 items-center gap-2 self-start rounded-full bg-[#F3EA3B] px-6 text-[15px] font-bold text-black">
          Monte o seu <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>,
  );
  for (const p of products.slice(0, 3)) {
    const pct = totalPct(p.discount_pct, extra);
    slides.push(
      <Link key={p.id} href={`/loja/p/${p.id}`} className="relative block h-full w-full overflow-hidden bg-[#0b0b0c]">
        <div className="absolute inset-y-0 right-0 w-full sm:w-[55%]">
          <ProductImage p={p} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-transparent" />
        <div className="relative flex h-full flex-col justify-center p-6 sm:p-12 [&>*]:shrink-0">
          {p.badge && <span className="self-start rounded-[8px] bg-[#F3EA3B] px-2 py-0.5 text-[12px] font-black text-black">{p.badge}</span>}
          <p className="mt-3 max-w-md text-[26px] leading-[1.05] font-black tracking-[-0.03em] sm:text-[46px]">{p.name}</p>
          {p.subtitle && <p className="mt-2 max-w-sm text-[14px] text-white/75 sm:text-[17px]">{p.subtitle}</p>}
          {pct > 0 && <p className="mt-3 text-[24px] font-black text-[#FF453A] sm:text-[32px]">{pct}% OFF</p>}
          <span className="mt-4 inline-flex h-11 items-center gap-2 self-start rounded-full bg-[#fff] px-6 text-[15px] font-bold text-black">
            Ver detalhes <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </Link>,
    );
  }

  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % slides.length), 5500);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  return (
    <div className="relative mt-2 h-[300px] overflow-hidden rounded-[26px] sm:h-[400px]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)}>
      <div className="flex h-full transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)]" style={{ transform: `translateX(-${i * 100}%)` }}>
        {slides.map((s, k) => (
          <div key={k} className="h-full w-full shrink-0" aria-hidden={k !== i}>
            {s}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <>
          <button onClick={() => setI((i - 1 + slides.length) % slides.length)} className="liquid-glass absolute top-1/2 left-3 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full sm:grid" aria-label="Anterior">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => setI((i + 1) % slides.length)} className="liquid-glass absolute top-1/2 right-3 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full sm:grid" aria-label="Próximo">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {slides.map((_, k) => (
              <button key={k} onClick={() => setI(k)} className={cx("h-1.5 rounded-full transition-all", k === i ? "w-6 bg-white" : "w-1.5 bg-white/40")} aria-label={`Banner ${k + 1}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Página de vendas: por que investir, garantias, como funciona e dúvidas. */
function Persuasion({ company }: { company: PublicCompany }) {
  const icons: [LucideIcon, string][] = [
    [TrendingUp, "#30D158"],
    [CircleDollarSign, "#F3EA3B"],
    [Shield, "#FF9F0A"],
    [Home, "#BF5AF2"],
    [Wrench, "#AEAEB2"],
    [Leaf, "#9BD373"],
  ];
  return (
    <>
      <section className="pt-14">
        <p className="text-[13px] font-bold tracking-[0.06em] text-[#F3EA3B] uppercase">Por que investir</p>
        <h2 className="text-[26px] leading-tight font-bold tracking-tight sm:text-[34px]">O investimento que se paga sozinho</h2>
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b, i) => {
            const [Icon, color] = icons[i];
            return (
              <div key={b.id} className="flex gap-3.5 rounded-[22px] bg-[#1C1C1E] p-4">
                <Tile icon={Icon} color={color} className="h-11 w-11 rounded-[12px]" />
                <div>
                  <p className="text-[16px] font-semibold">{b.t}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-[#8E8E93]">{b.d}</p>
                </div>
              </div>
            );
          })}
        </div>
        <SavingsChart />
      </section>

      <section className="pt-14">
        <p className="text-[13px] font-bold tracking-[0.06em] text-[#F3EA3B] uppercase">Garantias</p>
        <h2 className="text-[26px] leading-tight font-bold tracking-tight sm:text-[34px]">Compra segura por décadas</h2>
        <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {WARRANTIES.map((w) => (
            <div key={w.id} className="rounded-[22px] bg-[#1C1C1E] p-4">
              <div className="flex items-end gap-1">
                <span className="text-[44px] leading-none font-black tracking-[-0.04em] text-[#F3EA3B] tabular-nums">{w.years}</span>
                <span className="mb-1 text-[13px] font-semibold text-[#8E8E93]">{w.years === 1 ? "ano" : "anos"}</span>
              </div>
              <p className="mt-2 text-[15px] font-semibold">{w.t}</p>
              <p className="text-[12px] leading-snug text-[#8E8E93]">
                {w.d[0].toUpperCase() + w.d.slice(1)}
                {w.id === "modulos" && company.warranty_modules_performance_years ? `, e ${company.warranty_modules_performance_years} anos de performance` : ""}
              </p>
            </div>
          ))}
        </div>
        <ol className="mt-4 grid gap-2.5 sm:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.t} className="flex gap-3 rounded-[20px] bg-[#1C1C1E] p-4 sm:block">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F3EA3B] text-[14px] font-black text-black">{i + 1}</span>
              <div className="sm:mt-3">
                <p className="text-[14px] font-semibold">{s.t}</p>
                <p className="text-[12px] text-[#8E8E93]">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="pt-14">
        <p className="text-[13px] font-bold tracking-[0.06em] text-[#F3EA3B] uppercase">Dúvidas</p>
        <h2 className="text-[26px] leading-tight font-bold tracking-tight sm:text-[34px]">Perguntas frequentes</h2>
        <Faq className="mt-5" />
      </section>

      <section className="mt-14 overflow-hidden rounded-[28px] bg-[#1C1C1E] p-6 text-center sm:p-12">
        <Truck className="mx-auto h-8 w-8 text-[#F3EA3B]" />
        <h2 className="mt-3 text-[26px] font-black tracking-tight sm:text-[38px]">Pronto para economizar?</h2>
        <p className="mx-auto mt-2 max-w-lg text-[15px] text-[#AEAEB2]">Escolha os produtos, garanta o desconto e receba a cotação de um consultor. Grátis e sem compromisso.</p>
        <button onClick={() => go("monte")} className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-[#F3EA3B] px-7 text-[16px] font-bold text-black">
          Começar agora <ArrowRight className="h-4 w-4" />
        </button>
      </section>
    </>
  );
}

export function Faq({ className, limit }: { className?: string; limit?: number }) {
  const list = limit ? FAQ.slice(0, limit) : FAQ;
  return (
    <div className={cx("overflow-hidden rounded-[22px] bg-[#1C1C1E]", className)}>
      {list.map((f, i) => (
        <details key={f.q} className="group relative">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
            {f.q}
            <ChevronDown className="h-5 w-5 shrink-0 text-[#636366] transition group-open:rotate-180" />
          </summary>
          <p className="px-5 pb-5 text-[14px] leading-relaxed text-[#AEAEB2]">{f.a}</p>
          {i < list.length - 1 && <span className="absolute right-0 bottom-0 left-5 h-[0.5px] bg-white/[0.12]" />}
        </details>
      ))}
    </div>
  );
}
