"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  LayoutGrid,
  Plug,
  ToggleRight,
  Waypoints,
  BadgeCheck,
  Battery,
  Cable,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleDollarSign,
  ClipboardList,
  HandCoins,
  Home,
  Leaf,
  Lightbulb,
  Loader2,
  MessageCircle,
  Plus,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Timer,
  TrendingUp,
  Trash2,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/app/brand";
import { GlyphTile, type GlyphId } from "@/components/app/ios-glyphs";
import type { PublicCompany } from "@/components/capture/funnel";
import {
  BENEFITS,
  CHARGERS,
  FAQ,
  KIND_LABEL,
  KIT_INCLUDES,
  KITS,
  MATERIALS,
  MIN_KWH,
  MOTOS,
  MOUNTS,
  PLACES,
  SERVICES,
  STEPS,
  WARRANTIES,
  areaOf,
  fmt,
  kitKwp,
  monthlyKwh,
  quoteSummary,
  segmentOf,
  sizeSystem,
  type CartItem,
  type Grid,
  type Kit,
  type Mount,
  type Place,
} from "@/lib/store";
import { ChargerArt, MotoArt, MountArt, PlaceArt } from "./art";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const CART_KEY = "quark-loja-cotacao";

/* ------------------------------------------------------------------ blocos */

function Tile({ icon: Icon, color, className }: { icon: LucideIcon; color: string; className?: string }) {
  return (
    <span className={cx("ios-tile h-10 w-10 rounded-[11px]", className)}>
      <Icon className="relative h-[21px] w-[21px]" style={{ color }} strokeWidth={2.2} />
    </span>
  );
}

function Section({ id, eyebrow, title, text, children, className }: { id: string; eyebrow: string; title: ReactNode; text?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cx("scroll-mt-32 px-4 py-14 sm:px-6 sm:py-20", className)}>
      <div className="mx-auto max-w-6xl">
        <p className="text-[13px] font-semibold tracking-[0.04em] text-[#9BD373] uppercase">{eyebrow}</p>
        <h2 className="mt-1.5 max-w-3xl text-[30px] leading-[1.08] font-bold tracking-[-0.03em] text-white sm:text-[44px]">{title}</h2>
        {text && <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-[#8E8E93] sm:text-[17px]">{text}</p>}
        <div className="mt-8 sm:mt-10">{children}</div>
      </div>
    </section>
  );
}

function AddButton({ added, onClick, label = "Adicionar à cotação", full }: { added: boolean; onClick: () => void; label?: string; full?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition active:scale-[0.97]",
        full && "w-full",
        added ? "bg-[#30D158]/15 text-[#30D158] ring-1 ring-[#30D158]/40" : "bg-[#fff] text-black hover:bg-white/90",
      )}
    >
      {added ? <Check className="h-4 w-4" strokeWidth={3} /> : <Plus className="h-4 w-4" strokeWidth={2.8} />}
      {added ? "Na sua cotação" : label}
    </button>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl bg-[#2C2C2E]/70 px-3 py-2.5">
      <p className="text-[11px] font-medium text-[#8E8E93]">{label}</p>
      <p className="mt-0.5 text-[17px] font-semibold tracking-tight text-white tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-[12px] font-medium text-[#8E8E93]">{unit}</span>}
      </p>
    </div>
  );
}

function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-sheet-up relative flex max-h-[92dvh] w-full flex-col rounded-t-[32px] bg-[#1C1C1E] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] sm:max-w-lg sm:rounded-[32px]">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-2">
          <h3 className="text-[20px] font-bold tracking-tight text-white">{title}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-[rgba(118,118,128,0.24)] text-[#AEAEB2]" aria-label="Fechar">
            <X className="h-4 w-4" strokeWidth={2.6} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-6">{children}</div>
        {footer && <div className="border-t border-white/[0.08] px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- página */

const NAV: { id: string; label: string; glyph: GlyphId }[] = [
  { id: "kits", label: "Kits solares", glyph: "sol" },
  { id: "monte", label: "Monte o seu", glyph: "calculadora" },
  { id: "eletropostos", label: "Eletropostos", glyph: "plugue" },
  { id: "motos", label: "Motos elétricas", glyph: "raio" },
  { id: "material", label: "Material elétrico", glyph: "pacote" },
  { id: "servicos", label: "Serviços", glyph: "chave" },
  { id: "garantias", label: "Garantias", glyph: "estrela" },
  { id: "duvidas", label: "Dúvidas", glyph: "busca" },
];

export function Store({ company }: { company: PublicCompany }) {
  const params = useSearchParams();
  const owner = params.get("v") ?? "";
  const tariff = company.tariff && company.tariff > 0 ? company.tariff : 0.95;
  const sun = company.sunHours && company.sunHours > 0 ? company.sunHours : 5.2;
  const name = company.company_name || "Quark Energia";
  const wa = (company.whatsapp ?? "").replace(/\D/g, "");
  const waLink = (text: string) => (wa ? `https://wa.me/${wa.length <= 11 ? `55${wa}` : wa}?text=${encodeURIComponent(text)}` : null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [place, setPlace] = useState<Place>("casa");
  const [kitInfo, setKitInfo] = useState<Kit | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setCart(JSON.parse(raw) as CartItem[]);
    } catch {
      /* navegação privada */
    }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* navegação privada */
    }
  }, [cart]);

  const has = (key: string) => cart.some((c) => c.key === key);
  const toggle = (item: CartItem) => setCart((c) => (c.some((x) => x.key === item.key) ? c.filter((x) => x.key !== item.key) : [...c, item]));
  const add = (item: CartItem) => setCart((c) => [...c.filter((x) => x.key !== item.key), item]);
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const kitItem = (k: Kit): CartItem => ({ key: `kit:${k.id}`, kind: "kit", title: `Kit ${k.name}`, detail: `${fmt(kitKwp(k.modules), 2)} kWp · ${k.modules} placas` });

  return (
    <div className="theme-dark ios-app min-h-dvh bg-black text-white">
      {/* topo */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/80 backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href="#topo" className="flex items-end gap-2" aria-label={name}>
            <BrandLogo className="h-8" />
            <span className="mb-0.5 hidden rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-[0.14em] text-[#9BD373] sm:inline">LOJA</span>
          </a>
          <button
            onClick={() => setCartOpen(true)}
            className={cx(
              "relative inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold transition",
              cart.length ? "bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] text-black" : "bg-[rgba(118,118,128,0.24)] text-white",
            )}
          >
            <ClipboardList className="h-4 w-4" />
            Minha cotação
            {cart.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-black px-1.5 text-[11px] text-white tabular-nums">{cart.length}</span>}
          </button>
        </div>
        <nav className="scrollbar-none mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => go(n.id)} className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-[#1C1C1E] pr-3.5 pl-1.5 text-[13px] font-medium text-white/90 transition hover:bg-[#2C2C2E]">
              <GlyphTile id={n.glyph} size="xs" className="!h-6 !w-6 !rounded-full" />
              {n.label}
            </button>
          ))}
        </nav>
      </header>

      {/* herói */}
      <section id="topo" className="relative overflow-hidden px-4 pt-10 pb-6 sm:px-6 sm:pt-16">
        <div className="pointer-events-none absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-[#F3EA3B]/10 blur-[120px]" />
        <div className="relative mx-auto max-w-6xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-[#1C1C1E] px-3 py-1.5 text-[13px] font-medium text-[#D1D1D6]">
            <Sparkles className="h-3.5 w-3.5 text-[#F3EA3B]" /> Sem compromisso · resposta rápida
          </p>
          <h1 className="mt-5 max-w-4xl text-[40px] leading-[1.02] font-bold tracking-[-0.04em] sm:text-[68px]">
            Energia do sol.
            <br />
            <span className="bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] bg-clip-text text-transparent">Conta de luz lá embaixo.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-[#AEAEB2] sm:text-[19px]">
            Escolha um kit pronto ou monte o seu em 1 minuto. Também temos eletropostos, motos elétricas e material elétrico. Você monta sua lista e um consultor da {name} prepara a cotação.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={() => go("monte")} className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] px-6 text-[16px] font-semibold text-black shadow-[0_14px_40px_-12px_rgba(243,234,59,0.6)] transition active:scale-[0.97]">
              Monte seu sistema <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={() => go("kits")} className="inline-flex h-12 items-center gap-2 rounded-full bg-[#1C1C1E] px-6 text-[16px] font-semibold text-white ring-1 ring-white/10 transition active:scale-[0.97]">
              Ver kits prontos
            </button>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {PLACES.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPlace(p.id);
                  go("kits");
                }}
                className="group overflow-hidden rounded-[26px] bg-[#1C1C1E] text-left transition hover:bg-[#232325] active:scale-[0.99]"
              >
                <PlaceArt place={p.id} className="h-36 w-full transition duration-500 group-hover:scale-[1.03]" />
                <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-4">
                  <div>
                    <p className="text-[17px] font-semibold">{p.label}</p>
                    <p className="text-[14px] text-[#8E8E93]">{p.text}</p>
                  </div>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 transition group-hover:bg-[#fff] group-hover:text-black">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { icon: BadgeCheck, c: "#30D158", t: "Projeto e homologação inclusos" },
              { icon: ShieldCheck, c: "#F3EA3B", t: "Até 30 anos de garantia" },
              { icon: HandCoins, c: "#FF9F0A", t: "Financiamento facilitado" },
              { icon: Wrench, c: "#FF375F", t: "Instalação com equipe própria" },
            ].map((b) => (
              <div key={b.t} className="flex items-center gap-2.5 rounded-2xl bg-[#1C1C1E] px-3 py-3">
                <b.icon className="h-5 w-5 shrink-0" style={{ color: b.c }} />
                <span className="text-[13px] leading-tight font-medium text-[#D1D1D6]">{b.t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* kits */}
      <Section id="kits" eyebrow="Kits solares prontos" title="Escolha o kit do seu tamanho" text="Tudo incluso: placas, inversor, estrutura, proteções, projeto, homologação e instalação. Toque em “O que vem no kit” para ver os detalhes.">
        <div className="mb-6 inline-flex rounded-full bg-[rgba(118,118,128,0.24)] p-[3px]">
          {PLACES.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlace(p.id)}
              className={cx("h-9 rounded-full px-4 text-[14px] font-semibold transition sm:px-6", place === p.id ? "bg-[#636366] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]" : "text-[#AEAEB2]")}
            >
              {p.short}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {KITS.filter((k) => k.place === place).map((k) => {
            const kwp = kitKwp(k.modules);
            const gen = monthlyKwh(kwp, sun);
            const bill = Math.round(((gen + MIN_KWH.bi) * tariff) / 10) * 10;
            return (
              <article key={k.id} className="flex flex-col overflow-hidden rounded-[28px] bg-[#1C1C1E]">
                <div className="relative">
                  <PlaceArt place={k.offgrid ? "offgrid" : k.place} className="h-40 w-full" />
                  {k.best && <span className="absolute top-3 left-3 rounded-full bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] px-2.5 py-1 text-[11px] font-bold text-black">Mais escolhido</span>}
                  {k.offgrid && <span className="absolute top-3 left-3 rounded-full bg-[#30D158] px-2.5 py-1 text-[11px] font-bold text-black">Com baterias</span>}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-[21px] font-bold tracking-tight">Kit {k.name}</h3>
                  <p className="text-[14px] text-[#8E8E93]">{k.tag}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Stat label="Potência" value={fmt(kwp, 2)} unit="kWp" />
                    <Stat label="Placas" value={String(k.modules)} unit={`× ${610} W`} />
                    <Stat label="Gera por mês" value={`~${fmt(gen)}`} unit="kWh" />
                    <Stat label="Área no telhado" value={`${areaOf(k.modules)}`} unit="m²" />
                  </div>
                  {!k.offgrid ? (
                    <p className="mt-3 flex items-center gap-2 rounded-2xl bg-[#9BD373]/10 px-3 py-2 text-[13px] text-[#C9EBA8]">
                      <Lightbulb className="h-4 w-4 shrink-0" /> Ideal para contas de até ~R$ {fmt(bill)}/mês
                    </p>
                  ) : (
                    <p className="mt-3 flex items-center gap-2 rounded-2xl bg-[#30D158]/10 px-3 py-2 text-[13px] text-[#A8F0BC]">
                      <Battery className="h-4 w-4 shrink-0" /> Energia própria, mesmo sem rede da distribuidora
                    </p>
                  )}
                  <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row">
                    <button onClick={() => setKitInfo(k)} className="h-11 w-full shrink-0 rounded-full bg-[#2C2C2E] text-[15px] font-semibold text-white transition hover:bg-[#3A3A3C] sm:w-auto sm:flex-1">
                      O que vem no kit
                    </button>
                    <AddButton added={has(`kit:${k.id}`)} onClick={() => toggle(kitItem(k))} label="Cotação" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      {/* monte o seu */}
      <Section id="monte" eyebrow="Monte seu sistema" title="Em 4 toques, o sistema ideal para você" text="Responda o básico e calculamos quantas placas você precisa, quanto vai gerar e quanto pode economizar.">
        <Builder
          tariff={tariff}
          sun={sun}
          onAdd={(item) => {
            add(item);
            setCartOpen(true);
          }}
          initialPlace={place}
        />
      </Section>

      {/* eletropostos */}
      <Section id="eletropostos" eyebrow="Eletropostos" title="Carregue o carro elétrico onde ele dorme" text="Do carregador de parede para casa ao carregador rápido para postos e frotas. Instalação com projeto elétrico e laudo.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CHARGERS.map((c) => {
            const key = `charger:${c.id}`;
            const pct = Math.max(6, Math.min(100, (c.hours / 7) * 100));
            return (
              <article key={c.id} className="flex flex-col rounded-[28px] bg-[#1C1C1E] p-5">
                <div className="flex items-start justify-between">
                  <ChargerArt kind={c.kind} className="h-28 w-28" />
                  <span className={cx("rounded-full px-2.5 py-1 text-[11px] font-bold", c.kind === "DC" ? "bg-[#F3EA3B] text-black" : "bg-white/10 text-white")}>{c.kind === "DC" ? "Rápido DC" : "AC"}</span>
                </div>
                <h3 className="mt-2 text-[19px] font-bold tracking-tight">{c.name}</h3>
                <p className="text-[14px] text-[#8E8E93]">{c.where}</p>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[12px] text-[#8E8E93]">
                    <span className="flex items-center gap-1">
                      <Timer className="h-3.5 w-3.5" /> Carga completa*
                    </span>
                    <span className="font-semibold text-white tabular-nums">{c.hours < 1 ? `~${Math.round(c.hours * 60)} min` : `~${fmt(c.hours, 1)} h`}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#9BD373] to-[#F3EA3B]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <ul className="mt-4 grid gap-1.5 text-[13px] text-[#D1D1D6]">
                  <li className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-[#F3EA3B]" /> {fmt(c.power, c.power % 1 ? 1 : 0)} kW · {c.grid}
                  </li>
                  {c.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-[#30D158]" strokeWidth={3} /> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-5">
                  <AddButton full added={has(key)} onClick={() => toggle({ key, kind: "charger", title: c.name, detail: `${fmt(c.power, 1)} kW ${c.kind}` })} />
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] text-[#6C6C70]">*Bateria de 50 kWh, de 0 a 100% (DC: até 80%). O tempo real depende do carro.</p>
        <div className="mt-6 flex flex-col items-start gap-4 rounded-[28px] bg-gradient-to-r from-[#9BD373]/15 to-[#F3EA3B]/10 p-6 sm:flex-row sm:items-center">
          <Tile icon={Sun} color="#F3EA3B" />
          <div className="flex-1">
            <p className="text-[17px] font-semibold">Carro elétrico + energia solar</p>
            <p className="text-[14px] text-[#AEAEB2]">Somamos o consumo do carregador no projeto solar: o sol abastece o seu carro e o km rodado fica muito mais barato.</p>
          </div>
        </div>
      </Section>

      {/* motos */}
      <Section id="motos" eyebrow="Motos elétricas" title="Rode sem gasolina, sem barulho e sem óleo" text="Recarregue na tomada de casa. O custo por quilômetro é muito menor que o da moto a gasolina e a manutenção é mínima.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MOTOS.map((m) => {
            const key = `moto:${m.id}`;
            return (
              <article key={m.id} className="flex flex-col rounded-[28px] bg-[#1C1C1E] p-5">
                <MotoArt id={m.id} className="h-32 w-full" />
                <p className="mt-2 text-[12px] font-semibold tracking-[0.04em] text-[#8E8E93] uppercase">{m.kind}</p>
                <h3 className="text-[19px] font-bold tracking-tight">{m.name}</h3>
                <p className="text-[14px] text-[#8E8E93]">{m.highlight}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Stat label="Velocidade" value={String(m.speed)} unit="km/h" />
                  <Stat label="Autonomia" value={`até ${m.range}`} unit="km" />
                  <Stat label="Motor" value={fmt(m.powerW)} unit="W" />
                  <Stat label="Recarga" value={m.charge.split(" ")[0] === "Bateria" || m.charge.startsWith("Troca") ? "Fácil" : m.charge.split(" na")[0]} />
                </div>
                <p className="mt-3 flex items-center gap-2 text-[13px] text-[#D1D1D6]">
                  <BadgeCheck className="h-4 w-4 text-[#F3EA3B]" /> {m.license}
                </p>
                <div className="mt-auto pt-5">
                  <AddButton full added={has(key)} onClick={() => toggle({ key, kind: "moto", title: m.name, detail: `${m.kind}, ${m.speed} km/h` })} />
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { icon: CircleDollarSign, c: "#30D158", t: "Até 10× mais barato por km", d: "Uma recarga completa custa poucos reais." },
            { icon: Wrench, c: "#FF9F0A", t: "Manutenção mínima", d: "Sem óleo, filtro, vela ou embreagem." },
            { icon: Leaf, c: "#9BD373", t: "Zero emissão", d: "Silenciosa e sem fumaça na cidade." },
          ].map((b) => (
            <div key={b.t} className="flex gap-3 rounded-[22px] bg-[#1C1C1E] p-4">
              <Tile icon={b.icon} color={b.c} />
              <div>
                <p className="text-[15px] font-semibold">{b.t}</p>
                <p className="text-[13px] text-[#8E8E93]">{b.d}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-[#6C6C70]">*Autopropelidos (até 32 km/h e 1000 W) seguem regras próprias do Contran. Confirme com o consultor as exigências para cada modelo.</p>
      </Section>

      {/* material elétrico */}
      <Section id="material" eyebrow="Material elétrico" title="Tudo para a sua instalação" text="Catálogo em expansão. Marque o que você precisa e, na sua cotação, escreva quantidades e medidas.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MATERIALS.map((m, i) => {
            const key = `material:${m.id}`;
            const on = has(key);
            const icons: [LucideIcon, string][] = [
              [Cable, "#FF9F0A"],
              [ToggleRight, "#FF453A"],
              [ShieldCheck, "#F3EA3B"],
              [LayoutGrid, "#BF5AF2"],
              [Plug, "#30D158"],
              [ArrowDownToLine, "#9BD373"],
              [Waypoints, "#AEAEB2"],
              [Lightbulb, "#FFD60A"],
            ];
            const [Icon, color] = icons[i % icons.length];
            return (
              <button
                key={m.id}
                onClick={() => toggle({ key, kind: "material", title: m.name, detail: m.text })}
                className={cx("relative flex flex-col items-start gap-3 rounded-[24px] p-4 text-left transition active:scale-[0.98]", on ? "bg-[#2C2C2E] ring-1 ring-[#30D158]/50" : "bg-[#1C1C1E] hover:bg-[#232325]")}
              >
                <Tile icon={Icon} color={color} />
                <div>
                  <p className="text-[15px] font-semibold">{m.name}</p>
                  <p className="text-[13px] leading-snug text-[#8E8E93]">{m.text}</p>
                </div>
                <span className={cx("absolute top-4 right-4 grid h-6 w-6 place-items-center rounded-full", on ? "bg-[#30D158] text-black" : "bg-white/10 text-white")}>
                  {on ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Plus className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* serviços */}
      <Section id="servicos" eyebrow="Serviços personalizados" title="Do projeto à manutenção, cuidamos de tudo">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s, i) => {
            const key = `service:${s.id}`;
            const on = has(key);
            const glyphs: GlyphId[] = ["propostas", "documentos", "chave", "sol", "relatorios", "plugue", "integracao", "alerta"];
            return (
              <div key={s.id} className="flex flex-col rounded-[24px] bg-[#1C1C1E] p-5">
                <GlyphTile id={glyphs[i % glyphs.length]} size="md" />
                <p className="mt-3 text-[16px] font-semibold">{s.name}</p>
                <p className="mt-0.5 flex-1 text-[14px] leading-snug text-[#8E8E93]">{s.text}</p>
                <button
                  onClick={() => toggle({ key, kind: "service", title: s.name, detail: "" })}
                  className={cx("mt-4 inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-full px-4 text-[14px] font-semibold transition", on ? "bg-[#30D158]/15 text-[#30D158]" : "bg-[#2C2C2E] text-white hover:bg-[#3A3A3C]")}
                >
                  {on ? <Check className="h-4 w-4" strokeWidth={3} /> : <Plus className="h-4 w-4" strokeWidth={2.8} />}
                  {on ? "Adicionado" : "Quero este"}
                </button>
              </div>
            );
          })}
        </div>
      </Section>

      {/* benefícios */}
      <Section id="beneficios" eyebrow="Por que investir" title="Um investimento que se paga e continua rendendo">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b, i) => {
            const icons: [LucideIcon, string][] = [
              [TrendingUp, "#30D158"],
              [CircleDollarSign, "#F3EA3B"],
              [Shield, "#FF9F0A"],
              [Home, "#BF5AF2"],
              [Wrench, "#AEAEB2"],
              [Leaf, "#9BD373"],
            ];
            const [Icon, color] = icons[i];
            return (
              <div key={b.id} className="flex gap-4 rounded-[24px] bg-[#1C1C1E] p-5">
                <Tile icon={Icon} color={color} className="h-12 w-12 rounded-[13px]" />
                <div>
                  <p className="text-[17px] font-semibold">{b.t}</p>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-[#8E8E93]">{b.d}</p>
                </div>
              </div>
            );
          })}
        </div>
        <SavingsChart />
      </Section>

      {/* garantias */}
      <Section id="garantias" eyebrow="Garantias" title="Tranquilidade por décadas">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {WARRANTIES.map((w) => {
            const years = w.years;
            return (
              <div key={w.id} className="rounded-[24px] bg-[#1C1C1E] p-5">
                <div className="flex items-end gap-1.5">
                  <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-[56px] leading-none font-bold tracking-[-0.04em] text-transparent tabular-nums">{years}</span>
                  <span className="mb-1.5 text-[15px] font-semibold text-[#8E8E93]">{years === 1 ? "ano" : "anos"}</span>
                </div>
                <p className="mt-3 text-[17px] font-semibold">{w.t}</p>
                <p className="text-[14px] text-[#8E8E93]">
                  {w.d[0].toUpperCase() + w.d.slice(1)}
                  {w.id === "modulos" && company.warranty_modules_performance_years ? `, e ${company.warranty_modules_performance_years} anos de performance garantida` : w.extra.startsWith("e ") ? ` ${w.extra}` : `, ${w.extra}`}.
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-10">
          <p className="text-[20px] font-bold tracking-tight">Como funciona</p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.t} className="relative rounded-[22px] bg-[#1C1C1E] p-4">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#F3EA3B] to-[#9BD373] text-[14px] font-bold text-black">{i + 1}</span>
                <p className="mt-3 text-[15px] font-semibold">{s.t}</p>
                <p className="text-[13px] text-[#8E8E93]">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* dúvidas */}
      <Section id="duvidas" eyebrow="Informações gerais" title="Perguntas frequentes">
        <div className="overflow-hidden rounded-[24px] bg-[#1C1C1E]">
          {FAQ.map((f, i) => (
            <details key={f.q} className="group relative">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[16px] font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="h-5 w-5 shrink-0 text-[#636366] transition group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-5 text-[15px] leading-relaxed text-[#AEAEB2]">{f.a}</p>
              {i < FAQ.length - 1 && <span className="absolute right-0 bottom-0 left-5 h-[0.5px] bg-white/[0.12]" />}
            </details>
          ))}
        </div>
      </Section>

      {/* chamada final */}
      <section className="px-4 pb-32 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-[#1C1C1E] p-8 text-center sm:p-14">
          <div className="pointer-events-none absolute -bottom-32 left-1/2 h-72 w-[600px] -translate-x-1/2 rounded-full bg-[#9BD373]/20 blur-[100px]" />
          <h2 className="relative text-[30px] leading-tight font-bold tracking-[-0.03em] sm:text-[44px]">Pronto para economizar?</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-[16px] text-[#AEAEB2]">Monte sua lista e receba a cotação de um consultor. É grátis e sem compromisso.</p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3">
            <button onClick={() => (cart.length ? setCartOpen(true) : go("monte"))} className="inline-flex h-12 items-center gap-2 rounded-full bg-[#fff] px-6 text-[16px] font-semibold text-black">
              {cart.length ? "Ver minha cotação" : "Monte seu sistema"} <ArrowRight className="h-4 w-4" />
            </button>
            {waLink(`Olá! Vim pela loja online da ${name} e quero falar com um consultor.`) && (
              <a href={waLink(`Olá! Vim pela loja online da ${name} e quero falar com um consultor.`)!} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center gap-2 rounded-full bg-[#30D158] px-6 text-[16px] font-semibold text-black">
                <MessageCircle className="h-5 w-5" /> Falar no WhatsApp
              </a>
            )}
          </div>
        </div>
        <footer className="mx-auto mt-10 flex max-w-6xl flex-col items-center gap-2 text-center text-[13px] text-[#6C6C70]">
          <BrandLogo className="h-7 opacity-80" />
          <p>
            {name}
            {company.city ? ` · ${company.city}` : ""}
            {company.instagram ? ` · ${company.instagram.startsWith("@") ? company.instagram : `@${company.instagram}`}` : ""}
          </p>
          <p>Imagens ilustrativas. Potências e gerações são estimativas e são confirmadas na visita técnica.</p>
        </footer>
      </section>

      {/* barra flutuante */}
      {cart.length > 0 && !cartOpen && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button onClick={() => setCartOpen(true)} className="liquid-glass pointer-events-auto mx-auto flex h-[62px] w-full max-w-md items-center gap-3 rounded-full pr-2 pl-5 text-left">
            <ClipboardList className="h-5 w-5 text-[#9BD373]" />
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">Minha cotação</span>
              <span className="block text-[12px] text-[#AEAEB2]">
                {cart.length} {cart.length === 1 ? "item escolhido" : "itens escolhidos"}
              </span>
            </span>
            <span className="inline-flex h-12 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] px-5 text-[15px] font-semibold text-black">
              Solicitar <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </div>
      )}

      <Sheet
        open={!!kitInfo}
        onClose={() => setKitInfo(null)}
        title={kitInfo ? `Kit ${kitInfo.name}` : ""}
        footer={kitInfo && <AddButton full added={has(`kit:${kitInfo.id}`)} onClick={() => toggle(kitItem(kitInfo))} />}
      >
        {kitInfo && (
          <>
            <div className="overflow-hidden rounded-[22px]">
              <PlaceArt place={kitInfo.offgrid ? "offgrid" : kitInfo.place} className="h-40 w-full" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="Potência" value={fmt(kitKwp(kitInfo.modules), 2)} unit="kWp" />
              <Stat label="Placas" value={String(kitInfo.modules)} />
              <Stat label="Gera/mês" value={`~${fmt(monthlyKwh(kitKwp(kitInfo.modules), sun))}`} unit="kWh" />
            </div>
            <p className="mt-5 mb-2 text-[13px] font-semibold tracking-[0.04em] text-[#8E8E93] uppercase">O que vem no kit</p>
            <ul className="overflow-hidden rounded-[20px] bg-[#2C2C2E]/60">
              {[...KIT_INCLUDES, ...(kitInfo.offgrid ? [{ t: "Baterias", d: "Banco de baterias de lítio para usar à noite" }] : [])].map((it, i, arr) => (
                <li key={it.t} className="relative flex items-center gap-3 px-4 py-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#30D158]/15 text-[#30D158]">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold">{it.t}</p>
                    <p className="text-[13px] text-[#8E8E93]">{it.d}</p>
                  </div>
                  {i < arr.length - 1 && <span className="absolute right-0 bottom-0 left-14 h-[0.5px] bg-white/[0.1]" />}
                </li>
              ))}
            </ul>
          </>
        )}
      </Sheet>

      <QuoteSheet open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} setCart={setCart} owner={owner} waLink={waLink} onBrowse={() => { setCartOpen(false); go("kits"); }} />
    </div>
  );
}

/* --------------------------------------------------- gráfico de economia */

function SavingsChart() {
  // Conta de luz sobe ~8% ao ano; com solar, paga-se praticamente a taxa mínima.
  const years = Array.from({ length: 10 }, (_, i) => i + 1);
  const without = years.map((y) => Math.pow(1.08, y - 1));
  const max = without[without.length - 1];
  return (
    <div className="mt-6 rounded-[28px] bg-[#1C1C1E] p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[17px] font-semibold">A conta de luz sobe. A sua economia também.</p>
          <p className="text-[14px] text-[#8E8E93]">Conta de luz nos próximos 10 anos (exemplo com reajuste médio de 8% ao ano)</p>
        </div>
        <div className="flex gap-4 text-[13px]">
          <span className="flex items-center gap-1.5 text-[#D1D1D6]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF453A]" /> Sem energia solar
          </span>
          <span className="flex items-center gap-1.5 text-[#D1D1D6]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#9BD373]" /> Com energia solar
          </span>
        </div>
      </div>
      <div className="mt-6 flex h-44 items-end gap-1.5 sm:gap-3">
        {years.map((y, i) => (
          <div key={y} className="group flex flex-1 flex-col items-center gap-1.5">
            <div className="flex h-36 w-full items-end justify-center gap-[3px]">
              <div className="w-1/2 max-w-[18px] rounded-t-[5px] bg-[#FF453A]/85" style={{ height: `${(without[i] / max) * 100}%` }} title={`Ano ${y}: sem solar`} />
              <div className="w-1/2 max-w-[18px] rounded-t-[5px] bg-[#9BD373]" style={{ height: `${(0.1 * without[i] / max) * 100 + 4}%` }} title={`Ano ${y}: com solar`} />
            </div>
            <span className="text-[11px] text-[#8E8E93] tabular-nums">{y}º</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- monte o seu */

const GRIDS: { id: Grid | "nao-sei"; label: string; text: string }[] = [
  { id: "mono", label: "Monofásico", text: "2 fios no padrão" },
  { id: "bi", label: "Bifásico", text: "3 fios no padrão" },
  { id: "tri", label: "Trifásico", text: "4 fios no padrão" },
  { id: "nao-sei", label: "Não sei", text: "A gente descobre na visita" },
];

function Builder({ tariff, sun, onAdd, initialPlace }: { tariff: number; sun: number; onAdd: (i: CartItem) => void; initialPlace: Place }) {
  const [step, setStep] = useState(0);
  const [place, setPlace] = useState<Place>(initialPlace);
  const [bill, setBill] = useState(450);
  const [mount, setMount] = useState<Mount | null>(null);
  const [grid, setGrid] = useState<Grid | "nao-sei" | null>(null);
  const max = place === "casa" ? 3000 : place === "comercio" ? 30000 : 20000;
  const s = useMemo(() => sizeSystem({ bill, place, grid: grid && grid !== "nao-sei" ? grid : "bi", tariff, sunHours: sun }), [bill, place, grid, tariff, sun]);
  const steps = ["Onde", "Conta de luz", "Telhado", "Rede", "Resultado"];
  const canNext = step === 0 ? true : step === 1 ? bill > 0 : step === 2 ? !!mount : step === 3 ? !!grid : true;
  const mountLabel = MOUNTS.find((m) => m.id === mount)?.label ?? "";

  return (
    <div className="overflow-hidden rounded-[32px] bg-[#1C1C1E]">
      {/* progresso */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4 sm:px-7">
        {steps.map((t, i) => (
          <div key={t} className="flex flex-1 flex-col gap-1.5">
            <div className={cx("h-1.5 rounded-full transition-all duration-500", i <= step ? "bg-gradient-to-r from-[#F3EA3B] to-[#9BD373]" : "bg-white/10")} />
            <span className={cx("hidden text-[12px] font-medium sm:block", i === step ? "text-white" : "text-[#6C6C70]")}>{t}</span>
          </div>
        ))}
      </div>

      <div className="p-5 sm:p-8">
        {step === 0 && (
          <Q title="Onde vai ser instalado?">
            <div className="grid gap-3 sm:grid-cols-3">
              {PLACES.map((p) => (
                <Choice key={p.id} on={place === p.id} onClick={() => { setPlace(p.id); setBill(p.id === "casa" ? 450 : p.id === "comercio" ? 2500 : 1500); setStep(1); }}>
                  <PlaceArt place={p.id} className="h-28 w-full rounded-[18px]" />
                  <p className="mt-3 text-[17px] font-semibold">{p.short}</p>
                  <p className="text-[13px] text-[#8E8E93]">{p.text}</p>
                </Choice>
              ))}
            </div>
          </Q>
        )}

        {step === 1 && (
          <Q title="Quanto vem a sua conta de luz por mês?" text="Use a média dos últimos meses. Não precisa ser exato.">
            <div className="mx-auto max-w-xl text-center">
              <p className="text-[56px] leading-none font-bold tracking-[-0.04em] tabular-nums sm:text-[72px]">
                <span className="mr-1 align-top text-[24px] text-[#8E8E93]">R$</span>
                {fmt(bill)}
              </p>
              <input
                type="range"
                min={100}
                max={max}
                step={place === "casa" ? 10 : 50}
                value={Math.min(bill, max)}
                onChange={(e) => setBill(Number(e.target.value))}
                className="store-range mt-8 w-full"
                style={{ "--p": `${((Math.min(bill, max) - 100) / (max - 100)) * 100}%` } as React.CSSProperties}
                aria-label="Valor da conta de luz"
              />
              <div className="mt-2 flex justify-between text-[12px] text-[#6C6C70]">
                <span>R$ 100</span>
                <span>R$ {fmt(max)}+</span>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {(place === "casa" ? [200, 350, 500, 800, 1200] : place === "comercio" ? [1000, 2500, 5000, 10000, 20000] : [800, 1500, 3000, 6000, 12000]).map((v) => (
                  <button key={v} onClick={() => setBill(v)} className={cx("h-9 rounded-full px-4 text-[14px] font-semibold tabular-nums transition", bill === v ? "bg-[#fff] text-black" : "bg-[#2C2C2E] text-white")}>
                    R$ {fmt(v)}
                  </button>
                ))}
              </div>
            </div>
          </Q>
        )}

        {step === 2 && (
          <Q title="Onde as placas vão ficar?" text="Escolha o tipo de telhado ou estrutura. Cada um tem uma fixação própria.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {MOUNTS.map((m) => (
                <Choice key={m.id} on={mount === m.id} onClick={() => { setMount(m.id); setStep(3); }}>
                  <div className="grid place-items-center rounded-[18px] bg-black/60 py-2">
                    <MountArt mount={m.id} className="h-28 w-40 sm:h-32 sm:w-48" />
                  </div>
                  <p className="mt-3 text-[16px] font-semibold">{m.label}</p>
                  <p className="text-[13px] leading-snug text-[#8E8E93]">{m.text}</p>
                </Choice>
              ))}
            </div>
          </Q>
        )}

        {step === 3 && (
          <Q title="Qual é o tipo de ligação?" text="Aparece na sua conta de luz como “tipo de fornecimento”.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {GRIDS.map((g) => (
                <Choice key={g.id} on={grid === g.id} onClick={() => { setGrid(g.id); setStep(4); }}>
                  <div className="flex h-12 items-end gap-1.5">
                    {Array.from({ length: g.id === "mono" ? 2 : g.id === "bi" ? 3 : g.id === "tri" ? 4 : 0 }, (_, i) => (
                      <span key={i} className="w-2.5 rounded-full" style={{ height: `${24 + i * 6}px`, background: ["#F3EA3B", "#9BD373", "#FF9F0A", "#AEAEB2"][i] }} />
                    ))}
                    {g.id === "nao-sei" && <span className="text-[34px] leading-none font-bold text-[#636366]">?</span>}
                  </div>
                  <p className="mt-3 text-[16px] font-semibold">{g.label}</p>
                  <p className="text-[13px] text-[#8E8E93]">{g.text}</p>
                </Choice>
              ))}
            </div>
          </Q>
        )}

        {step === 4 && (
          <div className="animate-fade-up">
            <p className="text-[14px] font-medium text-[#9BD373]">Seu sistema ideal</p>
            <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
              <p className="text-[56px] leading-none font-bold tracking-[-0.04em] tabular-nums sm:text-[76px]">
                {fmt(s.kwp, 2)}
                <span className="ml-1.5 text-[24px] font-semibold text-[#8E8E93]">kWp</span>
              </p>
              <p className="mb-2 text-[15px] text-[#AEAEB2]">
                {s.modules} placas · {mountLabel.toLowerCase()} · {PLACES.find((p) => p.id === place)?.short.toLowerCase()}
              </p>
            </div>

            {/* placas desenhadas */}
            <div className="mt-6 flex flex-wrap gap-1.5">
              {Array.from({ length: Math.min(s.modules, 60) }, (_, i) => (
                <span
                  key={i}
                  className="h-7 w-[18px] rounded-[3px] bg-gradient-to-br from-[#3a3a40] to-[#0e0e11] shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.18)]"
                  style={{ animation: `ios-rise .4s ${i * 0.02}s both` }}
                />
              ))}
              {s.modules > 60 && <span className="self-center pl-1 text-[13px] text-[#8E8E93]">+{s.modules - 60}</span>}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Geração estimada" value={`~${fmt(s.generation)}`} unit="kWh/mês" />
              <Stat label="Área necessária" value={`${s.area}`} unit="m²" />
              <Stat label="Economia na conta" value={`até ${s.savingPct}%`} />
              <Stat label="Por ano, no bolso" value={`~R$ ${fmt(s.saving * 12)}`} />
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-2xl bg-[#9BD373]/10 px-4 py-3">
                <Leaf className="h-5 w-5 text-[#9BD373]" />
                <p className="text-[14px] text-[#C9EBA8]">
                  Evita ~{fmt(s.co2Kg)} kg de CO₂ por ano, como plantar {fmt(Math.max(1, s.trees))} árvores.
                </p>
              </div>
              {s.kit && (
                <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3">
                  <Sun className="h-5 w-5 text-[#F3EA3B]" />
                  <p className="text-[14px] text-[#D1D1D6]">
                    Kit pronto mais próximo: <b className="text-white">Kit {s.kit.name}</b> ({fmt(kitKwp(s.kit.modules), 2)} kWp)
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() =>
                  onAdd({
                    key: "custom:sistema",
                    kind: "custom",
                    title: `Sistema ${fmt(s.kwp, 2)} kWp (${s.modules} placas)`,
                    detail: `${PLACES.find((p) => p.id === place)?.short}, ${mountLabel}, ${grid === "nao-sei" ? "ligação a confirmar" : GRIDS.find((g) => g.id === grid)?.label}, conta ~R$ ${fmt(bill)}`,
                  })
                }
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] text-[16px] font-semibold text-black active:scale-[0.98]"
              >
                <Plus className="h-5 w-5" strokeWidth={2.8} /> Adicionar à minha cotação
              </button>
              <button onClick={() => { setStep(0); setMount(null); setGrid(null); }} className="h-12 rounded-full bg-[#2C2C2E] px-6 text-[15px] font-semibold">
                Refazer
              </button>
            </div>
            <p className="mt-3 text-[12px] text-[#6C6C70]">Estimativa com {fmt(sun, 1)} horas de sol por dia. O projeto final é confirmado na visita técnica.</p>
          </div>
        )}

        {step > 0 && step < 4 && (
          <div className="mt-8 flex items-center justify-between">
            <button onClick={() => setStep(step - 1)} className="inline-flex h-11 items-center gap-1 rounded-full px-3 text-[15px] font-semibold text-[#AEAEB2] hover:text-white">
              <ChevronLeft className="h-5 w-5" /> Voltar
            </button>
            <button disabled={!canNext} onClick={() => setStep(step + 1)} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#fff] px-6 text-[15px] font-semibold text-black disabled:opacity-30">
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Q({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <div className="animate-fade-up">
      <p className="text-[24px] leading-tight font-bold tracking-tight sm:text-[28px]">{title}</p>
      {text && <p className="mt-1 text-[15px] text-[#8E8E93]">{text}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={cx("relative rounded-[24px] p-3 text-left transition active:scale-[0.98]", on ? "bg-[#2C2C2E] ring-2 ring-[#9BD373]" : "bg-[#2C2C2E]/50 hover:bg-[#2C2C2E]")}>
      {children}
      {on && (
        <span className="absolute top-3 right-3 grid h-6 w-6 place-items-center rounded-full bg-[#9BD373] text-black">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/* ----------------------------------------------------- minha cotação */

function QuoteSheet({
  open,
  onClose,
  cart,
  setCart,
  owner,
  waLink,
  onBrowse,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: (f: (c: CartItem[]) => CartItem[]) => void;
  owner: string;
  waLink: (t: string) => string | null;
  onBrowse: () => void;
}) {
  const [form, setForm] = useState({ name: "", phone: "", city: "", email: "", notes: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const opened = useRef(Date.now());
  useEffect(() => {
    if (open) opened.current = Date.now();
  }, [open]);

  const valid = form.name.trim().length >= 2 && form.phone.replace(/\D/g, "").length >= 10 && cart.length > 0;
  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setError("");
    const summary = quoteSummary(cart, form.notes.trim());
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
      setDone(summary);
      setCart(() => []);
    } catch {
      setError("Não conseguimos enviar agora. Tente de novo ou chame no WhatsApp.");
    } finally {
      setBusy(false);
    }
  };

  const input = "h-12 w-full rounded-[14px] bg-[rgba(118,118,128,0.18)] px-4 text-[16px] text-white placeholder:text-[#6C6C70] outline-none focus:ring-2 focus:ring-[#9BD373]/60";

  if (done) {
    const link = waLink(`Olá! Acabei de pedir uma cotação pela loja online.\n\n${done}\n\nMeu nome: ${form.name}`);
    return (
      <Sheet open={open} onClose={() => { setDone(null); onClose(); }} title="">
        <div className="pb-2 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#30D158]/15" style={{ animation: "ios-bounce .5s both" }}>
            <Check className="h-10 w-10 text-[#30D158]" strokeWidth={3} />
          </div>
          <p className="mt-5 text-[26px] font-bold tracking-tight">Pedido enviado!</p>
          <p className="mx-auto mt-2 max-w-sm text-[15px] text-[#AEAEB2]">Um consultor vai falar com você em breve pelo WhatsApp {form.phone}. Se preferir, adiante a conversa agora:</p>
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#30D158] text-[16px] font-semibold text-black">
              <MessageCircle className="h-5 w-5" /> Chamar no WhatsApp
            </a>
          )}
          <button onClick={() => { setDone(null); onClose(); }} className="mt-2 h-12 w-full rounded-full bg-[#2C2C2E] text-[15px] font-semibold">
            Voltar para a loja
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
            <button onClick={submit} disabled={!valid || busy} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] text-[16px] font-semibold text-black transition disabled:opacity-40">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />}
              Solicitar cotação com consultor
            </button>
            <p className="mt-2 text-center text-[12px] text-[#6C6C70]">Grátis e sem compromisso. Seus dados ficam só com a nossa equipe.</p>
          </>
        )
      }
    >
      {cart.length === 0 ? (
        <div className="py-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/[0.06]">
            <ClipboardList className="h-8 w-8 text-[#8E8E93]" />
          </div>
          <p className="mt-4 text-[17px] font-semibold">Sua lista está vazia</p>
          <p className="mt-1 text-[14px] text-[#8E8E93]">Adicione kits, eletropostos, motos, materiais ou serviços.</p>
          <button onClick={onBrowse} className="mt-5 h-11 rounded-full bg-[#fff] px-6 text-[15px] font-semibold text-black">
            Ver produtos
          </button>
        </div>
      ) : (
        <>
          <ul className="overflow-hidden rounded-[20px] bg-[#2C2C2E]/60">
            {cart.map((c, i) => (
              <li key={c.key} className="relative flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold tracking-[0.04em] text-[#9BD373] uppercase">{KIND_LABEL[c.kind]}</p>
                  <p className="truncate text-[15px] font-semibold">{c.title}</p>
                  {c.detail && <p className="truncate text-[13px] text-[#8E8E93]">{c.detail}</p>}
                </div>
                <button onClick={() => setCart((x) => x.filter((y) => y.key !== c.key))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#FF453A] hover:bg-[#FF453A]/10" aria-label={`Remover ${c.title}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
                {i < cart.length - 1 && <span className="absolute right-0 bottom-0 left-4 h-[0.5px] bg-white/[0.1]" />}
              </li>
            ))}
          </ul>
          <button onClick={onBrowse} className="mt-2 flex items-center gap-1 text-[14px] font-semibold text-[#9BD373]">
            <Plus className="h-4 w-4" /> Adicionar mais itens
          </button>

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
              placeholder={cart.some((c) => c.kind === "material") ? "Quantidades e medidas dos materiais, melhor horário para contato…" : "Algo que devemos saber? Melhor horário para contato…"}
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
