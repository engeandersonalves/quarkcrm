"use client";

/* eslint-disable @next/next/no-img-element */
import { ArrowLeft, ArrowRight, BadgeCheck, BadgePercent, Car, Check, CreditCard, Landmark, Lock, MessageCircle, PlugZap, Sun, Zap } from "lucide-react";
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
const ROOFS: { key: RoofKey; value: string; label: string; sub: string }[] = [
  { key: "ceramic", value: "Telhado cerâmico", label: "Cerâmico", sub: "Colonial, telha de barro" },
  { key: "fiber", value: "Telhado fibrocimento", label: "Fibrocimento", sub: "Telha ondulada" },
  { key: "metal", value: "Telhado metálico", label: "Metálico", sub: "Telha de aço ou zinco" },
  { key: "slab", value: "Laje", label: "Laje", sub: "Cobertura plana" },
  { key: "ground", value: "Solo", label: "Solo", sub: "Instalação no terreno" },
];
const VEHICLE = ["Já tenho", "Vou comprar em breve", "Estou pesquisando"];
const URGENCY: { v: Urgency; label: string }[] = [
  { v: "quente", label: "Agora" },
  { v: "morno", label: "Até 3 meses" },
  { v: "frio", label: "Pesquisando" },
];
const PAY_ICONS = [BadgePercent, CreditCard, Landmark];

function useCountUp(target: number, ms = 1300) {
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
  const capture: CapturePrefs = { ...DEFAULT_CAPTURE, ...(company.capture ?? {}) };

  const [segment, setSegment] = useState<Segment | null>(initialSegment === "save" || initialSegment === "ambos" || initialSegment === "solar" ? initialSegment : null);
  const [step, setStep] = useState<StepId>(segment ? (segment === "save" ? "veiculo" : "conta") : "interesse");
  const [bill, setBill] = useState(600);
  const [roof, setRoof] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "", urgency: "" as Urgency | "", referred: "" as "" | "sim" | "nao", referrer: "", website: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const brand = company.company_name || "Quark Energia";
  const hasSolar = segment !== "save";
  const flow = useMemo<StepId[]>(() => {
    if (!segment) return ["interesse"];
    const s: StepId[] = ["interesse"];
    if (segment !== "save") s.push("conta", "telhado");
    if (segment !== "solar") s.push("veiculo");
    return [...s, "resultado", "pronto"];
  }, [segment]);
  const idx = Math.max(0, flow.indexOf(step));
  const total = flow.length - 2; // perguntas (sem resultado e pronto)
  const next = () => setStep(flow[Math.min(flow.length - 1, idx + 1)]);
  const back = () => setStep(flow[Math.max(0, idx - 1)]);

  const estimate = useMemo(
    () =>
      quickEstimate({
        bill,
        tariff: Number(company.tariff) || undefined,
        sunHours: Number(company.sunHours) || undefined,
        fioBTariff: company.fioBTariff != null ? Number(company.fioBTariff) : undefined,
        publicLighting: company.publicLighting != null ? Number(company.publicLighting) : undefined,
      }),
    [bill, company],
  );

  useEffect(() => window.scrollTo({ top: 0, behavior: "smooth" }), [step]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.referred === "sim" && !form.referrer.trim()) return setError("Conte pra gente quem te indicou.");
    setSending(true);
    setError("");
    const referral = form.referred === "sim" ? `Indicação de: ${form.referrer.trim()}` : form.referred === "nao" ? "Sem indicação" : "";
    const notes = [
      referral,
      roof && `Telhado: ${roof}`,
      vehicle && `Veículo elétrico: ${vehicle}`,
      form.urgency && `Prazo: ${URGENCY.find((u) => u.v === form.urgency)?.label}`,
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
    setStep("pronto");
  };

  const question = step !== "interesse" && step !== "resultado" && step !== "pronto";

  return (
    <div className={cx("min-h-dvh text-[#1C1234]", embed ? "bg-transparent" : "bg-[#F4F3F8] sm:py-8")}>
      <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col bg-white sm:min-h-0 sm:overflow-hidden sm:rounded-[28px] sm:shadow-[0_30px_80px_-30px_rgba(28,18,52,0.35)]">
        {/* Cabeçalho da marca */}
        <header className="relative overflow-hidden px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6 text-white" style={{ background: PURPLE }}>
          <img src="/brand/symbol.png" alt="" aria-hidden className="pointer-events-none absolute -top-10 -right-10 w-56 opacity-[0.12]" />
          <div className="relative flex items-center justify-between">
            <img src="/brand/logo-h-white.png" alt={brand} className="h-9 w-auto" />
            {question && (
              <span className="tnum text-xs font-medium text-white/60">
                {idx} de {total}
              </span>
            )}
          </div>
          {step === "interesse" && (
            <div className="relative mt-8">
              <p className="text-[11px] font-semibold tracking-[0.28em] text-[#F3EA3B] uppercase">Simulação gratuita</p>
              <h1 className="mt-2 font-display text-[32px] leading-[1.08] font-semibold tracking-tight">Descubra quanto você vai economizar com energia solar.</h1>
              <p className="mt-3 text-[15px] leading-relaxed text-white/70">Poucas perguntas e o resultado aparece na hora.</p>
            </div>
          )}
        </header>
        <div className="h-1 bg-[#EEEDF4]">
          <div
            className="h-full bg-gradient-to-r from-[#F3EA3B] via-[#9BD373] to-[#6CC690] transition-all duration-500"
            style={{ width: `${step === "pronto" ? 100 : step === "resultado" ? 92 : (idx / (total + 1)) * 100}%` }}
          />
        </div>

        <main key={step} className="animate-fade-up flex flex-1 flex-col px-6 pt-7 pb-8">
          {question && (
            <button onClick={back} className="mb-5 flex w-fit items-center gap-1.5 text-sm font-medium text-[#6D6985] hover:text-[#1C1234]">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
          )}

          {step === "interesse" && (
            <>
              <Question title="O que você procura?" />
              <div className="mt-5 grid gap-3">
                <Option icon={<Sun className="h-5 w-5" />} title="Energia solar" sub="Reduzir a conta de luz" onClick={() => { setSegment("solar"); setStep("conta"); }} />
                <Option icon={<PlugZap className="h-5 w-5" />} title="Carregador veicular" sub="Carregar o carro elétrico em casa ou na empresa" onClick={() => { setSegment("save"); setStep("veiculo"); }} />
                <Option icon={<Zap className="h-5 w-5" />} title="Energia solar + carregador" sub="A solução completa" onClick={() => { setSegment("ambos"); setStep("conta"); }} />
              </div>
              <Trust company={company} />
            </>
          )}

          {step === "conta" && (
            <>
              <Question title="Qual o valor médio da sua conta de luz?" sub="Arraste até o valor aproximado." />
              <div className="mt-10 text-center">
                <p className="tnum font-display text-[56px] leading-none font-semibold tracking-tight">
                  {brl(bill, 0)}
                  {bill >= 5000 && <span className="text-3xl">+</span>}
                </p>
                <p className="mt-2 text-sm text-[#9A97AE]">por mês</p>
              </div>
              <input
                type="range"
                min={150}
                max={5000}
                step={10}
                value={bill}
                onChange={(e) => setBill(Number(e.target.value))}
                className="capture-range mt-10 w-full"
                style={{ ["--fill" as string]: `${((bill - 150) / (5000 - 150)) * 100}%` }}
                aria-label="Valor da conta de luz"
              />
              <div className="mt-2 flex justify-between text-xs text-[#9A97AE]">
                <span>R$ 150</span>
                <span>R$ 5.000+</span>
              </div>
              <Primary onClick={next}>Continuar</Primary>
            </>
          )}

          {step === "telhado" && (
            <>
              <Question title="Qual é o tipo do seu telhado?" />
              <div className="mt-5 grid grid-cols-2 gap-3">
                {ROOFS.map((r) => (
                  <RoofCard
                    key={r.key}
                    src={capture.roofImages?.[r.key] || DEFAULT_ROOF_IMAGES[r.key]}
                    label={r.label}
                    sub={r.sub}
                    active={roof === r.value}
                    wide={r.key === "ground"}
                    onClick={() => {
                      setRoof(r.value);
                      setTimeout(next, 220);
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {step === "veiculo" && (
            <>
              <Question title="Você já tem carro elétrico?" />
              <div className="mt-5 grid gap-3">
                {VEHICLE.map((v) => (
                  <Option
                    key={v}
                    icon={<Car className="h-5 w-5" />}
                    title={v}
                    active={vehicle === v}
                    onClick={() => {
                      setVehicle(v);
                      setTimeout(next, 220);
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {step === "resultado" && (
            <>
              <Result hasSolar={hasSolar} monthly={estimate.monthlySavings} capture={capture} />
              <form onSubmit={submit} className="mt-8 border-t border-[#EEEDF4] pt-7">
                <p className="font-display text-xl font-semibold">Receba seu estudo completo</p>
                <p className="mt-1 text-sm text-[#6D6985]">Enviamos por e-mail e um especialista fala com você no WhatsApp.</p>
                <div className="mt-5 grid gap-4">
                  <Inp label="Nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoComplete="name" required />
                  <Inp label="WhatsApp" type="tel" inputMode="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(00) 00000-0000" autoComplete="tel" required />
                  <Inp label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} autoComplete="email" required />
                  <Inp label="Cidade" value={form.city} onChange={(v) => setForm({ ...form, city: v })} autoComplete="address-level2" />
                  <Choice label="Quando pretende instalar?" value={form.urgency} onChange={(v) => setForm({ ...form, urgency: v as Urgency })} options={URGENCY.map((u) => [u.v, u.label])} />
                  <Choice
                    label="Alguém indicou a gente para você?"
                    value={form.referred}
                    onChange={(v) => setForm({ ...form, referred: v as "sim" | "nao" })}
                    options={[
                      ["sim", "Sim"],
                      ["nao", "Não"],
                    ]}
                  />
                  {form.referred === "sim" && (
                    <Inp label="Quem indicou?" value={form.referrer} onChange={(v) => setForm({ ...form, referrer: v })} placeholder="Nome de quem te indicou" autoFocus />
                  )}
                  <input tabIndex={-1} autoComplete="off" className="hidden" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} aria-hidden />
                </div>
                {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
                <Primary type="submit" disabled={sending}>
                  {sending ? "Enviando…" : "Quero meu estudo gratuito"}
                </Primary>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#9A97AE]">
                  <Lock className="h-3.5 w-3.5" /> Seus dados ficam protegidos com a {brand}.
                </p>
              </form>
            </>
          )}

          {step === "pronto" && <Done name={form.name} email={form.email} company={company} hasSolar={hasSolar} monthly={estimate.monthlySavings} capture={capture} />}
        </main>

        {!embed && (
          <footer className="border-t border-[#EEEDF4] px-6 py-5 text-center text-xs text-[#9A97AE]">
            {brand}
            {company.city ? ` · ${company.city}` : ""}
            {company.instagram ? ` · @${company.instagram.replace(/^@/, "")}` : ""}
          </footer>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ peças */

function Question({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h2 className="font-display text-[26px] leading-tight font-semibold tracking-tight">{title}</h2>
      {sub && <p className="mt-1.5 text-[15px] text-[#6D6985]">{sub}</p>}
    </div>
  );
}

function Option({ icon, title, sub, onClick, active }: { icon: ReactNode; title: string; sub?: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "group flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left transition active:scale-[0.99]",
        active ? "border-[#1C1234] ring-1 ring-[#1C1234]" : "border-[#E5E3EE] hover:border-[#1C1234]/40 hover:shadow-[0_8px_24px_-12px_rgba(28,18,52,0.25)]",
      )}
    >
      <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl transition", active ? "bg-[#1C1234] text-[#F3EA3B]" : "bg-[#F4F3F8] text-[#1C1234] group-hover:bg-[#1C1234] group-hover:text-[#F3EA3B]")}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {sub && <span className="block text-sm text-[#6D6985]">{sub}</span>}
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-[#CFCCDC] transition group-hover:translate-x-0.5 group-hover:text-[#1C1234]" />
    </button>
  );
}

function RoofCard({ src, label, sub, active, wide, onClick }: { src: string; label: string; sub: string; active: boolean; wide?: boolean; onClick: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      onClick={onClick}
      className={cx(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-white text-left transition active:scale-[0.99]",
        wide && "col-span-2",
        active ? "border-[#1C1234] ring-2 ring-[#1C1234]" : "border-[#E5E3EE] hover:shadow-[0_10px_30px_-12px_rgba(28,18,52,0.35)]",
      )}
    >
      <div className={cx("relative overflow-hidden bg-gradient-to-br from-[#2A2046] to-[#1C1234]", wide ? "aspect-[21/8]" : "aspect-[4/3]")}>
        {!failed && (
          <img src={src} alt={label} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        )}
        {failed && <img src="/brand/symbol.png" alt="" aria-hidden className="absolute inset-0 m-auto w-14 opacity-30" />}
        {active && (
          <span className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-[#1C1234] text-[#F3EA3B]">
            <Check className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="px-3.5 py-3">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-[#9A97AE]">{sub}</p>
      </div>
    </button>
  );
}

function Primary({ children, onClick, type = "button", disabled }: { children: ReactNode; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      style={{ background: PURPLE }}
    >
      {children} <ArrowRight className="h-5 w-5 text-[#F3EA3B]" />
    </button>
  );
}

function Inp({ label, value, onChange, ...rest }: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-medium text-[#4B4766]">
      {label}
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full min-w-0 rounded-xl border border-[#E5E3EE] bg-white px-4 text-base text-[#1C1234] transition outline-none placeholder:text-[#B7B4C7] focus:border-[#1C1234] focus:ring-4 focus:ring-[#1C1234]/5"
      />
    </label>
  );
}

function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium text-[#4B4766]">{label}</span>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cx("h-11 rounded-xl border px-2 text-sm font-medium transition", value === v ? "border-[#1C1234] bg-[#1C1234] text-white" : "border-[#E5E3EE] text-[#4B4766] hover:border-[#1C1234]/40")}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Trust({ company }: { company: PublicCompany }) {
  const items = [
    company.tech_name ? "Engenharia própria com responsável técnico" : "Engenharia e instalação próprias",
    "Projeto e homologação inclusos",
    `Até ${company.warranty_modules_performance_years || 25} anos de garantia`,
  ];
  return (
    <ul className="mt-8 grid gap-2.5 border-t border-[#EEEDF4] pt-6 text-sm text-[#4B4766]">
      {items.map((t) => (
        <li key={t} className="flex items-center gap-2.5">
          <BadgeCheck className="h-4 w-4 shrink-0 text-[#3F9C6A]" /> {t}
        </li>
      ))}
    </ul>
  );
}

function Payments({ capture }: { capture: CapturePrefs }) {
  return (
    <div className="mt-5 rounded-2xl border border-[#E5E3EE] p-5">
      <p className="text-[11px] font-semibold tracking-[0.2em] text-[#2C7A52] uppercase">{capture.paymentTitle}</p>
      <ul className="mt-3 grid gap-3">
        {capture.payments
          .filter((p) => p.title.trim())
          .map((p, i) => {
            const Icon = PAY_ICONS[i % PAY_ICONS.length];
            return (
              <li key={p.title} className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F4F3F8]">
                  <Icon className="h-5 w-5 text-[#1C1234]" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{p.title}</span>
                  {p.text && <span className="block text-sm text-[#6D6985]">{p.text}</span>}
                </span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

function Savings({ monthly }: { monthly: number }) {
  const v = useCountUp(monthly);
  return (
    <div className="relative overflow-hidden rounded-3xl px-6 py-8 text-center text-white" style={{ background: PURPLE }}>
      <img src="/brand/symbol.png" alt="" aria-hidden className="pointer-events-none absolute -right-8 -bottom-10 w-44 opacity-[0.1]" />
      <p className="relative text-[11px] font-semibold tracking-[0.28em] text-[#F3EA3B] uppercase">Sua economia estimada</p>
      <p className="tnum relative mt-3 bg-gradient-to-r from-[#F3EA3B] via-[#C9E97A] to-[#9BD373] bg-clip-text font-display text-[54px] leading-none font-semibold tracking-tight text-transparent">
        {brl(v, 0)}
      </p>
      <p className="relative mt-2 text-white/70">por mês na sua conta de luz</p>
    </div>
  );
}

function Result({ hasSolar, monthly, capture }: { hasSolar: boolean; monthly: number; capture: CapturePrefs }) {
  return (
    <>
      {hasSolar && monthly > 0 ? (
        <Savings monthly={monthly} />
      ) : (
        <div className="relative overflow-hidden rounded-3xl px-6 py-8 text-center text-white" style={{ background: PURPLE }}>
          <p className="text-[11px] font-semibold tracking-[0.28em] text-[#F3EA3B] uppercase">Carregador veicular</p>
          <p className="mt-3 font-display text-3xl leading-tight font-semibold">Seu carro carregado em casa, com segurança.</p>
        </div>
      )}
      <Payments capture={capture} />
    </>
  );
}

function Done({ name, email, company, hasSolar, monthly, capture }: { name: string; email: string; company: PublicCompany; hasSolar: boolean; monthly: number; capture: CapturePrefs }) {
  const first = name.trim().split(/\s+/)[0];
  const msg = `Olá! Sou ${first}, fiz a simulação no site${hasSolar && monthly > 0 ? ` (economia estimada de ${brl(monthly, 0)}/mês)` : ""} e quero falar com um especialista.`;
  return (
    <>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#3F9C6A] text-white">
          <Check className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-2xl font-semibold">Tudo certo{first ? `, ${first}` : ""}!</p>
          <p className="truncate text-sm text-[#6D6985]">Estudo enviado para {email}</p>
        </div>
      </div>
      <div className="mt-6">{hasSolar && monthly > 0 ? <Savings monthly={monthly} /> : null}</div>
      <Payments capture={capture} />
      {company.whatsapp && (
        <a
          href={whatsappUrl(company.whatsapp, msg)}
          target="_blank"
          rel="noreferrer"
          className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-base font-semibold text-white transition hover:brightness-105"
        >
          <MessageCircle className="h-5 w-5" /> Falar com um especialista agora
        </a>
      )}
    </>
  );
}
