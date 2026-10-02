"use client";

/* eslint-disable @next/next/no-img-element */
import { ArrowRight, BarChart3, BatteryCharging, Check, ChevronDown, Droplets, MessageCircle, PlugZap, ShieldCheck, Sun, Wrench, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { whatsappUrl } from "@/lib/format";
import { brl } from "@/lib/pricing";
import { quickEstimate } from "@/lib/quick-estimate";
import type { Segment } from "@/lib/types";
import { SunriseScene } from "./cinematic-scene";
import { CaptureFunnel, type PublicCompany } from "./funnel";

/* ===================================================================== copy */

interface Poster {
  seg: Segment;
  n: string;
  kicker: string;
  title: string;
  accent: string;
  promise: string;
  details: string[];
  cta: string;
  icon: (p: { className?: string }) => ReactNode;
  grade: string;
  glow: string;
}

const POSTERS: Poster[] = [
  {
    seg: "solar",
    n: "01",
    kicker: "Solar",
    title: "Sua própria",
    accent: "usina.",
    promise: "O telhado que hoje só esquenta passa a pagar a sua conta de luz. Todo santo dia.",
    details: ["Estudo feito a partir da sua conta", "Projeto, homologação e instalação inclusos", "Placas e inversor de primeira linha", "Geração acompanhada pelo celular"],
    cta: "Calcular minha usina",
    icon: Sun,
    grade: "from-[#3b1a08] via-[#1a0d10] to-[#07060F]",
    glow: "bg-[#ff9a3c]",
  },
  {
    seg: "save",
    n: "02",
    kicker: "Carregador",
    title: "Abasteça",
    accent: "dormindo.",
    promise: "O posto agora fica na sua garagem. E a recarga custa uma fração do que você gastaria com gasolina.",
    details: ["Wallbox de 7 a 22 kW instalado e pronto", "Circuito exclusivo com todas as proteções", "Funciona com qualquer carro elétrico", "Com solar, a recarga sai quase de graça"],
    cta: "Simular o carregador",
    icon: PlugZap,
    grade: "from-[#071a3b] via-[#0b0f24] to-[#07060F]",
    glow: "bg-[#2F7BF6]",
  },
  {
    seg: "eletroposto",
    n: "03",
    kicker: "Eletroposto",
    title: "Vagas que",
    accent: "faturam.",
    promise: "Quem carrega o carro fica mais tempo, consome mais e volta. Transforme vagas paradas em receita.",
    details: ["Estudo de viabilidade e retorno", "Carregadores rápidos em corrente contínua", "Cobertura solar opcional", "Ideal para postos, hotéis, mercados e restaurantes"],
    cta: "Simular o eletroposto",
    icon: BatteryCharging,
    grade: "from-[#06281c] via-[#08130f] to-[#07060F]",
    glow: "bg-[#1FA36A]",
  },
  {
    seg: "manutencao",
    n: "04",
    kicker: "Manutenção",
    title: "Placa suja é",
    accent: "dinheiro no lixo.",
    promise: "Poeira e fuligem roubam geração em silêncio. A gente devolve cada kWh que a sujeira estava levando.",
    details: ["Limpeza técnica que não risca as placas", "Inspeção completa do sistema", "Relatório com fotos de antes e depois", "Planos semestrais e anuais"],
    cta: "Simular a manutenção",
    icon: Droplets,
    grade: "from-[#062430] via-[#08121a] to-[#07060F]",
    glow: "bg-[#1A9FC0]",
  },
  {
    seg: "gestao",
    n: "05",
    kicker: "Gestão",
    title: "Cada crédito",
    accent: "no lugar certo.",
    promise: "Titularidade, rateio entre imóveis e revisão de contas. A burocracia é nossa, a economia é sua.",
    details: ["Troca de titularidade na distribuidora", "Rateio de créditos entre imóveis", "Revisão de contas e cobranças indevidas", "Relatório mensal de geração e consumo"],
    cta: "Simular a gestão",
    icon: BarChart3,
    grade: "from-[#2b0a26] via-[#140816] to-[#07060F]",
    glow: "bg-[#E0457B]",
  },
];

const BEATS = [
  { n: "01", title: "De dia, o seu telhado vira uma usina.", text: "As placas transformam luz em energia para a sua casa ou empresa. O que você não usa na hora segue para a rede." },
  { n: "02", title: "O que sobra vira crédito.", text: "Cada kWh excedente fica guardado na distribuidora por até 60 meses. É energia no banco." },
  { n: "03", title: "À noite, você usa o que guardou.", text: "No fim do mês, a conta chega com os créditos abatidos. E você paga só o mínimo obrigatório." },
];

const STEPS = [
  { n: "01", title: "Simulação", text: "60 segundos para descobrir quanto você economiza. Sem cadastro chato." },
  { n: "02", title: "Visita técnica", text: "Um técnico avalia o telhado e a parte elétrica. Sem custo e sem compromisso." },
  { n: "03", title: "Projeto e homologação", text: "Engenharia, documentação e aprovação na distribuidora. Tudo por nossa conta." },
  { n: "04", title: "Ligação", text: "Sistema instalado, ligado e monitorado pelo seu celular. Agora é só economizar." },
];

const OBJECTIONS = [
  ["E se chover ou ficar nublado?", "O sistema é dimensionado pela média do ano. O que sobra nos dias de sol forte vira crédito e cobre os dias nublados."],
  ["E se eu me mudar?", "Os créditos podem abater a conta de outro imóvel no seu nome, na mesma distribuidora. E o sistema pode ser desmontado e reinstalado."],
  ["E se der algum problema?", "Os equipamentos têm garantia de fábrica, a instalação tem garantia, e a geração é acompanhada pelo app. Você não fica sozinho."],
  ["E se eu não tiver o dinheiro agora?", "Dá para financiar. Em muitos casos, a parcela fica perto do valor que você já paga de luz. A diferença é que ela um dia acaba."],
  ["Vou zerar a minha conta?", "Sempre fica um valor mínimo: a taxa de disponibilidade, a iluminação pública e parte do uso da rede (Fio B). Mas a maior parte da conta desaparece."],
  ["E se a regra mudar?", "A Lei 14.300 trouxe regras claras para quem gera a própria energia, com uma transição definida. A simulação já considera o que muda."],
];

/* =============================================================== utilidades */

function useReveal() {
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

/** Número que corre até o valor (anima sempre que o valor muda). */
function Rolling({ value, format }: { value: number; format: (v: number) => string }) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      const next = start + (value - start) * (1 - Math.pow(1 - p, 3));
      setV(next);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value]);
  return <span className="tabular-nums">{format(v)}</span>;
}

const Serif = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cx("font-serif font-normal italic", className)}>{children}</span>;

function Chapter({ n, label, className }: { n: string; label: string; className?: string }) {
  return (
    <p data-reveal className={cx("flex items-center gap-3 text-[11px] font-semibold tracking-[0.32em] text-white/45 uppercase", className)}>
      <span className="text-[#F3EA3B]">{n}</span>
      <span className="h-px w-10 bg-white/25" />
      {label}
    </p>
  );
}

/* =================================================================== página */

export function CaptureLanding({ company, initialSegment }: { company: PublicCompany; initialSegment?: Segment | null }) {
  useReveal();
  const brand = company.company_name || "Quark Energia";
  const city = company.city || "";
  const warranty = Number(company.warranty_modules_performance_years) || 25;
  const capture = company.capture ?? {};
  const payments = capture.payments ?? [];
  const gallery = company.gallery ?? [];

  const [bill, setBill] = useState(600);
  const [preset, setPreset] = useState<Segment | null>(initialSegment ?? null);
  const [presetBill, setPresetBill] = useState<number | undefined>(undefined);
  const [funnelKey, setFunnelKey] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [simVisible, setSimVisible] = useState(false);
  const [openPoster, setOpenPoster] = useState<Segment | null>(null);
  const simRef = useRef<HTMLElement>(null);

  const est = useMemo(
    () =>
      quickEstimate({
        bill,
        tariff: Number(company.tariff) || undefined,
        sunHours: Number(company.sunHours) || undefined,
        fioBTariff: company.fioBTariff != null ? Number(company.fioBTariff) : undefined,
        publicLighting: company.publicLighting != null ? Number(company.publicLighting) : undefined,
      }),
    [bill, company.tariff, company.sunHours, company.fioBTariff, company.publicLighting],
  );
  const paid25 = bill * 12 * 25;
  const pctOff = Math.round(est.savingsPct <= 1 ? est.savingsPct * 100 : est.savingsPct);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const el = simRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSimVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const scrollToSim = useCallback(() => {
    requestAnimationFrame(() => {
      const target = window.innerWidth < 1024 ? simRef.current?.querySelector<HTMLElement>("[data-funnel]") : simRef.current;
      if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
    });
  }, []);
  const toSim = useCallback(
    (seg?: Segment, withBill?: number) => {
      if (seg) {
        setPreset(seg);
        setPresetBill(withBill);
        setFunnelKey((k) => k + 1);
      }
      scrollToSim();
    },
    [scrollToSim],
  );
  useEffect(() => {
    if (initialSegment) setTimeout(scrollToSim, 400);
  }, [initialSegment, scrollToSim]);
  const funnelTop = useCallback(() => {
    const el = simRef.current?.querySelector<HTMLElement>("[data-funnel]");
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 90;
    if (Math.abs(window.scrollY - top) > 120) window.scrollTo({ top, behavior: "smooth" });
  }, []);

  const wa = company.whatsapp ? whatsappUrl(company.whatsapp, `Olá! Vim pelo site da ${brand} e quero entender quanto eu economizo com energia solar.`) : null;

  return (
    <div className="notranslate relative min-h-dvh overflow-x-clip bg-[#050409] font-sans text-white antialiased selection:bg-[#F3EA3B] selection:text-[#1C1234]">
      {/* granulado de película sobre a página inteira */}
      <div aria-hidden className="pointer-events-none fixed -inset-[10%] z-[60] opacity-[0.07] mix-blend-overlay">
        <div className="cs-grain cs-grain-move h-full w-full" />
      </div>

      {/* ------------------------------------------------ navegação */}
      <header className={cx("fixed inset-x-0 top-0 z-50 transition-all duration-500", scrolled ? "bg-[#050409]/70 backdrop-blur-2xl" : "bg-transparent")}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:h-20 sm:px-8">
          <a href="#topo" aria-label={brand}>
            <img src="/brand/logo-h-white.png" alt={brand} className="h-8 w-auto sm:h-9" />
          </a>
          <nav className="hidden items-center gap-8 text-[13px] tracking-wide text-white/60 md:flex">
            <a href="#custo" className="transition hover:text-white">Quanto você perde</a>
            <a href="#servicos" className="transition hover:text-white">Serviços</a>
            <a href="#como-funciona" className="transition hover:text-white">Como funciona</a>
            <a href="#duvidas" className="transition hover:text-white">Dúvidas</a>
          </nav>
          <button onClick={() => toSim()} className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-[#050409] transition hover:bg-[#F3EA3B]">
            Simular grátis
          </button>
        </div>
      </header>

      {/* ================================================= CENA 1 · abertura */}
      <section id="topo" className="relative flex min-h-[100svh] items-end overflow-hidden">
        <div className="cs-kenburns absolute inset-0">
          {capture.heroImage ? (
            <img src={capture.heroImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <SunriseScene className="absolute top-0 left-0 aspect-[16/9] h-full w-auto max-w-none [transform:translateX(calc(-66%_+_74vw))] md:static md:aspect-auto md:w-full md:[transform:none]" />
          )}
        </div>
        {capture.heroImage && <div className="absolute inset-0 bg-gradient-to-t from-[#050409] via-[#050409]/40 to-[#050409]/30" />}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(5,4,9,0.75)_100%)]" />
        {/* tarjas de cinema que abrem na entrada */}
        <div className="cs-bar pointer-events-none absolute inset-x-0 top-0 z-10 h-1/2 origin-top bg-[#050409]" />
        <div className="cs-bar pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/2 origin-bottom bg-[#050409]" />

        <div className="relative z-20 mx-auto w-full max-w-7xl px-5 pt-32 pb-20 sm:px-8 sm:pb-28">
          <p className="cs-title text-[11px] font-semibold tracking-[0.4em] text-white/60 uppercase" style={{ ["--d" as string]: "1.1s" }}>
            {brand}
            {city ? ` · ${city}` : ""}
          </p>
          <h1 className="mt-6 max-w-5xl font-display text-[46px] leading-[0.95] font-semibold tracking-[-0.03em] sm:text-[84px] lg:text-[112px]">
            <span className="cs-title block" style={{ ["--d" as string]: "1.3s" }}>
              Pare de alugar
            </span>
            <span className="cs-title block" style={{ ["--d" as string]: "1.5s" }}>
              energia.{" "}
              <Serif className="bg-gradient-to-r from-[#FFE9A3] via-[#F3EA3B] to-[#9BD373] bg-clip-text pr-2 text-transparent">Gere a sua.</Serif>
            </span>
          </h1>
          <p className="cs-title mt-7 max-w-xl text-[17px] leading-relaxed text-white/70 sm:text-lg" style={{ ["--d" as string]: "1.8s" }}>
            Todo mês, uma parte do seu dinheiro vai embora com a conta de luz e nunca mais volta. Com a {brand}, o sol que já bate no seu telhado passa a pagar essa conta por mais de {warranty} anos.
          </p>
          <div className="cs-title mt-9 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ ["--d" as string]: "2s" }}>
            <a href="#custo" className="group inline-flex h-14 items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] pr-2 pl-7 text-[15px] font-bold text-[#1C1234] shadow-[0_20px_50px_-15px_rgba(243,234,59,0.6)] transition hover:brightness-105">
              Calcular quanto eu economizo
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1C1234] text-[#F3EA3B] transition group-hover:translate-x-0.5">
                <ArrowRight className="h-4 w-4" />
              </span>
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-14 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white/85 ring-1 ring-white/25 backdrop-blur transition hover:bg-white/10">
                <MessageCircle className="h-5 w-5" /> Falar com um especialista
              </a>
            )}
          </div>
          <p className="cs-title mt-8 text-[12px] tracking-wide text-white/45" style={{ ["--d" as string]: "2.2s" }}>
            Simulação em 60 segundos · Sem compromisso · Projeto e homologação inclusos
          </p>
        </div>

        <a href="#custo" aria-label="Rolar" className="absolute bottom-6 left-1/2 z-20 hidden -translate-x-1/2 flex-col items-center gap-2 text-[10px] tracking-[0.3em] text-white/40 uppercase sm:flex">
          Role
          <span className="relative h-10 w-px overflow-hidden bg-white/15">
            <span className="cs-scroll absolute inset-0 bg-white/70" />
          </span>
        </a>
      </section>

      {/* ================================================= CENA 2 · o custo invisível */}
      <section id="custo" className="relative scroll-mt-16 py-24 sm:py-36">
        <div className="pointer-events-none absolute top-0 left-1/2 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Chapter n="01" label="O custo invisível" />
          <h2 data-reveal className="mt-6 max-w-4xl font-display text-[36px] leading-[1.02] font-semibold tracking-[-0.025em] sm:text-6xl">
            Uma conta de luz parece pequena. <Serif className="text-white/55">Até você somar.</Serif>
          </h2>

          <div className="mt-14 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            {/* lado escuro: o que você perde */}
            <div data-reveal className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#1a0b14] to-[#0b0710] p-7 ring-1 ring-white/10 sm:p-10">
              <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[#ff4d4d]/10 blur-3xl" />
              <label htmlFor="lp-bill" className="text-sm text-white/55">
                Quanto vem a sua conta de luz por mês?
              </label>
              <p className="mt-2 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
                <Rolling value={bill} format={(v) => brl(Math.round(v / 10) * 10, 0)} />
              </p>
              <input
                id="lp-bill"
                type="range"
                min={150}
                max={5000}
                step={50}
                value={bill}
                onChange={(e) => setBill(Number(e.target.value))}
                className="anam-range mt-6 w-full"
                style={{ ["--fill" as string]: `${((bill - 150) / (5000 - 150)) * 100}%` }}
              />
              <div className="mt-1 flex justify-between text-[11px] text-white/35">
                <span>R$ 150</span>
                <span>R$ 5.000</span>
              </div>
              <div className="mt-10 border-t border-white/10 pt-8">
                <p className="text-sm text-white/55">Em 25 anos, você entrega à distribuidora</p>
                <p className="mt-1 font-display text-[44px] leading-none font-semibold tracking-tight text-[#ff7a6b] sm:text-[64px]">
                  <Rolling value={paid25} format={(v) => brl(v, 0)} />
                </p>
                <p className="mt-3 text-[13px] text-white/40">E isso sem contar os reajustes da tarifa, que acontecem todo ano.</p>
              </div>
            </div>

            {/* lado claro: o que fica com você */}
            <div data-reveal style={{ ["--d" as string]: "0.12s" }} className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#F3EA3B] via-[#d6e563] to-[#6CC690] p-7 text-[#1C1234] sm:p-10">
              <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-white/40 blur-3xl" />
              <p className="relative text-[11px] font-bold tracking-[0.28em] uppercase opacity-60">Com energia solar</p>
              <div className="relative mt-6 grid gap-7">
                <div>
                  <p className="text-sm opacity-70">A sua conta cai para cerca de</p>
                  <p className="font-display text-5xl font-semibold tracking-tight">
                    <Rolling value={est.billAfter} format={(v) => brl(v, 0)} />
                    <span className="text-xl font-medium opacity-60"> /mês</span>
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm opacity-70">No seu bolso, por ano</p>
                    <p className="font-display text-3xl font-semibold">
                      <Rolling value={est.annualSavings} format={(v) => brl(v, 0)} />
                    </p>
                  </div>
                  <div>
                    <p className="text-sm opacity-70">Redução na conta</p>
                    <p className="font-display text-3xl font-semibold">{pctOff}%</p>
                  </div>
                </div>
                <div className="rounded-2xl bg-[#1C1234]/90 p-5 text-white">
                  <p className="text-sm text-white/60">Economia estimada em 25 anos</p>
                  <p className="font-display text-4xl font-semibold text-[#F3EA3B]">
                    <Rolling value={est.savings25y} format={(v) => brl(v, 0)} />
                  </p>
                </div>
              </div>
              <button onClick={() => toSim("solar", bill)} className="group relative mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#1C1234] text-[15px] font-bold text-white transition hover:bg-[#2a1d4d]">
                Quero o estudo completo da minha conta <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>
              <p className="relative mt-3 text-center text-[11px] opacity-60">Estimativa com a tarifa da sua região. O estudo completo considera o seu telhado e o seu consumo real.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================= CENA 3 · a virada */}
      <section className="relative overflow-hidden py-24 sm:py-36">
        <div className="pointer-events-none absolute top-1/3 -left-40 h-[36rem] w-[36rem] rounded-full bg-[#5B34D6]/20 blur-[150px]" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <Chapter n="02" label="A virada" />
          <h2 data-reveal className="mt-6 max-w-4xl font-display text-[36px] leading-[1.02] font-semibold tracking-[-0.025em] sm:text-6xl">
            O sol nasce todos os dias. <Serif className="bg-gradient-to-r from-[#FFE9A3] to-[#F3EA3B] bg-clip-text text-transparent">A questão é para quem ele trabalha.</Serif>
          </h2>
          <div className="mt-16 grid gap-px overflow-hidden rounded-[32px] bg-white/10 ring-1 ring-white/10 md:grid-cols-3">
            {BEATS.map((b, i) => (
              <div key={b.n} data-reveal style={{ ["--d" as string]: `${i * 0.12}s` }} className="relative bg-[#08070e] p-8 sm:p-10">
                <p className="cs-outline font-display text-[88px] leading-none font-bold sm:text-[110px]">{b.n}</p>
                <h3 className="mt-4 font-display text-2xl leading-tight font-semibold">{b.title}</h3>
                <p className="mt-3 leading-relaxed text-white/55">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================= CENA 4 · serviços (pôsteres) */}
      <section id="servicos" className="relative scroll-mt-16 py-24 sm:py-36">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Chapter n="03" label="Em cartaz" />
              <h2 data-reveal className="mt-6 max-w-3xl font-display text-[36px] leading-[1.02] font-semibold tracking-[-0.025em] sm:text-6xl">
                Cinco jeitos de <Serif className="text-[#F3EA3B]">nunca mais</Serif> pagar caro pela energia.
              </h2>
            </div>
            <p data-reveal className="max-w-sm text-white/55">Toque em um cartaz para ver o que está incluso. Cada serviço tem a sua própria simulação.</p>
          </div>
        </div>
        <div className="mt-14 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-6 [scrollbar-width:none] sm:px-8 lg:mx-auto lg:grid lg:max-w-7xl lg:grid-cols-5 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
          {POSTERS.map((p, i) => {
            const open = openPoster === p.seg;
            const photo = capture.serviceImages?.[p.seg];
            return (
              <article
                key={p.seg}
                data-reveal
                style={{ ["--d" as string]: `${i * 0.08}s` }}
                onClick={() => setOpenPoster(open ? null : p.seg)}
                className={cx("group relative aspect-[2/3] w-[78vw] max-w-[320px] shrink-0 cursor-pointer snap-center overflow-hidden rounded-[26px] ring-1 ring-white/10 transition duration-500 sm:w-[46vw] lg:w-auto lg:max-w-none", open ? "ring-[#F3EA3B]/60" : "hover:-translate-y-1.5 hover:ring-white/30")}
              >
                <div className={cx("absolute inset-0 bg-gradient-to-b", p.grade)} />
                {photo && <img src={photo} alt={p.kicker} loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-70 mix-blend-luminosity transition duration-700 group-hover:scale-105" />}
                <div className={cx("absolute -top-16 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full opacity-40 blur-[70px] transition duration-700 group-hover:opacity-70", p.glow)} />
                {!photo && <p.icon className="absolute top-[18%] left-1/2 h-40 w-40 -translate-x-1/2 text-white/[0.07] transition duration-700 group-hover:scale-110 group-hover:text-white/[0.12]" />}
                <div className="absolute inset-0 bg-gradient-to-t from-[#050409] via-[#050409]/50 to-transparent" />

                <div className="relative flex h-full flex-col p-6">
                  <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.3em] text-white/50 uppercase">
                    <span>Nº {p.n}</span>
                    <span>{p.kicker}</span>
                  </div>
                  <div className="mt-auto">
                    <h3 className="font-display text-[28px] leading-[1.02] font-semibold tracking-tight break-words lg:text-[25px] xl:text-[28px]">
                      {p.title} <Serif className="block text-[#F3EA3B]">{p.accent}</Serif>
                    </h3>
                    <p className={cx("mt-3 text-[13px] leading-relaxed text-white/65 transition-all duration-500", open ? "line-clamp-none" : "line-clamp-3")}>{p.promise}</p>
                    <div className={cx("grid transition-all duration-500", open ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                      <ul className="space-y-1.5 overflow-hidden">
                        {p.details.map((d) => (
                          <li key={d} className="flex gap-2 text-[12.5px] text-white/80">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9BD373]" strokeWidth={3} /> {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toSim(p.seg);
                      }}
                      className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white/10 text-[13px] font-semibold ring-1 ring-white/20 backdrop-blur transition hover:bg-white hover:text-[#050409]"
                    >
                      {p.cta} <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ================================================= CENA 5 · como funciona */}
      <section id="como-funciona" className="relative scroll-mt-16 border-y border-white/[0.06] bg-[#08070e] py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Chapter n="04" label="Como funciona" />
          <h2 data-reveal className="mt-6 max-w-3xl font-display text-[36px] leading-[1.02] font-semibold tracking-[-0.025em] sm:text-6xl">
            Você decide. <Serif className="text-white/55">A gente resolve o resto.</Serif>
          </h2>
          <ol className="mt-16 grid gap-10 md:grid-cols-4 md:gap-6">
            {STEPS.map((s, i) => (
              <li key={s.n} data-reveal style={{ ["--d" as string]: `${i * 0.1}s` }} className="relative">
                <div className="flex items-center gap-4">
                  <span className="font-serif text-5xl text-[#F3EA3B] italic">{s.n}</span>
                  {i < STEPS.length - 1 && <span className="hidden h-px flex-1 bg-gradient-to-r from-white/30 to-transparent md:block" />}
                </div>
                <h3 className="mt-4 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/55">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================================================= CENA 6 · simulador */}
      <section id="simulador" ref={simRef} className="relative scroll-mt-16 overflow-hidden py-24 sm:py-36">
        <div className="pointer-events-none absolute top-10 left-[15%] h-[34rem] w-[34rem] rounded-full bg-[#ff9a3c]/10 blur-[150px]" />
        <div className="pointer-events-none absolute right-[10%] bottom-0 h-[28rem] w-[28rem] rounded-full bg-[#5B34D6]/25 blur-[140px]" />
        <div className="relative mx-auto grid max-w-7xl items-start gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_440px]">
          <div className="lg:sticky lg:top-32">
            <Chapter n="05" label="O seu estudo" />
            <h2 data-reveal className="mt-6 font-display text-[36px] leading-[1.02] font-semibold tracking-[-0.025em] sm:text-6xl">
              Em 60 segundos, você sabe <Serif className="bg-gradient-to-r from-[#FFE9A3] to-[#9BD373] bg-clip-text text-transparent">exatamente</Serif> quanto vai economizar.
            </h2>
            <p data-reveal className="mt-6 max-w-lg text-lg leading-relaxed text-white/60">
              Sem planilha, sem visita, sem vendedor insistente. Você responde poucas perguntas e vê na hora o tamanho do sistema, a economia e as formas de pagamento.
            </p>
            <ul data-reveal className="mt-8 space-y-3">
              {["Cálculo com a tarifa e as regras atuais da distribuidora", "Resultado na tela e no seu e-mail", "Um especialista só te chama se você quiser"].map((t) => (
                <li key={t} className="flex items-center gap-3 text-white/75">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#9BD373]/20 text-[#9BD373]">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div data-funnel className="relative">
            <div className="absolute -inset-4 rounded-[48px] bg-gradient-to-br from-[#F3EA3B]/25 via-[#ff9a3c]/10 to-[#5B34D6]/30 blur-2xl" />
            <div className="relative overflow-hidden rounded-[38px] bg-[#0E0A1C] ring-1 ring-white/15 shadow-[0_50px_100px_-30px_rgba(0,0,0,1)]">
              <CaptureFunnel key={funnelKey} company={company} inline initialSegment={preset} initialBill={presetBill} onStepChange={funnelTop} />
            </div>
          </div>
        </div>
      </section>

      {/* ================================================= obras (película) */}
      {gallery.length > 0 && (
        <section className="relative overflow-hidden py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Chapter n="—" label="Bastidores · obras entregues" />
          </div>
          <div className="mt-10 bg-black py-4">
            <div className="flex w-max gap-3 lp-marquee">
              {[...gallery, ...gallery].map((src, i) => (
                <div key={i} className="relative h-56 w-80 shrink-0 overflow-hidden rounded-md sm:h-72 sm:w-[26rem]">
                  <img src={src} alt={`Obra ${(i % gallery.length) + 1}`} loading="lazy" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ================================================= CENA 7 · objeções */}
      <section id="duvidas" className="relative scroll-mt-16 py-24 sm:py-36">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Chapter n="06" label="E se…?" />
          <h2 data-reveal className="mt-6 max-w-3xl font-display text-[36px] leading-[1.02] font-semibold tracking-[-0.025em] sm:text-6xl">
            As perguntas que todo mundo faz <Serif className="text-white/55">antes de decidir.</Serif>
          </h2>
          <div className="mt-14 grid gap-3 md:grid-cols-2">
            {OBJECTIONS.map(([q, a], i) => (
              <Objection key={q} q={q} a={a} delay={(i % 2) * 0.08} />
            ))}
          </div>
        </div>
      </section>

      {/* ================================================= CENA 8 · oferta */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid items-end gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <Chapter n="07" label="Pagamento" />
              <h2 data-reveal className="mt-6 font-display text-[36px] leading-[1.02] font-semibold tracking-[-0.025em] sm:text-6xl">
                Troque a conta de luz por uma parcela <Serif className="text-[#F3EA3B]">que um dia acaba.</Serif>
              </h2>
            </div>
            <p data-reveal className="text-lg leading-relaxed text-white/60">
              Em muitos casos, o financiamento cabe no valor que você já gasta com energia todo mês. A diferença: a parcela tem fim. A conta de luz, não.
            </p>
          </div>
          {payments.length > 0 && (
            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {payments.map((p, i) => {
                const best = i === payments.length - 1;
                return (
                  <div key={p.title} data-reveal style={{ ["--d" as string]: `${i * 0.08}s` }} className={cx("relative overflow-hidden rounded-[28px] p-8 ring-1", best ? "bg-gradient-to-br from-[#F3EA3B] to-[#9BD373] text-[#1C1234] ring-transparent" : "bg-white/[0.04] ring-white/10")}>
                    <p className={cx("text-[11px] font-bold tracking-[0.28em] uppercase", best ? "opacity-60" : "text-white/40")}>Opção {i + 1}</p>
                    <p className="mt-4 font-display text-2xl font-semibold">{p.title}</p>
                    <p className={cx("mt-2", best ? "opacity-75" : "text-white/55")}>{p.text}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* garantia */}
          <div data-reveal className="mt-6 grid items-center gap-8 overflow-hidden rounded-[28px] bg-white/[0.03] p-8 ring-1 ring-white/10 sm:p-10 lg:grid-cols-[auto_1fr]">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[88px] leading-none font-bold tracking-tight sm:text-[120px]">{warranty}</span>
              <span className="font-serif text-2xl text-[#F3EA3B] italic">anos</span>
            </div>
            <div>
              <p className="font-display text-2xl font-semibold">de garantia de performance nas placas.</p>
              <div className="mt-5 grid gap-3 text-[14px] text-white/60 sm:grid-cols-2">
                {[
                  [<ShieldCheck key="s" className="h-4 w-4" />, "Equipamentos de primeira linha, com certificação"],
                  [<Wrench key="w" className="h-4 w-4" />, "Projeto assinado por responsável técnico"],
                  [<Zap key="z" className="h-4 w-4" />, "Homologação na distribuidora por nossa conta"],
                  [<MessageCircle key="m" className="h-4 w-4" />, "Pós-venda de perto, com equipe da região"],
                ].map(([icon, t]) => (
                  <p key={String(t)} className="flex items-center gap-2.5">
                    <span className="text-[#9BD373]">{icon}</span> {t}
                  </p>
                ))}
              </div>
            </div>
          </div>
          {company.about && (
            <p data-reveal className="mx-auto mt-14 max-w-3xl text-center font-serif text-xl leading-relaxed text-white/60 italic">
              “{company.about}”
            </p>
          )}
        </div>
      </section>

      {/* ================================================= CENA FINAL */}
      <section className="relative flex min-h-[86svh] items-center overflow-hidden">
        <div className="absolute inset-0">
          <SunriseScene className="h-full w-full" rise={false} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#050409] via-[#050409]/40 to-[#050409]/80" />
        <div className="relative mx-auto w-full max-w-5xl px-5 py-24 text-center sm:px-8">
          <p data-reveal className="text-[11px] font-semibold tracking-[0.4em] text-white/55 uppercase">Fim? Não. Começo.</p>
          <h2 data-reveal className="mt-6 font-display text-[40px] leading-[0.98] font-semibold tracking-[-0.03em] sm:text-7xl">
            Amanhã o sol nasce de novo.
            <Serif className="mt-2 block bg-gradient-to-r from-[#FFE9A3] via-[#F3EA3B] to-[#9BD373] bg-clip-text text-transparent">Ele vai trabalhar para você ou para a distribuidora?</Serif>
          </h2>
          <div data-reveal className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={() => toSim("solar", bill)} className="group inline-flex h-14 items-center gap-3 rounded-full bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] pr-2 pl-7 text-[15px] font-bold text-[#1C1234] shadow-[0_20px_50px_-15px_rgba(243,234,59,0.6)]">
              Fazer minha simulação grátis
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1C1234] text-[#F3EA3B] transition group-hover:translate-x-0.5">
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-14 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white/85 ring-1 ring-white/25 backdrop-blur hover:bg-white/10">
                <MessageCircle className="h-5 w-5" /> Prefiro conversar no WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-10 pb-28 sm:pb-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 text-center text-[13px] text-white/40 sm:flex-row sm:px-8 sm:text-left">
          <img src="/brand/logo-h-white.png" alt={brand} className="h-8 w-auto opacity-80" />
          <p>
            {brand}
            {city ? ` · ${city}` : ""}
            {company.instagram ? ` · @${String(company.instagram).replace(/^@/, "")}` : ""}
            {company.tech_name ? ` · Responsável técnico: ${company.tech_name}` : ""}
          </p>
        </div>
      </footer>

      {/* atalhos fixos no celular */}
      <div className={cx("fixed inset-x-3 bottom-3 z-50 flex gap-2 transition-all duration-500 sm:hidden", scrolled && !simVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-8 opacity-0")}>
        <button onClick={() => toSim()} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] py-4 text-[15px] font-bold text-[#1C1234] shadow-[0_14px_30px_-10px_rgba(243,234,59,0.7)]">
          Simular grátis <ArrowRight className="h-4 w-4" />
        </button>
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="grid w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_14px_30px_-10px_rgba(37,211,102,0.7)]">
            <MessageCircle className="h-6 w-6" />
          </a>
        )}
      </div>
      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="fixed right-6 bottom-6 z-50 hidden h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_14px_30px_-10px_rgba(37,211,102,0.8)] transition hover:scale-105 sm:grid">
          <MessageCircle className="h-7 w-7" />
        </a>
      )}
    </div>
  );
}

function Objection({ q, a, delay }: { q: string; a: string; delay: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div data-reveal style={{ ["--d" as string]: `${delay}s` }} className={cx("rounded-[22px] ring-1 transition duration-300", open ? "bg-white/[0.06] ring-[#F3EA3B]/40" : "bg-white/[0.025] ring-white/10 hover:bg-white/[0.045]")}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left">
        <span className="font-display text-lg font-semibold">{q}</span>
        <ChevronDown className={cx("h-5 w-5 shrink-0 text-[#F3EA3B] transition duration-300", open && "rotate-180")} />
      </button>
      <div className={cx("grid transition-all duration-300", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <p className="px-6 pb-6 leading-relaxed text-white/60">{a}</p>
        </div>
      </div>
    </div>
  );
}
