"use client";

/* eslint-disable @next/next/no-img-element */
import {
  ArrowRight,
  BadgeCheck,
  BatteryCharging,
  BarChart3,
  Check,
  ChevronDown,
  ClipboardCheck,
  Cpu,
  Droplets,
  FileSignature,
  HardHat,
  HeartHandshake,
  MapPin,
  MessageCircle,
  PlugZap,
  ShieldCheck,
  Smartphone,
  Sun,
  Wrench,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { whatsappUrl } from "@/lib/format";
import { brl, fmtNum } from "@/lib/pricing";
import { FIXED_INVERTER_BRAND, FIXED_INVERTER_IMAGE, FIXED_MODULE_IMAGE, productImg } from "@/lib/product-images";
import { quickEstimate } from "@/lib/quick-estimate";
import type { Segment } from "@/lib/types";
import { CaptureFunnel, type PublicCompany } from "./funnel";
import { CleaningArt, EvChargerArt, ManagementArt, SolarHouseArt, StationArt } from "./landing-art";

/* ------------------------------------------------------------------ conteúdo */

interface Service {
  seg: Segment;
  name: string;
  tagline: string;
  text: string;
  bullets: string[];
  stat: { value: string; label: string };
  icon: ReactNode;
  color: string;
  Art: (p: { className?: string }) => ReactNode;
}

const SERVICES: Service[] = [
  {
    seg: "solar",
    name: "Energia solar",
    tagline: "Gere a sua própria energia e pague só a taxa mínima.",
    text: "Projetamos o sistema certo para o seu consumo, cuidamos de toda a burocracia com a distribuidora e instalamos com equipe própria. O sol passa a pagar a sua conta de luz por mais de 25 anos.",
    bullets: ["Estudo a partir da sua conta de luz", "Projeto de engenharia e homologação na distribuidora", "Placas e inversor de primeira linha", "Monitoramento da geração pelo celular"],
    stat: { value: "até 95%", label: "de economia na conta" },
    icon: <Sun className="h-5 w-5" />,
    color: "from-[#F3EA3B] to-[#F3A33B]",
    Art: SolarHouseArt,
  },
  {
    seg: "save",
    name: "Carregador para carro elétrico",
    tagline: "Abasteça em casa, enquanto dorme, por uma fração da gasolina.",
    text: "O S.A.V.E é o carregador instalado e pronto para uso: avaliamos a sua instalação elétrica, dimensionamos o circuito com toda a proteção e entregamos funcionando. Com energia solar, a recarga sai praticamente de graça.",
    bullets: ["Wallbox de 7 a 22 kW, monofásico ou trifásico", "Circuito exclusivo com proteções", "Instalação por eletrotécnico responsável", "Compatível com todos os carros elétricos e híbridos plug-in"],
    stat: { value: "até 4x", label: "mais barato que gasolina" },
    icon: <PlugZap className="h-5 w-5" />,
    color: "from-[#7CC4FF] to-[#2F7BF6]",
    Art: EvChargerArt,
  },
  {
    seg: "eletroposto",
    name: "Eletroposto de carga rápida",
    tagline: "Transforme o seu estacionamento numa nova fonte de receita.",
    text: "Para postos, hotéis, restaurantes, mercados e shoppings: estudamos o fluxo do seu negócio, dimensionamos a potência e entregamos o eletroposto operando, com a opção de gerar a própria energia com placas na cobertura.",
    bullets: ["Estudo de viabilidade e retorno", "Carregadores rápidos em corrente contínua", "Cobertura solar opcional", "Atrai clientes que ficam mais tempo no seu negócio"],
    stat: { value: "nova", label: "fonte de receita" },
    icon: <BatteryCharging className="h-5 w-5" />,
    color: "from-[#8FE3B0] to-[#1FA36A]",
    Art: StationArt,
  },
  {
    seg: "manutencao",
    name: "Limpeza e manutenção de usina",
    tagline: "Placa suja gera menos. Recupere o que você está perdendo.",
    text: "Poeira, fuligem e fezes de pássaros reduzem a geração sem você perceber. Fazemos a limpeza técnica com produtos adequados e uma inspeção completa do sistema, das placas ao inversor.",
    bullets: ["Limpeza que não risca nem perde a garantia", "Inspeção de conexões, estrutura e inversor", "Relatório com fotos de antes e depois", "Planos semestrais e anuais"],
    stat: { value: "até 25%", label: "de geração recuperada" },
    icon: <Droplets className="h-5 w-5" />,
    color: "from-[#7DE3F0] to-[#1A9FC0]",
    Art: CleaningArt,
  },
  {
    seg: "gestao",
    name: "Gestão energética",
    tagline: "Seus créditos de energia trabalhando do jeito certo.",
    text: "Cuidamos da parte chata: troca de titularidade, rateio dos créditos entre imóveis, revisão das contas e acompanhamento mensal para garantir que nenhum kWh gerado seja desperdiçado.",
    bullets: ["Troca de titularidade junto à distribuidora", "Rateio de créditos entre imóveis", "Revisão de contas e cobranças indevidas", "Relatório mensal de geração e consumo"],
    stat: { value: "todo mês", label: "acompanhamento dos créditos" },
    icon: <BarChart3 className="h-5 w-5" />,
    color: "from-[#FF9DB8] to-[#E0457B]",
    Art: ManagementArt,
  },
];

const STEPS = [
  { icon: <Smartphone className="h-5 w-5" />, title: "Simulação grátis", text: "Em 1 minuto você vê a economia, o tamanho do sistema e o retorno." },
  { icon: <HardHat className="h-5 w-5" />, title: "Visita técnica", text: "Nosso técnico avalia o telhado e a parte elétrica, sem custo." },
  { icon: <FileSignature className="h-5 w-5" />, title: "Projeto e homologação", text: "Fazemos o projeto e cuidamos de toda a burocracia com a distribuidora." },
  { icon: <Zap className="h-5 w-5" />, title: "Instalação e economia", text: "Instalamos, ligamos o sistema e você acompanha a geração pelo app." },
];

const DIFFERENTIALS = [
  { icon: <Cpu className="h-5 w-5" />, title: "Equipamentos premium", text: "Placas de alta eficiência e inversores de marcas reconhecidas, com certificação." },
  { icon: <ClipboardCheck className="h-5 w-5" />, title: "Engenharia própria", text: "Projeto feito para o seu imóvel e assinado por responsável técnico." },
  { icon: <ShieldCheck className="h-5 w-5" />, title: "Garantias de verdade", text: "Garantia dos equipamentos, da instalação e da performance das placas." },
  { icon: <FileSignature className="h-5 w-5" />, title: "Tudo digital", text: "Proposta online, procuração e contrato assinados pelo celular." },
  { icon: <Wrench className="h-5 w-5" />, title: "Pós-venda de perto", text: "Acompanhamos a geração e cuidamos da limpeza e manutenção." },
  { icon: <HeartHandshake className="h-5 w-5" />, title: "Atendimento local", text: "Equipe da região, que conhece a distribuidora e responde rápido." },
];

const FAQ = [
  ["Energia solar funciona em dia nublado ou de chuva?", "Funciona, com geração menor. O sistema é dimensionado pela média do ano: nos dias de sol forte ele gera mais do que você consome e o excedente vira crédito na distribuidora, que compensa os dias de pouca geração."],
  ["O que acontece com a energia que eu não uso na hora?", "Ela vai para a rede e vira crédito em kWh na sua conta, válido por 60 meses. À noite e em dias nublados você usa esses créditos."],
  ["Vou zerar a conta de luz?", "A conta cai bastante, mas sempre fica um valor mínimo: a taxa de disponibilidade, a iluminação pública e, pela Lei 14.300, uma parte do uso da rede (Fio B). A simulação já considera tudo isso."],
  ["Em quanto tempo o sistema se paga?", "Depende da sua conta e da forma de pagamento, mas costuma se pagar em poucos anos. Depois disso, a economia vira lucro por mais de duas décadas. Na simulação você vê o retorno estimado para o seu caso."],
  ["Posso usar os créditos em outro imóvel?", "Sim. Pelo autoconsumo remoto, os créditos podem abater a conta de outro imóvel no mesmo CPF ou CNPJ, na mesma distribuidora. Cuidamos desse rateio na gestão energética."],
  ["Precisa de manutenção?", "Pouca. Basicamente limpeza periódica das placas e uma inspeção do sistema. Oferecemos planos de limpeza e manutenção para manter a geração no máximo."],
  ["Dá para parcelar?", "Sim. Trabalhamos com pagamento à vista com desconto, cartão de crédito e financiamento, em que a parcela muitas vezes fica parecida com a conta que você já paga hoje."],
];

/* ------------------------------------------------------------------ utilidades */

/** Revela elementos com [data-reveal] quando entram na tela. */
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
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

function CountUp({ to, prefix = "", suffix = "", decimals = 0 }: { to: number; prefix?: string; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 1400);
        setV(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ página */

export function CaptureLanding({ company, initialSegment }: { company: PublicCompany; initialSegment?: Segment | null }) {
  useReveal();
  const brand = company.company_name || "Quark Energia";
  const city = company.city || "";
  const warranty = Number(company.warranty_modules_performance_years) || 25;
  const capture = company.capture ?? {};
  const payments = capture.payments ?? [];
  const gallery = company.gallery ?? [];
  const [preset, setPreset] = useState<Segment | null>(initialSegment ?? null);
  const [funnelKey, setFunnelKey] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const simRef = useRef<HTMLElement>(null);

  // Exemplo do cartão do topo: conta de R$ 600 com os parâmetros da empresa.
  const example = useMemo(
    () =>
      quickEstimate({
        bill: 600,
        tariff: Number(company.tariff) || undefined,
        sunHours: Number(company.sunHours) || undefined,
        fioBTariff: company.fioBTariff != null ? Number(company.fioBTariff) : undefined,
        publicLighting: company.publicLighting != null ? Number(company.publicLighting) : undefined,
      }),
    [company.tariff, company.sunHours, company.fioBTariff, company.publicLighting],
  );

  // A barra fixa do celular some enquanto o simulador está na tela.
  const [simVisible, setSimVisible] = useState(false);
  useEffect(() => {
    const el = simRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSimVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Link com ?interesse=… vai direto para o simulador.
  useEffect(() => {
    if (initialSegment)
      setTimeout(() => {
        const target = window.innerWidth < 1024 ? simRef.current?.querySelector<HTMLElement>("[data-funnel]") : simRef.current;
        if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
      }, 300);
  }, [initialSegment]);

  const toSim = useCallback((seg?: Segment) => {
    if (seg) {
      setPreset(seg);
      setFunnelKey((k) => k + 1);
    }
    // No celular vai direto para o simulador; no computador mostra a seção inteira.
    requestAnimationFrame(() => {
      const target = window.innerWidth < 1024 ? simRef.current?.querySelector<HTMLElement>("[data-funnel]") : simRef.current;
      if (!target) return;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
    });
  }, []);
  const funnelTop = useCallback(() => {
    const el = simRef.current?.querySelector<HTMLElement>("[data-funnel]");
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 90;
    if (Math.abs(window.scrollY - top) > 120) window.scrollTo({ top, behavior: "smooth" });
  }, []);

  const wa = company.whatsapp ? whatsappUrl(company.whatsapp, `Olá! Vim pelo site da ${brand} e quero saber mais sobre energia solar.`) : null;
  const nav = [
    ["Serviços", "#servicos"],
    ["Como funciona", "#como-funciona"],
    ...(gallery.length ? [["Obras", "#obras"]] : []),
    ["Dúvidas", "#duvidas"],
  ];

  return (
    <div className="notranslate min-h-dvh overflow-x-clip bg-[#07060F] font-sans text-white antialiased">
      {/* ------------------------------------------------ navegação */}
      <header className={cx("fixed inset-x-0 top-0 z-40 transition-all duration-300", scrolled ? "bg-[#07060F]/75 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/5 backdrop-blur-2xl" : "bg-transparent")}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-[72px] sm:px-6">
          <a href="#topo" aria-label={brand}>
            <img src="/brand/logo-h-white.png" alt={brand} className="h-8 w-auto sm:h-9" />
          </a>
          <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
            {nav.map(([l, h]) => (
              <a key={h} href={h} className="transition hover:text-white">
                {l}
              </a>
            ))}
          </nav>
          <button onClick={() => toSim()} className="lp-shine relative overflow-hidden rounded-full bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] px-4 py-2 text-sm font-bold text-[#1C1234] shadow-[0_8px_24px_-8px_rgba(243,234,59,0.7)] transition hover:brightness-105 sm:px-5 sm:py-2.5">
            Simular grátis
          </button>
        </div>
      </header>

      {/* ------------------------------------------------ hero */}
      <section id="topo" className="relative overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-24">
        <div className="lp-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div className="pointer-events-none absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full bg-[#5B34D6]/40 blur-[130px]" />
        <div className="pointer-events-none absolute top-20 -right-40 h-[30rem] w-[30rem] rounded-full bg-[#9BD373]/20 blur-[130px]" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#F3EA3B]/10 blur-[110px]" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p data-reveal className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3.5 py-1.5 text-[12px] font-semibold text-[#F3EA3B] ring-1 ring-white/10 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#9BD373] opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#9BD373]" />
              </span>
              Energia solar{city ? ` em ${city}` : ""} · simulação gratuita
            </p>
            <h1 data-reveal style={{ ["--d" as string]: "0.08s" }} className="mt-5 font-display text-[40px] leading-[1.02] font-semibold tracking-tight sm:text-6xl lg:text-[68px]">
              Sua conta de luz pode cair{" "}
              <span className="bg-gradient-to-r from-[#F3EA3B] via-[#c8e05a] to-[#6CC690] bg-clip-text text-transparent">até 95%</span>.
            </h1>
            <p data-reveal style={{ ["--d" as string]: "0.16s" }} className="mt-5 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
              Energia solar, carregador para carro elétrico, eletroposto, limpeza de usinas e gestão de créditos. Do projeto à instalação, a {brand} cuida de tudo para você parar de pagar caro na luz.
            </p>
            <div data-reveal style={{ ["--d" as string]: "0.24s" }} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => toSim("solar")} className="group lp-shine relative inline-flex h-14 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] px-7 text-[16px] font-bold text-[#1C1234] shadow-[0_18px_40px_-14px_rgba(243,234,59,0.75)] transition hover:brightness-105">
                Simular minha economia <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" />
              </button>
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-white/[0.07] px-6 text-[15px] font-semibold ring-1 ring-white/15 backdrop-blur transition hover:bg-white/[0.12]">
                  <MessageCircle className="h-5 w-5 text-[#25D366]" /> Falar no WhatsApp
                </a>
              )}
            </div>
            <div data-reveal style={{ ["--d" as string]: "0.32s" }} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-white/60">
              {["Homologação com a distribuidora", `Garantia de performance de ${warranty} anos`, payments[2]?.title || "Financiamento facilitado"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="h-4 w-4 text-[#9BD373]" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Visual */}
          <div data-reveal style={{ ["--d" as string]: "0.2s" }} className="relative mx-auto w-full max-w-[540px]">
            <div className="absolute -inset-6 rounded-[44px] bg-gradient-to-br from-[#F3EA3B]/25 via-transparent to-[#6CC690]/25 blur-2xl" />
            <div className="relative overflow-hidden rounded-[32px] ring-1 ring-white/15 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]">
              {capture.heroImage ? <img src={capture.heroImage} alt={`Obra da ${brand}`} className="aspect-[4/3] w-full object-cover" /> : <SolarHouseArt className="block aspect-[4/3] w-full" />}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07060F]/50 via-transparent to-transparent" />
            </div>
            <div className="lp-float absolute -bottom-6 -left-3 rounded-2xl bg-white/90 p-3.5 text-[#1C1234] shadow-2xl ring-1 ring-white backdrop-blur-xl sm:-left-8 sm:p-4">
              <p className="text-[11px] font-semibold text-ink-500">Conta de R$ 600 vira</p>
              <p className="font-display text-2xl font-bold">{brl(example.billAfter, 0)}</p>
              <p className="text-[11px] font-semibold text-emerald-600">−{Math.round(example.savingsPct <= 1 ? example.savingsPct * 100 : example.savingsPct)}% todo mês</p>
            </div>
            <div className="lp-float absolute -top-5 -right-2 rounded-2xl bg-[#1C1234]/85 p-3.5 shadow-2xl ring-1 ring-white/15 backdrop-blur-xl [animation-delay:-3s] sm:-right-6 sm:p-4">
              <p className="text-[11px] font-semibold text-white/55">Economia por ano</p>
              <p className="font-display text-2xl font-bold text-[#F3EA3B]">{brl(example.annualSavings, 0)}</p>
              <p className="text-[11px] text-white/55">{fmtNum(example.kwp, 1)} kWp · {example.modules} placas</p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ faixa de números */}
      <section className="relative border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4">
          {[
            { v: <CountUp to={95} prefix="até " suffix="%" />, l: "de economia na conta de luz" },
            { v: <CountUp to={warranty} suffix=" anos" />, l: "de garantia de performance das placas" },
            { v: <CountUp to={Math.round(example.annualSavings)} prefix="R$ " />, l: "de economia por ano numa conta de R$ 600" },
            { v: <CountUp to={1} suffix=" minuto" />, l: "para simular a sua economia" },
          ].map((x, i) => (
            <div key={i} data-reveal style={{ ["--d" as string]: `${i * 0.08}s` }} className="text-center lg:text-left">
              <p className="bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] bg-clip-text font-display text-3xl font-semibold text-transparent sm:text-4xl">{x.v}</p>
              <p className="mt-1 text-sm text-white/55">{x.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ serviços */}
      <section id="servicos" className="relative scroll-mt-20 py-20 sm:py-28">
        <div className="pointer-events-none absolute top-1/3 -left-40 h-96 w-96 rounded-full bg-[#5B34D6]/25 blur-[130px]" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle kicker="Nossos serviços" title="Uma empresa, cinco formas de economizar" sub="Escolha o que faz sentido para você. Cada serviço tem uma simulação própria, com os números do seu caso." />

          <div className="mt-12 flex snap-x gap-2 overflow-x-auto pb-2 [scrollbar-width:none] sm:flex-wrap sm:justify-center [&::-webkit-scrollbar]:hidden">
            {SERVICES.map((s) => (
              <a key={s.seg} href={`#svc-${s.seg}`} className="inline-flex shrink-0 snap-start items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/80 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
                <span className={cx("grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br text-[#1C1234] [&_svg]:h-3.5 [&_svg]:w-3.5", s.color)}>{s.icon}</span>
                {s.name}
              </a>
            ))}
          </div>

          <div className="mt-14 space-y-20 sm:space-y-28">
            {SERVICES.map((s, i) => (
              <article id={`svc-${s.seg}`} key={s.seg} className={cx("grid scroll-mt-28 items-center gap-10 lg:grid-cols-2 lg:gap-16", i % 2 === 1 && "lg:[&>*:first-child]:order-2")}>
                <div data-reveal className="relative">
                  <div className={cx("absolute -inset-4 rounded-[40px] bg-gradient-to-br opacity-25 blur-2xl", s.color)} />
                  <div className="relative overflow-hidden rounded-[30px] ring-1 ring-white/10 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.9)]">
                    {capture.serviceImages?.[s.seg] ? <img src={capture.serviceImages[s.seg]} alt={s.name} loading="lazy" className="aspect-[4/3] w-full object-cover" /> : <s.Art className="block aspect-[4/3] w-full" />}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07060F]/60 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 rounded-2xl bg-white/90 px-4 py-2.5 text-[#1C1234] shadow-xl backdrop-blur">
                      <p className="font-display text-xl leading-none font-bold">{s.stat.value}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-ink-500">{s.stat.label}</p>
                    </div>
                  </div>
                  {s.seg === "solar" && (
                    <div className="absolute -right-2 -bottom-8 hidden gap-2 sm:flex">
                      {[
                        { src: FIXED_MODULE_IMAGE, label: "Placas bifaciais" },
                        { src: FIXED_INVERTER_IMAGE, label: `Inversor ${FIXED_INVERTER_BRAND}` },
                      ].map((p) => (
                        <div key={p.label} className="lp-float w-28 rounded-2xl bg-white/95 p-2 text-center shadow-2xl ring-1 ring-white">
                          <img src={productImg(p.src)} alt={p.label} loading="lazy" className="mx-auto h-20 w-full object-contain" />
                          <p className="mt-1 text-[10px] font-bold text-[#1C1234]">{p.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div data-reveal style={{ ["--d" as string]: "0.1s" }}>
                  <span className={cx("inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-[#1C1234] shadow-lg", s.color)}>{s.icon}</span>
                  <h3 className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{s.name}</h3>
                  <p className="mt-2 text-lg text-[#F3EA3B]/90">{s.tagline}</p>
                  <p className="mt-4 leading-relaxed text-white/60">{s.text}</p>
                  <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm text-white/80">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#9BD373]/20 text-[#9BD373]">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => toSim(s.seg)} className="group mt-8 inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-6 text-[15px] font-bold text-[#1C1234] shadow-[0_14px_30px_-14px_rgba(255,255,255,0.5)] transition hover:bg-[#F3EA3B]">
                    Simular {s.seg === "solar" ? "energia solar" : s.name.toLowerCase()} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ como funciona */}
      <section id="como-funciona" className="relative scroll-mt-20 overflow-hidden bg-gradient-to-b from-[#0E0A1C] to-[#07060F] py-20 sm:py-28">
        <div className="pointer-events-none absolute -right-32 top-10 h-96 w-96 rounded-full bg-[#9BD373]/15 blur-[130px]" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle kicker="Como funciona" title="Do primeiro contato à conta baixa" sub="Você acompanha cada etapa pelo celular. A burocracia fica com a gente." />
          <div className="relative mt-14 grid gap-5 md:grid-cols-4">
            <div className="absolute top-7 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-[#F3EA3B]/0 via-[#F3EA3B]/50 to-[#6CC690]/0 md:block" />
            {STEPS.map((s, i) => (
              <div key={s.title} data-reveal style={{ ["--d" as string]: `${i * 0.1}s` }} className="relative rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 backdrop-blur md:bg-transparent md:p-0 md:text-center md:ring-0">
                <span className="relative inline-grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#2a1d4d] to-[#1C1234] text-[#F3EA3B] shadow-[0_14px_30px_-12px_rgba(91,52,214,0.8)] ring-1 ring-white/15">
                  {s.icon}
                  <span className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#F3EA3B] to-[#9BD373] text-[11px] font-bold text-[#1C1234]">{i + 1}</span>
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/55">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ simulador */}
      <section id="simulador" ref={simRef} className="relative scroll-mt-16 overflow-hidden py-20 sm:py-28">
        <div className="pointer-events-none absolute top-1/4 left-1/4 h-[30rem] w-[30rem] rounded-full bg-[#5B34D6]/30 blur-[140px]" />
        <div className="pointer-events-none absolute right-10 bottom-0 h-80 w-80 rounded-full bg-[#F3EA3B]/10 blur-[120px]" />
        <div className="relative mx-auto grid max-w-6xl items-start gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_440px]">
          <div className="lg:sticky lg:top-28">
            <SectionTitle align="left" kicker="Simulação gratuita" title="Veja os seus números em 1 minuto" sub="Responda poucas perguntas e receba na hora a economia, o tamanho do sistema e as formas de pagamento. Sem compromisso." />
            <ul className="mt-8 grid gap-3">
              {["Cálculo com a tarifa e as regras atuais da distribuidora", "Resultado na tela e por e-mail", "Um especialista te chama só se você quiser"].map((t) => (
                <li key={t} className="flex items-center gap-3 text-white/75">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#F3EA3B] to-[#9BD373] text-[#1C1234]">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#9BD373] hover:underline">
                <MessageCircle className="h-4 w-4" /> Prefere conversar? Chame no WhatsApp
              </a>
            )}
          </div>
          <div data-funnel className="relative">
            <div className="absolute -inset-3 rounded-[46px] bg-gradient-to-br from-[#F3EA3B]/30 via-[#5B34D6]/20 to-[#6CC690]/30 blur-xl" />
            <div className="relative overflow-hidden rounded-[38px] bg-[#0E0A1C] ring-1 ring-white/15 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95)]">
              <CaptureFunnel key={funnelKey} company={company} inline initialSegment={preset} onStepChange={funnelTop} />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ obras */}
      {gallery.length > 0 && (
        <section id="obras" className="relative scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionTitle kicker="Obras entregues" title="Projetos que já estão gerando economia" />
            <div className="mt-12 columns-2 gap-3 sm:gap-4 lg:columns-3">
              {gallery.map((src, i) => (
                <div key={src} data-reveal style={{ ["--d" as string]: `${(i % 3) * 0.08}s` }} className="group mb-3 break-inside-avoid overflow-hidden rounded-3xl ring-1 ring-white/10 sm:mb-4">
                  <img src={src} alt={`Obra ${i + 1} da ${brand}`} loading="lazy" className="w-full transition duration-700 group-hover:scale-105" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ diferenciais */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#07060F] to-[#0E0A1C] py-20 sm:py-28">
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle kicker={`Por que a ${brand}`} title="Feito para durar 25 anos" />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DIFFERENTIALS.map((d, i) => (
              <div key={d.title} data-reveal style={{ ["--d" as string]: `${(i % 3) * 0.08}s` }} className="group relative overflow-hidden rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 backdrop-blur transition duration-300 hover:-translate-y-1 hover:bg-white/[0.07]">
                <div className="pointer-events-none absolute -top-12 -right-10 h-32 w-32 rounded-full bg-[#9BD373]/0 blur-2xl transition group-hover:bg-[#9BD373]/20" />
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#F3EA3B] to-[#9BD373] text-[#1C1234]">{d.icon}</span>
                <h3 className="mt-4 font-display text-lg font-semibold">{d.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/55">{d.text}</p>
              </div>
            ))}
          </div>
          {company.about && (
            <p data-reveal className="mx-auto mt-12 max-w-3xl text-center text-[17px] leading-relaxed text-white/65 italic">
              “{company.about}”
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------ pagamento */}
      {payments.length > 0 && (
        <section className="relative py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionTitle kicker="Formas de pagamento" title={capture.paymentTitle || "Condições que cabem no seu bolso"} />
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {payments.map((p, i) => (
                <div key={p.title} data-reveal style={{ ["--d" as string]: `${i * 0.08}s` }} className={cx("relative overflow-hidden rounded-3xl p-7 ring-1", i === payments.length - 1 ? "bg-gradient-to-br from-[#2a1d4d] to-[#1C1234] ring-[#F3EA3B]/40" : "bg-white/[0.04] ring-white/10")}>
                  {i === payments.length - 1 && <span className="absolute top-4 right-4 rounded-full bg-[#F3EA3B] px-2.5 py-0.5 text-[10px] font-bold text-[#1C1234]">Mais escolhido</span>}
                  <p className="font-display text-2xl font-semibold">{p.title}</p>
                  <p className="mt-2 text-white/60">{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ dúvidas */}
      <section id="duvidas" className="relative scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionTitle kicker="Dúvidas frequentes" title="Tudo o que perguntam antes de instalar" />
          <div className="mt-10 space-y-3">
            {FAQ.map(([q, a], i) => (
              <Faq key={q} q={q} a={a} delay={i * 0.04} />
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ chamada final */}
      <section className="relative px-4 pb-20 sm:px-6">
        <div data-reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] bg-gradient-to-br from-[#F3EA3B] via-[#c8e05a] to-[#6CC690] p-8 text-[#1C1234] sm:p-14">
          <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white/40 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">Pronto para parar de pagar caro na luz?</h2>
              <p className="mt-3 max-w-xl text-[#1C1234]/70">Faça a simulação agora. Leva 1 minuto e você já sai com os números do seu caso.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={() => toSim("solar")} className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#1C1234] px-7 text-[16px] font-bold text-white shadow-xl transition hover:bg-[#2a1d4d]">
                Simular agora <ArrowRight className="h-5 w-5" />
              </button>
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-white/70 px-6 text-[15px] font-bold backdrop-blur transition hover:bg-white">
                  <MessageCircle className="h-5 w-5 text-[#128C7E]" /> WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ rodapé */}
      <footer className="border-t border-white/5 py-10 pb-28 sm:pb-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center text-sm text-white/45 sm:flex-row sm:px-6 sm:text-left">
          <img src="/brand/logo-h-white.png" alt={brand} className="h-8 w-auto opacity-80" />
          <p>
            {brand}
            {city && (
              <>
                {" · "}
                <MapPin className="inline h-3.5 w-3.5" /> {city}
              </>
            )}
            {company.instagram ? ` · @${String(company.instagram).replace(/^@/, "")}` : ""}
            {company.tech_name ? ` · Resp. técnico: ${company.tech_name}` : ""}
          </p>
        </div>
      </footer>

      {/* ------------------------------------------------ atalhos fixos no celular */}
      <div className={cx("fixed inset-x-3 bottom-3 z-40 flex gap-2 transition-all duration-300 sm:hidden", scrolled && !simVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0")}>
        <button onClick={() => toSim()} className="flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] py-3.5 text-[15px] font-bold text-[#1C1234] shadow-[0_14px_30px_-10px_rgba(243,234,59,0.7)]">
          Simular grátis <ArrowRight className="h-4 w-4" />
        </button>
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="grid w-14 place-items-center rounded-2xl bg-[#25D366] text-white shadow-[0_14px_30px_-10px_rgba(37,211,102,0.7)]">
            <MessageCircle className="h-6 w-6" />
          </a>
        )}
      </div>
      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="fixed right-6 bottom-6 z-40 hidden h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_14px_30px_-10px_rgba(37,211,102,0.8)] transition hover:scale-105 sm:grid">
          <MessageCircle className="h-7 w-7" />
        </a>
      )}
    </div>
  );
}

function SectionTitle({ kicker, title, sub, align = "center" }: { kicker: string; title: string; sub?: string; align?: "center" | "left" }) {
  return (
    <div data-reveal className={cx("max-w-3xl", align === "center" && "mx-auto text-center")}>
      <p className="bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] bg-clip-text text-xs font-bold tracking-[0.22em] text-transparent uppercase">{kicker}</p>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-[44px] sm:leading-[1.08]">{title}</h2>
      {sub && <p className="mt-4 text-white/60 sm:text-lg">{sub}</p>}
    </div>
  );
}

function Faq({ q, a, delay }: { q: string; a: string; delay: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div data-reveal style={{ ["--d" as string]: `${delay}s` }} className={cx("overflow-hidden rounded-2xl ring-1 transition", open ? "bg-white/[0.07] ring-[#9BD373]/40" : "bg-white/[0.03] ring-white/10")}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="font-semibold">{q}</span>
        <ChevronDown className={cx("h-5 w-5 shrink-0 text-[#9BD373] transition duration-300", open && "rotate-180")} />
      </button>
      <div className={cx("grid transition-all duration-300", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm leading-relaxed text-white/65">{a}</p>
        </div>
      </div>
    </div>
  );
}
