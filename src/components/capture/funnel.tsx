"use client";

/* eslint-disable @next/next/no-img-element */
import { BadgePercent, Car, Check, ChevronLeft, ChevronRight, CreditCard, Landmark, Lock, Minus, PlugZap, Plus, ShieldCheck, Sparkles, Sun, Zap } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { DEFAULT_CAPTURE, DEFAULT_ROOF_IMAGES, type CapturePrefs, type RoofKey } from "@/lib/defaults";
import { whatsappUrl } from "@/lib/format";
import { brl } from "@/lib/pricing";
import { quickEstimate } from "@/lib/quick-estimate";
import type { Segment } from "@/lib/types";

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

type StepId = "interesse" | "conta" | "telhado" | "veiculo" | "resultado" | "pronto";
type Urgency = "quente" | "morno" | "frio";

const PURPLE = "#1C1234";
const GRADIENTS = {
  sun: "linear-gradient(145deg,#FFD84D 0%,#F3A33B 100%)",
  plug: "linear-gradient(145deg,#8FE3B0 0%,#2FB57A 100%)",
  both: "linear-gradient(145deg,#B38CFF 0%,#5B34D6 100%)",
  car: "linear-gradient(145deg,#7CC4FF 0%,#2F7BF6 100%)",
  pct: "linear-gradient(145deg,#8FE3B0 0%,#2FB57A 100%)",
  card: "linear-gradient(145deg,#7CC4FF 0%,#2F7BF6 100%)",
  bank: "linear-gradient(145deg,#B38CFF 0%,#5B34D6 100%)",
};
const ROOFS: { key: RoofKey; value: string; label: string; sub: string }[] = [
  { key: "ceramic", value: "Telhado cerâmico", label: "Cerâmico", sub: "Colonial, telha de barro" },
  { key: "fiber", value: "Telhado fibrocimento", label: "Fibrocimento", sub: "Telha ondulada" },
  { key: "metal", value: "Telhado metálico", label: "Metálico", sub: "Aço ou zinco" },
  { key: "slab", value: "Laje", label: "Laje", sub: "Cobertura plana" },
  { key: "ground", value: "Solo", label: "Solo", sub: "Instalação no terreno" },
];
const VEHICLE = [
  { v: "Já tenho", sub: "Quero carregar em casa" },
  { v: "Vou comprar em breve", sub: "Quero me preparar" },
  { v: "Estou pesquisando", sub: "Quero entender os custos" },
];
const URGENCY: [Urgency, string][] = [
  ["quente", "Agora"],
  ["morno", "Até 3 meses"],
  ["frio", "Pesquisando"],
];
const PAY_STYLE = [
  { icon: BadgePercent, bg: GRADIENTS.pct },
  { icon: CreditCard, bg: GRADIENTS.card },
  { icon: Landmark, bg: GRADIENTS.bank },
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
  const initialSegment = params.get("interesse");
  const startedAt = useRef(Date.now());

  const capture: CapturePrefs = {
    roofImages: company.capture?.roofImages ?? {},
    paymentTitle: company.capture?.paymentTitle || DEFAULT_CAPTURE.paymentTitle,
    payments: Array.isArray(company.capture?.payments) && company.capture.payments.length ? company.capture.payments : DEFAULT_CAPTURE.payments,
  };

  const [segment, setSegment] = useState<Segment | null>(initialSegment === "save" || initialSegment === "ambos" || initialSegment === "solar" ? initialSegment : null);
  const [step, setStep] = useState<StepId>(segment ? (segment === "save" ? "veiculo" : "conta") : "interesse");
  const [dir, setDir] = useState<"push" | "pop">("push");
  const [bill, setBill] = useState(600);
  const [roof, setRoof] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "", urgency: "" as Urgency | "", referred: "" as "" | "sim" | "nao", referrer: "", website: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const brand = company.company_name || "Quark Energia";
  const hasSolar = segment !== "save";
  const flow = useMemo<StepId[]>(() => {
    const s: StepId[] = ["interesse"];
    if (segment && segment !== "save") s.push("conta", "telhado");
    if (segment && segment !== "solar") s.push("veiculo");
    return [...s, "resultado", "pronto"];
  }, [segment]);
  const idx = Math.max(0, flow.indexOf(step));
  const questions = flow.length - 2;

  const go = (to: StepId, d: "push" | "pop" = "push") => {
    setDir(d);
    setStep(to);
    // Sempre com chaves: o retorno de scrollTo não pode virar "função de limpeza" do React.
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  };
  const next = () => go(flow[Math.min(flow.length - 1, idx + 1)]);
  const back = () => go(flow[Math.max(0, idx - 1)], "pop");
  const pick = (seg: Segment) => {
    setSegment(seg);
    setDir("push");
    setStep(seg === "save" ? "veiculo" : "conta");
    window.scrollTo(0, 0);
  };

  const estimate = useMemo(
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.referred === "sim" && !form.referrer.trim()) return setError("Conte pra gente quem te indicou.");
    setSending(true);
    setError("");
    const notes = [
      form.referred === "sim" ? `Indicação de: ${form.referrer.trim()}` : form.referred === "nao" ? "Sem indicação" : "",
      roof && `Telhado: ${roof}`,
      vehicle && `Veículo elétrico: ${vehicle}`,
      form.urgency && `Prazo: ${URGENCY.find(([v]) => v === form.urgency)?.[1]}`,
      hasSolar && estimate.monthlySavings > 0 && `Simulação: economia de ${brl(estimate.monthlySavings, 0)}/mês`,
      form.referred === "sim" && source !== "Site" && `Origem do link: ${source}`,
    ]
      .filter(Boolean)
      .join(" · ");
    const res = await fetch("/api/public/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone,
        email: form.email,
        city: form.city,
        segment,
        avg_bill: hasSolar ? bill : "",
        consumption_kwh: hasSolar ? estimate.consumption : "",
        roof_type: roof,
        temperature: form.urgency || "morno",
        source: form.referred === "sim" ? "Indicação" : source,
        notes,
        website: form.website,
        elapsed: Date.now() - startedAt.current,
      }),
    }).catch(() => null);
    setSending(false);
    if (!res?.ok) return setError("Não conseguimos enviar agora. Confira seus dados e tente novamente.");
    go("pronto");
  };

  const showBack = step !== "interesse" && step !== "pronto";

  return (
    <div className={cx("relative min-h-dvh overflow-x-hidden text-[#1C1234]", embed ? "bg-transparent" : "bg-[#F2F2F7]")}>
      {/* Fundo: luzes suaves da marca por trás do vidro */}
      {!embed && (
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="ios-float absolute -top-32 -left-24 h-80 w-80 rounded-full bg-[#9BD373]/35 blur-[90px]" />
          <div className="ios-float absolute top-1/3 -right-28 h-96 w-96 rounded-full bg-[#B38CFF]/25 blur-[100px] [animation-delay:-3s]" />
          <div className="ios-float absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-[#F3EA3B]/25 blur-[100px] [animation-delay:-5s]" />
        </div>
      )}

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col">
        {/* Barra de navegação translúcida */}
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
              {step !== "pronto" &&
                Array.from({ length: questions + 1 }, (_, i) => (
                  <span key={i} className={cx("h-1.5 rounded-full transition-all duration-300", i < idx ? "w-1.5 bg-[#1C1234]" : i === idx ? "w-4 bg-[#1C1234]" : "w-1.5 bg-black/15")} />
                ))}
            </div>
          </div>
        </nav>

        <main key={step} className={cx("flex flex-1 flex-col px-4 pt-6 pb-10", dir === "push" ? "ios-push" : "ios-pop")}>
          {step === "interesse" && (
            <>
              <LargeTitle kicker="Simulação gratuita" title="Quanto você vai economizar?" sub="Três toques e o resultado aparece na hora." />
              <Group>
                <Row icon={<Sun className="h-[18px] w-[18px]" />} bg={GRADIENTS.sun} title="Energia solar" sub="Reduzir a conta de luz" onClick={() => pick("solar")} />
                <Row icon={<PlugZap className="h-[18px] w-[18px]" />} bg={GRADIENTS.plug} title="Carregador veicular" sub="Carro elétrico em casa ou na empresa" onClick={() => pick("save")} />
                <Row icon={<Zap className="h-[18px] w-[18px]" />} bg={GRADIENTS.both} title="Solar + carregador" sub="A solução completa" onClick={() => pick("ambos")} last />
              </Group>
              <Trust company={company} />
            </>
          )}

          {step === "conta" && (
            <>
              <LargeTitle kicker={`Pergunta 1 de ${questions}`} title="Sua conta de luz" sub="Valor médio por mês. Arraste ou use − e +." />
              <Glass className="mt-6 px-5 pt-8 pb-7 text-center">
                <p className="ios-rounded text-[64px] leading-none font-semibold tracking-tight">
                  {brl(bill, 0)}
                  {bill >= 5000 && <span className="text-4xl">+</span>}
                </p>
                <p className="mt-2 text-[15px] text-black/45">por mês</p>
                <div className="mt-8 flex items-center gap-3">
                  <Round onClick={() => setBill((b) => Math.max(150, b - 50))} label="Diminuir">
                    <Minus className="h-5 w-5" />
                  </Round>
                  <input
                    type="range"
                    min={150}
                    max={5000}
                    step={10}
                    value={bill}
                    onChange={(e) => setBill(Number(e.target.value))}
                    className="ios-slider flex-1"
                    style={{ ["--fill" as string]: `${((bill - 150) / (5000 - 150)) * 100}%` }}
                    aria-label="Valor da conta de luz"
                  />
                  <Round onClick={() => setBill((b) => Math.min(5000, b + 50))} label="Aumentar">
                    <Plus className="h-5 w-5" />
                  </Round>
                </div>
              </Glass>
              <Primary onClick={next}>Continuar</Primary>
            </>
          )}

          {step === "telhado" && (
            <>
              <LargeTitle kicker={`Pergunta 2 de ${questions}`} title="Seu telhado" sub="Toque no que parece com o seu." />
              <div className="mt-6 grid grid-cols-2 gap-3">
                {ROOFS.map((r, i) => (
                  <RoofCard
                    key={r.key}
                    delay={i * 50}
                    src={capture.roofImages?.[r.key] || DEFAULT_ROOF_IMAGES[r.key]}
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

          {step === "veiculo" && (
            <>
              <LargeTitle kicker={`Pergunta ${idx} de ${questions}`} title="Carro elétrico" sub="Você já tem um?" />
              <Group>
                {VEHICLE.map((v, i) => (
                  <Row
                    key={v.v}
                    icon={<Car className="h-[18px] w-[18px]" />}
                    bg={GRADIENTS.car}
                    title={v.v}
                    sub={v.sub}
                    selected={vehicle === v.v}
                    last={i === VEHICLE.length - 1}
                    onClick={() => {
                      setVehicle(v.v);
                      setTimeout(next, 260);
                    }}
                  />
                ))}
              </Group>
            </>
          )}

          {step === "resultado" && (
            <>
              <Hero hasSolar={hasSolar} monthly={estimate.monthlySavings} />
              <Payments capture={capture} />
              <form onSubmit={submit} className="mt-8">
                <SectionHeader>Receba o estudo completo</SectionHeader>
                <Group className="mt-2">
                  <Field label="Nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoComplete="name" required placeholder="Seu nome" />
                  <Field label="WhatsApp" type="tel" inputMode="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} autoComplete="tel" required placeholder="(00) 00000-0000" />
                  <Field label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} autoComplete="email" required placeholder="voce@email.com" />
                  <Field label="Cidade" value={form.city} onChange={(v) => setForm({ ...form, city: v })} autoComplete="address-level2" placeholder="Opcional" last />
                </Group>

                <SectionHeader className="mt-6">Quando pretende instalar?</SectionHeader>
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
                  {sending ? "Enviando…" : "Quero meu estudo gratuito"}
                </Primary>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-black/40">
                  <Lock className="h-3.5 w-3.5" /> Seus dados ficam protegidos com a {brand}.
                </p>
              </form>
            </>
          )}

          {step === "pronto" && <Done name={form.name} email={form.email} company={company} hasSolar={hasSolar} monthly={estimate.monthlySavings} capture={capture} />}
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

/* ------------------------------------------------------------------ peças */

function LargeTitle({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <header className="px-1">
      <p className="text-[13px] font-semibold tracking-wide text-[#5B34D6] uppercase">{kicker}</p>
      <h1 className="mt-1 text-[34px] leading-[1.1] font-bold tracking-[-0.022em]">{title}</h1>
      {sub && <p className="mt-2 text-[17px] leading-snug text-black/50">{sub}</p>}
    </header>
  );
}

function Glass({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-[26px] bg-white/70 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_10px_40px_-12px_rgba(28,18,52,0.18)] ring-1 ring-black/[0.04] backdrop-blur-2xl", className)}>{children}</div>;
}

function Group({ children, className }: { children: ReactNode; className?: string }) {
  return <Glass className={cx("mt-6 overflow-hidden rounded-[20px]", className)}>{children}</Glass>;
}

function SectionHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("px-4 text-[13px] font-medium tracking-wide text-black/45 uppercase", className)}>{children}</p>;
}

function AppIcon({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] text-white shadow-[0_1px_2px_rgba(0,0,0,0.15)]" style={{ background: bg }}>
      {children}
    </span>
  );
}

function Row({ icon, bg, title, sub, onClick, last, selected }: { icon: ReactNode; bg: string; title: string; sub?: string; onClick: () => void; last?: boolean; selected?: boolean }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 pl-4 text-left transition-colors active:bg-black/[0.05]">
      <AppIcon bg={bg}>{icon}</AppIcon>
      <span className={cx("flex min-w-0 flex-1 items-center gap-2 py-3.5 pr-4", !last && "border-b border-black/[0.08]")}>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] leading-tight">{title}</span>
          {sub && <span className="mt-0.5 block text-[14px] text-black/45">{sub}</span>}
        </span>
        {selected ? <Check className="h-5 w-5 text-[#5B34D6]" strokeWidth={2.6} /> : <ChevronRight className="h-5 w-5 text-black/25" />}
      </span>
    </button>
  );
}

function Field({ label, value, onChange, last, ...rest }: { label: string; value: string; onChange: (v: string) => void; last?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="flex items-center gap-3 pl-4">
      <span className={cx("flex min-w-0 flex-1 items-center gap-3 pr-4", !last && "border-b border-black/[0.08]")}>
        <span className="w-[84px] shrink-0 text-[17px]">{label}</span>
        <input
          {...rest}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-[50px] min-w-0 flex-1 bg-transparent text-[17px] text-[#1C1234] outline-none placeholder:text-black/25"
        />
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

function Round({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} className="ios-press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#767680]/[0.12] text-[#1C1234]">
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
      className="ios-press mt-8 h-[54px] w-full rounded-[16px] text-[17px] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(28,18,52,0.6)] disabled:opacity-50"
      style={{ background: PURPLE }}
    >
      {children}
    </button>
  );
}

function RoofCard({ src, label, sub, active, wide, delay, onClick }: { src: string; label: string; sub: string; active: boolean; wide?: boolean; delay: number; onClick: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      onClick={onClick}
      className={cx("ios-press ios-rise flex flex-col overflow-hidden rounded-[22px] bg-white/75 text-left shadow-[0_10px_30px_-14px_rgba(28,18,52,0.3)] ring-1 backdrop-blur-xl", wide && "col-span-2", active ? "ring-[3px] ring-[#5B34D6]" : "ring-black/[0.05]")}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={cx("relative w-full overflow-hidden bg-gradient-to-br from-[#E9E6F2] to-[#D9D4E8]", wide ? "aspect-[21/8]" : "aspect-[4/3]")}>
        {!failed ? (
          <img src={src} alt={label} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
        ) : (
          <img src="/brand/symbol.png" alt="" aria-hidden className="absolute inset-0 m-auto w-12 opacity-40" />
        )}
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

function Hero({ hasSolar, monthly }: { hasSolar: boolean; monthly: number }) {
  const v = useCountUp(monthly);
  const solar = hasSolar && monthly > 0;
  return (
    <div className="ios-rise relative overflow-hidden rounded-[28px] px-6 pt-7 pb-8 text-center text-white shadow-[0_24px_60px_-20px_rgba(28,18,52,0.7)]" style={{ background: "linear-gradient(160deg,#2A1B55 0%,#1C1234 55%,#120B24 100%)" }}>
      <div aria-hidden className="absolute -top-16 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-[#9BD373]/30 blur-3xl" />
      <img src="/brand/symbol.png" alt="" aria-hidden className="absolute -right-6 -bottom-8 w-36 opacity-[0.12]" />
      <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold tracking-wide text-[#F3EA3B] backdrop-blur-md">
        <Sparkles className="h-3.5 w-3.5" /> {solar ? "Sua economia estimada" : "Carregador veicular"}
      </span>
      {solar ? (
        <>
          <p className="ios-rounded relative mt-4 bg-gradient-to-r from-[#F3EA3B] via-[#C9E97A] to-[#8FE3B0] bg-clip-text text-[62px] leading-none font-bold tracking-tight text-transparent">{brl(v, 0)}</p>
          <p className="relative mt-2 text-[16px] text-white/70">por mês na sua conta de luz</p>
        </>
      ) : (
        <p className="relative mt-4 text-[28px] leading-tight font-bold">Seu carro carregado em casa, com segurança.</p>
      )}
    </div>
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

function Done({ name, email, company, hasSolar, monthly, capture }: { name: string; email: string; company: PublicCompany; hasSolar: boolean; monthly: number; capture: CapturePrefs }) {
  const first = name.trim().split(/\s+/)[0];
  const msg = `Olá! Sou ${first}, fiz a simulação no site${hasSolar && monthly > 0 ? ` (economia estimada de ${brl(monthly, 0)}/mês)` : ""} e quero falar com um especialista.`;
  return (
    <>
      <div className="flex flex-col items-center pt-4 text-center">
        <span className="ios-bounce grid h-20 w-20 place-items-center rounded-full bg-[#34C759] shadow-[0_16px_40px_-10px_rgba(52,199,89,0.7)]">
          <svg viewBox="0 0 24 24" className="ios-check h-10 w-10" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h1 className="mt-5 text-[30px] font-bold tracking-[-0.02em]">Tudo certo{first ? `, ${first}` : ""}!</h1>
        <p className="mt-1.5 text-[16px] text-black/50">
          Seu estudo foi enviado para <span className="text-black/80">{email}</span>
        </p>
      </div>
      {hasSolar && monthly > 0 && (
        <div className="mt-7">
          <Hero hasSolar={hasSolar} monthly={monthly} />
        </div>
      )}
      <Payments capture={capture} />
      {company.whatsapp && (
        <a
          href={whatsappUrl(company.whatsapp, msg)}
          target="_blank"
          rel="noreferrer"
          className="ios-press mt-8 flex h-[54px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#34C759] text-[17px] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(52,199,89,0.8)]"
        >
          Falar com um especialista agora
        </a>
      )}
    </>
  );
}
