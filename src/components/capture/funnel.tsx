"use client";

/* eslint-disable @next/next/no-img-element */
import {
  AlertTriangle,
  BadgePercent,
  BarChart3,
  BatteryCharging,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  CreditCard,
  Droplets,
  FileText,
  Flame,
  Fuel,
  Gauge,
  Hotel,
  Landmark,
  Leaf,
  Lock,
  Minus,
  PlugZap,
  Plus,
  Repeat,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Sun,
  TrendingUp,
  Wrench,
  Zap,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { BUSINESSES, CLEANING, MANAGEMENT, POWERS, evCompare, maintenanceSim, stationCapacity, stationSim } from "@/lib/capture-sims";
import { DEFAULT_CAPTURE, type CapturePrefs, type RoofKey } from "@/lib/defaults";
import { whatsappUrl } from "@/lib/format";
import { brl, fmtNum } from "@/lib/pricing";
import { quickEstimate } from "@/lib/quick-estimate";
import type { Segment } from "@/lib/types";
import { RoofScene } from "./art";

export interface PublicCompany {
  company_name?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  city?: string | null;
  tech_name?: string | null;
  warranty_modules_performance_years?: number | null;
  tariff?: number | null;
  sunHours?: number | null;
  fioBTariff?: number | null;
  publicLighting?: number | null;
  capture?: Partial<CapturePrefs> | null;
}

type StepId = "interesse" | "conta" | "telhado" | "carro" | "negocio" | "operacao" | "usina" | "servicos" | "resultado" | "pronto";
type Urgency = "quente" | "morno" | "frio";

const PURPLE = "#1C1234";
const G = {
  sun: "linear-gradient(145deg,#FFD84D 0%,#F3A33B 100%)",
  plug: "linear-gradient(145deg,#7CC4FF 0%,#2F7BF6 100%)",
  station: "linear-gradient(145deg,#8FE3B0 0%,#1FA36A 100%)",
  clean: "linear-gradient(145deg,#7DE3F0 0%,#1A9FC0 100%)",
  manage: "linear-gradient(145deg,#FF9DB8 0%,#E0457B 100%)",
  purple: "linear-gradient(145deg,#B38CFF 0%,#5B34D6 100%)",
  orange: "linear-gradient(145deg,#FFB36B 0%,#F0642E 100%)",
  gray: "linear-gradient(145deg,#C7C7CC 0%,#8E8E93 100%)",
};

const SERVICES: { seg: Segment; title: string; sub: string; bg: string; icon: ReactNode }[] = [
  { seg: "solar", title: "Energia solar", sub: "Reduza até 95% da conta de luz", bg: G.sun, icon: <Sun className="h-[18px] w-[18px]" /> },
  { seg: "save", title: "Carregador para carro elétrico", sub: "Rode pagando até 4x menos que gasolina", bg: G.plug, icon: <PlugZap className="h-[18px] w-[18px]" /> },
  { seg: "eletroposto", title: "Eletroposto de carga rápida", sub: "Invista em recarga e fature com isso", bg: G.station, icon: <BatteryCharging className="h-[18px] w-[18px]" /> },
  { seg: "manutencao", title: "Limpeza e manutenção de usina", sub: "Recupere a geração que a sujeira rouba", bg: G.clean, icon: <Droplets className="h-[18px] w-[18px]" /> },
  { seg: "gestao", title: "Gestão energética", sub: "Titularidade, rateio de créditos e gestão", bg: G.manage, icon: <BarChart3 className="h-[18px] w-[18px]" /> },
];

const FLOWS: Record<string, StepId[]> = {
  solar: ["interesse", "conta", "telhado", "resultado", "pronto"],
  ambos: ["interesse", "conta", "telhado", "carro", "resultado", "pronto"],
  save: ["interesse", "carro", "resultado", "pronto"],
  eletroposto: ["interesse", "negocio", "operacao", "resultado", "pronto"],
  manutencao: ["interesse", "usina", "resultado", "pronto"],
  gestao: ["interesse", "servicos", "resultado", "pronto"],
};

const ROOFS: { key: RoofKey; value: string; label: string; sub: string }[] = [
  { key: "ceramic", value: "Telhado cerâmico", label: "Cerâmico", sub: "Colonial, telha de barro" },
  { key: "fiber", value: "Telhado fibrocimento", label: "Fibrocimento", sub: "Telha ondulada" },
  { key: "metal", value: "Telhado metálico", label: "Metálico", sub: "Aço ou zinco" },
  { key: "slab", value: "Laje", label: "Laje", sub: "Cobertura plana" },
  { key: "ground", value: "Solo", label: "Solo", sub: "Instalação no terreno" },
];
const BUSINESS_ICON: Record<string, ReactNode> = {
  posto: <Fuel className="h-5 w-5" />,
  restaurante: <Coffee className="h-5 w-5" />,
  shopping: <ShoppingBag className="h-5 w-5" />,
  hotel: <Hotel className="h-5 w-5" />,
  mercado: <ShoppingCart className="h-5 w-5" />,
  outro: <Store className="h-5 w-5" />,
};
const MANAGE_ICON: Record<string, ReactNode> = {
  titularidade: <FileText className="h-[18px] w-[18px]" />,
  rateio: <Repeat className="h-[18px] w-[18px]" />,
  gestao: <BarChart3 className="h-[18px] w-[18px]" />,
  revisao: <Search className="h-[18px] w-[18px]" />,
};
const URGENCY: [Urgency, string][] = [
  ["quente", "Agora"],
  ["morno", "Até 3 meses"],
  ["frio", "Pesquisando"],
];
const PAY_STYLE = [
  { icon: BadgePercent, bg: G.station },
  { icon: CreditCard, bg: G.plug },
  { icon: Landmark, bg: G.purple },
];

function useCountUp(target: number, ms = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      setV(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function CaptureFunnel({ company }: { company: PublicCompany }) {
  const params = useSearchParams();
  const embed = params.get("embed") === "1";
  const source = params.get("origem") || params.get("utm_source") || "Site";
  const startedAt = useRef(Date.now());
  const initial = params.get("interesse") as Segment | null;

  const capture: CapturePrefs = {
    roofImages: company.capture?.roofImages ?? {},
    paymentTitle: company.capture?.paymentTitle || DEFAULT_CAPTURE.paymentTitle,
    payments: Array.isArray(company.capture?.payments) && company.capture.payments.length ? company.capture.payments : DEFAULT_CAPTURE.payments,
  };
  const tariff = Number(company.tariff) || 0.95;

  const [segment, setSegment] = useState<Segment | null>(initial && FLOWS[initial] ? initial : null);
  const [step, setStep] = useState<StepId>(initial && FLOWS[initial] ? FLOWS[initial][1] : "interesse");
  const [dir, setDir] = useState<"push" | "pop">("push");
  // Respostas
  const [bill, setBill] = useState(600);
  const [roof, setRoof] = useState("");
  const [km, setKm] = useState(1500);
  const [kml, setKml] = useState(10);
  const [business, setBusiness] = useState("");
  const [power, setPower] = useState(60);
  const [sessions, setSessions] = useState(10);
  const [kwp, setKwp] = useState(10);
  const [last, setLast] = useState("mais1ano");
  const [services, setServices] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "", urgency: "" as Urgency | "", referred: "" as "" | "sim" | "nao", referrer: "", website: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const brand = company.company_name || "Quark Energia";
  const flow = FLOWS[segment ?? "solar"];
  const idx = Math.max(0, flow.indexOf(step));
  const questions = flow.length - 3;

  const go = (to: StepId, d: "push" | "pop" = "push") => {
    setDir(d);
    setStep(to);
    // Sempre dentro do clique: o retorno de scrollTo nunca pode virar "limpeza" de efeito do React.
    window.scrollTo(0, 0);
  };
  const next = () => go(flow[Math.min(flow.length - 1, idx + 1)]);
  const back = () => go(flow[Math.max(0, idx - 1)], "pop");
  const choose = (seg: Segment) => {
    setSegment(seg);
    go(FLOWS[seg][1]);
  };

  const solar = useMemo(
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
  const ev = useMemo(() => evCompare({ kmMonth: km, kmPerLiter: kml, tariff }), [km, kml, tariff]);
  const station = useMemo(() => stationSim({ power, sessionsDay: sessions, business }), [power, sessions, business]);
  const maint = useMemo(() => maintenanceSim({ kwp, last, tariff, sunHours: Number(company.sunHours) || 5.2 }), [kwp, last, tariff, company.sunHours]);

  const summary = (): string => {
    switch (segment) {
      case "save":
        return `Rodagem: ${fmtNum(km)} km/mês a ${kml} km/L · economia estimada de ${brl(ev.savingMonth, 0)}/mês`;
      case "eletroposto":
        return `Negócio: ${BUSINESSES.find((b) => b.id === business)?.label ?? "—"} · ${power} kW · ${station.sessions} recargas/dia · potencial ${brl(station.net + station.crossSell, 0)}/mês`;
      case "manutencao":
        return `Usina de ${fmtNum(kwp)} kWp · última limpeza: ${CLEANING.find((c) => c.id === last)?.label} · perda estimada ${brl(maint.lossMonth, 0)}/mês`;
      case "gestao":
        return `Interesse: ${services.map((s) => MANAGEMENT.find((m) => m.id === s)?.label).filter(Boolean).join(", ") || "gestão energética"}`;
      default:
        return solar.monthlySavings > 0 ? `Simulação: economia de ${brl(solar.monthlySavings, 0)}/mês` : "";
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.referred === "sim" && !form.referrer.trim()) return setError("Conte pra gente quem te indicou.");
    setSending(true);
    setError("");
    const notes = [
      form.referred === "sim" ? `Indicação de: ${form.referrer.trim()}` : form.referred === "nao" ? "Sem indicação" : "",
      roof && `Telhado: ${roof}`,
      form.urgency && `Prazo: ${URGENCY.find(([v]) => v === form.urgency)?.[1]}`,
      summary(),
      form.referred === "sim" && source !== "Site" && `Origem do link: ${source}`,
    ]
      .filter(Boolean)
      .join(" · ");
    const isSolar = segment === "solar" || segment === "ambos";
    const res = await fetch("/api/public/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone,
        email: form.email,
        city: form.city,
        segment,
        avg_bill: isSolar ? bill : "",
        consumption_kwh: isSolar ? solar.consumption : "",
        roof_type: roof,
        temperature: form.urgency || "morno",
        source: form.referred === "sim" ? "Indicação" : source,
        notes,
        website: form.website,
        elapsed: Date.now() - startedAt.current,
        sim: { km, kml, business, power, sessions, kwp, last, services },
      }),
    }).catch(() => null);
    setSending(false);
    if (!res?.ok) return setError("Não conseguimos enviar agora. Confira seus dados e tente novamente.");
    go("pronto");
  };

  const showBack = step !== "interesse" && step !== "pronto";
  const withPayments = segment === "solar" || segment === "ambos" || segment === "save" || segment === "eletroposto";

  const result = (
    <>
      {(segment === "solar" || segment === "ambos") && <SolarResult monthly={solar.monthlySavings} before={solar.billBefore} after={solar.billAfter} />}
      {segment === "save" && <EvResult ev={ev} />}
      {segment === "eletroposto" && <StationResult s={station} />}
      {segment === "manutencao" && <MaintResult m={maint} />}
      {segment === "gestao" && <ManageResult selected={services} />}
      {withPayments && <Payments capture={capture} />}
    </>
  );

  return (
    <div className={cx("relative min-h-dvh overflow-x-hidden text-[#1C1234]", embed ? "bg-transparent" : "bg-[#F2F2F7]")}>
      {!embed && (
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="ios-float absolute -top-32 -left-24 h-80 w-80 rounded-full bg-[#9BD373]/35 blur-[90px]" />
          <div className="ios-float absolute top-1/3 -right-28 h-96 w-96 rounded-full bg-[#B38CFF]/25 blur-[100px] [animation-delay:-3s]" />
          <div className="ios-float absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-[#F3EA3B]/25 blur-[100px] [animation-delay:-5s]" />
        </div>
      )}

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col">
        <nav className="sticky top-0 z-20 border-b border-black/[0.06] bg-white/60 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur-2xl backdrop-saturate-150">
          <div className="grid h-11 grid-cols-[1fr_auto_1fr] items-center">
            <div>
              {showBack && (
                <button onClick={back} className="ios-press -ml-1 flex items-center text-[17px] text-[#5B34D6]">
                  <ChevronLeft className="h-6 w-6" strokeWidth={2.4} /> Voltar
                </button>
              )}
            </div>
            <img src="/brand/logo-h-color.png" alt={brand} className="h-7 w-auto" />
            <div className="flex justify-end gap-1.5">
              {segment &&
                step !== "pronto" &&
                flow.slice(0, -1).map((s, i) => (
                  <span key={s} className={cx("h-1.5 rounded-full transition-all duration-300", i < idx ? "w-1.5 bg-[#1C1234]" : i === idx ? "w-4 bg-[#1C1234]" : "w-1.5 bg-black/15")} />
                ))}
            </div>
          </div>
        </nav>

        <main key={step} className={cx("flex flex-1 flex-col px-4 pt-6 pb-10", dir === "push" ? "ios-push" : "ios-pop")}>
          {step === "interesse" && (
            <>
              <LargeTitle kicker="Simulação gratuita" title="Como podemos te ajudar?" sub="Escolha e veja os números na hora." />
              <Group>
                {SERVICES.map((s, i) => (
                  <Row key={s.seg} icon={s.icon} bg={s.bg} title={s.title} sub={s.sub} onClick={() => choose(s.seg)} last={i === SERVICES.length - 1} />
                ))}
              </Group>
              <Trust company={company} />
            </>
          )}

          {step === "conta" && (
            <>
              <LargeTitle kicker={questions > 1 ? `Pergunta ${idx} de ${questions}` : "Última pergunta"} title="Sua conta de luz" sub="Valor médio por mês. Arraste ou use − e +." />
              <Glass className="mt-6 px-5 pt-8 pb-7 text-center">
                <BigNumber>
                  {brl(bill, 0)}
                  {bill >= 5000 && <span className="text-4xl">+</span>}
                </BigNumber>
                <p className="mt-2 text-[15px] text-black/45">por mês</p>
                <SliderRow value={bill} min={150} max={5000} step={10} bump={50} onChange={setBill} label="Valor da conta de luz" />
              </Glass>
              <Primary onClick={next}>Continuar</Primary>
            </>
          )}

          {step === "telhado" && (
            <>
              <LargeTitle kicker={questions > 1 ? `Pergunta ${idx} de ${questions}` : "Última pergunta"} title="Seu telhado" sub="Toque no que parece com o seu." />
              <div className="mt-6 grid grid-cols-2 gap-3">
                {ROOFS.map((r, i) => (
                  <PhotoCard
                    key={r.key}
                    delay={i * 50}
                    photo={capture.roofImages?.[r.key]}
                    art={<RoofScene kind={r.key} className="h-full w-full" />}
                    label={r.label}
                    sub={r.sub}
                    active={roof === r.value}
                    wide={r.key === "ground"}
                    onClick={() => {
                      setRoof(r.value);
                      setTimeout(next, 260);
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {step === "carro" && (
            <>
              <LargeTitle kicker={questions > 1 ? `Pergunta ${idx} de ${questions}` : "Última pergunta"} title="Quanto você roda?" sub="Por mês, somando todos os trajetos." />
              <Glass className="mt-6 px-5 pt-8 pb-7 text-center">
                <BigNumber>{fmtNum(km)} km</BigNumber>
                <p className="mt-2 text-[15px] text-black/45">por mês</p>
                <SliderRow value={km} min={300} max={6000} step={50} bump={100} onChange={setKm} label="Quilômetros por mês" />
              </Glass>
              <SectionHeader className="mt-7">Seu carro a gasolina faz</SectionHeader>
              <Segmented
                value={String(kml)}
                onChange={(v) => setKml(Number(v))}
                options={[
                  ["8", "8 km/L"],
                  ["10", "10 km/L"],
                  ["12", "12 km/L"],
                  ["14", "14 km/L"],
                ]}
              />
              <Primary onClick={next}>Ver minha economia</Primary>
            </>
          )}

          {step === "negocio" && (
            <>
              <LargeTitle kicker={questions > 1 ? `Pergunta ${idx} de ${questions}` : "Última pergunta"} title="Qual é o seu negócio?" sub="Onde o eletroposto vai ficar." />
              <div className="mt-6 grid grid-cols-2 gap-3">
                {BUSINESSES.map((b, i) => (
                  <Tile
                    key={b.id}
                    delay={i * 40}
                    active={business === b.id}
                    icon={BUSINESS_ICON[b.id]}
                    bg={[G.orange, G.sun, G.purple, G.plug, G.station, G.gray][i]}
                    label={b.label}
                    onClick={() => {
                      setBusiness(b.id);
                      setTimeout(next, 260);
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {step === "operacao" && (
            <>
              <LargeTitle kicker={questions > 1 ? `Pergunta ${idx} de ${questions}` : "Última pergunta"} title="Seu eletroposto" sub="Potência do carregador e movimento esperado." />
              <SectionHeader className="mt-6">Potência do carregador rápido (DC)</SectionHeader>
              <Segmented
                value={String(power)}
                onChange={(v) => {
                  const p = Number(v);
                  setPower(p);
                  setSessions((s) => Math.min(s, stationCapacity(p)));
                }}
                options={POWERS.map((p) => [String(p), `${p} kW`])}
              />
              <Glass className="mt-6 px-5 pt-7 pb-7 text-center">
                <BigNumber>{station.sessions}</BigNumber>
                <p className="mt-2 text-[15px] text-black/45">recargas por dia</p>
                <SliderRow value={sessions} min={1} max={stationCapacity(power)} step={1} bump={1} onChange={setSessions} label="Recargas por dia" />
                <p className="mt-4 text-[13px] text-black/40">
                  Capacidade de até {stationCapacity(power)} recargas/dia com {power} kW · cerca de {Math.round((30 / (power * 0.85)) * 60)} min por recarga
                </p>
              </Glass>
              <Primary onClick={next}>Ver meu potencial</Primary>
            </>
          )}

          {step === "usina" && (
            <>
              <LargeTitle kicker={questions > 1 ? `Pergunta ${idx} de ${questions}` : "Última pergunta"} title="Sua usina solar" sub="Tamanho aproximado e última limpeza." />
              <Glass className="mt-6 px-5 pt-8 pb-7 text-center">
                <BigNumber>{fmtNum(kwp)} kWp</BigNumber>
                <p className="mt-2 text-[15px] text-black/45">≈ {Math.max(1, Math.round((kwp * 1000) / 600))} placas</p>
                <SliderRow value={kwp} min={2} max={300} step={1} bump={1} onChange={setKwp} label="Potência da usina" />
              </Glass>
              <SectionHeader className="mt-7">Última limpeza</SectionHeader>
              <Group className="mt-2">
                {CLEANING.map((c, i) => (
                  <Row
                    key={c.id}
                    icon={<Droplets className="h-[18px] w-[18px]" />}
                    bg={[G.station, G.clean, G.orange, G.manage][i]}
                    title={c.label}
                    selected={last === c.id}
                    onClick={() => setLast(c.id)}
                    last={i === CLEANING.length - 1}
                    noChevron
                  />
                ))}
              </Group>
              <Primary onClick={next}>Ver diagnóstico</Primary>
            </>
          )}

          {step === "servicos" && (
            <>
              <LargeTitle kicker={questions > 1 ? `Pergunta ${idx} de ${questions}` : "Última pergunta"} title="Do que você precisa?" sub="Pode marcar mais de um." />
              <Group>
                {MANAGEMENT.map((m, i) => (
                  <Row
                    key={m.id}
                    icon={MANAGE_ICON[m.id]}
                    bg={[G.purple, G.station, G.plug, G.manage][i]}
                    title={m.label}
                    sub={m.text}
                    selected={services.includes(m.id)}
                    onClick={() => setServices((s) => (s.includes(m.id) ? s.filter((x) => x !== m.id) : [...s, m.id]))}
                    last={i === MANAGEMENT.length - 1}
                    noChevron
                  />
                ))}
              </Group>
              <Primary onClick={next} disabled={!services.length}>
                Continuar
              </Primary>
            </>
          )}

          {step === "resultado" && (
            <>
              {result}
              <form onSubmit={submit} className="mt-8">
                <SectionHeader>{segment === "eletroposto" ? "Receba o estudo de viabilidade" : segment === "manutencao" ? "Agende um diagnóstico" : "Receba o estudo completo"}</SectionHeader>
                <Group className="mt-2">
                  <Field label="Nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoComplete="name" required placeholder="Seu nome" />
                  <Field label="WhatsApp" type="tel" inputMode="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} autoComplete="tel" required placeholder="(00) 00000-0000" />
                  <Field label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} autoComplete="email" required placeholder="voce@email.com" />
                  <Field label="Cidade" value={form.city} onChange={(v) => setForm({ ...form, city: v })} autoComplete="address-level2" placeholder="Opcional" last />
                </Group>

                <SectionHeader className="mt-6">Quando pretende começar?</SectionHeader>
                <Segmented value={form.urgency} onChange={(v) => setForm({ ...form, urgency: v as Urgency })} options={URGENCY} />

                <SectionHeader className="mt-6">Alguém indicou a gente?</SectionHeader>
                <Segmented
                  value={form.referred}
                  onChange={(v) => setForm({ ...form, referred: v as "sim" | "nao" })}
                  options={[
                    ["sim", "Sim"],
                    ["nao", "Não"],
                  ]}
                />
                {form.referred === "sim" && (
                  <Group className="ios-rise mt-3">
                    <Field label="Quem?" value={form.referrer} onChange={(v) => setForm({ ...form, referrer: v })} placeholder="Nome de quem indicou" autoFocus last />
                  </Group>
                )}
                <input tabIndex={-1} autoComplete="off" className="hidden" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} aria-hidden />

                {error && <p className="mt-4 px-4 text-[15px] text-[#FF3B30]">{error}</p>}
                <Primary type="submit" disabled={sending}>
                  {sending ? "Enviando…" : "Quero receber gratuitamente"}
                </Primary>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-black/40">
                  <Lock className="h-3.5 w-3.5" /> Seus dados ficam protegidos com a {brand}.
                </p>
              </form>
            </>
          )}

          {step === "pronto" && (
            <>
              <div className="flex flex-col items-center pt-2 pb-6 text-center">
                <span className="ios-bounce grid h-20 w-20 place-items-center rounded-full bg-[#34C759] shadow-[0_16px_40px_-10px_rgba(52,199,89,0.7)]">
                  <svg viewBox="0 0 24 24" className="ios-check h-10 w-10" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <h1 className="mt-5 text-[30px] font-bold tracking-[-0.02em]">Tudo certo{form.name ? `, ${form.name.trim().split(/\s+/)[0]}` : ""}!</h1>
                <p className="mt-1.5 text-[16px] text-black/50">
                  Enviamos tudo para <span className="text-black/80">{form.email}</span>
                </p>
              </div>
              {result}
              {company.whatsapp && (
                <a
                  href={whatsappUrl(company.whatsapp, `Olá! Sou ${form.name.trim().split(/\s+/)[0]}, fiz a simulação no site (${summary() || "quero saber mais"}) e quero falar com um especialista.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="ios-press mt-8 flex h-[54px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#34C759] text-[17px] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(52,199,89,0.8)]"
                >
                  Falar com um especialista agora
                </a>
              )}
            </>
          )}
        </main>

        {!embed && (
          <footer className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-[12px] text-black/35">
            {brand}
            {company.city ? ` · ${company.city}` : ""}
            {company.instagram ? ` · @${String(company.instagram).replace(/^@/, "")}` : ""}
          </footer>
        )}
      </div>
    </div>
  );
}

/* ================================================================ resultados */

function SolarResult({ monthly, before, after }: { monthly: number; before: number; after: number }) {
  return (
    <>
      <Hero badge="Sua economia estimada" value={monthly} sub="por mês na sua conta de luz" />
      {before > 0 && (
        <Glass className="ios-rise mt-4 p-5">
          <Compare
            rows={[
              { label: "Conta hoje", value: before, color: "linear-gradient(90deg,#FF9F6B,#F0642E)", icon: <Flame className="h-4 w-4" /> },
              { label: "Com energia solar", value: after, color: "linear-gradient(90deg,#F3EA3B,#34C759)", icon: <Sun className="h-4 w-4" /> },
            ]}
          />
        </Glass>
      )}
    </>
  );
}

function EvResult({ ev }: { ev: ReturnType<typeof evCompare> }) {
  return (
    <>
      <Hero badge="Economia com carro elétrico" value={ev.savingMonth} sub="por mês trocando a gasolina pela tomada" />
      <Glass className="ios-rise mt-4 p-5">
        <p className="mb-4 text-[13px] font-medium tracking-wide text-black/45 uppercase">Custo para rodar {fmtNum(ev.km)} km/mês</p>
        <Compare
          rows={[
            { label: "Carro a gasolina", value: ev.gasMonth, color: "linear-gradient(90deg,#FF9F6B,#F0642E)", icon: <Fuel className="h-4 w-4" /> },
            { label: "Carro elétrico", value: ev.evMonth, color: "linear-gradient(90deg,#7CC4FF,#34C759)", icon: <Zap className="h-4 w-4" /> },
          ]}
        />
      </Glass>
      <div className="ios-rise mt-3 grid grid-cols-2 gap-3">
        <Stat icon={<Gauge className="h-4 w-4" />} bg={G.plug} label="Por km" value={`${brl(ev.perKmEv, 2)}`} sub={`contra ${brl(ev.perKmGas, 2)} na gasolina`} />
        <Stat icon={<TrendingUp className="h-4 w-4" />} bg={G.station} label="Em 5 anos" value={brl(ev.saving5y, 0)} sub="no seu bolso" />
        <Stat icon={<Zap className="h-4 w-4" />} bg={G.purple} label="Mais barato" value={`${fmtNum(ev.times, 1)}x`} sub="que a gasolina" />
        <Stat icon={<Leaf className="h-4 w-4" />} bg={G.station} label="CO₂ evitado" value={`${fmtNum(ev.co2TonsYear, 1)} t`} sub="por ano" />
      </div>
      <Tip icon={<Sun className="h-4 w-4" />}>Com energia solar em casa, a recarga sai praticamente de graça: o sol abastece o carro.</Tip>
    </>
  );
}

function StationResult({ s }: { s: ReturnType<typeof stationSim> }) {
  const total = s.net + s.crossSell;
  const netPct = total > 0 ? (s.net / total) * 100 : 0;
  const paybackPct = Math.min(100, (s.paybackMonths / 60) * 100);
  return (
    <>
      <Hero badge="Potencial do seu eletroposto" value={total} sub="por mês entre recarga e vendas no seu negócio" />
      <Glass className="ios-rise mt-4 p-5">
        <p className="text-[13px] font-medium tracking-wide text-black/45 uppercase">De onde vem o dinheiro</p>
        <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-black/5">
          <div className="h-full bg-gradient-to-r from-[#8FE3B0] to-[#1FA36A]" style={{ width: `${netPct}%` }} />
          <div className="h-full bg-gradient-to-r from-[#B38CFF] to-[#5B34D6]" style={{ width: `${100 - netPct}%` }} />
        </div>
        <div className="mt-4 grid gap-3">
          <Legend color="#1FA36A" title="Lucro com recargas" value={brl(s.net, 0)} sub={`${fmtNum(s.sessionsMonth)} recargas · ${fmtNum(s.kwhMonth)} kWh vendidos`} />
          <Legend color="#5B34D6" title="Venda cruzada no seu negócio" value={brl(s.crossSell, 0)} sub={`6 em cada 10 motoristas consomem enquanto carregam · ticket de ${brl(s.ticket, 0)}`} />
        </div>
      </Glass>
      <Glass className="ios-rise mt-3 p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] font-medium tracking-wide text-black/45 uppercase">Retorno do investimento</p>
          <p className="ios-rounded text-[22px] font-bold">{s.paybackMonths ? `${fmtNum(s.paybackMonths)} meses` : "—"}</p>
        </div>
        <div className="relative mt-4 h-2 rounded-full bg-black/5">
          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#F3EA3B] to-[#34C759]" style={{ width: `${paybackPct}%` }} />
          <span className="absolute -top-1.5 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full bg-white shadow ring-2 ring-[#34C759]" style={{ left: `${paybackPct}%` }}>
            <Check className="h-3 w-3 text-[#34C759]" strokeWidth={3} />
          </span>
        </div>
        <div className="mt-2 flex justify-between text-[12px] text-black/40">
          <span>Hoje</span>
          <span>5 anos</span>
        </div>
        <p className="mt-3 text-[14px] text-black/55">
          Só com recargas: {brl(s.net * 12, 0)} por ano. Investimento de referência: {brl(s.invest, 0)} ({s.power} kW, equipamento e instalação).
        </p>
      </Glass>
      <Tip icon={<Sun className="h-4 w-4" />}>Com energia solar alimentando o eletroposto, o custo da energia despenca e a margem por recarga dispara.</Tip>
      <p className="mt-3 px-2 text-[11px] leading-relaxed text-black/35">
        Estimativa com recarga média de 30 kWh, venda a R$ 2,19/kWh, energia a R$ 0,95/kWh e 10% de taxas. O estudo de viabilidade considera o seu local.
      </p>
    </>
  );
}

function MaintResult({ m }: { m: ReturnType<typeof maintenanceSim> }) {
  const loss = useCountUp(m.lossMonth);
  return (
    <>
      <div className="ios-rise relative overflow-hidden rounded-[28px] px-6 pt-7 pb-6 text-center text-white shadow-[0_24px_60px_-20px_rgba(28,18,52,0.7)]" style={{ background: "linear-gradient(160deg,#2A1B55 0%,#1C1234 55%,#120B24 100%)" }}>
        <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold tracking-wide text-[#FFB36B]">
          <AlertTriangle className="h-3.5 w-3.5" /> Diagnóstico da sua usina
        </span>
        <EfficiencyGauge value={m.efficiency} />
        <p className="mt-1 text-[15px] text-white/70">Você pode estar deixando de ganhar</p>
        <p className="ios-rounded mt-1 bg-gradient-to-r from-[#FFD84D] to-[#FF7A45] bg-clip-text text-[48px] leading-none font-bold text-transparent">{brl(loss, 0)}</p>
        <p className="mt-1 text-[15px] text-white/70">por mês · {brl(m.lossYear, 0)} por ano</p>
      </div>
      <SectionHeader className="mt-7">Benefícios da limpeza e manutenção</SectionHeader>
      <Group className="mt-2">
        {[
          ["Mais geração, mais economia", `Recupere até ${fmtNum(m.lossPct * 100)}% de energia que a sujeira bloqueia.`],
          ["Vida útil prolongada", "Módulos limpos esquentam menos e degradam mais devagar."],
          ["Garantia preservada", "Fabricantes exigem manutenção para manter a garantia."],
          ["Falhas detectadas cedo", "Inspeção de conexões, inversor e string box."],
        ].map(([t, d], i, a) => (
          <InfoRow key={t} icon={<Check className="h-[18px] w-[18px]" strokeWidth={3} />} bg={G.station} title={t} text={d} last={i === a.length - 1} />
        ))}
      </Group>
      <SectionHeader className="mt-6">Riscos de não fazer</SectionHeader>
      <Group className="mt-2">
        {[
          ["Pontos quentes (hotspots)", "Sujeira concentrada aquece células e pode queimar o módulo."],
          ["Risco de incêndio", "Conexões frouxas e cabos danificados geram arcos elétricos."],
          ["Perda silenciosa", "A geração cai aos poucos e a conta volta a subir sem você perceber."],
        ].map(([t, d], i, a) => (
          <InfoRow key={t} icon={<AlertTriangle className="h-[18px] w-[18px]" />} bg={G.orange} title={t} text={d} last={i === a.length - 1} />
        ))}
      </Group>
      <div className="ios-rise mt-4 grid grid-cols-2 gap-3">
        <Stat icon={<Zap className="h-4 w-4" />} bg={G.clean} label="Energia perdida" value={`${fmtNum(m.lossKwh)} kWh`} sub="por mês" />
        <Stat icon={<TrendingUp className="h-4 w-4" />} bg={G.station} label="Em 5 anos" value={brl(m.loss5y, 0)} sub="que voltam para você" />
      </div>
    </>
  );
}

function ManageResult({ selected }: { selected: string[] }) {
  const list = MANAGEMENT.filter((m) => selected.includes(m.id));
  return (
    <>
      <div className="ios-rise relative overflow-hidden rounded-[28px] px-6 pt-7 pb-8 text-center text-white shadow-[0_24px_60px_-20px_rgba(28,18,52,0.7)]" style={{ background: "linear-gradient(160deg,#2A1B55 0%,#1C1234 55%,#120B24 100%)" }}>
        <div aria-hidden className="absolute -top-16 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-[#FF9DB8]/30 blur-3xl" />
        <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold tracking-wide text-[#F3EA3B]">
          <Sparkles className="h-3.5 w-3.5" /> Gestão energética
        </span>
        <p className="relative mt-4 text-[28px] leading-tight font-bold">Sua energia no controle, sem burocracia.</p>
        <p className="relative mt-2 text-[15px] text-white/70">Cuidamos de tudo junto à distribuidora.</p>
      </div>
      <SectionHeader className="mt-7">O que resolvemos para você</SectionHeader>
      <Group className="mt-2">
        {list.map((m, i) => (
          <InfoRow key={m.id} icon={MANAGE_ICON[m.id]} bg={[G.purple, G.station, G.plug, G.manage][MANAGEMENT.findIndex((x) => x.id === m.id)]} title={m.label} text={m.text} last={i === list.length - 1} />
        ))}
      </Group>
      <div className="ios-rise mt-4 grid grid-cols-3 gap-2">
        {[
          [<ShieldCheck key="a" className="h-5 w-5" />, "Sem filas", G.station],
          [<Wrench key="b" className="h-5 w-5" />, "Sem burocracia", G.plug],
          [<Building2 key="c" className="h-5 w-5" />, "Vários imóveis", G.purple],
        ].map(([icon, label, bg]) => (
          <Glass key={String(label)} className="flex flex-col items-center gap-2 p-3 text-center">
            <span className="grid h-10 w-10 place-items-center rounded-[11px] text-white" style={{ background: bg as string }}>
              {icon}
            </span>
            <span className="text-[13px] font-medium">{label}</span>
          </Glass>
        ))}
      </div>
    </>
  );
}

/* ================================================================== peças */

function LargeTitle({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <header className="px-1">
      <p className="text-[13px] font-semibold tracking-wide text-[#5B34D6] uppercase">{kicker}</p>
      <h1 className="mt-1 text-[34px] leading-[1.1] font-bold tracking-[-0.022em]">{title}</h1>
      {sub && <p className="mt-2 text-[17px] leading-snug text-black/50">{sub}</p>}
    </header>
  );
}

function BigNumber({ children }: { children: ReactNode }) {
  return <p className="ios-rounded text-[60px] leading-none font-semibold tracking-tight">{children}</p>;
}

function Glass({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-[24px] bg-white/70 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_10px_40px_-12px_rgba(28,18,52,0.18)] ring-1 ring-black/[0.04] backdrop-blur-2xl", className)}>{children}</div>;
}

function Group({ children, className }: { children: ReactNode; className?: string }) {
  return <Glass className={cx("mt-6 overflow-hidden rounded-[20px]", className)}>{children}</Glass>;
}

function SectionHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("px-4 text-[13px] font-medium tracking-wide text-black/45 uppercase", className)}>{children}</p>;
}

function AppIcon({ bg, children, size = 30 }: { bg: string; children: ReactNode; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-[8px] text-white shadow-[0_1px_2px_rgba(0,0,0,0.15)]" style={{ background: bg, width: size, height: size }}>
      {children}
    </span>
  );
}

function Row({ icon, bg, title, sub, onClick, last, selected, noChevron }: { icon: ReactNode; bg: string; title: string; sub?: string; onClick: () => void; last?: boolean; selected?: boolean; noChevron?: boolean }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 pl-4 text-left transition-colors active:bg-black/[0.05]">
      <AppIcon bg={bg}>{icon}</AppIcon>
      <span className={cx("flex min-w-0 flex-1 items-center gap-2 py-3.5 pr-4", !last && "border-b border-black/[0.08]")}>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] leading-tight">{title}</span>
          {sub && <span className="mt-0.5 block text-[14px] leading-snug text-black/45">{sub}</span>}
        </span>
        {selected ? (
          <span className="ios-bounce grid h-6 w-6 place-items-center rounded-full bg-[#5B34D6] text-white">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        ) : noChevron ? (
          <span className="h-6 w-6 rounded-full ring-[1.5px] ring-black/15" />
        ) : (
          <ChevronRight className="h-5 w-5 text-black/25" />
        )}
      </span>
    </button>
  );
}

function InfoRow({ icon, bg, title, text, last }: { icon: ReactNode; bg: string; title: string; text: string; last?: boolean }) {
  return (
    <div className="flex items-start gap-3 pl-4">
      <span className="pt-3.5">
        <AppIcon bg={bg}>{icon}</AppIcon>
      </span>
      <div className={cx("min-w-0 flex-1 py-3.5 pr-4", !last && "border-b border-black/[0.08]")}>
        <p className="text-[16px] leading-tight font-medium">{title}</p>
        <p className="mt-0.5 text-[14px] leading-snug text-black/50">{text}</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, last, ...rest }: { label: string; value: string; onChange: (v: string) => void; last?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="flex items-center gap-3 pl-4">
      <span className={cx("flex min-w-0 flex-1 items-center gap-3 pr-4", !last && "border-b border-black/[0.08]")}>
        <span className="w-[84px] shrink-0 text-[17px]">{label}</span>
        <input {...rest} value={value} onChange={(e) => onChange(e.target.value)} className="h-[50px] min-w-0 flex-1 bg-transparent text-[17px] text-[#1C1234] outline-none placeholder:text-black/25" />
      </span>
    </label>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  const i = options.findIndex(([v]) => v === value);
  return (
    <div className="relative mt-2 grid rounded-[10px] bg-[#767680]/[0.12] p-[2px]" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {i >= 0 && (
        <span
          className="absolute top-[2px] bottom-[2px] rounded-[8px] bg-white shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)] transition-all duration-300"
          style={{ left: `calc(${(i / options.length) * 100}% + 2px)`, width: `calc(${100 / options.length}% - 4px)` }}
        />
      )}
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={cx("relative z-10 h-9 text-[14px] transition", value === v ? "font-semibold" : "text-black/70")}>
          {l}
        </button>
      ))}
    </div>
  );
}

function SliderRow({ value, min, max, step, bump, onChange, label }: { value: number; min: number; max: number; step: number; bump: number; onChange: (v: number) => void; label: string }) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 100;
  return (
    <div className="mt-8 flex items-center gap-3">
      <Round onClick={() => onChange(Math.max(min, value - bump))} label="Diminuir">
        <Minus className="h-5 w-5" />
      </Round>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="ios-slider flex-1"
        style={{ ["--fill" as string]: `${fill}%` }}
        aria-label={label}
      />
      <Round onClick={() => onChange(Math.min(max, value + bump))} label="Aumentar">
        <Plus className="h-5 w-5" />
      </Round>
    </div>
  );
}

function Round({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="ios-press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#767680]/[0.12] text-[#1C1234]">
      {children}
    </button>
  );
}

function Primary({ children, onClick, type = "button", disabled }: { children: ReactNode; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="ios-press mt-8 h-[54px] w-full rounded-[16px] text-[17px] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(28,18,52,0.6)] disabled:opacity-40"
      style={{ background: PURPLE }}
    >
      {children}
    </button>
  );
}

function PhotoCard({ photo, art, label, sub, active, wide, delay, onClick }: { photo?: string; art: ReactNode; label: string; sub: string; active: boolean; wide?: boolean; delay: number; onClick: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      onClick={onClick}
      className={cx("ios-press ios-rise flex flex-col overflow-hidden rounded-[22px] bg-white/75 text-left shadow-[0_10px_30px_-14px_rgba(28,18,52,0.3)] ring-1 backdrop-blur-xl", wide && "col-span-2", active ? "ring-[3px] ring-[#5B34D6]" : "ring-black/[0.05]")}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={cx("relative w-full overflow-hidden", wide ? "aspect-[21/8]" : "aspect-[4/3]")}>
        {photo && !failed ? <img src={photo} alt={label} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" /> : art}
        {active && (
          <span className="ios-bounce absolute top-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-full bg-[#5B34D6] text-white shadow-lg">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
        )}
      </div>
      <div className="px-3.5 py-3">
        <p className="text-[16px] font-semibold">{label}</p>
        <p className="text-[13px] text-black/45">{sub}</p>
      </div>
    </button>
  );
}

function Tile({ icon, bg, label, active, delay, onClick }: { icon: ReactNode; bg: string; label: string; active: boolean; delay: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx("ios-press ios-rise flex flex-col items-start gap-3 rounded-[22px] bg-white/75 p-4 text-left shadow-[0_10px_30px_-14px_rgba(28,18,52,0.3)] ring-1 backdrop-blur-xl", active ? "ring-[3px] ring-[#5B34D6]" : "ring-black/[0.05]")}
      style={{ animationDelay: `${delay}ms` }}
    >
      <AppIcon bg={bg} size={44}>
        {icon}
      </AppIcon>
      <span className="text-[15px] leading-tight font-semibold">{label}</span>
    </button>
  );
}

function Trust({ company }: { company: PublicCompany }) {
  const items = [
    company.tech_name ? "Engenharia própria com responsável técnico" : "Engenharia e instalação próprias",
    "Projeto e homologação inclusos",
    `Até ${company.warranty_modules_performance_years || 25} anos de garantia`,
  ];
  return (
    <div className="mt-8 grid gap-2.5 px-2">
      {items.map((t) => (
        <p key={t} className="flex items-center gap-2.5 text-[14px] text-black/55">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#2FB57A]" /> {t}
        </p>
      ))}
    </div>
  );
}

function Hero({ badge, value, sub }: { badge: string; value: number; sub: string }) {
  const v = useCountUp(value);
  return (
    <div className="ios-rise relative overflow-hidden rounded-[28px] px-6 pt-7 pb-8 text-center text-white shadow-[0_24px_60px_-20px_rgba(28,18,52,0.7)]" style={{ background: "linear-gradient(160deg,#2A1B55 0%,#1C1234 55%,#120B24 100%)" }}>
      <div aria-hidden className="absolute -top-16 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-[#9BD373]/30 blur-3xl" />
      <img src="/brand/symbol.png" alt="" aria-hidden className="absolute -right-6 -bottom-8 w-36 opacity-[0.12]" />
      <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold tracking-wide text-[#F3EA3B] backdrop-blur-md">
        <Sparkles className="h-3.5 w-3.5" /> {badge}
      </span>
      <p className="ios-rounded relative mt-4 bg-gradient-to-r from-[#F3EA3B] via-[#C9E97A] to-[#8FE3B0] bg-clip-text text-[58px] leading-none font-bold tracking-tight text-transparent">{brl(v, 0)}</p>
      <p className="relative mt-2 text-[16px] text-white/70">{sub}</p>
    </div>
  );
}

function Compare({ rows }: { rows: { label: string; value: number; color: string; icon: ReactNode }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 120);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="grid gap-4">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[15px]">
            <span className="flex items-center gap-2 text-black/60">
              <span className="text-black/40">{r.icon}</span> {r.label}
            </span>
            <span className="ios-rounded font-semibold">{brl(r.value, 0)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-black/5">
            <div className="h-full rounded-full transition-[width] duration-1000 ease-out" style={{ width: ready ? `${Math.max(3, (r.value / max) * 100)}%` : "0%", background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ icon, bg, label, value, sub }: { icon: ReactNode; bg: string; label: string; value: string; sub: string }) {
  return (
    <Glass className="p-4">
      <AppIcon bg={bg} size={28}>
        {icon}
      </AppIcon>
      <p className="mt-3 text-[12px] font-medium tracking-wide text-black/45 uppercase">{label}</p>
      <p className="ios-rounded mt-0.5 text-[22px] leading-tight font-bold">{value}</p>
      <p className="text-[12px] text-black/45">{sub}</p>
    </Glass>
  );
}

function Legend({ color, title, value, sub }: { color: string; title: string; value: string; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[15px] font-medium">{title}</p>
          <p className="ios-rounded text-[17px] font-bold">{value}</p>
        </div>
        <p className="text-[13px] leading-snug text-black/45">{sub}</p>
      </div>
    </div>
  );
}

function Tip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="ios-rise mt-4 flex items-start gap-3 rounded-[20px] bg-gradient-to-br from-[#FFF8D6] to-[#EAF8DD] p-4 ring-1 ring-black/[0.04]">
      <AppIcon bg={G.sun} size={28}>
        {icon}
      </AppIcon>
      <p className="text-[14px] leading-snug text-black/70">{children}</p>
    </div>
  );
}

function EfficiencyGauge({ value }: { value: number }) {
  const [v, setV] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => setV(value), 200);
    return () => clearTimeout(t);
  }, [value]);
  const r = 70;
  const len = Math.PI * r;
  return (
    <svg viewBox="0 0 180 110" className="relative mx-auto mt-3 w-56" aria-label={`Eficiência estimada ${Math.round(value * 100)}%`}>
      <defs>
        <linearGradient id="gauge" x1="0" x2="1">
          <stop offset="0" stopColor="#FF7A45" />
          <stop offset="0.6" stopColor="#F3EA3B" />
          <stop offset="1" stopColor="#34C759" />
        </linearGradient>
      </defs>
      <path d="M20 95 A70 70 0 0 1 160 95" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="14" strokeLinecap="round" />
      <path
        d="M20 95 A70 70 0 0 1 160 95"
        fill="none"
        stroke="url(#gauge)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - v)}
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)" }}
      />
      <text x="90" y="82" textAnchor="middle" className="ios-rounded" fill="white" fontSize="30" fontWeight="700">
        {Math.round(value * 100)}%
      </text>
      <text x="90" y="100" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="10">
        eficiência estimada
      </text>
    </svg>
  );
}

function Payments({ capture }: { capture: CapturePrefs }) {
  const list = (capture.payments ?? []).filter((p) => p?.title?.trim());
  if (!list.length) return null;
  return (
    <div className="mt-7">
      <SectionHeader>{capture.paymentTitle}</SectionHeader>
      <Group className="mt-2">
        {list.map((p, i) => {
          const s = PAY_STYLE[i % PAY_STYLE.length];
          return (
            <div key={`${p.title}-${i}`} className="flex items-center gap-3 pl-4">
              <AppIcon bg={s.bg}>
                <s.icon className="h-[18px] w-[18px]" />
              </AppIcon>
              <div className={cx("min-w-0 flex-1 py-3 pr-4", i < list.length - 1 && "border-b border-black/[0.08]")}>
                <p className="text-[17px] leading-tight">{p.title}</p>
                {p.text && <p className="mt-0.5 text-[14px] text-black/45">{p.text}</p>}
              </div>
            </div>
          );
        })}
      </Group>
    </div>
  );
}

