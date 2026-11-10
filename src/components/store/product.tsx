"use client";

import { ArrowRight, BadgeCheck, Check, ChevronRight, HandCoins, MessageCircle, Plus, ShieldCheck, Tag, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { PublicCompany } from "@/components/capture/funnel";
import { CATEGORIES, STEPS, WARRANTIES, soldLabel, totalPct, type Campaign, type Coupon, type StoreProduct } from "@/lib/store";
import { CouponTicket, Countdown, FloatingCart, OffBadge, ProductCard, ProductImage, StoreHeader, StoreProvider, Stars, cx, itemOf, useStore } from "./kit";
import { Faq } from "./shop";

export function ProductPage(props: { company: PublicCompany; product: StoreProduct; related: StoreProduct[]; campaign: Campaign | null; coupons: Coupon[] }) {
  return (
    <StoreProvider company={props.company} campaign={props.campaign} coupons={props.coupons}>
      <Inner product={props.product} related={props.related} />
    </StoreProvider>
  );
}

function Inner({ product: p, related }: { product: StoreProduct; related: StoreProduct[] }) {
  const { extra, campaign, coupons, has, add, toggle, open, waLink, company } = useStore();
  const [img, setImg] = useState(0);
  const pct = totalPct(p.discount_pct, extra);
  const key = `p:${p.id}`;
  const on = has(key);
  const cat = CATEGORIES.find((c) => c.id === p.category);
  const photos = p.images.length ? p.images.length : 1;
  const buy = () => {
    add(itemOf(p, extra));
    open();
  };
  const wa = waLink(`Olá! Tenho interesse em: ${p.name}${pct ? ` (${pct}% OFF na loja)` : ""}. Pode me ajudar?`);
  const trust =
    p.category === "kit"
      ? [
          { icon: Wrench, t: "Instalação inclusa", c: "#FF9F0A" },
          { icon: BadgeCheck, t: "Projeto e homologação", c: "#30D158" },
          { icon: ShieldCheck, t: "Até 30 anos de garantia", c: "#F3EA3B" },
          { icon: HandCoins, t: "Financiamento facilitado", c: "#FF375F" },
        ]
      : p.category === "carregador"
        ? [
            { icon: Wrench, t: "Instalação com laudo", c: "#FF9F0A" },
            { icon: ShieldCheck, t: "Garantia do fabricante", c: "#F3EA3B" },
            { icon: HandCoins, t: "Financiamento facilitado", c: "#FF375F" },
          ]
        : [
            { icon: ShieldCheck, t: "Garantia do fabricante", c: "#F3EA3B" },
            { icon: HandCoins, t: "Parcelamento facilitado", c: "#FF375F" },
            { icon: BadgeCheck, t: "Atendimento de consultor", c: "#30D158" },
          ];

  return (
    <div className="theme-dark ios-app min-h-dvh overflow-x-clip bg-black pb-40 text-white">
      <StoreHeader />
      <main className="mx-auto max-w-7xl px-3 sm:px-6">
        <nav className="flex items-center gap-1 overflow-hidden py-3 text-[12px] whitespace-nowrap text-[#8E8E93]">
          <Link href="/loja" className="hover:text-white">
            Loja
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <Link href={`/loja?cat=${p.category}#resultados`} className="hover:text-white">
            {cat?.label}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-[#D1D1D6]">{p.name}</span>
        </nav>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-8">
          {/* galeria */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative aspect-square overflow-hidden rounded-[26px] bg-[#1C1C1E]">
              <div className="scrollbar-none flex h-full snap-x snap-mandatory overflow-x-auto" onScroll={(e) => setImg(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
                {Array.from({ length: photos }, (_, k) => (
                  <div key={k} className="h-full w-full shrink-0 snap-center">
                    <ProductImage p={p} index={k} />
                  </div>
                ))}
              </div>
              <div className="pointer-events-none absolute top-3 left-3 flex flex-col items-start gap-1.5">
                <OffBadge pct={pct} big />
                {p.badge && <span className="rounded-[8px] bg-black/70 px-2 py-1 text-[12px] font-bold text-[#F3EA3B] backdrop-blur">{p.badge}</span>}
              </div>
              {photos > 1 && (
                <span className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-semibold tabular-nums backdrop-blur">
                  {img + 1}/{photos}
                </span>
              )}
            </div>
            {photos > 1 && (
              <div className="scrollbar-none mt-2.5 flex gap-2 overflow-x-auto">
                {p.images.map((src, k) => (
                  <button
                    key={src + k}
                    onClick={(e) => {
                      const strip = e.currentTarget.parentElement?.previousElementSibling?.firstElementChild as HTMLElement | null;
                      strip?.scrollTo({ left: k * strip.clientWidth, behavior: "smooth" });
                      setImg(k);
                    }}
                    className={cx("h-16 w-16 shrink-0 overflow-hidden rounded-[12px] ring-2 transition", img === k ? "ring-[#F3EA3B]" : "ring-transparent opacity-60")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* compra */}
          <div>
            <h1 className="text-[24px] leading-tight font-bold tracking-tight sm:text-[32px]">{p.name}</h1>
            {p.subtitle && <p className="mt-1 text-[15px] text-[#AEAEB2]">{p.subtitle}</p>}
            {p.sold > 0 && (
              <div className="mt-2 flex items-center gap-2 text-[13px] text-[#8E8E93]">
                {p.rating > 0 && (
                  <>
                    <span className="font-semibold text-white">{p.rating.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}</span>
                    <Stars value={p.rating} size={14} />
                    <span>·</span>
                  </>
                )}
                <span>{soldLabel(p.sold)}</span>
              </div>
            )}

            {/* bloco de oferta */}
            <div className="mt-5 overflow-hidden rounded-[24px] bg-[#1C1C1E]">
              {campaign && (
                <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-[#FF453A] to-[#FF9F0A] px-4 py-2.5">
                  <span className="text-[13px] font-black tracking-wide italic">⚡ {campaign.name.toUpperCase()}</span>
                  <span className="flex items-center gap-2 text-[12px] font-semibold">
                    termina em <Countdown to={campaign.ends_at} />
                  </span>
                </div>
              )}
              <div className="p-5">
                {pct > 0 ? (
                  <>
                    <p className="text-[13px] text-[#8E8E93]">Desconto garantido na sua cotação</p>
                    <p className="mt-1 flex items-baseline gap-2">
                      <span className="text-[52px] leading-none font-black tracking-[-0.04em] text-[#FF453A] tabular-nums">{pct}%</span>
                      <span className="text-[22px] font-black text-[#FF453A]">OFF</span>
                    </p>
                    {extra > 0 && p.discount_pct > 0 && (
                      <p className="mt-1 text-[13px] text-[#AEAEB2]">
                        {p.discount_pct}% do produto + {extra}% da campanha
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[13px] text-[#8E8E93]">Valor sob medida para você</p>
                    <p className="mt-1 text-[28px] font-black tracking-tight text-[#9BD373]">Cotação grátis</p>
                  </>
                )}
                <p className="mt-3 text-[13px] leading-relaxed text-[#AEAEB2]">O consultor envia o valor final já com o desconto, conforme o seu projeto. Sem compromisso.</p>

                {coupons.length > 0 && (
                  <div className="scrollbar-none -mx-5 mt-4 flex gap-2.5 overflow-x-auto px-5">
                    {coupons.slice(0, 4).map((c) => (
                      <CouponTicket key={c.code} c={c} />
                    ))}
                  </div>
                )}

                <div className="mt-5 grid gap-2">
                  <button onClick={buy} className="inline-flex h-[52px] items-center justify-center gap-2 rounded-full bg-[#F3EA3B] text-[16px] font-black text-black shadow-[0_14px_40px_-14px_rgba(243,234,59,0.7)] transition active:scale-[0.98]">
                    <Tag className="h-5 w-5" /> {pct > 0 ? `Garantir ${pct}% OFF` : "Pedir cotação grátis"}
                  </button>
                  <button
                    onClick={() => toggle(itemOf(p, extra))}
                    className={cx("inline-flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition", on ? "bg-[#30D158]/15 text-[#30D158]" : "bg-[#2C2C2E] text-white")}
                  >
                    {on ? <Check className="h-4 w-4" strokeWidth={3} /> : <Plus className="h-4 w-4" strokeWidth={2.8} />}
                    {on ? "Já está na sua cotação" : "Adicionar e continuar vendo"}
                  </button>
                  {wa && (
                    <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-[#30D158]">
                      <MessageCircle className="h-5 w-5" /> Tirar dúvida no WhatsApp
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {trust.map((t) => (
                <div key={t.t} className="flex items-center gap-2 rounded-2xl bg-[#1C1C1E] px-3 py-2.5">
                  <t.icon className="h-4 w-4 shrink-0" style={{ color: t.c }} />
                  <span className="text-[12px] leading-tight font-medium text-[#D1D1D6]">{t.t}</span>
                </div>
              ))}
            </div>

            {p.highlights.length > 0 && (
              <Box title={p.category === "kit" ? "O que está incluso" : "Destaques"}>
                <ul className="grid gap-2.5">
                  {p.highlights.map((h) => {
                    const [a, b] = h.includes(":") ? [h.slice(0, h.indexOf(":")), h.slice(h.indexOf(":") + 1).trim()] : [h, ""];
                    return (
                      <li key={h} className="flex gap-3">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#30D158]/15 text-[#30D158]">
                          <Check className="h-3 w-3" strokeWidth={3.5} />
                        </span>
                        <span className="text-[14px] leading-snug">
                          <b className="font-semibold">{a}</b>
                          {b && <span className="text-[#AEAEB2]"> — {b}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Box>
            )}

            {p.specs.length > 0 && (
              <Box title="Ficha técnica">
                <dl className="overflow-hidden rounded-[16px]">
                  {p.specs.map((s, k) => (
                    <div key={s.label} className={cx("grid grid-cols-[40%_60%] gap-3 px-4 py-2.5 text-[14px]", k % 2 ? "bg-transparent" : "bg-white/[0.04]")}>
                      <dt className="text-[#8E8E93]">{s.label}</dt>
                      <dd className="font-medium">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </Box>
            )}

            {p.description && (
              <Box title="Descrição">
                <p className="text-[14px] leading-relaxed whitespace-pre-line text-[#D1D1D6]">{p.description}</p>
              </Box>
            )}
          </div>
        </div>

        {p.category === "kit" && (
          <section className="mt-10">
            <h2 className="text-[22px] font-bold tracking-tight">Garantias</h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {WARRANTIES.map((w) => (
                <div key={w.id} className="rounded-[20px] bg-[#1C1C1E] p-4">
                  <span className="text-[38px] leading-none font-black text-[#F3EA3B]">{w.years}</span>
                  <span className="ml-1 text-[13px] text-[#8E8E93]">{w.years === 1 ? "ano" : "anos"}</span>
                  <p className="mt-1.5 text-[14px] font-semibold">{w.t}</p>
                  <p className="text-[12px] text-[#8E8E93]">
                    {w.d[0].toUpperCase() + w.d.slice(1)}
                    {w.id === "modulos" && company.warranty_modules_performance_years ? `, e ${company.warranty_modules_performance_years} anos de performance` : ""}
                  </p>
                </div>
              ))}
            </div>
            <h2 className="mt-8 text-[22px] font-bold tracking-tight">Como funciona</h2>
            <ol className="mt-3 grid gap-2.5 sm:grid-cols-5">
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
        )}

        <section className="mt-10">
          <h2 className="text-[22px] font-bold tracking-tight">Perguntas frequentes</h2>
          <Faq className="mt-3" limit={p.category === "moto" ? undefined : 6} />
        </section>

        {related.length > 0 && (
          <section className="mt-10">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="text-[22px] font-bold tracking-tight">Você também pode gostar</h2>
              <Link href={`/loja?cat=${p.category}#resultados`} className="flex items-center text-[13px] font-semibold text-[#F3EA3B]">
                Ver mais <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {related.slice(0, 10).map((r) => (
                <ProductCard key={r.id} p={r} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* barra fixa de compra (celular) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-black/90 px-3 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] backdrop-blur-2xl lg:hidden">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="min-w-0 flex-1">
            {pct > 0 ? <p className="text-[20px] leading-none font-black text-[#FF453A]">{pct}% OFF</p> : <p className="text-[15px] font-bold text-[#9BD373]">Cotação grátis</p>}
            <p className="truncate text-[11px] text-[#8E8E93]">{campaign ? `${campaign.name} · por tempo limitado` : "Garantido na sua cotação"}</p>
          </div>
          <button onClick={buy} className="h-12 shrink-0 rounded-full bg-[#F3EA3B] px-6 text-[15px] font-black text-black">
            {pct > 0 ? "Garantir desconto" : "Pedir cotação"}
          </button>
        </div>
      </div>
      <div className="hidden lg:block">
        <FloatingCart />
      </div>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-[22px] bg-[#1C1C1E] p-5">
      <h2 className="mb-3 text-[17px] font-bold">{title}</h2>
      {children}
    </section>
  );
}
