"use client";

import {
  ArrowDownToLine,
  AtSign,
  BadgeCheck,
  CalendarCheck,
  Cable,
  Check,
  Clock,
  Construction,
  Cpu,
  Download,
  Droplets,
  FileText,
  Frame,
  Gauge,
  HardHat,
  Info,
  LayoutPanelTop,
  ListChecks,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plug,
  Power,
  Repeat,
  ScanSearch,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Thermometer,
  ToggleRight,
  TrendingDown,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_SIGNATURE, mergeSettings } from "@/lib/defaults";
import { formatDate, formatPhone, whatsappUrl } from "@/lib/format";
import {
  MAINT_CATEGORIES,
  SEVERITY,
  catalogOf,
  kwpOf,
  maintCardInstallment,
  mergeMaint,
  planOf,
  soilingLoss,
  type MaintCategory,
  type MaintClientItem,
  type MaintIcon,
  type MaintInputs,
} from "@/lib/maintenance";
import { brl, fmtNum } from "@/lib/pricing";
import { Button } from "../ui";
import { AcceptModal, Brand, BrandFooter, BrandRule, CTA_STYLE, CoverKpi, Explain, LeafMark, PayOption, Photo, Section, SectionTitle, type PublicProposal } from "../proposal/document";
import { useProposalTracking } from "../proposal/tracking";

/** Capa padrão (módulos fotovoltaicos). */
const DEFAULT_MAINT_COVER = "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=2000&q=75";
const NAVY = "#1C1234";
const GREEN = "#2C7A52";

const ICONS: Record<MaintIcon, LucideIcon> = {
  droplets: Droplets,
  scan: ScanSearch,
  thermo: Thermometer,
  frame: Frame,
  plug: Plug,
  gauge: Gauge,
  ground: ArrowDownToLine,
  panel: LayoutPanelTop,
  shield: ShieldCheck,
  toggle: ToggleRight,
  cable: Cable,
  cpu: Cpu,
  phone: Smartphone,
  report: FileText,
  truck: Truck,
  ladder: Construction,
};

export function MaintenanceDocument({ data, token }: { data: PublicProposal; token: string | null }) {
  const s = mergeSettings(data.settings);
  const i = mergeMaint(data.proposal.inputs as Partial<MaintInputs>);
  const price = Number(data.proposal.final_price);
  const [accepted, setAccepted] = useState<{ at: string; by: string } | null>(
    data.proposal.accepted_at ? { at: data.proposal.accepted_at, by: data.proposal.accepted_by ?? "" } : null,
  );
  const [acceptOpen, setAcceptOpen] = useState(false);
  const { click } = useProposalTracking(token);

  const kwp = kwpOf(i);
  const loss = soilingLoss(i);
  const plan = planOf(price, i);
  const card = maintCardInstallment(price, i);
  const items = i.clientItems ?? [];
  const keys = new Set(items.map((x) => x.key));
  const paybackMonths = loss.lostMonth > 0 ? price / loss.lostMonth : Infinity;
  const anyConditional = items.some((x) => x.conditional);

  const expired = !!data.proposal.valid_until && new Date(`${data.proposal.valid_until}T23:59:59`) < new Date() && !accepted;
  const location = [data.lead.address, [data.lead.city, data.lead.state].filter(Boolean).join(" – ")].filter(Boolean).join(" · ");
  const contactPhone = s.whatsapp || s.phone || data.seller?.phone || "";
  const waText = `Olá! Estou vendo a proposta nº ${data.proposal.number} de manutenção do sistema solar e gostaria de conversar.`;
  const conditions = (i.conditions ?? []).filter((c) => c.trim());
  const highlights = (i.highlights ?? []).filter((c) => c.trim());
  const findings = (i.findings ?? []).filter((f) => f.title.trim());
  const ageYears = i.installYear > 1990 ? new Date().getFullYear() - i.installYear : null;

  const grouped = (Object.keys(MAINT_CATEGORIES) as MaintCategory[])
    .map((cat) => ({ cat, list: items.filter((x) => (catalogOf(x.key)?.category ?? "entrega") === cat) }))
    .filter((g) => g.list.length);

  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  useEffect(() => {
    if (!token) return;
    const key = `viewed-${token}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    fetch(`/api/public/proposal/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "view" }) }).catch(() => {});
  }, [token]);

  const openAccept = () => {
    click("aceitar");
    setAcceptOpen(true);
  };
  const printPdf = () => {
    click("pdf");
    window.print();
  };

  return (
    <div className="min-h-dvh bg-[#F6F5FA] text-ink-900 print:bg-white">
      <div className="no-print fixed top-4 right-4 z-40 hidden gap-2 sm:flex">
        <Button variant="secondary" size="sm" onClick={printPdf}>
          <Download className="h-4 w-4" /> Baixar PDF
        </Button>
        {!accepted && !expired && token && (
          <Button size="sm" onClick={openAccept} style={CTA_STYLE}>
            <Check className="h-4 w-4" /> Aceitar proposta
          </Button>
        )}
      </div>

      <div className="mx-auto max-w-[1040px] sm:px-6 sm:py-10 print:max-w-none print:p-0">
        <article className="overflow-hidden bg-white shadow-[0_30px_80px_-30px_rgba(14,42,71,0.35)] sm:rounded-2xl print:rounded-none print:shadow-none">
          {/* ============================================================ CAPA */}
          <header data-track="capa" className="relative flex min-h-[640px] flex-col overflow-hidden text-white print:min-h-[297mm]">
            <Photo src={i.coverImage || DEFAULT_MAINT_COVER} className="absolute inset-0 h-full w-full" fallback={<CoverFallback />} />
            <div className="absolute inset-0 bg-gradient-to-r from-[#120B24]/95 via-[#120B24]/75 to-[#120B24]/25" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#120B24] via-transparent to-transparent" />
            <LeafMark className="right-[-6%] bottom-[18%] w-[46%] max-w-[420px] opacity-[0.12]" />

            <div className="relative flex items-start justify-between gap-6 px-6 pt-8 sm:px-14 sm:pt-12">
              <Brand settings={s} />
              <div className="text-right text-xs leading-relaxed text-white/70">
                <p className="font-semibold tracking-[0.18em] text-white uppercase">Proposta nº {data.proposal.number}</p>
                <p>{formatDate(data.proposal.created_at, { day: "2-digit", month: "long", year: "numeric" })}</p>
                {data.proposal.valid_until && <p>Válida até {formatDate(data.proposal.valid_until)}</p>}
              </div>
            </div>

            <div className="relative mt-auto px-6 pb-10 sm:px-14 sm:pb-14">
              <p className="text-xs font-semibold tracking-[0.3em] text-[#F3EA3B] uppercase">Manutenção solar · Limpeza e revisão elétrica</p>
              <h1 className="mt-4 max-w-2xl font-display text-[34px] leading-[1.08] font-semibold tracking-tight sm:text-[50px]">
                Seu sistema gerando no máximo, com segurança, para <span className="text-[#F3EA3B]">{data.lead.name}</span>
              </h1>
              {location && (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-white/70">
                  <MapPin className="h-4 w-4" /> {location}
                </p>
              )}
              <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/15 ring-1 ring-white/15 backdrop-blur-sm sm:grid-cols-4">
                <CoverKpi label="Sistema" value={`${fmtNum(kwp, 2)} kWp`} />
                <CoverKpi label="Módulos" value={`${fmtNum(i.moduleQty)} placas`} />
                <CoverKpi label="Serviços" value={`${items.length} itens`} />
                <CoverKpi label="Investimento" value={brl(price, 0)} />
              </dl>
            </div>
          </header>
          <BrandRule />

          {accepted && (
            <div className="flex items-center gap-3 bg-emerald-700 px-6 py-4 text-sm text-white sm:px-14">
              <Check className="h-4 w-4 shrink-0" />
              <p>
                Proposta aceita por <b>{accepted.by}</b> em {formatDate(accepted.at, { day: "2-digit", month: "long", year: "numeric" })}. Vamos entrar em contato para agendar a visita.
              </p>
            </div>
          )}
          {expired && (
            <div className="flex items-center gap-3 bg-amber-50 px-6 py-4 text-sm text-amber-900 sm:px-14">
              <Clock className="h-4 w-4 shrink-0" />
              <p>Esta proposta passou da validade. Fale com a nossa equipe para atualizar os valores.</p>
            </div>
          )}

          {/* ======================================================= PERDA */}
          {loss.lostMonth > 0 && (
            <div data-track="perda">
              <Section num={num()} kicker="Por que fazer agora" title="Quanto a sujeira está custando">
                <div className="grid gap-8 md:grid-cols-[1fr_1.15fr] md:items-center">
                  <div>
                    <p className="leading-relaxed text-ink-600">
                      Poeira, fuligem, fezes de pássaros e limo formam uma película sobre o vidro que bloqueia parte da luz. A geração cai aos poucos, sem nenhum aviso.
                      {i.lastCleaning ? ` Última limpeza: ${i.lastCleaning.toLowerCase()}.` : ""}
                    </p>
                    <div className="mt-6 rounded-2xl p-6 ring-1 ring-rose-200" style={{ background: "#FFF5F4" }}>
                      <p className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-rose-700 uppercase">
                        <TrendingDown className="h-4 w-4" /> Perda estimada
                      </p>
                      <p className="tnum mt-2 font-display text-5xl font-semibold tracking-tight text-rose-700">
                        {brl(loss.lostMonth, 0)}
                        <span className="ml-1 text-lg font-medium text-rose-700/70">/mês</span>
                      </p>
                      <p className="mt-1 text-sm text-rose-900/70">
                        cerca de {fmtNum(loss.lostKwh)} kWh por mês · <b>{brl(loss.lostYear, 0)} por ano</b>
                      </p>
                    </div>
                    {Number.isFinite(paybackMonths) && paybackMonths <= 18 && (
                      <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-ink-700">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" style={{ color: GREEN }} />
                        <span>
                          Só a energia recuperada paga esta manutenção em cerca de <b style={{ color: GREEN }}>{paybackMonths < 1 ? "1 mês" : `${Math.ceil(paybackMonths)} meses`}</b>.
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-ink-200 p-6">
                    <p className="text-xs font-bold tracking-[0.16em] text-ink-500 uppercase">Geração mensal estimada</p>
                    <div className="mt-5 grid gap-5">
                      <GenBar label="Com o sistema limpo e revisado" kwh={loss.monthlyKwh} max={loss.monthlyKwh} color={GREEN} />
                      <GenBar label={`Com sujeira (−${fmtNum(i.soilingPct)}%)`} kwh={loss.monthlyKwh - loss.lostKwh} max={loss.monthlyKwh} color="#C2410C" />
                    </div>
                    <p className="mt-5 text-xs leading-relaxed text-ink-500">
                      Estimativa para {fmtNum(kwp, 2)} kWp com {fmtNum(i.sunHours, 1)} h de sol pleno por dia e tarifa de {brl(i.tariff)}/kWh. A perda real varia com o local, a inclinação e o
                      tempo desde a última limpeza.
                    </p>
                  </div>
                </div>
              </Section>
            </div>
          )}

          {/* ================================================== DIAGNÓSTICO */}
          {findings.length > 0 && (
            <div data-track="diagnostico">
              <Section num={num()} kicker="O que encontramos" title="Diagnóstico da vistoria" tone="paper">
                <div className="mb-6 flex flex-wrap gap-2">
                  {(["critico", "atencao", "ok"] as const).map((sev) => {
                    const c = findings.filter((f) => f.severity === sev).length;
                    if (!c) return null;
                    return (
                      <span key={sev} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: SEVERITY[sev].bg, color: SEVERITY[sev].color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEVERITY[sev].color }} />
                        {c} {SEVERITY[sev].label.toLowerCase()}
                      </span>
                    );
                  })}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {findings.map((f) => (
                    <figure key={f.id} className="avoid-break overflow-hidden rounded-xl border border-ink-200 bg-white">
                      {f.photo && (
                        <div className="relative aspect-[4/3] bg-ink-100">
                          <Photo src={f.photo} className="absolute inset-0 h-full w-full" />
                        </div>
                      )}
                      <figcaption className="p-5">
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase" style={{ background: SEVERITY[f.severity].bg, color: SEVERITY[f.severity].color }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEVERITY[f.severity].color }} />
                          {SEVERITY[f.severity].label}
                        </span>
                        <p className="mt-2 font-semibold text-ink-900">{f.title}</p>
                        {f.text && <p className="mt-1 text-sm leading-relaxed text-ink-600">{f.text}</p>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* ========================================================= MAPA */}
          <div data-track="mapa">
            <Section num={num()} kicker="Do telhado até a rede" title="Onde vamos atuar no seu sistema" tone={findings.length ? undefined : "paper"}>
              <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white p-4 sm:p-6">
                <SystemMap keys={keys} inverterBrand={i.inverterBrand} moduleQty={i.moduleQty} />
              </div>
              <p className="no-print mt-2 text-center text-xs text-ink-400 sm:hidden">Arraste o mapa para o lado →</p>
              <div className="mt-6 grid gap-3 text-sm sm:grid-cols-4">
                {[
                  ["Sistema", `${fmtNum(kwp, 2)} kWp · ${fmtNum(i.moduleQty)} módulos`],
                  ["Inversor", `${fmtNum(i.inverterQty)}× ${i.inverterBrand || "inversor"}`],
                  ["Estrutura", i.structure],
                  ["Idade", ageYears !== null ? (ageYears <= 0 ? "Menos de 1 ano" : `${ageYears} ${ageYears === 1 ? "ano" : "anos"}`) : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-[#F6F5FA] px-4 py-3">
                    <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase">{k}</p>
                    <p className="mt-0.5 font-medium text-ink-900">{v}</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* ===================================================== SERVIÇOS */}
          <div data-track="servicos">
            <Section num={num()} kicker="Tudo o que está incluso" title="Serviços da manutenção">
              <p className="max-w-2xl leading-relaxed text-ink-600">Cada item tem um motivo. Veja o que fazemos e por que isso protege o seu investimento.</p>
              <div className="mt-8 grid gap-10">
                {grouped.map((g) => (
                  <div key={g.cat}>
                    <div className="mb-3 flex items-center gap-3">
                      <p className="text-xs font-bold tracking-[0.18em] uppercase" style={{ color: GREEN }}>
                        {MAINT_CATEGORIES[g.cat].label}
                      </p>
                      <span className="h-px flex-1 bg-ink-200" />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {g.list.map((it, idx) => (
                        <ServiceCard key={it.key + it.label} it={it} wide={g.list.length % 2 === 1 && idx === g.list.length - 1} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* ======================================================= VISITA */}
          <div data-track="visita">
            <Section num={num()} kicker="Passo a passo" title="Como é a visita técnica" tone="paper">
              <ol className="relative grid gap-4 md:grid-cols-3">
                {[
                  { icon: CalendarCheck, t: "Agendamento", d: `Marcamos a data em até ${fmtNum(i.scheduleDays)} dias, no melhor horário para você.` },
                  { icon: Power, t: "Desligamento seguro", d: "Desligamos o sistema e isolamos os circuitos antes de qualquer intervenção." },
                  ...(keys.has("limpeza") ? [{ icon: Droplets, t: "Limpeza dos módulos", d: "Água desmineralizada e escovas macias, de preferência com as placas frias." }] : []),
                  { icon: Gauge, t: "Inspeções e medições", d: "Conectores, quadro, aterramento e strings medidos com instrumentos calibrados." },
                  { icon: ListChecks, t: "Reapertos e trocas", d: "Reaperto de conexões e troca das peças aprovadas por você na hora." },
                  { icon: Smartphone, t: "Religamento e testes", d: "Ligamos o sistema, conferimos a geração e deixamos o app funcionando." },
                ].map((st, idx) => (
                  <li key={st.t} className="relative rounded-xl border border-ink-200 bg-white p-5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: NAVY }}>
                        <st.icon className="h-5 w-5" />
                      </span>
                      <span className="tnum font-display text-sm font-bold text-ink-300">{String(idx + 1).padStart(2, "0")}</span>
                    </div>
                    <p className="mt-3 font-semibold text-ink-900">{st.t}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">{st.d}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-5 flex items-center gap-2 text-sm text-ink-600">
                <Clock className="h-4 w-4" style={{ color: GREEN }} /> Duração estimada: <b>cerca de {fmtNum(i.serviceHours)} horas</b> no local.
              </p>
            </Section>
          </div>

          {/* ===================================================== ENTREGAS */}
          <div data-track="entregas">
            <Section num={num()} kicker="Depois da visita" title="O que você recebe">
              <div className="grid gap-8 md:grid-cols-[1.2fr_1fr]">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { icon: FileText, t: "Relatório técnico", d: "Fotos de antes e depois e tudo o que foi feito." },
                    { icon: Gauge, t: "Medições registradas", d: "Aterramento (Ω), isolamento (MΩ) e tensões das strings." },
                    { icon: ListChecks, t: "Itens corrigidos", d: "O que foi reapertado, trocado e o que acompanhar." },
                    { icon: Smartphone, t: "App funcionando", d: i.hasMonitoring ? "Monitoramento conferido e acessível no seu celular." : "Monitoramento configurado no seu celular." },
                  ].map((x) => (
                    <div key={x.t} className="rounded-xl border border-ink-200 p-5">
                      <x.icon className="h-5 w-5" style={{ color: GREEN }} />
                      <p className="mt-3 font-semibold text-ink-900">{x.t}</p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-600">{x.d}</p>
                    </div>
                  ))}
                </div>
                {highlights.length > 0 && (
                  <div className="rounded-2xl p-6 text-white" style={{ background: NAVY }}>
                    <p className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-[#F3EA3B] uppercase">
                      <HardHat className="h-4 w-4" /> Segurança e qualidade
                    </p>
                    <ul className="mt-4 grid gap-3">
                      {highlights.map((h) => (
                        <li key={h} className="flex gap-2.5 text-sm leading-relaxed text-white/85">
                          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#9BD373]" /> {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          </div>

          {/* ================================================= INVESTIMENTO */}
          <section data-track="investimento" className="print-break relative overflow-hidden px-6 py-14 text-white sm:px-14 sm:py-16" style={{ background: NAVY }}>
            <LeafMark className="right-[-8%] bottom-[-12%] w-[420px] opacity-[0.07]" />
            <BrandRule className="absolute inset-x-0 top-0" />
            <SectionTitle num={num()} kicker="Investimento" title="Condições comerciais" dark />
            <div className="relative mt-8 grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-start">
              <div>
                <p className="text-sm text-white/60">Valor da visita completa, com materiais e mão de obra</p>
                <p className="tnum mt-1 bg-gradient-to-r from-[#F3EA3B] via-[#C9E97A] to-[#9BD373] bg-clip-text font-display text-5xl font-semibold tracking-tight text-transparent sm:text-6xl">
                  {brl(price)}
                </p>
                {items.some((x) => x.price !== null) ? (
                  <ul className="mt-6 divide-y divide-white/10 rounded-xl bg-white/[0.04] px-4 ring-1 ring-white/10">
                    {items.map((x) => (
                      <li key={x.key + x.label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                        <span className="min-w-0 text-white/80">
                          {x.label}
                          {x.conditional && <span className="ml-1.5 text-[11px] text-[#F3EA3B]">se necessário</span>}
                        </span>
                        <span className="tnum shrink-0 font-medium">{x.price === null ? "" : x.price > 0 ? brl(x.price) : "Incluso"}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="mt-6 grid gap-2 text-sm text-white/80">
                    {["Todos os serviços listados nesta proposta", "Materiais de limpeza e consumíveis", "Relatório técnico com fotos", "Deslocamento da equipe"].map((t) => (
                      <li key={t} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-[#F3EA3B]" /> {t}
                      </li>
                    ))}
                  </ul>
                )}
                {anyConditional && (
                  <p className="mt-4 text-xs leading-relaxed text-white/60">
                    Peças marcadas como “se necessário” estão no valor com uma quantidade estimada. Se a vistoria mostrar que não precisam de troca, elas saem do valor final.
                  </p>
                )}
              </div>
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <PayOption title="À vista" main={brl(price)} sub="Pix ou espécie" />
                  {card > 0 && <PayOption title="Cartão de crédito" main={`${i.cardInstallments}× de ${brl(card)}`} sub={`Total ${brl(card * i.cardInstallments, 0)}`} />}
                  <PayOption title="Agendamento" main={`até ${fmtNum(i.scheduleDays)} dias`} sub="após o aceite" />
                  <PayOption title="Validade" main={`${fmtNum(i.validityDays)} dias`} sub={data.proposal.valid_until ? `até ${formatDate(data.proposal.valid_until)}` : "a partir da emissão"} />
                </div>
                {i.paymentNotes && <p className="rounded-xl bg-white/[0.06] px-4 py-3 text-sm whitespace-pre-line text-white/80 ring-1 ring-white/10">{i.paymentNotes}</p>}
              </div>
            </div>
          </section>

          {/* ======================================================== PLANO */}
          {plan && (
            <div data-track="plano">
              <Section num={num()} kicker="Recomendado" title="Plano de manutenção preventiva">
                <p className="max-w-2xl leading-relaxed text-ink-600">
                  Sistemas limpos e revisados com frequência geram mais, têm menos falhas e preservam a garantia dos equipamentos. Com o plano, você garante {plan.visits} visitas por ano com
                  desconto.
                </p>
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-ink-200 p-6">
                    <p className="text-xs font-bold tracking-[0.16em] text-ink-500 uppercase">Visita avulsa</p>
                    <p className="tnum mt-2 font-display text-3xl font-semibold text-ink-900">{brl(price)}</p>
                    <p className="mt-1 text-sm text-ink-500">por visita, quando você solicitar</p>
                    <ul className="mt-5 grid gap-2 text-sm text-ink-600">
                      <li className="flex gap-2">
                        <Check className="h-4 w-4 shrink-0 text-ink-400" /> Todos os serviços desta proposta
                      </li>
                      <li className="flex gap-2">
                        <Check className="h-4 w-4 shrink-0 text-ink-400" /> Agendamento conforme disponibilidade
                      </li>
                    </ul>
                  </div>
                  <div className="relative overflow-hidden rounded-2xl bg-[#F2F8EC] p-6 ring-2 ring-[#9BD373]">
                    <span className="absolute top-4 right-4 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase" style={CTA_STYLE}>
                      Economize {brl(plan.saving, 0)}/ano
                    </span>
                    <p className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] uppercase" style={{ color: GREEN }}>
                      <Repeat className="h-4 w-4" /> Plano {plan.visits === 2 ? "semestral" : plan.visits === 4 ? "trimestral" : `${plan.visits} visitas`}
                    </p>
                    <p className="tnum mt-2 font-display text-3xl font-semibold text-ink-900">
                      {brl(plan.perVisit)} <span className="text-base font-medium text-ink-500">por visita</span>
                    </p>
                    <p className="mt-1 text-sm text-ink-600">
                      {plan.visits} visitas por ano · {brl(plan.year, 0)} no total (equivale a {brl(plan.monthly, 0)}/mês)
                    </p>
                    <ul className="mt-5 grid gap-2 text-sm text-ink-700">
                      {[`${fmtNum(i.planDiscountPct)}% de desconto em cada visita`, "Datas já reservadas na agenda", "Histórico do sistema de visita em visita", "Prioridade no atendimento de chamados"].map((t) => (
                        <li key={t} className="flex gap-2">
                          <Check className="h-4 w-4 shrink-0" style={{ color: GREEN }} /> {t}
                        </li>
                      ))}
                    </ul>
                    {contactPhone && (
                      <a
                        href={whatsappUrl(contactPhone, `Olá! Na proposta nº ${data.proposal.number} tenho interesse no plano de manutenção com ${plan.visits} visitas por ano.`)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => click("plano")}
                        className="no-print mt-6 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold"
                        style={CTA_STYLE}
                      >
                        <MessageCircle className="h-4 w-4" /> Quero o plano
                      </a>
                    )}
                  </div>
                </div>
              </Section>
            </div>
          )}

          {/* ===================================================== CONDIÇÕES */}
          <div data-track="condicoes">
            <Section num={num()} kicker="Transparência" title="Garantia e condições" tone="paper">
              <div className="grid gap-8 md:grid-cols-[260px_1fr] md:items-start">
                <div className="rounded-2xl border border-ink-200 bg-white p-6">
                  <ShieldCheck className="h-6 w-6" style={{ color: GREEN }} />
                  <p className="tnum mt-3 font-display text-4xl font-semibold tracking-tight" style={{ color: NAVY }}>
                    {fmtNum(i.serviceWarrantyDays)}
                    <span className="ml-1.5 text-sm font-medium text-ink-400">dias</span>
                  </p>
                  <p className="mt-1 font-semibold text-ink-900">Garantia do serviço</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-500">Reapertos, conexões e peças trocadas pela nossa equipe.</p>
                </div>
                {conditions.length > 0 && (
                  <ul className="grid gap-3">
                    {conditions.map((c) => (
                      <li key={c} className="flex gap-3 text-sm leading-relaxed text-ink-700">
                        <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: GREEN }} />
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Section>
          </div>

          {/* ===================================================== ASSINATURA */}
          <section className="avoid-break px-6 py-14 sm:px-14">
            <p className="text-xs font-semibold tracking-[0.22em] uppercase" style={{ color: GREEN }}>
              De acordo
            </p>
            <div className="mt-12 grid gap-12 sm:grid-cols-2">
              <Signature name={s.company_name} role={s.cnpj ? `Contratada · CNPJ ${s.cnpj}` : "Contratada"} image={s.signature_url || DEFAULT_SIGNATURE} />
              <Signature name={accepted?.by || data.lead.name} role="Contratante" />
            </div>
          </section>

          {/* ======================================================= SOBRE */}
          <section className="border-t border-ink-100 bg-[#F6F5FA]/70 px-6 py-10 sm:px-14">
            <div className="grid gap-6 sm:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="font-display text-xl font-semibold" style={{ color: NAVY }}>
                  {s.company_name}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{s.about}</p>
              </div>
              <div className="grid content-start gap-2.5 text-sm">
                {data.seller?.name && (
                  <p className="flex items-center gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-ink-400" /> Consultor: <b>{data.seller.name}</b>
                  </p>
                )}
                {contactPhone && (
                  <p className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 text-ink-400" /> {formatPhone(contactPhone)}
                  </p>
                )}
                {(s.email || data.seller?.email) && (
                  <p className="flex items-center gap-2.5">
                    <Mail className="h-4 w-4 text-ink-400" /> {s.email || data.seller?.email}
                  </p>
                )}
                {s.instagram && (
                  <p className="flex items-center gap-2.5">
                    <AtSign className="h-4 w-4 text-ink-400" /> {s.instagram.replace(/^@/, "")}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ========================================================= CTA */}
          <section className="no-print border-t border-ink-100 px-6 py-12 sm:px-14">
            <div className="flex flex-col gap-6 rounded-2xl border border-ink-200 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <p className="font-display text-2xl font-semibold tracking-tight" style={{ color: NAVY }}>
                  {accepted ? "Proposta aceita. Obrigado pela confiança." : "Vamos agendar a sua manutenção?"}
                </p>
                <p className="mt-1 max-w-md text-sm text-ink-500">{accepted ? "Entraremos em contato para combinar a data da visita." : "Aceite online em um clique ou fale com a nossa equipe."}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {!accepted && !expired && token && (
                  <Button size="lg" onClick={openAccept} style={CTA_STYLE}>
                    <Check className="h-5 w-5" /> Aceitar proposta
                  </Button>
                )}
                {contactPhone && (
                  <a href={whatsappUrl(contactPhone, waText)} target="_blank" rel="noreferrer" onClick={() => click("whatsapp")}>
                    <Button size="lg" variant="secondary" className="w-full">
                      <MessageCircle className="h-5 w-5 text-emerald-600" /> WhatsApp
                    </Button>
                  </a>
                )}
                <Button size="lg" variant="secondary" onClick={printPdf} className="sm:hidden">
                  <Download className="h-5 w-5" /> PDF
                </Button>
              </div>
            </div>
          </section>

          <footer className="border-t border-ink-100 px-6 py-6 text-[11px] leading-relaxed text-ink-400 sm:px-14">
            Perda por sujeira estimada em {fmtNum(i.soilingPct)}% da geração; o valor real depende do local e do tempo desde a última limpeza. Proposta nº {data.proposal.number}.
          </footer>
          <BrandFooter settings={s} number={data.proposal.number} phone={contactPhone} />
        </article>
      </div>

      {!accepted && !expired && token && (
        <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
          <div className="flex gap-2">
            {contactPhone && (
              <a href={whatsappUrl(contactPhone, waText)} target="_blank" rel="noreferrer" className="flex-1" onClick={() => click("whatsapp")}>
                <Button variant="secondary" className="w-full">
                  <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
                </Button>
              </a>
            )}
            <Button className="flex-1" style={CTA_STYLE} onClick={openAccept}>
              <Check className="h-4 w-4" /> Aceitar
            </Button>
          </div>
        </div>
      )}

      {token && (
        <AcceptModal
          open={acceptOpen}
          onClose={() => setAcceptOpen(false)}
          token={token}
          defaultName={data.lead.name}
          days={i.scheduleDays}
          note={`O aceite online não gera cobrança: ele reserva as condições desta proposta. Vamos agendar a visita em até ${fmtNum(i.scheduleDays)} dias.`}
          onAccepted={(by) => {
            click("aceite");
            setAccepted({ at: new Date().toISOString(), by });
            setAcceptOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ subcomponentes */

function CoverFallback() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-[#120B24] via-[#2A2046] to-[#120B24]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(155,211,115,0.25),transparent_45%)]" />
    </div>
  );
}

function GenBar({ label, kwh, max, color }: { label: string; kwh: number; max: number; color: string }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink-600">{label}</span>
        <span className="tnum font-display text-lg font-semibold" style={{ color }}>
          {fmtNum(kwh)} kWh
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full" style={{ width: `${Math.max(3, (kwh / Math.max(1, max)) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function ServiceCard({ it, wide }: { it: MaintClientItem; wide?: boolean }) {
  const meta = catalogOf(it.key);
  const Icon = meta ? ICONS[meta.icon] : Sparkles;
  return (
    <div className={`avoid-break flex gap-4 rounded-xl border border-ink-200 p-5 ${wide ? "md:col-span-2" : ""}`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: "#F2F8EC", color: GREEN }}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className="font-semibold text-ink-900">{it.label}</p>
          {it.price !== null && <p className="tnum text-sm font-semibold text-ink-900">{it.price > 0 ? brl(it.price) : "Incluso"}</p>}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
          {it.qtyLabel}
          {it.conditional && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 ring-1 ring-amber-600/20">Se necessário</span>}
        </p>
        {meta?.what && <p className="mt-2 text-sm leading-relaxed text-ink-600">{meta.what}</p>}
        {meta?.why && (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
            <b style={{ color: GREEN }}>Por que importa:</b> {meta.why}
          </p>
        )}
      </div>
    </div>
  );
}

/** Mapa do sistema: cada bloco acende quando há serviço nele. */
function SystemMap({ keys, inverterBrand, moduleQty }: { keys: Set<string>; inverterBrand: string; moduleQty: number }) {
  const has = (...k: string[]) => k.some((x) => keys.has(x));
  const nodes = [
    { x: 20, t: "Módulos", sub: `${moduleQty} placas`, on: has("limpeza", "inspecao", "termografia", "estrutura"), lines: [has("limpeza") && "Limpeza", has("inspecao") && "Inspeção", has("termografia") && "Termografia", has("estrutura") && "Estrutura"] },
    { x: 215, t: "Cabos CC", sub: "conectores MC4", on: has("conectores", "troca_mc4", "medicoes"), lines: [has("conectores") && "Reaperto", has("troca_mc4") && "Troca MC4", has("medicoes") && "Medições"] },
    { x: 410, t: "String box", sub: "proteções CC", on: has("quadro", "dps"), lines: [has("quadro") && "Reaperto", has("dps") && "DPS CC"] },
    { x: 605, t: "Inversor", sub: inverterBrand || "conversão CC/CA", on: has("inversor", "app"), lines: [has("inversor") && "Revisão", has("app") && "App"] },
    { x: 800, t: "Quadro CA", sub: "para a rede", on: has("quadro", "disjuntores", "terminais", "dps"), lines: [has("disjuntores") && "Disjuntores", has("terminais") && "Terminais", has("dps") && "DPS CA"] },
  ];
  const ground = has("aterramento");
  const W = 175;
  return (
    <svg viewBox="0 0 1000 330" className="h-auto w-full min-w-[680px]" role="img" aria-label="Mapa do sistema solar com os pontos de manutenção">
      <defs>
        <marker id="m-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="#9C97B0" />
        </marker>
        <linearGradient id="m-on" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F2F8EC" />
          <stop offset="1" stopColor="#E3F2D6" />
        </linearGradient>
      </defs>
      {/* app no celular */}
      {has("app") && (
        <g>
          <rect x={605 + W / 2 - 22} y={4} width={44} height={62} rx={9} fill={NAVY} />
          <rect x={605 + W / 2 - 17} y={12} width={34} height={42} rx={4} fill="#9BD373" />
          <path d={`M${605 + W / 2 - 9} 40 l6 -8 l5 5 l7 -11`} stroke={NAVY} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M${605 + W / 2} 72 v14`} stroke="#9BD373" strokeWidth={2} strokeDasharray="3 4" />
          <text x={605 + W / 2 + 32} y={38} fontSize={13} fill={GREEN} fontWeight={700}>
            App
          </text>
        </g>
      )}
      {nodes.map((nd, idx) => (
        <g key={nd.t}>
          {idx < nodes.length - 1 && <line x1={nd.x + W} y1={150} x2={nodes[idx + 1].x - 4} y2={150} stroke="#9C97B0" strokeWidth={2} markerEnd="url(#m-arrow)" />}
          <rect x={nd.x} y={92} width={W} height={116} rx={14} fill={nd.on ? "url(#m-on)" : "#FFFFFF"} stroke={nd.on ? "#6CC690" : "#DAD7E4"} strokeWidth={nd.on ? 2 : 1.5} />
          <text x={nd.x + 16} y={122} fontSize={17} fontWeight={700} fill={NAVY}>
            {nd.t}
          </text>
          <text x={nd.x + 16} y={142} fontSize={13} fill="#6E6987">
            {nd.sub.length > 20 ? `${nd.sub.slice(0, 19)}…` : nd.sub}
          </text>
          {nd.lines
            .filter(Boolean)
            .slice(0, 3)
            .map((l, j) => (
              <g key={String(l)}>
                <circle cx={nd.x + 21} cy={162 + j * 17} r={3} fill={GREEN} />
                <text x={nd.x + 31} y={167 + j * 17} fontSize={13.5} fill="#2F2A44">
                  {l}
                </text>
              </g>
            ))}
          {nd.on && (
            <g>
              <circle cx={nd.x + W - 16} cy={108} r={10} fill={GREEN} />
              <path d={`M${nd.x + W - 21} 108 l3.5 3.5 l6.5 -7`} stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}
          {/* descida para o aterramento */}
          <line x1={nd.x + W / 2} y1={208} x2={nd.x + W / 2} y2={268} stroke={ground ? "#6CC690" : "#DAD7E4"} strokeWidth={1.5} strokeDasharray="4 4" />
        </g>
      ))}
      <line x1={20 + W / 2} y1={268} x2={800 + W / 2} y2={268} stroke={ground ? GREEN : "#C9C5D6"} strokeWidth={3} />
      <g transform={`translate(${20 + W / 2 - 60} 268)`}>
        <line x1={60} y1={0} x2={60} y2={16} stroke={ground ? GREEN : "#C9C5D6"} strokeWidth={3} />
        <line x1={44} y1={16} x2={76} y2={16} stroke={ground ? GREEN : "#C9C5D6"} strokeWidth={3} />
        <line x1={50} y1={23} x2={70} y2={23} stroke={ground ? GREEN : "#C9C5D6"} strokeWidth={3} />
        <line x1={56} y1={30} x2={64} y2={30} stroke={ground ? GREEN : "#C9C5D6"} strokeWidth={3} />
      </g>
      <text x={20 + W / 2 + 26} y={297} fontSize={14} fontWeight={700} fill={ground ? GREEN : "#8E89A3"}>
        Aterramento {ground ? "· aferição com terrômetro" : ""}
      </text>
    </svg>
  );
}

function Signature({ name, role, image }: { name: string; role: string; image?: string | null }) {
  return (
    <div className="pt-3">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={`Assinatura de ${name}`} className="mb-2 h-24 w-auto max-w-full object-contain object-left" />
      ) : (
        <div className="mb-2 h-24" />
      )}
      <BrandRule className="mb-3 h-0.5" />
      <p className="font-semibold text-ink-900">{name}</p>
      <p className="text-sm text-ink-500">{role}</p>
    </div>
  );
}

