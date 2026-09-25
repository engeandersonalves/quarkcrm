"use client";

import { Check, CheckCircle2, Clock, Download, Info, Mail, MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { mergeInputs, mergeSettings, type CompanySettings } from "@/lib/defaults";
import { formatDate, formatPhone, whatsappUrl } from "@/lib/format";
import { brl, calcEnergy, calcFinancing, fmtNum, irr, pct, pmt, type ProposalInputs } from "@/lib/pricing";
import { DEFAULT_FAQ, DEFAULT_TIMELINE } from "@/lib/proposal-content";
import { Button, Field, Input, Modal, cx } from "../ui";
import { CashflowChart, GenerationChart } from "./charts";
import { InverterRender, ModuleRender, SystemDiagram } from "./renders";

export interface PublicProposal {
  proposal: {
    id?: string;
    number: number;
    title: string | null;
    status: string;
    inputs: Partial<ProposalInputs> & { product?: "solar" | "save"; [key: string]: unknown };
    final_price: number;
    power_kwp: number;
    valid_until: string | null;
    created_at: string;
    accepted_at: string | null;
    accepted_by: string | null;
  };
  lead: { name: string; city: string | null; state: string | null; address: string | null };
  seller: { name: string | null; email: string | null; phone: string | null } | null;
  settings: Partial<CompanySettings>;
}

/** Foto padrão da capa (usina solar). Troque em Configurações → Proposta. */
const DEFAULT_COVER = "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=2000&q=75";
const MODULE_AREA_M2 = 2.6;
const CAR_KG_CO2_PER_KM = 0.12;
const NAVY = "#1C1234"; // roxo da marca Quark
/** Botão principal no degradê da marca (amarelo → verde) com texto roxo. */
export const CTA_STYLE = { backgroundImage: "linear-gradient(135deg, #F3EA3B 0%, #9BD373 55%, #6CC690 100%)", color: "#1C1234" } as const;

export function ProposalDocument({ data, token }: { data: PublicProposal; token: string | null }) {
  const s = mergeSettings(data.settings);
  const inputs = mergeInputs(data.proposal.inputs);
  const price = Number(data.proposal.final_price);
  const startYear = new Date(data.proposal.created_at).getFullYear();
  const [accepted, setAccepted] = useState<{ at: string; by: string } | null>(
    data.proposal.accepted_at ? { at: data.proposal.accepted_at, by: data.proposal.accepted_by ?? "" } : null,
  );
  const [acceptOpen, setAcceptOpen] = useState(false);

  const kwp = (inputs.modulePowerW * inputs.moduleQty) / 1000;
  const energy = useMemo(() => calcEnergy(inputs, price, startYear), [inputs, price, startYear]);
  const financing = useMemo(() => calcFinancing(price, inputs.financingRate, inputs.financingTerms), [price, inputs.financingRate, inputs.financingTerms]);
  const tir = useMemo(() => irr(price, energy.cashflow.map((c) => c.savings)), [price, energy]);
  const cardInstallment = inputs.cardInstallments > 0 ? pmt(price, inputs.cardRate, inputs.cardInstallments) : 0;

  const show = s.proposal.sections;
  const firstName = data.lead.name.split(" ")[0];
  const hasBill = energy.monthlyBillBefore > 0;
  const expired = !!data.proposal.valid_until && new Date(`${data.proposal.valid_until}T23:59:59`) < new Date() && !accepted;
  const location = [data.lead.address, [data.lead.city, data.lead.state].filter(Boolean).join(" – ")].filter(Boolean).join(" · ");
  const contactPhone = s.whatsapp || s.phone || data.seller?.phone || "";
  const waText = `Olá! Estou analisando a proposta nº ${data.proposal.number} de energia solar e gostaria de conversar.`;
  const cheapest = financing.length ? financing[financing.length - 1] : null;
  const cheaperThanBill = !!cheapest && hasBill && cheapest.installment < energy.monthlyBillBefore;
  const totalDays = Math.max(10, Math.round(inputs.installationDays || 40));
  const steps = s.proposal.timeline.length
    ? [...s.proposal.timeline].sort((a, b) => a.day - b.day)
    : DEFAULT_TIMELINE.map((st) => ({ ...st, day: Math.round((st.day / 40) * totalDays) }));
  const lastDay = steps.length ? steps[steps.length - 1].day : totalDays;
  const faq = s.proposal.faq.length ? s.proposal.faq : DEFAULT_FAQ;
  const headline = s.proposal.headline.trim().replaceAll("{nome}", firstName);
  const moduleImg = inputs.moduleImage || s.proposal.moduleImage;
  const inverterImg = inputs.inverterImage || s.proposal.inverterImage;
  const carKm = Math.round((energy.co2TonsPerYear * 1000) / CAR_KG_CO2_PER_KM);
  const milestones = energy.cashflow.filter((c) => [1, 5, 10, 15, 20, 25].includes(c.year));

  // Numeração automática das seções visíveis.
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

  return (
    <div className="min-h-dvh bg-[#F6F5FA] text-ink-900 print:bg-white">
      {/* Barra de ações */}
      <div className="no-print fixed top-4 right-4 z-40 hidden gap-2 sm:flex">
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Download className="h-4 w-4" /> Baixar PDF
        </Button>
        {!accepted && !expired && token && (
          <Button size="sm" onClick={() => setAcceptOpen(true)} style={CTA_STYLE}>
            <Check className="h-4 w-4" /> Aceitar proposta
          </Button>
        )}
      </div>

      <div className="mx-auto max-w-[1040px] sm:px-6 sm:py-10 print:max-w-none print:p-0">
        <article className="overflow-hidden bg-white shadow-[0_30px_80px_-30px_rgba(14,42,71,0.35)] sm:rounded-2xl print:rounded-none print:shadow-none">
          {/* ============================================================ CAPA */}
          <header className="relative flex min-h-[640px] flex-col overflow-hidden text-white print:min-h-[297mm]">
            <Photo src={s.proposal.coverImage || DEFAULT_COVER} className="absolute inset-0 h-full w-full" fallback={<CoverFallback />} />
            <div className="absolute inset-0 bg-gradient-to-r from-[#120B24]/95 via-[#120B24]/75 to-[#120B24]/20" />
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
              <p className="text-xs font-semibold tracking-[0.3em] text-[#F3EA3B] uppercase">Proposta comercial · Sistema fotovoltaico</p>
              <h1 className="mt-4 max-w-2xl font-display text-[34px] leading-[1.08] font-semibold tracking-tight sm:text-[50px]">
                {headline || (
                  <>
                    Energia solar para <span className="text-[#F3EA3B]">{data.lead.name}</span>
                  </>
                )}
              </h1>
              {location && (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-white/70">
                  <MapPin className="h-4 w-4" /> {location}
                </p>
              )}
              <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/15 ring-1 ring-white/15 backdrop-blur-sm sm:grid-cols-4">
                <CoverKpi label="Potência instalada" value={`${fmtNum(kwp, 2)} kWp`} />
                <CoverKpi label="Geração média" value={`${fmtNum(energy.monthlyGeneration)} kWh/mês`} />
                <CoverKpi label="Economia estimada" value={hasBill ? `${brl(energy.monthlySavings, 0)}/mês` : "—"} />
                <CoverKpi label="Retorno do investimento" value={energy.paybackYears ? `${fmtNum(energy.paybackYears, 1)} anos` : "—"} />
              </dl>
            </div>
          </header>
          <BrandRule />

          {accepted && (
            <Notice tone="green" icon={<CheckCircle2 className="h-5 w-5" />}>
              Proposta aceita por <b>{accepted.by}</b> em {formatDate(accepted.at, { day: "2-digit", month: "long", year: "numeric" })}. Nossa equipe entrará em contato para formalizar o contrato.
            </Notice>
          )}
          {expired && (
            <Notice tone="amber" icon={<Clock className="h-5 w-5" />}>
              O prazo de validade desta proposta terminou. Fale conosco para atualizarmos os valores.
            </Notice>
          )}

          {/* ======================================================= RESUMO */}
          <Section num={num()} kicker="Resumo" title={`${firstName}, este é o seu projeto em números`}>
            <p className="max-w-3xl text-[15px] leading-relaxed text-ink-600">
              Dimensionamos um sistema de <b className="text-ink-900">{fmtNum(kwp, 2)} kWp</b>, com {inputs.moduleQty} módulos fotovoltaicos
              {inputs.moduleBrand && ` ${inputs.moduleBrand}`} e inversor{inputs.inverterBrand && ` ${inputs.inverterBrand}`}, capaz de gerar em média{" "}
              <b className="text-ink-900">{fmtNum(energy.monthlyGeneration)} kWh por mês</b>
              {hasBill && (
                <>
                  {" "}
                  — cerca de {pct(Math.min(1, energy.coverage), 0)} do seu consumo. Com isso, sua fatura estimada passa de{" "}
                  <b className="text-ink-900">{brl(energy.monthlyBillBefore, 0)}</b> para <b className="text-emerald-700">{brl(energy.monthlyBillAfter, 0)}</b> por mês
                </>
              )}
              .
            </p>
            {hasBill && (
              <div className="mt-8 grid gap-4 md:grid-cols-[1.4fr_1fr]">
                <div className="rounded-xl border border-ink-200 p-6">
                  <p className="text-xs font-semibold tracking-[0.14em] text-ink-500 uppercase">Fatura mensal estimada</p>
                  <div className="mt-5 grid gap-5">
                    <Bar label="Hoje, sem energia solar" value={energy.monthlyBillBefore} max={energy.monthlyBillBefore} color="#94A3B8" />
                    <Bar label="Com o sistema fotovoltaico" value={energy.monthlyBillAfter} max={energy.monthlyBillBefore} color="#3F9C6A" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Redução na fatura" value={pct(energy.savingsPct, 0)} accent />
                  <Stat label="Economia no 1º ano" value={brl(energy.annualSavings, 0)} />
                  <Stat label="Economia em 25 anos" value={brl(energy.savings25y, 0)} />
                  <Stat label="Retorno" value={energy.paybackYears ? `${fmtNum(energy.paybackYears, 1)} anos` : "—"} />
                </div>
              </div>
            )}
          </Section>

          {/* ================================================= COMO FUNCIONA */}
          {show.howItWorks && (
            <Section num={num()} kicker="Como funciona" title="Do sol à sua tomada, em quatro etapas" tone="paper">
              <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white p-4 sm:p-6">
                <SystemDiagram brand={inputs.inverterBrand} className="min-w-[760px]" />
              </div>
              <ol className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                {[
                  ["Captação", "Os módulos no telhado convertem a luz do sol em energia elétrica em corrente contínua."],
                  ["Conversão", "O inversor transforma essa energia em corrente alternada, igual à da rede, e monitora tudo em tempo real."],
                  ["Consumo", "A energia abastece a sua casa pelo quadro de distribuição. O que é usado na hora não passa pelo medidor."],
                  ["Créditos", "O excedente vai para a rede e vira créditos em kWh, usados à noite e em dias nublados por até 60 meses."],
                ].map(([t, d], i) => (
                  <li key={t} className="border-t-2 pt-4" style={{ borderColor: i === 3 ? "#3F9C6A" : NAVY }}>
                    <p className="text-xs font-semibold tracking-[0.14em] text-ink-400 uppercase">Etapa {i + 1}</p>
                    <p className="mt-1 font-display text-lg font-semibold" style={{ color: NAVY }}>
                      {t}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{d}</p>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {/* ======================================================== FATURA */}
          {hasBill && show.bill && (
            <Section num={num()} kicker="Sua conta de luz" title="Como fica a sua fatura, item por item">
              <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
                <div className="self-start overflow-x-auto rounded-xl border border-ink-200">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F6F5FA] text-left text-xs tracking-[0.1em] text-ink-500 uppercase">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Composição mensal</th>
                        <th className="px-4 py-3 text-right font-semibold">Hoje</th>
                        <th className="px-4 py-3 text-right font-semibold">Com solar</th>
                      </tr>
                    </thead>
                    <tbody className="tnum divide-y divide-ink-100">
                      <BillRow label="Energia consumida da rede" hint={`${fmtNum(inputs.consumptionKwh)} kWh × ${brl(inputs.tariff, 2)}`} before={inputs.consumptionKwh * inputs.tariff} after={energy.bill.energyCharge} />
                      <BillRow label={`Fio B (${fmtNum(energy.fioBPct * 100)}% em ${startYear})`} hint={`${fmtNum(energy.bill.compensatedKwh)} kWh compensados`} before={0} after={energy.bill.fioBCharge} />
                      <BillRow label="Complemento da taxa mínima" hint={`Mínimo de ${energy.availabilityKwh} kWh`} before={0} after={energy.bill.minimumTopUp} />
                      <BillRow label="Iluminação pública" hint="Taxa municipal" before={inputs.publicLighting} after={energy.bill.publicLighting} />
                    </tbody>
                    <tfoot className="tnum">
                      <tr className="text-white" style={{ background: NAVY }}>
                        <td className="px-4 py-4 font-semibold">Total estimado</td>
                        <td className="px-4 py-4 text-right font-semibold">{brl(energy.monthlyBillBefore)}</td>
                        <td className="px-4 py-4 text-right font-semibold text-[#9BD373]">{brl(energy.monthlyBillAfter)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="grid content-start gap-4">
                  <Explain title="Por que a conta não zera?">
                    Todo imóvel conectado à rede paga um valor mínimo (custo de disponibilidade) e a iluminação pública, que é uma taxa da prefeitura. Por isso a meta é
                    reduzir a conta ao mínimo, e não a zero.
                  </Explain>
                  <Explain title="O que é o fio B?">
                    É a parte da tarifa que remunera os fios da distribuidora. Pela Lei 14.300, quem instala energia solar a partir de 2023 paga uma fração dele sobre a
                    energia compensada pelos créditos: {fmtNum(energy.fioBPct * 100)}% em {startYear}, chegando a 100% em 2029. Esse custo já está no cálculo.
                  </Explain>
                </div>
              </div>
            </Section>
          )}

          {/* ================================================= EQUIPAMENTOS */}
          {show.equipment && (
            <Section num={num()} kicker="Equipamentos" title="O que será instalado no seu imóvel" tone="paper">
              <div className="grid gap-5 md:grid-cols-2">
                <Product
                  image={moduleImg}
                  render={<ModuleRender className="h-[88%] w-auto drop-shadow-xl" />}
                  kicker="Módulos fotovoltaicos"
                  title={[inputs.moduleBrand, inputs.moduleModel].filter(Boolean).join(" ") || "Módulo monocristalino Tier 1"}
                  specs={[
                    ["Quantidade", `${inputs.moduleQty} unidades`],
                    ["Potência unitária", `${fmtNum(inputs.modulePowerW)} W`],
                    ["Potência total", `${fmtNum(kwp, 2)} kWp`],
                    ["Área ocupada", `≈ ${fmtNum(inputs.moduleQty * MODULE_AREA_M2)} m²`],
                    ["Garantia do produto", `${s.warranty_modules_years} anos`],
                    ["Garantia de eficiência", `${s.warranty_modules_performance_years} anos (≥ 80%)`],
                  ]}
                />
                <Product
                  image={inverterImg}
                  render={<InverterRender className="h-[82%] w-auto drop-shadow-xl" brand={inputs.inverterBrand} power={`${fmtNum(inputs.inverterPowerKw, 1)} kW`} />}
                  kicker="Inversor"
                  title={[inputs.inverterBrand, inputs.inverterModel].filter(Boolean).join(" ") || "Inversor on-grid"}
                  specs={[
                    ["Quantidade", `${inputs.inverterQty} ${inputs.inverterQty > 1 ? "unidades" : "unidade"}`],
                    ["Potência nominal", `${fmtNum(inputs.inverterPowerKw, 1)} kW${inputs.inverterQty > 1 ? " cada" : ""}`],
                    ["Tipo", "String on-grid, conectado à rede"],
                    ["Monitoramento", "Wi-Fi, pelo aplicativo no celular"],
                    ["Garantia", `${s.warranty_inverter_years} anos`],
                  ]}
                />
              </div>
              <div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-ink-200 bg-ink-200 sm:grid-cols-3">
                <MiniSpec label="Estrutura de fixação" value={inputs.structureType} sub={`Alumínio e aço inox · ${s.warranty_structure_years} anos de garantia`} />
                <MiniSpec label="Proteções elétricas" value="String box CC/CA" sub="Disjuntores, DPS e aterramento conforme NBR 16690" />
                <MiniSpec label="Projeto e homologação" value="Inclusos" sub="ART do engenheiro e aprovação na distribuidora" />
              </div>
            </Section>
          )}

          {/* ======================================================= GERAÇÃO */}
          {show.generation && (
            <Section num={num()} kicker="Desempenho" title="Geração estimada ao longo do ano">
              <div className="grid gap-6 md:grid-cols-[1fr_280px]">
                <div className="self-start rounded-xl border border-ink-200 p-5 sm:p-6">
                  <GenerationChart data={energy.monthly} />
                </div>
                <div className="grid content-start gap-3">
                  <Stat label="Geração anual" value={`${fmtNum(energy.annualGeneration)} kWh`} />
                  <Stat label="Média mensal" value={`${fmtNum(energy.monthlyGeneration)} kWh`} />
                  <Explain title="Por que varia?">
                    No verão os dias são mais longos e a geração é maior. O excedente vira crédito e é usado nos meses de menor produção, equilibrando a conta ao longo do ano.
                  </Explain>
                </div>
              </div>
            </Section>
          )}

          {/* ===================================================== FINANCEIRO */}
          {energy.monthlySavings > 0 && show.payback && (
            <Section num={num()} kicker="Análise financeira" title="Um investimento que se paga e continua rendendo" tone="paper">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Retorno do investimento" value={`${fmtNum(energy.paybackYears, 1)} anos`} accent />
                <Stat label="Economia em 25 anos" value={brl(energy.savings25y, 0)} />
                <Stat label="Retorno sobre o valor" value={`${fmtNum(energy.roi25y, 1)}×`} />
                <Stat label="Rentabilidade equivalente" value={tir ? `${fmtNum((Math.pow(1 + tir, 1 / 12) - 1) * 100, 2)}% a.m.` : "—"} />
              </div>
              <div className="mt-5 grid gap-5 md:grid-cols-[1.7fr_1fr]">
                <div className="rounded-xl border border-ink-200 bg-white p-5 sm:p-6">
                  <p className="text-xs font-semibold tracking-[0.14em] text-ink-500 uppercase">Saldo acumulado (investimento × economia)</p>
                  <div className="mt-4">
                    <CashflowChart data={energy.cashflow} payback={energy.paybackYears} />
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F6F5FA] text-left text-xs tracking-[0.1em] text-ink-500 uppercase">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Ano</th>
                        <th className="px-4 py-3 text-right font-semibold">Economia no ano</th>
                        <th className="px-4 py-3 text-right font-semibold">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="tnum divide-y divide-ink-100">
                      {milestones.map((c) => (
                        <tr key={c.year}>
                          <td className="px-4 py-2.5 font-medium">{c.year}º</td>
                          <td className="px-4 py-2.5 text-right">{brl(c.savings, 0)}</td>
                          <td className={cx("px-4 py-2.5 text-right font-semibold", c.cumulative >= 0 ? "text-emerald-700" : "text-ink-500")}>{brl(c.cumulative, 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Explain title="O retorno do investimento" className="mt-5">
                A economia de cada mês “paga” o sistema. Depois de {fmtNum(energy.paybackYears, 1)} anos o valor investido está recuperado, e a economia dos anos seguintes é
                ganho líquido — sem imposto de renda. O cálculo considera reajuste da tarifa de {fmtNum(inputs.tariffIncrease, 1)}% ao ano e a regra de transição do fio B.
              </Explain>
            </Section>
          )}

          {/* ===================================================== GARANTIAS */}
          {show.warranties && (
            <Section num={num()} kicker="Garantias" title="Proteção de longo prazo, por contrato">
              <div className="grid gap-px overflow-hidden rounded-xl border border-ink-200 bg-ink-200 sm:grid-cols-5">
                <Warranty years={s.warranty_modules_performance_years} title="Eficiência dos módulos" text="Produção mínima de 80% ao fim do período" />
                <Warranty years={s.warranty_modules_years} title="Módulos" text="Contra defeitos de fabricação" />
                <Warranty years={s.warranty_inverter_years} title="Inversor" text="Reparo ou substituição pelo fabricante" />
                <Warranty years={s.warranty_structure_years} title="Estrutura" text="Contra corrosão e defeitos" />
                <Warranty years={s.warranty_installation_years} title="Instalação" text="Serviço executado pela nossa equipe" />
              </div>
            </Section>
          )}

          {/* ====================================================== OBRA */}
          {show.timeline && (
            <Section num={num()} kicker="Cronograma" title={`Da assinatura ao sistema ligado: cerca de ${lastDay} dias`} tone="paper">
              <ol className="grid gap-x-5 gap-y-8 sm:grid-cols-2 md:grid-cols-4">
                {steps.map((st, i) => {
                  const last = i === steps.length - 1;
                  return (
                    <li key={`${i}-${st.title}`} className="avoid-break border-t-2 pt-4" style={{ borderColor: last ? "#3F9C6A" : NAVY }}>
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: last ? "#3F9C6A" : NAVY }}>
                          {last ? <Check className="h-4 w-4" /> : i + 1}
                        </span>
                        <span className="tnum text-xs font-semibold tracking-[0.14em] text-ink-400 uppercase">Dia {st.day}</span>
                      </div>
                      <p className="mt-3 font-semibold text-ink-900">{st.title}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{st.text}</p>
                    </li>
                  );
                })}
              </ol>
            </Section>
          )}

          {/* ===================================================== OBRAS */}
          {s.proposal.gallery.length > 0 && (
            <Section num={num()} kicker="Portfólio" title="Obras realizadas pela nossa equipe">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {s.proposal.gallery.slice(0, 6).map((src, i) => (
                  <div key={src} className={cx("overflow-hidden rounded-xl bg-ink-100", i === 0 && "col-span-2 row-span-2")}>
                    <Photo src={src} className="aspect-[4/3] h-full w-full" />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ===================================================== PLANETA */}
          {show.planet && (
            <Section num={num()} kicker="Sustentabilidade" title="Impacto ambiental positivo">
              <div className="grid gap-px overflow-hidden rounded-xl border border-ink-200 bg-ink-200 sm:grid-cols-3">
                <MiniSpec label="CO₂ evitado por ano" value={`${fmtNum(energy.co2TonsPerYear, 2)} toneladas`} sub={`${fmtNum(energy.co2TonsPerYear * 25, 1)} t em 25 anos`} />
                <MiniSpec label="Equivale ao plantio de" value={`${fmtNum(energy.treesEquivalent)} árvores`} sub="por ano de operação" />
                <MiniSpec label="Ou deixar de rodar" value={`${fmtNum(carKm)} km`} sub="de carro por ano" />
              </div>
            </Section>
          )}

          {/* ================================================= INVESTIMENTO */}
          <section className="print-break relative overflow-hidden px-6 py-14 text-white sm:px-14 sm:py-16" style={{ background: NAVY }}>
            <LeafMark className="right-[-8%] bottom-[-12%] w-[420px] opacity-[0.07]" />
            <BrandRule className="absolute inset-x-0 top-0" />
            <SectionTitle num={num()} kicker="Investimento" title="Condições comerciais" dark />
            <div className="relative mt-8 grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-start">
              <div>
                <p className="text-sm text-white/60">Valor total do sistema, à vista</p>
                <p className="tnum mt-1 bg-gradient-to-r from-[#F3EA3B] via-[#C9E97A] to-[#9BD373] bg-clip-text font-display text-5xl font-semibold tracking-tight text-transparent sm:text-6xl">
                  {brl(price)}
                </p>
                <p className="tnum mt-2 text-sm text-white/60">{brl(price / Math.max(1, kwp * 1000))} por Wp instalado</p>
                <ul className="mt-6 grid gap-2 text-sm text-white/80">
                  {["Equipamentos com nota fiscal", "Projeto elétrico e ART", "Homologação na distribuidora", "Instalação completa e comissionamento", "Monitoramento pelo aplicativo"].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#F3EA3B]" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {cardInstallment > 0 && <PayOption title="Cartão de crédito" main={`${inputs.cardInstallments}× de ${brl(cardInstallment)}`} sub={`Total ${brl(cardInstallment * inputs.cardInstallments, 0)}`} />}
                  {cheapest && (
                    <PayOption
                      title="Financiamento solar"
                      main={`${cheapest.months}× de ${brl(cheapest.installment)}`}
                      sub={cheaperThanBill ? `Parcela menor que a sua conta atual (${brl(energy.monthlyBillBefore, 0)})` : "Sujeito à análise de crédito"}
                      highlight={cheaperThanBill}
                    />
                  )}
                </div>
                {financing.length > 1 && (
                  <div className="overflow-hidden rounded-xl ring-1 ring-white/15">
                    <table className="w-full text-sm">
                      <thead className="bg-white/[0.06] text-left text-[11px] tracking-[0.1em] text-white/50 uppercase">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">Prazo</th>
                          <th className="px-4 py-2.5 text-right font-semibold">Parcela</th>
                          <th className="px-4 py-2.5 text-right font-semibold">Parcela − economia</th>
                        </tr>
                      </thead>
                      <tbody className="tnum divide-y divide-white/10">
                        {financing.map((f) => {
                          const diff = f.installment - energy.monthlySavings;
                          return (
                            <tr key={f.months}>
                              <td className="px-4 py-2.5 text-white/70">{f.months} meses</td>
                              <td className="px-4 py-2.5 text-right font-semibold">{brl(f.installment)}</td>
                              <td className={cx("px-4 py-2.5 text-right font-semibold", diff <= 0 ? "text-[#9BD373]" : "text-white/70")}>
                                {diff <= 0 ? `sobram ${brl(-diff, 0)}` : brl(diff, 0)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="border-t border-white/10 px-4 py-2.5 text-[11px] leading-relaxed text-white/45">
                      “Parcela − economia” indica o desembolso real por mês, já descontada a redução na conta de luz. Simulação com taxa de {fmtNum(inputs.financingRate, 2)}% a.m.
                    </p>
                  </div>
                )}
                {inputs.paymentNotes && <p className="rounded-xl bg-white/[0.06] px-4 py-3 text-sm whitespace-pre-line text-white/80 ring-1 ring-white/10">{inputs.paymentNotes}</p>}
              </div>
            </div>
          </section>

          {/* ========================================================= FAQ */}
          {show.faq && (
            <Section num={num()} kicker="Dúvidas frequentes" title="Respostas diretas">
              <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
                {faq.map((f) => (
                  <div key={f.q} className="border-t border-ink-200 pt-4">
                    <dt className="font-semibold text-ink-900">{f.q}</dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-ink-600">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}

          {/* ======================================================= SOBRE */}
          {show.about && (
            <Section num={num()} kicker="Sobre nós" title={s.company_name} tone="paper">
              <div className="grid gap-8 sm:grid-cols-[1.4fr_1fr]">
                <p className="leading-relaxed text-ink-600">{s.about}</p>
                <div className="grid content-start gap-3 text-sm">
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
                  {s.address && (
                    <p className="flex items-center gap-2.5">
                      <MapPin className="h-4 w-4 text-ink-400" /> {s.address}
                    </p>
                  )}
                  {s.cnpj && <p className="text-xs text-ink-400">CNPJ {s.cnpj}</p>}
                </div>
              </div>
            </Section>
          )}

          {/* ========================================================= CTA */}
          <section className="no-print border-t border-ink-100 px-6 py-12 sm:px-14">
            <div className="flex flex-col gap-6 rounded-2xl border border-ink-200 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <p className="font-display text-2xl font-semibold tracking-tight" style={{ color: NAVY }}>
                  {accepted ? "Proposta aceita. Obrigado pela confiança." : "Pronto para seguir?"}
                </p>
                <p className="mt-1 max-w-md text-sm text-ink-500">
                  {accepted ? "Entraremos em contato para agendar a visita técnica." : "Aceite a proposta online ou fale com seu consultor para esclarecer qualquer ponto."}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {!accepted && !expired && token && (
                  <Button size="lg" onClick={() => setAcceptOpen(true)} style={CTA_STYLE}>
                    <Check className="h-5 w-5" /> Aceitar proposta
                  </Button>
                )}
                {contactPhone && (
                  <a href={whatsappUrl(contactPhone, waText)} target="_blank" rel="noreferrer">
                    <Button size="lg" variant="secondary" className="w-full">
                      <MessageCircle className="h-5 w-5 text-emerald-600" /> WhatsApp
                    </Button>
                  </a>
                )}
                <Button size="lg" variant="secondary" onClick={() => window.print()} className="sm:hidden">
                  <Download className="h-5 w-5" /> PDF
                </Button>
              </div>
            </div>
          </section>

          <footer className="border-t border-ink-100 px-6 py-6 text-[11px] leading-relaxed text-ink-400 sm:px-14">
            <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink-500">
              <Info className="h-3.5 w-3.5" /> Premissas de cálculo
            </p>
            Irradiação média de {fmtNum(inputs.sunHours, 2)} kWh/m²/dia e rendimento global de {fmtNum(inputs.performanceRatio * 100)}%; tarifa de {brl(inputs.tariff, 3)}/kWh com reajuste
            de {fmtNum(inputs.tariffIncrease, 1)}% a.a.; fio B de {brl(inputs.fioBTariff, 3)}/kWh conforme a transição da Lei 14.300/2022; {fmtNum(inputs.selfConsumption)}% de consumo
            simultâneo; iluminação pública de {brl(inputs.publicLighting)}; degradação dos módulos de {fmtNum(inputs.degradation, 1)}% a.a. Valores estimados: a geração real depende de clima,
            sombreamento e orientação do telhado. Proposta nº {data.proposal.number}.
          </footer>
          <BrandFooter settings={s} number={data.proposal.number} phone={contactPhone} />
        </article>
      </div>

      {/* Barra fixa no celular */}
      {!accepted && !expired && token && (
        <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
          <div className="flex gap-2">
            {contactPhone && (
              <a href={whatsappUrl(contactPhone, waText)} target="_blank" rel="noreferrer" className="flex-1">
                <Button variant="secondary" className="w-full">
                  <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
                </Button>
              </a>
            )}
            <Button className="flex-1" style={CTA_STYLE} onClick={() => setAcceptOpen(true)}>
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
          days={lastDay}
          onAccepted={(by) => {
            setAccepted({ at: new Date().toISOString(), by });
            setAcceptOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ subcomponentes */

export function Photo({ src, className, fallback }: { src?: string; className?: string; fallback?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className={className}>{fallback}</div>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" onError={() => setFailed(true)} className={cx("object-cover", className)} />
  );
}

function CoverFallback() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-[#120B24] via-[#2A2046] to-[#120B24]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(155,211,115,0.25),transparent_45%)]" />
      <div className="absolute top-[8%] right-[-4%] grid w-[62%] rotate-[-12deg] grid-cols-4 gap-2 opacity-40">
        {Array.from({ length: 8 }, (_, i) => (
          <ModuleRender key={i} className="h-auto w-full" />
        ))}
      </div>
    </div>
  );
}

export function Brand({ settings }: { settings: CompanySettings }) {
  if (settings.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={settings.logo_url} alt={settings.company_name} className="h-11 w-auto max-w-[200px] object-contain brightness-0 invert" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/logo-h-white.png" alt={settings.company_name || "Quark Energia"} className="h-11 w-auto sm:h-12" />;
}

/** Faixa de encerramento com o logotipo. */
export function BrandFooter({ settings, number, phone }: { settings: CompanySettings; number: number; phone: string }) {
  const info = [settings.company_name, phone && formatPhone(phone), settings.instagram && `@${settings.instagram.replace(/^@/, "")}`, settings.city].filter(Boolean);
  return (
    <div className="relative overflow-hidden px-6 py-8 text-white sm:px-14" style={{ background: NAVY }}>
      <BrandRule className="absolute inset-x-0 top-0 h-1" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Brand settings={settings} />
        <div className="text-xs leading-relaxed text-white/60 sm:text-right">
          <p>{info.join(" · ")}</p>
          <p>Proposta nº {number}</p>
        </div>
      </div>
    </div>
  );
}

/** Faixa no degradê da marca. */
export function BrandRule({ className }: { className?: string }) {
  return <div className={cx("h-1.5 bg-gradient-to-r from-[#F3EA3B] via-[#9BD373] to-[#6CC690]", className)} />;
}

/** Folha da marca como marca-d'água. */
export function LeafMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/symbol.png" alt="" aria-hidden className={cx("pointer-events-none absolute select-none", className)} />;
}

export function CoverKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#120B24]/50 px-4 py-4 sm:px-5">
      <dt className="text-[10px] font-semibold tracking-[0.14em] text-white/55 uppercase sm:text-[11px]">{label}</dt>
      <dd className="tnum mt-1 font-display text-lg font-semibold sm:text-xl">{value}</dd>
    </div>
  );
}

export function SectionTitle({ num, kicker, title, dark }: { num: string; kicker: string; title: ReactNode; dark?: boolean }) {
  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        <span className="tnum bg-gradient-to-r from-[#E8DF2E] to-[#3F9C6A] bg-clip-text font-display text-sm font-bold text-transparent">{num}</span>
        <span className="h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-[#C7BE40]" aria-hidden />
        <p className={cx("text-xs font-semibold tracking-[0.22em] uppercase", dark ? "text-[#F3EA3B]" : "text-[#2C7A52]")}>{kicker}</p>
      </div>
      <h2 className={cx("mt-2 max-w-3xl font-display text-[26px] leading-tight font-semibold tracking-tight sm:text-[34px]", dark ? "text-white" : "text-[#1C1234]")}>{title}</h2>
    </div>
  );
}

export function Section({ num, kicker, title, children, tone }: { num: string; kicker: string; title: ReactNode; children: ReactNode; tone?: "paper" }) {
  return (
    <section className={cx("avoid-break px-6 py-14 sm:px-14 sm:py-16", tone === "paper" && "bg-[#F6F5FA]/70")}>
      <SectionTitle num={num} kicker={kicker} title={title} />
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function Notice({ tone, icon, children }: { tone: "green" | "amber"; icon: ReactNode; children: ReactNode }) {
  return (
    <div className={cx("flex items-center gap-3 px-6 py-4 text-sm sm:px-14", tone === "green" ? "bg-emerald-700 text-white" : "bg-amber-50 text-amber-900")}>
      {icon}
      <p>{children}</p>
    </div>
  );
}

export function Explain({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-xl border-l-[3px] border-[#6CC690] bg-[#F6F5FA] p-5", className)}>
      <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-[#2C7A52] uppercase">
        <Info className="h-3.5 w-3.5" /> Entenda · {title}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-700">{children}</p>
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink-600">{label}</span>
        <span className="tnum font-display text-xl font-semibold" style={{ color: color === "#94A3B8" ? NAVY : color }}>
          {brl(value, 0)}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full" style={{ width: `${Math.max(3, (value / Math.max(1, max)) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

export function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cx("relative overflow-hidden rounded-xl border p-4", accent ? "border-transparent text-white" : "border-ink-200 bg-white")} style={accent ? { background: NAVY } : undefined}>
      {accent && <BrandRule className="absolute inset-x-0 top-0 h-1" />}
      <p className={cx("text-[11px] font-semibold tracking-[0.1em] uppercase", accent ? "text-white/60" : "text-ink-500")}>{label}</p>
      <p className="tnum mt-1.5 font-display text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
    </div>
  );
}

function BillRow({ label, hint, before, after }: { label: string; hint: string; before: number; after: number }) {
  if (before < 0.005 && after < 0.005) return null;
  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-medium text-ink-800">{label}</p>
        <p className="text-xs text-ink-400">{hint}</p>
      </td>
      <td className="px-4 py-3 text-right text-ink-600">{before > 0.004 ? brl(before) : "—"}</td>
      <td className="px-4 py-3 text-right font-medium text-ink-900">{after > 0.004 ? brl(after) : "—"}</td>
    </tr>
  );
}

export function Product({ image, render, kicker, title, specs }: { image?: string; render: ReactNode; kicker: string; title: string; specs: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      <div className="relative grid aspect-[16/10] place-items-center overflow-hidden bg-gradient-to-b from-[#F3F2F8] to-[#E4E1EE]">
        {image ? <Photo src={image} className="absolute inset-0 h-full w-full" fallback={<div className="grid h-full place-items-center">{render}</div>} /> : render}
      </div>
      <div className="p-5 sm:p-6">
        <p className="text-xs font-semibold tracking-[0.18em] text-[#2C7A52] uppercase">{kicker}</p>
        <p className="mt-1 font-display text-xl font-semibold" style={{ color: NAVY }}>
          {title}
        </p>
        <dl className="mt-4 divide-y divide-ink-100 text-sm">
          {specs.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2">
              <dt className="text-ink-500">{k}</dt>
              <dd className="text-right font-medium text-ink-900">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export function MiniSpec({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white p-5">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">{label}</p>
      <p className="tnum mt-1 font-display text-lg font-semibold" style={{ color: NAVY }}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-ink-500">{sub}</p>
    </div>
  );
}

function Warranty({ years, title, text }: { years: number; title: string; text: string }) {
  return (
    <div className="bg-white p-5">
      <p className="tnum font-display text-4xl font-semibold tracking-tight" style={{ color: NAVY }}>
        {years}
        <span className="ml-1 text-sm font-medium text-ink-400">{years === 1 ? "ano" : "anos"}</span>
      </p>
      <p className="mt-2 font-semibold text-ink-900">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{text}</p>
    </div>
  );
}

export function PayOption({ title, main, sub, highlight }: { title: string; main: string; sub: string; highlight?: boolean }) {
  return (
    <div className={cx("rounded-xl p-5 ring-1", highlight ? "bg-emerald-500/15 ring-emerald-400/40" : "bg-white/[0.06] ring-white/15")}>
      <p className="text-[11px] font-semibold tracking-[0.14em] text-white/55 uppercase">{title}</p>
      <p className="tnum mt-1.5 font-display text-xl font-semibold">{main}</p>
      <p className={cx("mt-1 text-xs", highlight ? "font-semibold text-[#9BD373]" : "text-white/55")}>{sub}</p>
    </div>
  );
}

export function AcceptModal({
  open,
  onClose,
  token,
  defaultName,
  days,
  note,
  onAccepted,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  defaultName: string;
  days: number;
  note?: string;
  onAccepted: (name: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/public/proposal/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", name }),
    }).catch(() => null);
    setLoading(false);
    const json = res ? await res.json().catch(() => null) : null;
    if (!json?.ok) return toast.error("Não foi possível registrar o aceite. Fale com seu consultor pelo WhatsApp.");
    toast.success("Proposta aceita. Em breve entraremos em contato.");
    onAccepted(name);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Aceitar proposta"
      subtitle="Confirme seu nome. Nossa equipe entrará em contato para formalizar o contrato."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Voltar
          </Button>
          <Button form="accept-form" type="submit" loading={loading} style={CTA_STYLE}>
            <Check className="h-4 w-4" /> Confirmar aceite
          </Button>
        </>
      }
    >
      <form id="accept-form" onSubmit={submit}>
        <Field label="Nome completo">
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <p className="mt-3 text-xs leading-relaxed text-ink-500">
          {note ??
            `O aceite online não gera cobrança: ele reserva as condições desta proposta enquanto o contrato é preparado. Após a assinatura, o prazo estimado até o sistema em operação é de ${days} dias.`}
        </p>
      </form>
    </Modal>
  );
}
