"use client";

/* eslint-disable @next/next/no-img-element */
import {
  ArrowRight,
  BadgePercent,
  Building2,
  CalendarClock,
  Check,
  ChevronLeft,
  CircleHelp,
  Clock,
  CreditCard,
  FileSignature,
  Gauge,
  Hourglass,
  Landmark,
  Leaf,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Rocket,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  TrendingDown,
  TrendingUp,
  Wrench,
  Zap,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PublicCompany } from "@/components/capture/funnel";
import { trackLead } from "@/components/capture/funnel";
import { RoofScene } from "@/components/capture/art";
import { cx } from "@/components/ui";
import {
  EMPTY_ANSWERS,
  INCREASES,
  PAYMENTS,
  PROPERTIES,
  TIMELINES,
  anamneseNotes,
  buildPlan,
  currentBill,
  currentKwh,
  fioBShare,
  increaseKwh,
  temperatureOf,
  type Answers,
  type Payment,
  type Timeline,
} from "@/lib/anamnese";
import type { RoofKey } from "@/lib/defaults";
import { whatsappUrl } from "@/lib/format";
import { brl, fmtNum } from "@/lib/pricing";

type Step = "intro" | "consumo" | "atende" | "telhado" | "imoveis" | "pagamento" | "prazo" | "contato" | "resultado";
const QUESTIONS: Step[] = ["consumo", "atende", "telhado", "imoveis", "pagamento", "prazo", "contato"];

const ROOFS: { key: RoofKey | "naosei"; value: string; label: string; insight: string }[] = [
  { key: "ceramic", value: "Telhado cerâmico", label: "Cerâmico", insight: "Usamos ganchos próprios para telha cerâmica e trocamos, sem custo, qualquer telha que quebrar na instalação." },
  { key: "fiber", value: "Telhado fibrocimento", label: "Fibrocimento", insight: "Fixação direto na estrutura com vedação: zero risco de goteira e instalação rápida." },
  { key: "metal", value: "Telhado metálico", label: "Metálico", insight: "O mais rápido de instalar: estrutura leve, parafusos com vedação e nenhuma perfuração exposta." },
  { key: "slab", value: "Laje", label: "Laje", insight: "Na laje montamos a estrutura com a inclinação ideal para o sol de Alagoas: geração máxima." },
  { key: "ground", value: "Solo", label: "Solo", insight: "No solo o sistema fica na posição perfeita e sem limite de espaço — ótimo para crescer depois." },
  { key: "naosei", value: "Não sabe informar", label: "Não sei", insight: "Sem problema! Na visita técnica gratuita avaliamos o telhado e a estrutura para você." },
];

const PAY_ICON: Record<Payment, ReactNode> = {
  financiamento: <Landmark className="h-5 w-5" />,
  cartao: <CreditCard className="h-5 w-5" />,
  avista: <BadgePercent className="h-5 w-5" />,
  pensar: <CircleHelp className="h-5 w-5" />,
};
const TIME_ICON: Record<Timeline, ReactNode> = {
  agora: <Rocket className="h-5 w-5" />,
  "1-3": <CalendarClock className="h-5 w-5" />,
  "3-6": <Clock className="h-5 w-5" />,
  naosei: <Hourglass className="h-5 w-5" />,
};

/* ------------------------------------------------------------------ util */

/** Momento da última troca de etapa: só rola até o argumento quando ele surge por uma resposta. */
let stepChangedAt = 0;

/** Traz para a tela o bloco que acabou de aparecer (o argumento da resposta). */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (Date.now() - stepChangedAt < 600) return;
    const el = ref.current;
    if (!el) return;
    const t = setTimeout(() => {
      const r = el.getBoundingClientRect();
      // Barra de ação fixa ocupa ~110px embaixo.
      if (r.bottom > window.innerHeight - 110) window.scrollBy({ top: r.bottom - window.innerHeight + 130, behavior: "smooth" });
    }, 80);
    return () => clearTimeout(t);
  }, []);
  return ref;
}

/** Número que "corre" até o valor novo. */
function useCountUp(value: number, ms = 700) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, ms]);
  return shown;
}

function Glass({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-[26px] bg-white/[0.06] ring-1 ring-white/10 backdrop-blur-xl", className)}>{children}</div>;
}

function Option({ selected, onClick, icon, title, sub, className }: { selected: boolean; onClick: () => void; icon?: ReactNode; title: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        "group relative flex w-full items-center gap-3.5 rounded-[22px] p-4 text-left transition duration-200 active:scale-[0.985]",
        selected ? "bg-[#F3EA3B] text-[#1C1234] shadow-[0_18px_40px_-18px_rgba(243,234,59,0.8)]" : "bg-white/[0.06] text-white ring-1 ring-white/10 hover:bg-white/[0.1]",
        className,
      )}
    >
      {icon && <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition", selected ? "bg-[#1C1234] text-[#F3EA3B]" : "bg-white/10 text-[#9BD373]")}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] leading-tight font-semibold">{title}</span>
        {sub && <span className={cx("mt-0.5 block text-[13px] leading-snug", selected ? "text-[#1C1234]/70" : "text-white/55")}>{sub}</span>}
      </span>
      <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-full transition", selected ? "bg-[#1C1234] text-[#F3EA3B]" : "ring-1 ring-white/25")}>{selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
    </button>
  );
}

/** Cartão de argumento que aparece a cada resposta. */
function Insight({ icon, tone = "lime", title, children }: { icon: ReactNode; tone?: "lime" | "yellow" | "rose"; title: ReactNode; children?: ReactNode }) {
  const tones = {
    lime: "from-[#9BD373]/20 to-[#6CC690]/5 ring-[#9BD373]/30 text-[#9BD373]",
    yellow: "from-[#F3EA3B]/20 to-[#F3EA3B]/5 ring-[#F3EA3B]/30 text-[#F3EA3B]",
    rose: "from-[#FF6B8B]/20 to-[#FF6B8B]/5 ring-[#FF6B8B]/30 text-[#FF8FA8]",
  };
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={cx("ios-rise mt-5 flex gap-3 rounded-[22px] bg-gradient-to-br p-4 ring-1", tones[tone])}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 text-[14px] leading-relaxed text-white/85">
        <p className="font-semibold text-white">{title}</p>
        {children && <div className="mt-1">{children}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- componente */

export function Diagnostic({ company }: { company: PublicCompany }) {
  const params = useSearchParams();
  const owner = params.get("v") ?? "";
  const leadId = params.get("l") ?? "";
  const firstName = (params.get("n") ?? "").trim().split(/\s+/)[0]?.slice(0, 30) ?? "";
  const brand = company.company_name || "Quark Energia";
  const rates = useMemo(() => ({ tariff: company.tariff, sunHours: company.sunHours, fioBTariff: company.fioBTariff, publicLighting: company.publicLighting }), [company]);

  const [step, setStep] = useState<Step>("intro");
  const [dir, setDir] = useState<"push" | "pop">("push");
  const [a, setA] = useState<Answers>(EMPTY_ANSWERS);
  const [contact, setContact] = useState({ name: firstName, phone: "", email: "", city: "", referral: "", website: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const startedAt = useRef(Date.now());

  const plan = useMemo(() => buildPlan(a, rates), [a, rates]);
  const set = (patch: Partial<Answers>) => setA((x) => ({ ...x, ...patch }));

  const go = (next: Step, d: "push" | "pop" = "push") => {
    stepChangedAt = Date.now();
    setDir(d);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const idx = QUESTIONS.indexOf(step);
  const next = () => go(idx >= 0 && idx < QUESTIONS.length - 1 ? QUESTIONS[idx + 1] : "contato");
  const back = () => go(idx > 0 ? QUESTIONS[idx - 1] : "intro", "pop");

  const canNext =
    (step === "consumo" && a.value > 0) ||
    (step === "atende" && (a.fit === "atende" || (a.fit === "aumentar" && increaseKwh(a) > 0))) ||
    (step === "telhado" && !!a.roof) ||
    (step === "imoveis" && !!a.properties && (a.properties === "1" || a.otherKwh > 0)) ||
    (step === "pagamento" && !!a.payment) ||
    (step === "prazo" && !!a.timeline);

  const phoneOk = contact.phone.replace(/\D/g, "").length >= 10;
  const canSend = contact.name.trim().length >= 2 && phoneOk;

  const submit = async () => {
    if (!canSend || sending) return;
    setSending(true);
    setError("");
    const notes = anamneseNotes(a, plan, { referral: contact.referral });
    const res = await fetch("/api/public/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: contact.name.trim(),
        phone: contact.phone,
        email: contact.email.trim(),
        city: contact.city.trim(),
        state: "AL",
        avg_bill: plan.billPlanned,
        consumption_kwh: plan.kwhPlanned,
        roof_type: a.roof,
        segment: "solar",
        source: "Anamnese",
        temperature: temperatureOf(a),
        notes,
        owner,
        lead_id: leadId,
        website: contact.website,
        elapsed: Date.now() - startedAt.current,
      }),
    }).catch(() => null);
    setSending(false);
    if (!res || !res.ok) {
      setError("Não conseguimos enviar agora. Confira sua conexão e toque de novo.");
      return;
    }
    trackLead("solar", plan.estimate.annualSavings);
    go("resultado");
  };

  const monthly = useCountUp(plan.estimate.monthlySavings);
  const total25 = useCountUp(plan.estimate.savings25y);
  const showHud = idx >= 1 && step !== "contato";
  const progress = step === "intro" ? 0 : step === "resultado" ? 1 : (idx + 1) / (QUESTIONS.length + 1);

  return (
    <div translate="no" className="notranslate ios-font relative min-h-dvh overflow-x-clip bg-[#0E0A1C] text-white">
      {/* Aurora */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="ios-float absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-[#5B34D6]/40 blur-[110px]" />
        <div className="ios-float absolute top-1/3 -right-40 h-[26rem] w-[26rem] rounded-full bg-[#9BD373]/20 blur-[110px] [animation-delay:-3s]" />
        <div className="ios-float absolute -bottom-40 left-1/4 h-[24rem] w-[24rem] rounded-full bg-[#F3EA3B]/15 blur-[110px] [animation-delay:-5s]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      </div>

      {/* Topo */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0E0A1C]/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-3 px-4">
          {step !== "intro" && step !== "resultado" ? (
            <button onClick={back} className="-ml-1 grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/10" aria-label="Voltar">
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <img src="/brand/logo-h-white.png" alt={brand} className="h-7 w-auto" />
          )}
          <div className="flex-1">
            {step !== "intro" && (
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] transition-all duration-500" style={{ width: `${Math.max(6, progress * 100)}%` }} />
              </div>
            )}
          </div>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-white/50">
            <Lock className="h-3 w-3 text-[#9BD373]" /> {step === "intro" ? "Grátis" : step === "resultado" ? "Pronto" : `${idx + 1}/${QUESTIONS.length}`}
          </span>
        </div>

        {/* Painel da economia ao vivo */}
        {showHud && (
          <div className="mx-auto max-w-xl px-4 pb-3">
            <div className="anam-shine relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#F3EA3B] via-[#C7E36B] to-[#9BD373] px-4 py-2.5 text-[#1C1234] shadow-[0_12px_40px_-16px_rgba(243,234,59,0.7)]">
              <TrendingDown className="h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase opacity-70">Sua economia estimada</p>
                <p className="ios-rounded truncate text-[19px] leading-tight font-extrabold">
                  {brl(monthly, 0)}
                  <span className="text-[13px] font-semibold opacity-70">/mês</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase opacity-70">Em 25 anos</p>
                <p className="ios-rounded text-[15px] font-extrabold">{brl(total25, 0)}</p>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="relative mx-auto max-w-xl px-4 pt-6 pb-40">
        <div key={step} className={dir === "push" ? "ios-push" : "ios-pop"}>
          {step === "intro" && <Intro brand={brand} firstName={firstName} city={company.city} onStart={() => go("consumo")} />}

          {step === "consumo" && (
            <section>
              <Kicker n={1}>Seu consumo</Kicker>
              <H>Quanto de energia você usa por mês?</H>
              <Sub>Use a média da sua conta. Se tiver a conta em mãos, o consumo em kWh é o dado mais preciso.</Sub>
              <div className="mt-5 inline-flex rounded-2xl bg-white/[0.06] p-1 ring-1 ring-white/10">
                {(
                  [
                    ["bill", "Valor da conta (R$)"],
                    ["kwh", "Consumo (kWh)"],
                  ] as const
                ).map(([m, l]) => (
                  <button
                    key={m}
                    onClick={() => {
                      if (m === a.mode) return;
                      // Converte o valor atual para a outra unidade.
                      set({ mode: m, value: m === "kwh" ? Math.max(50, currentKwh(a, rates)) : Math.max(80, currentBill(a, rates)) });
                    }}
                    className={cx("rounded-xl px-3.5 py-2 text-[13px] font-semibold transition", a.mode === m ? "bg-white text-[#1C1234]" : "text-white/60")}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <ValuePicker mode={a.mode} value={a.value} onChange={(value) => set({ value })} />
              <Insight icon={<TrendingUp className="h-5 w-5" />} tone="rose" title={`Você entrega ≈ ${brl(currentBill(a, rates) * 12, 0)} por ano para a distribuidora.`}>
                Com os reajustes da tarifa, isso passa de <b className="text-white">{brl(buildPlan({ ...a, fit: "atende", properties: "1" }, rates).paid25y, 0)}</b> em 25 anos — dinheiro que não volta. Vamos
                mudar isso?
              </Insight>
              <p className="mt-4 flex items-start gap-2 text-[12.5px] text-white/45">
                <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Na conta da Equatorial, o consumo aparece no quadro “Histórico de consumo” (kWh). Use a média dos últimos meses.
              </p>
            </section>
          )}

          {step === "atende" && (
            <section>
              <Kicker n={2}>Seu futuro</Kicker>
              <H>Esse consumo atende tudo o que você precisa?</H>
              <Sub>Muita gente economiza no ar-condicionado por causa da conta. Com energia solar, dá para viver com conforto.</Sub>
              <div className="mt-6 grid gap-3">
                <Option selected={a.fit === "atende"} onClick={() => set({ fit: "atende" })} icon={<Check className="h-5 w-5" />} title="Sim, atende bem" sub="Quero pagar menos pelo que já uso" />
                <Option selected={a.fit === "aumentar"} onClick={() => set({ fit: "aumentar" })} icon={<TrendingUp className="h-5 w-5" />} title="Quero consumir mais" sub="Ar-condicionado, carro elétrico, piscina…" />
              </div>
              {a.fit === "aumentar" && (
                <div className="ios-rise mt-5">
                  <p className="mb-2.5 text-[13px] font-semibold text-white/70">O que vai entrar na sua casa? (marque quantos quiser)</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {INCREASES.map((i) => {
                      const on = a.increases.includes(i.id);
                      return (
                        <button
                          key={i.id}
                          onClick={() => set({ increases: on ? a.increases.filter((x) => x !== i.id) : [...a.increases, i.id] })}
                          className={cx(
                            "flex flex-col items-start gap-1 rounded-2xl p-3.5 text-left transition active:scale-[0.97]",
                            on ? "bg-[#9BD373] text-[#1C1234]" : "bg-white/[0.06] ring-1 ring-white/10",
                          )}
                        >
                          <span className="text-2xl">{i.emoji}</span>
                          <span className="text-[14px] leading-tight font-semibold">{i.label}</span>
                          <span className={cx("text-[12px] font-semibold", on ? "text-[#1C1234]/70" : "text-[#9BD373]")}>+{i.kwh} kWh/mês</span>
                        </button>
                      );
                    })}
                    <div className="flex flex-col justify-between gap-2 rounded-2xl bg-white/[0.06] p-3.5 ring-1 ring-white/10">
                      <span className="text-[13px] font-semibold">Outro aumento</span>
                      <Stepper value={a.extraKwh} step={50} min={0} max={3000} suffix="kWh" onChange={(extraKwh) => set({ extraKwh })} />
                    </div>
                  </div>
                </div>
              )}
              {a.fit === "atende" && (
                <Insight icon={<Gauge className="h-5 w-5" />} title="Perfeito: sistema sob medida para a sua média.">
                  Sem sobras e sem faltas. Você passa a pagar praticamente só a taxa mínima da distribuidora.
                </Insight>
              )}
              {a.fit === "aumentar" && increaseKwh(a) > 0 && (
                <Insight icon={<Sparkles className="h-5 w-5" />} tone="yellow" title={`Novo consumo: ${fmtNum(plan.kwhPlanned)} kWh/mês — e a economia sobe junto.`}>
                  Dimensionar agora pensando no futuro sai bem mais barato do que ampliar o sistema depois: é uma instalação só, um projeto só e uma aprovação só na distribuidora.
                </Insight>
              )}
            </section>
          )}

          {step === "telhado" && (
            <section>
              <Kicker n={3}>Sua estrutura</Kicker>
              <H>Onde as placas vão ficar?</H>
              <Sub>
                Você vai precisar de cerca de <b className="text-white">{plan.estimate.areaM2} m²</b> livres para {plan.estimate.modules} placas.
              </Sub>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {ROOFS.map((r) => {
                  const on = a.roof === r.value;
                  return (
                    <button
                      key={r.key}
                      onClick={() => set({ roof: r.value })}
                      aria-pressed={on}
                      className={cx("group relative overflow-hidden rounded-[22px] text-left transition active:scale-[0.97]", on ? "ring-[3px] ring-[#F3EA3B]" : "ring-1 ring-white/10")}
                    >
                      <div className="relative aspect-[4/3] bg-white/5">
                        {r.key === "naosei" ? (
                          <div className="grid h-full place-items-center bg-gradient-to-br from-[#5B34D6]/40 to-[#1C1234]">
                            <CircleHelp className="h-10 w-10 text-white/60" />
                          </div>
                        ) : company.capture?.roofImages?.[r.key] ? (
                          <img src={company.capture.roofImages[r.key]} alt={r.label} className="h-full w-full object-cover" />
                        ) : (
                          <RoofScene kind={r.key} className="h-full w-full" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        {on && (
                          <span className="ios-bounce absolute top-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-full bg-[#F3EA3B] text-[#1C1234]">
                            <Check className="h-4 w-4" strokeWidth={3} />
                          </span>
                        )}
                        <span className="absolute bottom-2.5 left-3 text-[15px] font-semibold">{r.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {a.roof && (
                <Insight icon={<Wrench className="h-5 w-5" />} title={ROOFS.find((r) => r.value === a.roof)!.label === "Não sei" ? "Nosso técnico resolve isso." : "Ótima escolha para energia solar."}>
                  {ROOFS.find((r) => r.value === a.roof)!.insight}
                </Insight>
              )}
            </section>
          )}

          {step === "imoveis" && (
            <section>
              <Kicker n={4}>Seus imóveis</Kicker>
              <H>A energia vai abastecer um imóvel ou mais?</H>
              <Sub>Você pode gerar num lugar e usar os créditos para abater a conta de outro imóvel seu.</Sub>
              <div className="mt-6 grid gap-3">
                {PROPERTIES.map((p) => (
                  <Option
                    key={p.id}
                    selected={a.properties === p.id}
                    onClick={() => set({ properties: p.id, otherKwh: p.id === "1" ? 0 : a.otherKwh || (p.id === "2" ? 250 : 500) })}
                    icon={p.id === "1" ? <Sun className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                    title={p.label}
                    sub={p.sub}
                  />
                ))}
              </div>
              {a.properties && a.properties !== "1" && (
                <div className="ios-rise mt-5">
                  <Glass className="p-4">
                    <TransferArt />
                    <p className="mt-3 text-[13px] font-semibold text-white/70">Consumo somado dos outros imóveis</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <Stepper value={a.otherKwh} step={50} min={50} max={20000} suffix="kWh/mês" onChange={(otherKwh) => set({ otherKwh })} big />
                    </div>
                  </Glass>
                  <Insight icon={<Zap className="h-5 w-5" />} tone="yellow" title="Autoconsumo remoto: uma usina, várias contas no zero.">
                    Os créditos vão para os imóveis do mesmo titular (CPF ou CNPJ) atendidos pela mesma distribuidora. Nós cuidamos de todo o cadastro do rateio com a
                    Equatorial.
                  </Insight>
                </div>
              )}
              {a.properties === "1" && (
                <Insight icon={<Sun className="h-5 w-5" />} title="Simples e direto.">
                  E se um dia você tiver outro imóvel, dá para transferir os créditos para ele sem mudar nada no sistema.
                </Insight>
              )}
            </section>
          )}

          {step === "pagamento" && (
            <section>
              <Kicker n={5}>Seu investimento</Kicker>
              <H>Como você prefere investir?</H>
              <Sub>Energia solar é investimento: ela se paga com a própria economia e continua gerando por mais de 25 anos.</Sub>
              <div className="mt-6 grid gap-3">
                {PAYMENTS.map((p) => (
                  <Option key={p.id} selected={a.payment === p.id} onClick={() => set({ payment: p.id })} icon={PAY_ICON[p.id]} title={p.label} sub={payText(p.id, company) ?? p.sub} />
                ))}
              </div>
              {a.payment === "financiamento" && (
                <div className="ios-rise mt-5">
                  <Glass className="p-4">
                    <p className="text-[13px] font-semibold text-white/70">A troca inteligente</p>
                    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-center">
                      <div className="rounded-2xl bg-[#FF6B8B]/15 p-3 ring-1 ring-[#FF6B8B]/30">
                        <p className="text-[11px] font-semibold text-[#FF8FA8] uppercase">Hoje</p>
                        <p className="ios-rounded text-lg font-bold">{brl(plan.billPlanned, 0)}</p>
                        <p className="text-[11px] text-white/50">conta de luz, para sempre</p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-white/40" />
                      <div className="rounded-2xl bg-[#9BD373]/15 p-3 ring-1 ring-[#9BD373]/30">
                        <p className="text-[11px] font-semibold text-[#9BD373] uppercase">Com solar</p>
                        <p className="ios-rounded text-lg font-bold">Parcela</p>
                        <p className="text-[11px] text-white/50">que termina — a economia fica</p>
                      </div>
                    </div>
                  </Glass>
                  <Insight icon={<Landmark className="h-5 w-5" />} title="Você troca a conta de luz pela parcela.">
                    Em muitos casos a parcela fica próxima do valor que você já paga hoje. Quando o financiamento acaba, sobra só a economia — cerca de{" "}
                    <b className="text-white">{brl(plan.estimate.monthlySavings, 0)} por mês</b> no seu bolso.
                  </Insight>
                </div>
              )}
              {a.payment === "cartao" && (
                <Insight icon={<CreditCard className="h-5 w-5" />} title="Parcele no cartão e comece a economizar logo.">
                  A economia começa assim que o sistema é ligado — e ajuda a pagar as parcelas desde o primeiro mês.
                </Insight>
              )}
              {a.payment === "avista" && (
                <Insight icon={<BadgePercent className="h-5 w-5" />} tone="yellow" title="O caminho de maior retorno.">
                  Pagamento à vista tem condição especial, e o sistema se paga só com a economia. Depois disso, são anos de energia praticamente de graça.
                </Insight>
              )}
              {a.payment === "pensar" && (
                <Insight icon={<CircleHelp className="h-5 w-5" />} title="Sem pressa.">
                  O consultor vai te mostrar as três opções lado a lado, com a parcela e o retorno de cada uma, para você decidir com calma.
                </Insight>
              )}
            </section>
          )}

          {step === "prazo" && (
            <section>
              <Kicker n={6}>Seu momento</Kicker>
              <H>Quando você quer começar a economizar?</H>
              <Sub>Do contrato à ligação do sistema, cuidamos de projeto, aprovação na Equatorial e instalação.</Sub>
              <div className="mt-6 grid gap-3">
                {TIMELINES.map((t) => (
                  <Option key={t.id} selected={a.timeline === t.id} onClick={() => set({ timeline: t.id })} icon={TIME_ICON[t.id]} title={t.label} sub={t.sub} />
                ))}
              </div>
              {a.timeline && <WaitCost monthly={plan.costOfWaiting} timeline={a.timeline} />}
            </section>
          )}

          {step === "contato" && (
            <section>
              <Kicker n={7}>Quase lá</Kicker>
              <H>{contact.name.trim() ? `${contact.name.trim().split(" ")[0]}, seu diagnóstico está pronto!` : "Seu diagnóstico está pronto!"}</H>
              <Sub>Informe seu contato para ver o resultado completo. Um consultor da {brand} confirma os números com você, sem compromisso.</Sub>
              {/* Prévia borrada do resultado: curiosidade que converte */}
              <Glass className="relative mt-5 overflow-hidden p-4">
                <div className="pointer-events-none grid grid-cols-3 gap-2 blur-[6px] select-none" aria-hidden>
                  {[brl(plan.estimate.monthlySavings, 0), `${fmtNum(plan.estimate.kwp, 1)} kWp`, brl(plan.estimate.savings25y, 0)].map((v, i) => (
                    <div key={i} className="rounded-xl bg-white/10 p-3 text-center">
                      <p className="ios-rounded text-lg font-bold">{v}</p>
                      <p className="text-[10px] text-white/60">■■■■■</p>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 grid place-items-center">
                  <span className="flex items-center gap-1.5 rounded-full bg-[#0E0A1C]/80 px-3 py-1.5 text-[12px] font-semibold ring-1 ring-white/15">
                    <Lock className="h-3.5 w-3.5 text-[#F3EA3B]" /> Liberado após o envio
                  </span>
                </div>
              </Glass>
              <div className="mt-5 grid gap-3">
                <Field label="Seu nome" value={contact.name} onChange={(name) => setContact((c) => ({ ...c, name }))} autoComplete="name" />
                <Field label="WhatsApp" value={contact.phone} onChange={(phone) => setContact((c) => ({ ...c, phone }))} autoComplete="tel" inputMode="tel" placeholder="(82) 9 9999-9999" />
                <Field label="E-mail (receba o estudo)" value={contact.email} onChange={(email) => setContact((c) => ({ ...c, email }))} autoComplete="email" inputMode="email" optional />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Cidade" value={contact.city} onChange={(city) => setContact((c) => ({ ...c, city }))} autoComplete="address-level2" optional />
                  <Field label="Quem indicou?" value={contact.referral} onChange={(referral) => setContact((c) => ({ ...c, referral }))} optional />
                </div>
                {/* Campo invisível contra robôs */}
                <input tabIndex={-1} autoComplete="off" value={contact.website} onChange={(e) => setContact((c) => ({ ...c, website: e.target.value }))} className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />
              </div>
              {error && <p className="mt-3 rounded-xl bg-[#FF6B8B]/15 px-3 py-2 text-sm text-[#FFB3C3]">{error}</p>}
              <p className="mt-4 flex items-start gap-2 text-[12px] text-white/45">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9BD373]" /> Seus dados ficam protegidos (LGPD) e são usados só para o seu atendimento. Nada de spam.
              </p>
            </section>
          )}

          {step === "resultado" && <Result brand={brand} company={company} name={contact.name} a={a} plan={plan} />}
        </div>
      </main>

      {/* Barra de ação */}
      {step !== "intro" && step !== "resultado" && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#0E0A1C] via-[#0E0A1C]/95 to-transparent px-4 pt-8 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-xl">
            {step === "contato" ? (
              <button
                onClick={submit}
                disabled={!canSend || sending}
                className="flex h-[58px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#F3EA3B] text-[17px] font-bold text-[#1C1234] shadow-[0_18px_40px_-14px_rgba(243,234,59,0.8)] transition active:scale-[0.98] disabled:opacity-40"
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                {sending ? "Gerando seu diagnóstico…" : "Ver meu diagnóstico"}
              </button>
            ) : (
              <button
                onClick={next}
                disabled={!canNext}
                className="flex h-[58px] w-full items-center justify-center gap-2 rounded-[20px] bg-white text-[17px] font-bold text-[#1C1234] transition active:scale-[0.98] disabled:opacity-30"
              >
                Continuar <ArrowRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function payText(id: Payment, company: PublicCompany) {
  const list = company.capture?.payments ?? [];
  const find = (re: RegExp) => list.find((p) => re.test(p.title));
  if (id === "financiamento") return find(/financ/i)?.text ?? null;
  if (id === "cartao") return find(/cart/i)?.text ?? null;
  if (id === "avista") return find(/vista/i)?.text ?? null;
  return null;
}

/* ------------------------------------------------------------ pedaços */

function Kicker({ n, children }: { n: number; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[12px] font-bold tracking-[0.16em] text-[#9BD373] uppercase">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-[#9BD373] text-[11px] text-[#1C1234]">{n}</span>
      {children}
    </p>
  );
}
function H({ children }: { children: ReactNode }) {
  return <h1 className="mt-3 font-display text-[30px] leading-[1.1] font-semibold tracking-tight sm:text-[34px]">{children}</h1>;
}
function Sub({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[15px] leading-relaxed text-white/60">{children}</p>;
}

function Field({
  label,
  value,
  onChange,
  optional,
  ...rest
}: { label: string; value: string; onChange: (v: string) => void; optional?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[13px] font-semibold text-white/70">
        {label} {optional && <span className="font-normal text-white/35">(opcional)</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[52px] rounded-2xl bg-white/[0.07] px-4 text-[16px] text-white ring-1 ring-white/10 outline-none placeholder:text-white/30 focus:ring-2 focus:ring-[#F3EA3B]"
        {...rest}
      />
    </label>
  );
}

function Stepper({ value, onChange, step, min, max, suffix, big }: { value: number; onChange: (v: number) => void; step: number; min: number; max: number; suffix: string; big?: boolean }) {
  return (
    <div className="flex w-full items-center justify-between gap-2">
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 active:scale-90" aria-label="Diminuir">
        <Minus className="h-4 w-4" />
      </button>
      <span className={cx("ios-rounded text-center font-bold", big ? "text-2xl" : "text-[15px]")}>
        {fmtNum(value)} <span className="text-[11px] font-semibold text-white/50">{suffix}</span>
      </span>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 active:scale-90" aria-label="Aumentar">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function ValuePicker({ mode, value, onChange }: { mode: "bill" | "kwh"; value: number; onChange: (v: number) => void }) {
  const cfg = mode === "bill" ? { min: 80, max: 5000, step: 10, presets: [200, 350, 500, 800, 1500] } : { min: 50, max: 5000, step: 10, presets: [150, 300, 500, 800, 1500] };
  const fill = ((Math.min(value, cfg.max) - cfg.min) / (cfg.max - cfg.min)) * 100;
  return (
    <Glass className="mt-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => onChange(Math.max(cfg.min, value - cfg.step * 5))} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 active:scale-90" aria-label="Diminuir">
          <Minus className="h-5 w-5" />
        </button>
        <label className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
          {mode === "bill" && <span className="text-lg font-semibold text-white/50">R$</span>}
          <input
            value={value ? String(value) : ""}
            onChange={(e) => onChange(Math.min(cfg.max * 4, Number(e.target.value.replace(/\D/g, "")) || 0))}
            inputMode="numeric"
            aria-label={mode === "bill" ? "Valor da conta em reais" : "Consumo em kWh"}
            className="ios-rounded w-full min-w-0 bg-transparent text-center text-[44px] leading-none font-extrabold outline-none"
            style={{ maxWidth: `${Math.max(3, String(value).length) + 0.5}ch` }}
          />
          {mode === "kwh" && <span className="text-lg font-semibold text-white/50">kWh</span>}
        </label>
        <button type="button" onClick={() => onChange(Math.min(cfg.max * 4, value + cfg.step * 5))} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 active:scale-90" aria-label="Aumentar">
          <Plus className="h-5 w-5" />
        </button>
      </div>
      <input
        type="range"
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        value={Math.min(value, cfg.max)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="anam-range mt-6 w-full"
        style={{ ["--fill" as string]: `${fill}%` }}
        aria-label="Ajustar valor"
      />
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {cfg.presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cx("rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition", value === p ? "bg-white text-[#1C1234]" : "bg-white/[0.07] text-white/70 ring-1 ring-white/10")}
          >
            {mode === "bill" ? brl(p, 0) : `${fmtNum(p)} kWh`}
          </button>
        ))}
      </div>
    </Glass>
  );
}

/** Duas casas trocando energia: a usina gera numa e abate a conta da outra. */
function TransferArt() {
  return (
    <svg viewBox="0 0 320 124" className="w-full" aria-hidden>
      <defs>
        <linearGradient id="tf" x1="0" x2="1">
          <stop offset="0" stopColor="#F3EA3B" />
          <stop offset="1" stopColor="#9BD373" />
        </linearGradient>
      </defs>
      {/* casa 1 com placas */}
      <g transform="translate(18 30)">
        <polygon points="0,34 40,6 80,34" fill="#2A1F4D" />
        <polygon points="10,30 40,9 70,30" fill="#23385C" stroke="#8FA6D1" strokeWidth="1" />
        <line x1="25" y1="19" x2="55" y2="19" stroke="#8FA6D1" strokeWidth="0.8" />
        <rect x="8" y="34" width="64" height="40" rx="3" fill="#3A2C66" />
        <rect x="32" y="50" width="16" height="24" rx="2" fill="#1C1234" />
        <circle cx="40" cy="-10" r="9" fill="#F3EA3B" />
      </g>
      {/* fluxo */}
      <path d="M110 70 C 150 30, 170 30, 210 70" stroke="url(#tf)" strokeWidth="3" fill="none" className="anam-flow" strokeLinecap="round" />
      <text x="160" y="28" textAnchor="middle" fill="#9BD373" fontSize="11" fontWeight="700">créditos de energia</text>
      {/* casa 2 */}
      <g transform="translate(222 30)">
        <polygon points="0,34 40,6 80,34" fill="#2A1F4D" />
        <rect x="8" y="34" width="64" height="40" rx="3" fill="#3A2C66" />
        <rect x="18" y="44" width="14" height="12" rx="2" fill="#F3EA3B" opacity="0.8" />
        <rect x="48" y="44" width="14" height="12" rx="2" fill="#F3EA3B" opacity="0.8" />
        <text x="40" y="90" textAnchor="middle" fill="#fff" opacity="0.6" fontSize="10">conta abatida</text>
      </g>
      <text x="58" y="120" textAnchor="middle" fill="#fff" opacity="0.6" fontSize="10">gera aqui</text>
    </svg>
  );
}

function WaitCost({ monthly, timeline }: { monthly: number; timeline: Timeline }) {
  const ref = useReveal<HTMLDivElement>();
  const months = timeline === "agora" ? 0 : timeline === "1-3" ? 3 : timeline === "3-6" ? 6 : 12;
  const year = new Date().getFullYear();
  const now = fioBShare(year);
  const nextShare = fioBShare(year + 1);
  const fio = year >= 2023 && year < 2028 && nextShare > now;
  if (timeline === "agora")
    return (
      <Insight icon={<Rocket className="h-5 w-5" />} tone="yellow" title="Decisão de quem economiza de verdade.">
        Começando já, você deixa de perder ≈ <b className="text-white">{brl(monthly, 0)} por mês</b>.
        {fio && ` E garante as regras de ${year}: pela Lei 14.300, a parcela do Fio B cobrada de quem gera energia sobe de ${now}% para ${nextShare}% em ${year + 1}.`}
      </Insight>
    );
  return (
    <div ref={ref} className="ios-rise mt-5 overflow-hidden rounded-[22px] bg-gradient-to-br from-[#FF6B8B]/20 to-[#FF6B8B]/5 p-4 ring-1 ring-[#FF6B8B]/30">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-[#FF8FA8]">
        <Hourglass className="h-4 w-4" /> O custo de esperar
      </p>
      <p className="ios-rounded mt-1 text-[34px] leading-tight font-extrabold">{brl(monthly * months, 0)}</p>
      <p className="text-[14px] text-white/75">
        é o que você deixa de economizar em {months} meses de espera (≈ {brl(monthly, 0)} por mês).
      </p>
      {fio && (
        <p className="mt-2 text-[13px] text-white/60">
          Além disso, pela Lei 14.300, o Fio B cobrado de quem gera sobe de {now}% para {nextShare}% em {year + 1}: quanto antes instalar, melhor.
        </p>
      )}
    </div>
  );
}

function Intro({ brand, firstName, city, onStart }: { brand: string; firstName: string; city?: string | null; onStart: () => void }) {
  return (
    <section className="pt-4 text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-[12px] font-semibold text-[#9BD373] ring-1 ring-white/10">
        <Sparkles className="h-3.5 w-3.5" /> Diagnóstico energético gratuito
      </span>
      {firstName && <p className="mt-6 text-[17px] text-white/70">Olá, {firstName}! 👋 Preparei isto para você.</p>}
      <h1 className={cx("font-display text-[38px] leading-[1.05] font-semibold tracking-tight sm:text-[46px]", firstName ? "mt-2" : "mt-6")}>
        Descubra quanto dinheiro está <span className="bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] bg-clip-text text-transparent">escapando pela sua conta de luz.</span>
      </h1>
      <p className="mx-auto mt-4 max-w-md text-[16px] leading-relaxed text-white/60">
        6 perguntas rápidas. No final você vê a economia estimada, o tamanho do sistema ideal e o caminho para parar de pagar caro — sem compromisso.
      </p>
      <div className="relative mx-auto mt-8 grid h-64 max-w-sm place-items-center" aria-hidden>
        <div className="absolute h-44 w-44 rounded-full bg-[#F3EA3B]/25 blur-3xl" />
        {/* Órbitas com a economia girando em volta do sol */}
        <div className="absolute h-60 w-60 animate-[spin_28s_linear_infinite] rounded-full border border-dashed border-white/15">
          <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[#9BD373] shadow-[0_0_16px_#9BD373]" />
        </div>
        <div className="absolute h-44 w-44 animate-[spin_16s_linear_infinite_reverse] rounded-full border border-white/10">
          <span className="absolute top-1/2 -right-1 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#F3EA3B] shadow-[0_0_14px_#F3EA3B]" />
        </div>
        <div className="relative grid h-32 w-32 place-items-center rounded-full bg-gradient-to-br from-[#F3EA3B] to-[#9BD373] shadow-[0_30px_80px_-20px_rgba(243,234,59,0.7)]">
          <Sun className="h-14 w-14 text-[#1C1234]" strokeWidth={1.6} />
        </div>
        <span className="ios-float absolute top-3 -left-1 rounded-2xl bg-white/10 px-3 py-2 text-left text-[11px] leading-tight ring-1 ring-white/15 backdrop-blur-md sm:left-2">
          <b className="ios-rounded block text-[15px] text-[#F3EA3B]">até 95%</b>menos na conta
        </span>
        <span className="ios-float absolute -right-1 bottom-4 rounded-2xl bg-white/10 px-3 py-2 text-left text-[11px] leading-tight ring-1 ring-white/15 backdrop-blur-md [animation-delay:-3s] sm:right-2">
          <b className="ios-rounded block text-[15px] text-[#9BD373]">+25 anos</b>de energia própria
        </span>
      </div>
      <div className="mt-8 grid grid-cols-3 gap-2">
        {[
          ["6", "perguntas"],
          ["2 min", "para responder"],
          ["R$ 0", "custo zero"],
        ].map(([v, l]) => (
          <Glass key={v} className="px-2 py-3">
            <p className="ios-rounded text-[18px] font-extrabold text-[#F3EA3B]">{v}</p>
            <p className="text-[11.5px] text-white/55">{l}</p>
          </Glass>
        ))}
      </div>
      <button
        onClick={onStart}
        className="anam-shine relative mt-8 flex h-[60px] w-full items-center justify-center gap-2 overflow-hidden rounded-[20px] bg-[#F3EA3B] text-[17px] font-bold text-[#1C1234] shadow-[0_18px_40px_-14px_rgba(243,234,59,0.8)] transition active:scale-[0.98]"
      >
        Começar meu diagnóstico <ArrowRight className="h-5 w-5" />
      </button>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-white/45">
        <ShieldCheck className="h-3.5 w-3.5 text-[#9BD373]" /> {brand}
        {city ? ` · ${city}` : ""} · seus dados protegidos
      </p>
    </section>
  );
}

function Result({ brand, company, name, a, plan }: { brand: string; company: PublicCompany; name: string; a: Answers; plan: ReturnType<typeof buildPlan> }) {
  const e = plan.estimate;
  const monthly = useCountUp(e.monthlySavings, 1200);
  const first = name.trim().split(/\s+/)[0];
  const afterPct = plan.billPlanned > 0 ? Math.max(4, (e.billAfter / plan.billPlanned) * 100) : 5;
  const warranty = company.warranty_modules_performance_years || 25;
  const msg = `Olá! Acabei de fazer o diagnóstico energético.\n• Consumo: ${plan.kwhPlanned} kWh/mês\n• Sistema: ${fmtNum(e.kwp, 2)} kWp (${e.modules} placas)\n• Economia estimada: ${brl(e.monthlySavings, 0)}/mês\nQuero receber a proposta!`;

  const benefits: [ReactNode, string, string][] = [
    [<FileSignature key="1" className="h-5 w-5" />, "Burocracia por nossa conta", "Projeto, aprovação na Equatorial e troca do medidor. Você assina tudo pelo celular."],
    [<ShieldCheck key="2" className="h-5 w-5" />, `${warranty} anos de garantia de performance`, "Equipamentos de primeira linha, com garantia do fabricante."],
    [<Smartphone key="3" className="h-5 w-5" />, "Geração na palma da mão", "Acompanhe quanto seu sistema gera, direto no aplicativo."],
    [<Wrench key="4" className="h-5 w-5" />, company.tech_name ? `Responsável técnico: ${company.tech_name}` : "Equipe técnica própria", "Instalação feita por quem entende, do projeto à ligação."],
    [<MapPin key="5" className="h-5 w-5" />, company.city ? `Atendimento local em ${company.city}` : "Atendimento local", "Pertinho de você antes, durante e depois da instalação."],
    [<Leaf key="6" className="h-5 w-5" />, `${fmtNum(e.co2Tons25y, 0)} t de CO₂ a menos`, `Equivale a plantar ${fmtNum(e.trees)} árvores.`],
  ];

  return (
    <section>
      <div className="text-center">
        <span className="ios-bounce mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#9BD373] shadow-[0_16px_40px_-10px_rgba(155,211,115,0.8)]">
          <svg viewBox="0 0 24 24" className="ios-check h-8 w-8" fill="none" stroke="#1C1234" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <p className="mt-4 text-[12px] font-bold tracking-[0.16em] text-[#9BD373] uppercase">Diagnóstico concluído</p>
        <h1 className="mt-2 font-display text-[30px] leading-tight font-semibold">{first ? `${first}, este é o seu potencial ☀️` : "Este é o seu potencial ☀️"}</h1>
      </div>

      {/* Economia */}
      <div className="relative mt-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#F3EA3B] via-[#C7E36B] to-[#9BD373] p-6 text-[#1C1234] shadow-[0_30px_80px_-30px_rgba(243,234,59,0.8)]">
        <p className="text-[12px] font-bold tracking-[0.14em] uppercase opacity-70">Economia estimada</p>
        <p className="ios-rounded mt-1 text-[52px] leading-none font-extrabold">{brl(monthly, 0)}</p>
        <p className="text-[15px] font-semibold opacity-75">por mês · {brl(e.annualSavings, 0)} por ano</p>
        <div className="mt-5 grid gap-2">
          <Bar label="Conta hoje" value={brl(plan.billPlanned, 0)} pct={100} tone="bg-[#1C1234]/80" />
          <Bar label="Com energia solar" value={brl(e.billAfter, 0)} pct={afterPct} tone="bg-white" />
        </div>
        <p className="mt-4 rounded-2xl bg-[#1C1234]/10 px-3 py-2 text-[13px] font-semibold">
          Em 25 anos: <span className="ios-rounded text-[16px]">{brl(e.savings25y, 0)}</span> que ficam com você.
        </p>
      </div>

      {/* Sistema */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          [<Zap key="a" className="h-4 w-4" />, `${fmtNum(e.kwp, 2)} kWp`, "potência do sistema"],
          [<Sun key="b" className="h-4 w-4" />, `${e.modules} placas`, `≈ ${e.areaM2} m² de área`],
          [<Gauge key="c" className="h-4 w-4" />, `${fmtNum(e.generation)} kWh`, "gerados por mês"],
          [<TrendingDown key="d" className="h-4 w-4" />, `${fmtNum(e.savingsPct * 100, 0)}%`, "de redução na conta"],
        ].map(([icon, v, l], i) => (
          <Glass key={i} className="p-4">
            <span className="text-[#9BD373]">{icon}</span>
            <p className="ios-rounded mt-1 text-[22px] font-extrabold">{v}</p>
            <p className="text-[12px] text-white/55">{l}</p>
          </Glass>
        ))}
      </div>

      {/* Perfil */}
      <Glass className="mt-4 p-4">
        <p className="text-[13px] font-semibold text-white/70">Seu perfil</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            `${plan.kwhNow} kWh/mês hoje`,
            a.fit === "aumentar" ? `+${increaseKwh(a)} kWh planejados` : "Consumo atual atende",
            a.roof ?? "",
            PROPERTIES.find((p) => p.id === a.properties)?.label ?? "",
            PAYMENTS.find((p) => p.id === a.payment)?.label ?? "",
            TIMELINES.find((t) => t.id === a.timeline)?.label ?? "",
          ]
            .filter(Boolean)
            .map((t) => (
              <span key={t} className="rounded-full bg-white/[0.08] px-3 py-1 text-[12.5px] font-medium ring-1 ring-white/10">
                {t}
              </span>
            ))}
        </div>
      </Glass>

      {/* Por que nós */}
      <h2 className="mt-8 font-display text-[22px] font-semibold">Por que instalar com a {brand}</h2>
      <div className="mt-3 grid gap-2.5">
        {benefits.map(([icon, t, s]) => (
          <div key={t} className="flex items-start gap-3 rounded-[20px] bg-white/[0.05] p-3.5 ring-1 ring-white/10">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#9BD373]/15 text-[#9BD373]">{icon}</span>
            <div>
              <p className="text-[15px] font-semibold">{t}</p>
              <p className="text-[13px] text-white/55">{s}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Próximos passos */}
      <h2 className="mt-8 font-display text-[22px] font-semibold">Próximos passos</h2>
      <ol className="relative mt-3 grid gap-4 pl-9">
        <span className="absolute top-2 bottom-2 left-[13px] w-px bg-gradient-to-b from-[#F3EA3B] to-[#9BD373]/20" aria-hidden />
        {[
          ["Hoje", "Um consultor analisa seu diagnóstico e fala com você no WhatsApp."],
          ["Visita técnica gratuita", "Avaliamos telhado, padrão de entrada e sombreamento."],
          ["Proposta detalhada", "Economia, retorno do investimento e as formas de pagamento."],
          ["Instalação e ligação", "Cuidamos de tudo com a Equatorial até o sistema gerar."],
        ].map(([t, s], i) => (
          <li key={t} className="relative">
            <span className="absolute top-0 -left-9 grid h-7 w-7 place-items-center rounded-full bg-[#1C1234] text-[12px] font-bold text-[#F3EA3B] ring-2 ring-[#F3EA3B]/60">{i + 1}</span>
            <p className="text-[15px] font-semibold">{t}</p>
            <p className="text-[13px] text-white/55">{s}</p>
          </li>
        ))}
      </ol>

      {company.whatsapp && (
        <a
          href={whatsappUrl(company.whatsapp, msg)}
          target="_blank"
          rel="noreferrer"
          className="mt-8 flex h-[58px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#25D366] text-[17px] font-bold text-white shadow-[0_18px_40px_-14px_rgba(37,211,102,0.8)] transition active:scale-[0.98]"
        >
          <MessageCircle className="h-5 w-5" /> Falar com um consultor agora
        </a>
      )}
      <p className="mt-5 text-center text-[11.5px] leading-relaxed text-white/40">
        Estimativa com base na tarifa e na irradiação solar média da região, já considerando a taxa mínima e o Fio B (Lei 14.300). Os valores finais são confirmados na
        proposta, após a visita técnica.
      </p>
    </section>
  );
}

function Bar({ label, value, pct, tone }: { label: string; value: string; pct: number; tone: string }) {
  return (
    <div>
      <div className="flex justify-between text-[12.5px] font-semibold">
        <span className="opacity-75">{label}</span>
        <span className="ios-rounded">{value}</span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full bg-[#1C1234]/10">
        <div className={cx("h-full rounded-full transition-all duration-1000", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
