"use client";

/* eslint-disable @next/next/no-img-element */
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, Car, CheckCircle2, Factory, Home, Leaf, MessageCircle, PlugZap, Share2, ShieldCheck, Sun, Tractor, Warehouse, Zap } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Confetti } from "@/components/app/celebration";
import { cx } from "@/components/ui";
import { UFS } from "@/lib/constants";
import { formatPhone, whatsappUrl } from "@/lib/format";
import { brl, fmtNum } from "@/lib/pricing";
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
}

type StepId = "interesse" | "conta" | "imovel" | "telhado" | "veiculo" | "urgencia" | "resultado" | "pronto";
type Urgency = "quente" | "morno" | "frio";

const BILL_CHIPS = [250, 400, 700, 1000, 2000];

const PROPERTIES = [
  { v: "Casa", icon: Home },
  { v: "Comércio", icon: Building2 },
  { v: "Indústria", icon: Factory },
  { v: "Rural", icon: Tractor },
  { v: "Condomínio / galpão", icon: Warehouse },
];
const ROOFS = [
  { v: "Telhado cerâmico", sub: "Telha de barro", art: "ceramic" },
  { v: "Telhado fibrocimento", sub: "Telha ondulada", art: "fiber" },
  { v: "Telhado metálico", sub: "Telha de aço/zinco", art: "metal" },
  { v: "Laje", sub: "Laje plana", art: "slab" },
  { v: "Solo", sub: "No chão / terreno", art: "ground" },
] as const;
const SHADE = ["Não tem sombra", "Um pouco", "Bastante"];
const VEHICLE = ["Já tenho", "Vou comprar em breve", "Estou pesquisando"];
const PARKING = ["Casa", "Condomínio", "Empresa"];
const URGENCY: { v: Urgency; label: string; sub: string; emoji: string }[] = [
  { v: "quente", label: "O quanto antes", sub: "Quero parar de perder dinheiro já", emoji: "🔥" },
  { v: "morno", label: "Nos próximos 3 meses", sub: "Estou me planejando", emoji: "📅" },
  { v: "frio", label: "Só pesquisando", sub: "Quero entender os números", emoji: "🔎" },
];

function useCountUp(target: number, run = true, ms = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      setV(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return v;
}

export function CaptureFunnel({ company }: { company: PublicCompany }) {
  const params = useSearchParams();
  const embed = params.get("embed") === "1";
  const source = params.get("origem") || params.get("utm_source") || "Site";
  const initialSegment = params.get("interesse");
  const startedAt = useRef(Date.now());

  const [segment, setSegment] = useState<Segment | null>(initialSegment === "save" || initialSegment === "ambos" || initialSegment === "solar" ? initialSegment : null);
  const [step, setStep] = useState<StepId>(segment ? (segment === "save" ? "veiculo" : "conta") : "interesse");
  const [bill, setBill] = useState(600);
  const [property, setProperty] = useState("");
  const [roof, setRoof] = useState("");
  const [shade, setShade] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [parking, setParking] = useState("");
  const [urgency, setUrgency] = useState<Urgency | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "", state: "", connection: "", website: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const brand = company.company_name || "Quark Energia";
  const hasSolar = segment !== "save";
  const flow: StepId[] = useMemo(() => {
    if (!segment) return ["interesse"];
    const s: StepId[] = ["interesse"];
    if (segment !== "save") s.push("conta", "imovel", "telhado");
    if (segment !== "solar") s.push("veiculo");
    s.push("urgencia", "resultado", "pronto");
    return s;
  }, [segment]);
  const idx = Math.max(0, flow.indexOf(step));
  const progress = step === "pronto" ? 1 : (idx + 1) / (flow.length - 1);
  const next = () => setStep(flow[Math.min(flow.length - 1, idx + 1)]);
  const back = () => setStep(flow[Math.max(0, idx - 1)]);
  const choose = <T,>(set: (v: T) => void, v: T) => {
    set(v);
    setTimeout(next, 180);
  };

  const estimate = useMemo(
    () =>
      quickEstimate({
        bill,
        connectionType: form.connection === "mono" || form.connection === "bi" || form.connection === "tri" ? form.connection : undefined,
        tariff: Number(company.tariff) || undefined,
        sunHours: Number(company.sunHours) || undefined,
        fioBTariff: company.fioBTariff != null ? Number(company.fioBTariff) : undefined,
        publicLighting: company.publicLighting != null ? Number(company.publicLighting) : undefined,
      }),
    [bill, form.connection, company],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    const notes = [
      property && `Imóvel: ${property}`,
      roof && `Telhado: ${roof}`,
      shade && `Sombra: ${shade}`,
      vehicle && `Veículo elétrico: ${vehicle}`,
      parking && `Carro fica em: ${parking}`,
      urgency && `Prazo: ${URGENCY.find((u) => u.v === urgency)?.label}`,
      hasSolar && estimate.monthlySavings > 0 && `Simulação: ${fmtNum(estimate.kwp, 2)} kWp · economia ${brl(estimate.monthlySavings, 0)}/mês`,
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
        state: form.state,
        segment,
        avg_bill: hasSolar ? bill : "",
        consumption_kwh: hasSolar ? estimate.consumption : "",
        roof_type: roof,
        connection_type: form.connection,
        temperature: urgency ?? "morno",
        source,
        notes,
        website: form.website,
        elapsed: Date.now() - startedAt.current,
      }),
    }).catch(() => null);
    setSending(false);
    if (!res?.ok) {
      const json = res ? await res.json().catch(() => null) : null;
      return setError(json?.error ? "Confira nome e WhatsApp e tente de novo." : "Sem conexão. Tente novamente.");
    }
    setStep("pronto");
  };

  return (
    <div className={cx("relative min-h-dvh overflow-x-hidden text-white", embed ? "bg-transparent" : "bg-[#120B24]")}>
      {!embed && (
        <>
          <div className="pointer-events-none fixed -top-40 -right-32 h-[520px] w-[520px] rounded-full bg-[#9BD373]/20 blur-[130px]" />
          <div className="pointer-events-none fixed -bottom-48 -left-40 h-[480px] w-[480px] rounded-full bg-[#F3EA3B]/10 blur-[130px]" />
          <img src="/brand/symbol.png" alt="" aria-hidden className="pointer-events-none fixed -right-24 bottom-10 w-[380px] opacity-[0.05]" />
        </>
      )}

      <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8">
        {/* Topo: logo + progresso */}
        <header className="flex items-center justify-between gap-4">
          {step !== "interesse" && step !== "pronto" ? (
            <button onClick={back} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/15" aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <img src="/brand/logo-h-white.png" alt={brand} className="h-9 w-auto" />
          )}
          {step !== "interesse" && step !== "pronto" && (
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-[#F3EA3B] via-[#9BD373] to-[#6CC690] transition-all duration-500" style={{ width: `${progress * 100}%` }} />
            </div>
          )}
          {step !== "interesse" && step !== "pronto" && <span className="tnum text-xs text-white/50">{Math.round(progress * 100)}%</span>}
        </header>

        <main key={step} className="animate-fade-up flex flex-1 flex-col pt-8">
          {step === "interesse" && (
            <>
              <p className="text-[11px] font-semibold tracking-[0.35em] text-[#F3EA3B] uppercase">Simulação grátis · 30 segundos</p>
              <h1 className="mt-3 font-display text-[40px] leading-[1.02] font-bold tracking-tight">
                Quanto o sol pode colocar <span className="text-sun-gradient">no seu bolso?</span>
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-white/70">Responda 4 perguntas rápidas e veja na hora quanto você deixa de pagar para a distribuidora.</p>
              <div className="mt-8 grid gap-3">
                <BigChoice icon={<Sun className="h-6 w-6" />} title="Energia solar" sub="Quero reduzir a conta de luz" onClick={() => { setSegment("solar"); setStep("conta"); }} />
                <BigChoice icon={<PlugZap className="h-6 w-6" />} title="Carregador para carro elétrico" sub="Quero carregar em casa ou na empresa" onClick={() => { setSegment("save"); setStep("veiculo"); }} />
                <BigChoice icon={<Zap className="h-6 w-6" />} title="Os dois" sub="Sol no telhado e carro abastecido de graça" onClick={() => { setSegment("ambos"); setStep("conta"); }} />
              </div>
              <Proof company={company} />
            </>
          )}

          {step === "conta" && (
            <>
              <StepTitle kicker="Pergunta 1" title="Quanto vem, em média, a sua conta de luz?" />
              <div className="mt-8 text-center">
                <p className="tnum font-display text-6xl font-bold tracking-tight">
                  {brl(bill, 0)}
                  {bill >= 5000 && "+"}
                </p>
                <p className="mt-1 text-sm text-white/50">por mês</p>
              </div>
              <input
                type="range"
                min={100}
                max={5000}
                step={10}
                value={bill}
                onChange={(e) => setBill(Number(e.target.value))}
                className="mt-8 h-3 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#9BD373]"
                aria-label="Valor da conta de luz"
              />
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {BILL_CHIPS.map((v) => (
                  <button key={v} onClick={() => setBill(v)} className={cx("rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition", bill === v ? "bg-white text-[#1C1234] ring-white" : "ring-white/20 hover:bg-white/10")}>
                    {brl(v, 0)}
                    {v === 2000 && "+"}
                  </button>
                ))}
              </div>
              <div className="mt-8 rounded-2xl bg-white/[0.06] p-4 text-center ring-1 ring-white/10">
                <p className="text-xs tracking-[0.2em] text-white/50 uppercase">Prévia da sua economia</p>
                <p className="tnum mt-1 font-display text-3xl font-bold text-[#9BD373]">~ {brl(estimate.monthlySavings, 0)}/mês</p>
                <p className="mt-1 text-xs text-white/50">Continue para ver o estudo completo</p>
              </div>
              <Next onClick={next} />
            </>
          )}

          {step === "imovel" && (
            <>
              <StepTitle kicker="Pergunta 2" title="Onde vamos instalar?" />
              <div className="mt-8 grid grid-cols-2 gap-3">
                {PROPERTIES.map((p) => (
                  <Tile key={p.v} active={property === p.v} onClick={() => choose(setProperty, p.v)} className={p.v.startsWith("Condomínio") ? "col-span-2" : ""}>
                    <p.icon className="h-7 w-7 text-[#9BD373]" />
                    <span className="mt-2 font-semibold">{p.v}</span>
                  </Tile>
                ))}
              </div>
            </>
          )}

          {step === "telhado" && (
            <>
              <StepTitle kicker="Pergunta 3" title="Como é o seu telhado?" sub="Cada tipo pede uma estrutura diferente. A gente cuida disso." />
              <div className="mt-7 grid grid-cols-2 gap-3">
                {ROOFS.map((r) => (
                  <Tile key={r.v} active={roof === r.v} onClick={() => setRoof(r.v)} className={r.v === "Solo" ? "col-span-2" : ""}>
                    <RoofArt kind={r.art} />
                    <span className="mt-2 text-sm font-semibold">{r.v.replace("Telhado ", "").replace(/^./, (c) => c.toUpperCase())}</span>
                    <span className="text-xs text-white/50">{r.sub}</span>
                  </Tile>
                ))}
              </div>
              <p className="mt-7 text-sm font-semibold">Tem sombra de árvores ou prédios?</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {SHADE.map((s) => (
                  <Pill key={s} active={shade === s} onClick={() => setShade(s)}>
                    {s}
                  </Pill>
                ))}
              </div>
              <Next onClick={next} disabled={!roof} />
            </>
          )}

          {step === "veiculo" && (
            <>
              <StepTitle kicker={segment === "save" ? "Pergunta 1" : "Pergunta 4"} title="E o carro elétrico?" />
              <div className="mt-8 grid gap-3">
                {VEHICLE.map((v) => (
                  <BigChoice key={v} icon={<Car className="h-6 w-6" />} title={v} active={vehicle === v} onClick={() => setVehicle(v)} />
                ))}
              </div>
              <p className="mt-7 text-sm font-semibold">Onde o carro fica estacionado?</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {PARKING.map((s) => (
                  <Pill key={s} active={parking === s} onClick={() => setParking(s)}>
                    {s}
                  </Pill>
                ))}
              </div>
              <Next onClick={next} disabled={!vehicle} />
            </>
          )}

          {step === "urgencia" && (
            <>
              <StepTitle kicker="Última pergunta" title="Quando você quer começar a economizar?" />
              <div className="mt-8 grid gap-3">
                {URGENCY.map((u) => (
                  <BigChoice key={u.v} icon={<span className="text-2xl">{u.emoji}</span>} title={u.label} sub={u.sub} active={urgency === u.v} onClick={() => choose(setUrgency, u.v)} />
                ))}
              </div>
            </>
          )}

          {step === "resultado" && (
            <>
              {hasSolar ? <SolarReveal estimate={estimate} /> : <SaveReveal />}
              <form onSubmit={submit} className="mt-8 rounded-3xl bg-white p-5 text-[#1C1234] shadow-[0_30px_80px_-20px_rgba(155,211,115,0.35)]">
                <p className="font-display text-xl font-bold">Receba o estudo completo grátis</p>
                <p className="mt-1 text-sm text-[#6D6985]">No seu e-mail agora e com um especialista no WhatsApp.</p>
                <div className="mt-4 grid gap-3">
                  <Inp label="Seu nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoComplete="name" required />
                  <Inp label="WhatsApp" type="tel" inputMode="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(00) 00000-0000" autoComplete="tel" required />
                  <Inp label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} autoComplete="email" placeholder="para receber o estudo" required />
                  <div className="grid grid-cols-[1fr_88px] gap-3">
                    <Inp label="Cidade" value={form.city} onChange={(v) => setForm({ ...form, city: v })} autoComplete="address-level2" />
                    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#4B4766]">
                      UF
                      <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="h-12 w-full min-w-0 rounded-xl bg-[#F0EFF5] px-3 text-base text-[#1C1234] outline-none focus:ring-2 focus:ring-[#9BD373]">
                        <option value="">—</option>
                        {UFS.map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {hasSolar && (
                    <div>
                      <p className="text-xs font-semibold text-[#4B4766]">Tipo de ligação (está na conta de luz)</p>
                      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                        {[
                          ["mono", "Mono"],
                          ["bi", "Bi"],
                          ["tri", "Tri"],
                          ["", "Não sei"],
                        ].map(([v, l]) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setForm({ ...form, connection: v })}
                            className={cx("h-10 rounded-xl text-sm font-semibold transition", form.connection === v ? "bg-[#1C1234] text-white" : "bg-[#F0EFF5] text-[#4B4766]")}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <input tabIndex={-1} autoComplete="off" className="hidden" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} aria-hidden />
                </div>
                {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#F3EA3B] via-[#9BD373] to-[#6CC690] text-base font-bold text-[#1C1234] shadow-lg transition hover:brightness-105 disabled:opacity-60"
                >
                  {sending ? "Enviando…" : "Quero meu estudo grátis"} <ArrowRight className="h-5 w-5" />
                </button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#9A97AE]">
                  <ShieldCheck className="h-3.5 w-3.5" /> Seus dados ficam só com a {brand}. Nada de spam.
                </p>
              </form>
              <Proof company={company} />
            </>
          )}

          {step === "pronto" && <Done name={form.name} email={form.email} company={company} hasSolar={hasSolar} estimate={estimate} />}
        </main>

        {!embed && step !== "pronto" && (
          <footer className="pt-8 text-center text-[11px] text-white/35">
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

function StepTitle({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <>
      <p className="text-[11px] font-semibold tracking-[0.3em] text-[#F3EA3B] uppercase">{kicker}</p>
      <h2 className="mt-2 font-display text-[30px] leading-tight font-bold tracking-tight">{title}</h2>
      {sub && <p className="mt-2 text-sm text-white/60">{sub}</p>}
    </>
  );
}

function BigChoice({ icon, title, sub, onClick, active }: { icon: ReactNode; title: string; sub?: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "group flex w-full items-center gap-4 rounded-2xl p-4 text-left ring-1 transition active:scale-[0.99]",
        active ? "bg-white text-[#1C1234] ring-white" : "bg-white/[0.06] ring-white/10 hover:bg-white/[0.1] hover:ring-white/25",
      )}
    >
      <span className={cx("grid h-12 w-12 shrink-0 place-items-center rounded-xl", active ? "bg-sun-gradient text-[#1C1234]" : "bg-white/10 text-[#9BD373]")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {sub && <span className={cx("block text-sm", active ? "text-[#6D6985]" : "text-white/55")}>{sub}</span>}
      </span>
      <ArrowRight className={cx("h-5 w-5 shrink-0 transition group-hover:translate-x-0.5", active ? "text-[#1C1234]" : "text-white/40")} />
    </button>
  );
}

function Tile({ children, active, onClick, className }: { children: ReactNode; active: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex flex-col items-center rounded-2xl p-4 text-center ring-1 transition active:scale-[0.98]",
        active ? "bg-white text-[#1C1234] ring-2 ring-[#9BD373]" : "bg-white/[0.06] ring-white/10 hover:bg-white/[0.1]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Pill({ children, active, onClick }: { children: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cx("rounded-xl px-2 py-2.5 text-[13px] font-semibold ring-1 transition", active ? "bg-white text-[#1C1234] ring-white" : "ring-white/15 hover:bg-white/10")}>
      {children}
    </button>
  );
}

function Next({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-10 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#F3EA3B] via-[#9BD373] to-[#6CC690] text-base font-bold text-[#1C1234] transition hover:brightness-105 disabled:opacity-40"
    >
      Continuar <ArrowRight className="h-5 w-5" />
    </button>
  );
}

function Inp({ label, value, onChange, ...rest }: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#4B4766]">
      {label}
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full min-w-0 rounded-xl bg-[#F0EFF5] px-4 text-base font-normal text-[#1C1234] outline-none placeholder:text-[#9A97AE] focus:ring-2 focus:ring-[#9BD373]"
      />
    </label>
  );
}

function Proof({ company }: { company: PublicCompany }) {
  const items = [
    company.tech_name ? "Engenharia própria com responsável técnico" : "Engenharia e instalação próprias",
    "Projeto e homologação inclusos",
    `Até ${company.warranty_modules_performance_years || 25} anos de garantia de eficiência`,
  ];
  return (
    <ul className="mt-8 grid gap-2 text-sm text-white/70">
      {items.map((t) => (
        <li key={t} className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 shrink-0 text-[#9BD373]" /> {t}
        </li>
      ))}
    </ul>
  );
}

function SolarReveal({ estimate }: { estimate: ReturnType<typeof quickEstimate> }) {
  const monthly = useCountUp(estimate.monthlySavings);
  const total = useCountUp(estimate.savings25y, true, 2000);
  const afterPct = estimate.billBefore > 0 ? (estimate.billAfter / estimate.billBefore) * 100 : 0;
  return (
    <>
      <p className="text-[11px] font-semibold tracking-[0.3em] text-[#F3EA3B] uppercase">Seu resultado</p>
      <h2 className="mt-2 font-display text-[28px] leading-tight font-bold">Você pode deixar de pagar</h2>
      <p className="tnum text-sun-gradient mt-1 font-display text-[56px] leading-none font-bold tracking-tight">{brl(monthly, 0)}</p>
      <p className="mt-1 text-white/70">por mês para a distribuidora.</p>

      <div className="mt-6 grid gap-4 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
        <Bar label="Conta hoje" value={estimate.billBefore} pct={100} color="bg-white/30" />
        <Bar label="Com energia solar" value={estimate.billAfter} pct={Math.max(4, afterPct)} color="bg-gradient-to-r from-[#F3EA3B] to-[#6CC690]" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Mini label="Em 25 anos" value={brl(total, 0)} />
        <Mini label="Sistema" value={`${fmtNum(estimate.kwp, 2)} kWp`} sub={`${estimate.modules} placas · ${estimate.areaM2} m²`} />
        <Mini label="Geração" value={`${fmtNum(estimate.generation)} kWh`} sub="por mês" />
        <Mini label="Planeta" value={`${fmtNum(estimate.trees)} árvores`} sub="plantadas por ano" icon={<Leaf className="h-3.5 w-3.5" />} />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-white/40">
        Estimativa com as regras da Lei 14.300 (fio B), taxa mínima e iluminação pública. O valor final vem da visita técnica.
      </p>
    </>
  );
}

function SaveReveal() {
  return (
    <>
      <p className="text-[11px] font-semibold tracking-[0.3em] text-[#F3EA3B] uppercase">Seu resultado</p>
      <h2 className="mt-2 font-display text-[30px] leading-tight font-bold">
        Carro 100% carregado <span className="text-sun-gradient">da noite para o dia.</span>
      </h2>
      <div className="mt-6 grid gap-4 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
        <HoursBar label="Tomada comum de casa" hours="≈ 17h" pct={100} color="bg-white/30" />
        <HoursBar label="Carregador de 22 kW" hours="≈ 2h" pct={11} color="bg-gradient-to-r from-[#F3EA3B] to-[#6CC690]" />
      </div>
      <p className="mt-3 text-[11px] text-white/40">Recarga de 20% a 80% de um carro elétrico médio. Cada modelo tem um limite próprio de recarga.</p>
    </>
  );
}

function Bar({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="text-white/70">{label}</span>
        <span className="tnum font-semibold">{brl(value, 0)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div className={cx("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function HoursBar({ label, hours, pct, color }: { label: string; hours: string; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="text-white/70">{label}</span>
        <span className="font-semibold">{hours}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div className={cx("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Mini({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] p-3.5 ring-1 ring-white/10">
      <p className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.15em] text-white/50 uppercase">
        {icon}
        {label}
      </p>
      <p className="tnum mt-1 font-display text-lg font-bold">{value}</p>
      {sub && <p className="text-[11px] text-white/50">{sub}</p>}
    </div>
  );
}

function Done({ name, email, company, hasSolar, estimate }: { name: string; email: string; company: PublicCompany; hasSolar: boolean; estimate: ReturnType<typeof quickEstimate> }) {
  const first = name.trim().split(/\s+/)[0];
  const msg = `Olá! Sou ${first}, fiz a simulação no site${hasSolar && estimate.monthlySavings > 0 ? ` (economia estimada de ${brl(estimate.monthlySavings, 0)}/mês)` : ""} e quero falar com um especialista.`;
  const share = async () => {
    const data = { title: "Quanto o sol pode colocar no seu bolso?", text: "Fiz essa simulação grátis em 30 segundos:", url: window.location.origin + window.location.pathname };
    if (navigator.share) await navigator.share(data).catch(() => {});
    else await navigator.clipboard.writeText(data.url).catch(() => {});
  };
  return (
    <div className="relative flex flex-1 flex-col items-center pt-6 text-center">
      <div className="pointer-events-none fixed inset-0">
        <Confetti count={70} />
      </div>
      <div className="grid h-20 w-20 place-items-center rounded-full bg-sun-gradient shadow-[0_0_80px_rgba(155,211,115,0.5)]">
        <CheckCircle2 className="h-10 w-10 text-[#1C1234]" />
      </div>
      <h1 className="mt-6 font-display text-[34px] leading-tight font-bold">Pronto{first ? `, ${first}` : ""}!</h1>
      <p className="mt-3 text-white/70">
        Seu estudo {hasSolar ? "solar" : "do carregador"} está a caminho de <b className="text-white">{email}</b>. Um especialista vai te chamar no WhatsApp em breve.
      </p>
      {company.whatsapp && (
        <a
          href={whatsappUrl(company.whatsapp, msg)}
          target="_blank"
          rel="noreferrer"
          className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-base font-bold text-white shadow-lg transition hover:brightness-105"
        >
          <MessageCircle className="h-5 w-5" /> Não quero esperar: falar agora
        </a>
      )}
      <button onClick={share} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold ring-1 ring-white/20 transition hover:bg-white/10">
        <Share2 className="h-4 w-4" /> Mandar para um amigo que paga caro na luz
      </button>
      {company.whatsapp && <p className="mt-6 text-xs text-white/40">WhatsApp {formatPhone(company.whatsapp)}</p>}
      {company.instagram && (
        <a href={`https://instagram.com/${company.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="mt-2 text-sm font-semibold text-[#9BD373]">
          Veja nossas obras no Instagram @{company.instagram.replace(/^@/, "")}
        </a>
      )}
    </div>
  );
}

/** Desenho simples de cada tipo de telhado (sem fotos: carrega instantâneo no 4G). */
function RoofArt({ kind }: { kind: (typeof ROOFS)[number]["art"] }) {
  const stroke = "#9BD373";
  return (
    <svg viewBox="0 0 64 40" className="h-10 w-16" aria-hidden>
      {kind === "ceramic" && (
        <g fill="none" stroke={stroke} strokeWidth="2">
          <path d="M4 34 L32 8 L60 34" />
          {[14, 20, 26].map((y) => (
            <path key={y} d={`M${32 - (y - 6) * 1.05} ${y + 2} q3 3 6 0 q3 3 6 0 q3 3 6 0 q3 3 6 0`} />
          ))}
        </g>
      )}
      {kind === "fiber" && (
        <g fill="none" stroke={stroke} strokeWidth="2">
          <path d="M6 30 L58 14" />
          <path d="M6 30 q4 -6 8 -2 q4 -6 8 -2 q4 -6 8 -2 q4 -6 8 -2 q4 -6 8 -2 q4 -6 8 -2" />
        </g>
      )}
      {kind === "metal" && (
        <g fill="none" stroke={stroke} strokeWidth="2">
          <path d="M6 30 L58 14" />
          {[12, 20, 28, 36, 44, 52].map((x) => (
            <path key={x} d={`M${x} ${31 - (x - 6) * 0.31} v-6`} />
          ))}
        </g>
      )}
      {kind === "slab" && (
        <g fill="none" stroke={stroke} strokeWidth="2">
          <rect x="8" y="18" width="48" height="16" rx="2" />
          <path d="M14 18 l6 -8 h24 l6 8" />
        </g>
      )}
      {kind === "ground" && (
        <g fill="none" stroke={stroke} strokeWidth="2">
          <path d="M4 34 H60" />
          <path d="M14 34 l6 -16 h18 l-6 16" />
          <path d="M34 34 l6 -16 h18 l-6 16" />
        </g>
      )}
    </svg>
  );
}
