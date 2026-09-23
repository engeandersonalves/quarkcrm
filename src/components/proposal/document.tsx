"use client";

import {
  BadgeCheck,
  BatteryCharging,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileSignature,
  Gauge,
  HardHat,
  Landmark,
  Leaf,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PiggyBank,
  Ruler,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  TreePine,
  TrendingUp,
  Wrench,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { mergeInputs, mergeSettings, type CompanySettings } from "@/lib/defaults";
import { formatDate, formatPhone, whatsappUrl } from "@/lib/format";
import { brl, calcEnergy, calcFinancing, fmtNum, irr, pct, pmt, type ProposalInputs } from "@/lib/pricing";
import { Button, Field, Input, Modal, cx } from "../ui";
import { CashflowChart, GenerationChart } from "./charts";

export interface PublicProposal {
  proposal: {
    id?: string;
    number: number;
    title: string | null;
    status: string;
    inputs: Partial<ProposalInputs>;
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

const MODULE_AREA_M2 = 2.6; // área média ocupada por módulo de ~550–600 W, com espaçamento

export function ProposalDocument({ data, token }: { data: PublicProposal; token: string | null }) {
  const s = mergeSettings(data.settings);
  const inputs = mergeInputs(data.proposal.inputs);
  const price = Number(data.proposal.final_price);
  const [accepted, setAccepted] = useState<{ at: string; by: string } | null>(
    data.proposal.accepted_at ? { at: data.proposal.accepted_at, by: data.proposal.accepted_by ?? "" } : null,
  );
  const [acceptOpen, setAcceptOpen] = useState(false);

  const kwp = (inputs.modulePowerW * inputs.moduleQty) / 1000;
  const energy = useMemo(() => calcEnergy(inputs, price), [inputs, price]);
  const financing = useMemo(() => calcFinancing(price, inputs.financingRate, inputs.financingTerms), [price, inputs.financingRate, inputs.financingTerms]);
  const tir = useMemo(() => irr(price, energy.cashflow.map((c) => c.savings)), [price, energy]);
  const cardInstallment = inputs.cardInstallments > 0 ? pmt(price, inputs.cardRate, inputs.cardInstallments) : 0;

  const firstName = data.lead.name.split(" ")[0];
  const savingsPct = energy.monthlyBillBefore > 0 ? energy.monthlySavings / energy.monthlyBillBefore : 0;
  const expired = !!data.proposal.valid_until && new Date(`${data.proposal.valid_until}T23:59:59`) < new Date() && !accepted;
  const location = [data.lead.city, data.lead.state].filter(Boolean).join(" – ");
  const contactPhone = s.whatsapp || s.phone || data.seller?.phone || "";
  const waText = `Olá! Estou vendo a proposta #${data.proposal.number} de energia solar e gostaria de conversar.`;
  const cheapest = financing.length ? financing[financing.length - 1] : null;
  const cheaperThanBill = cheapest && energy.monthlyBillBefore > 0 && cheapest.installment < energy.monthlyBillBefore;

  // Registra a visualização (ignorado quando quem abre é alguém logado da equipe).
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
    <div className="min-h-dvh bg-[#eceef2] print:bg-white">
      {/* Barra de ações */}
      <div className="no-print fixed top-4 right-4 z-40 hidden gap-2 sm:flex">
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Download className="h-4 w-4" /> Baixar PDF
        </Button>
      </div>

      <div className="mx-auto max-w-[940px] sm:px-6 sm:py-10 print:max-w-none print:p-0">
        <div className="overflow-hidden bg-white shadow-lift sm:rounded-[28px] print:rounded-none print:shadow-none">
          {/* ============================================================ CAPA */}
          <section className="relative overflow-hidden bg-ink-950 px-6 pt-8 pb-10 text-white sm:px-12 sm:pt-12 sm:pb-14 print:min-h-[297mm]">
            <div className="pointer-events-none absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full bg-sun-500/30 blur-[110px]" />
            <div className="pointer-events-none absolute -bottom-40 -left-20 h-[360px] w-[360px] rounded-full bg-orange-600/15 blur-[100px]" />
            <SunRays />

            <div className="relative flex items-center justify-between gap-4">
              <Brand settings={s} dark />
              <div className="text-right text-xs text-ink-400">
                <p className="font-semibold text-ink-200">Proposta nº {data.proposal.number}</p>
                <p>{formatDate(data.proposal.created_at, { day: "2-digit", month: "long", year: "numeric" })}</p>
              </div>
            </div>

            <div className="relative mt-16 sm:mt-24">
              <p className="text-xs font-bold tracking-[0.2em] text-sun-400 uppercase">Proposta de energia solar</p>
              <h1 className="mt-4 max-w-[680px] font-display text-[34px] leading-[1.08] font-semibold tracking-tight sm:text-[52px]">
                {savingsPct > 0.3 ? (
                  <>
                    {firstName}, sua conta de luz pode cair <span className="text-sun-gradient">{fmtNum(savingsPct * 100)}%</span>.
                  </>
                ) : (
                  <>
                    Energia solar sob medida para <span className="text-sun-gradient">{firstName}</span>.
                  </>
                )}
              </h1>
              <p className="mt-5 max-w-[560px] text-base leading-relaxed text-ink-300 sm:text-lg">
                Um sistema fotovoltaico de {fmtNum(kwp, 2)} kWp projetado para o seu consumo — gerando em média {fmtNum(energy.monthlyGeneration)} kWh por mês
                {energy.monthlySavings > 0 && <> e colocando cerca de {brl(energy.monthlySavings, 0)} de volta no seu bolso todos os meses</>}.
              </p>
            </div>

            <div className="relative mt-10 grid grid-cols-2 gap-3 sm:mt-14 sm:grid-cols-4">
              <CoverStat icon={<Zap />} label="Potência instalada" value={fmtNum(kwp, 2)} unit="kWp" />
              <CoverStat icon={<Sun />} label="Geração média" value={fmtNum(energy.monthlyGeneration)} unit="kWh/mês" />
              <CoverStat icon={<PiggyBank />} label="Economia mensal" value={brl(energy.monthlySavings, 0)} />
              <CoverStat icon={<TrendingUp />} label="Retorno em" value={energy.paybackYears ? fmtNum(energy.paybackYears, 1) : "—"} unit="anos" />
            </div>

            <div className="relative mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-ink-500">Preparada para</p>
                <p className="mt-0.5 font-semibold">{data.lead.name}</p>
                {location && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-400">
                    <MapPin className="h-3 w-3" /> {location}
                  </p>
                )}
              </div>
              {data.proposal.valid_until && (
                <div className="sm:text-right">
                  <p className="text-xs text-ink-500">Válida até</p>
                  <p className="mt-0.5 font-semibold">{formatDate(data.proposal.valid_until, { day: "2-digit", month: "long", year: "numeric" })}</p>
                </div>
              )}
            </div>
          </section>

          {accepted && (
            <div className="flex items-center gap-3 bg-emerald-600 px-6 py-4 text-white sm:px-12">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="text-sm">
                <b>Proposta aceita</b> por {accepted.by} em {formatDate(accepted.at, { day: "2-digit", month: "long", year: "numeric" })}. Nossa equipe entrará em contato para os próximos passos.
              </p>
            </div>
          )}
          {expired && (
            <div className="flex items-center gap-3 bg-amber-100 px-6 py-4 text-amber-900 sm:px-12">
              <Clock className="h-5 w-5 shrink-0" />
              <p className="text-sm">Esta proposta expirou. Fale com a gente para atualizar os valores — normalmente conseguimos manter as mesmas condições.</p>
            </div>
          )}

          {/* ====================================================== CONTA DE LUZ */}
          {energy.monthlyBillBefore > 0 && (
            <Section eyebrow="01 · Economia" title="Sua conta de luz, antes e depois">
              <div className="grid gap-6 sm:grid-cols-[1.3fr_1fr]">
                <div className="grid content-center gap-5">
                  <BillBar label="Hoje" value={energy.monthlyBillBefore} max={energy.monthlyBillBefore} tone="before" />
                  <BillBar label="Com energia solar" value={energy.monthlyBillAfter} max={energy.monthlyBillBefore} tone="after" />
                  <p className="text-xs leading-relaxed text-ink-500">
                    Com energia solar você continua pagando apenas a taxa mínima da concessionária (custo de disponibilidade de {energy.availabilityKwh} kWh
                    {inputs.connectionType === "mono" ? ", ligação monofásica" : inputs.connectionType === "bi" ? ", ligação bifásica" : ", ligação trifásica"}) e a iluminação pública.
                  </p>
                </div>
                <div className="relative overflow-hidden rounded-3xl bg-emerald-600 p-6 text-white">
                  <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10" />
                  <p className="relative text-sm font-medium text-emerald-100">Você economiza</p>
                  <p className="tnum relative mt-1 font-display text-4xl font-semibold tracking-tight">{brl(energy.monthlySavings, 0)}</p>
                  <p className="relative text-sm text-emerald-100">por mês</p>
                  <div className="relative mt-6 grid gap-3 border-t border-white/20 pt-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-emerald-100">No 1º ano</span>
                      <b className="tnum">{brl(energy.annualSavings, 0)}</b>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-100">Em 25 anos</span>
                      <b className="tnum">{brl(energy.savings25y, 0)}</b>
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* ========================================================= SISTEMA */}
          <Section eyebrow="02 · Projeto" title="O seu sistema fotovoltaico" subtitle="Equipamentos de primeira linha, dimensionados para o seu perfil de consumo.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Equipment
                icon={<SolarPanelIcon />}
                title={`${inputs.moduleQty} módulos fotovoltaicos`}
                lines={[`${inputs.moduleBrand || "Marca Tier 1"}${inputs.moduleModel ? ` · ${inputs.moduleModel}` : ""}`, `${fmtNum(inputs.modulePowerW)} W cada · ${fmtNum(kwp, 2)} kWp no total`]}
                tag={`${s.warranty_modules_years} anos de garantia`}
              />
              <Equipment
                icon={<BatteryCharging className="h-6 w-6" />}
                title={`${inputs.inverterQty > 1 ? `${inputs.inverterQty} inversores` : "Inversor"} ${inputs.inverterBrand}`.trim()}
                lines={[inputs.inverterModel || "Inversor on-grid com monitoramento", `${fmtNum(inputs.inverterPowerKw, 1)} kW${inputs.inverterQty > 1 ? " cada" : ""} de potência`]}
                tag={`${s.warranty_inverter_years} anos de garantia`}
              />
              <Equipment icon={<Wrench className="h-6 w-6" />} title="Estrutura de fixação" lines={[inputs.structureType, "Alumínio anodizado e aço inox — resistente à corrosão"]} />
              <Equipment icon={<Smartphone className="h-6 w-6" />} title="Monitoramento no celular" lines={["Acompanhe a geração em tempo real", "Alertas automáticos de funcionamento"]} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <MiniStat icon={<Ruler />} label="Área aproximada" value={`${fmtNum(inputs.moduleQty * MODULE_AREA_M2)} m²`} />
              <MiniStat icon={<Gauge />} label="Geração anual" value={`${fmtNum(energy.annualGeneration / 1000, 1)} MWh`} />
              <MiniStat icon={<Sun />} label="Consumo atendido" value={energy.coverage ? pct(Math.min(1, energy.coverage), 0) : "—"} />
            </div>
          </Section>

          {/* ========================================================== GERAÇÃO */}
          <Section eyebrow="03 · Geração" title="Quanto o seu sistema vai produzir" subtitle="Estimativa mês a mês com base na irradiação solar da sua região.">
            <GenerationChart data={energy.monthly} />
          </Section>

          {/* ========================================================= RETORNO */}
          {energy.monthlySavings > 0 && (
            <Section eyebrow="04 · Retorno" title="Um investimento que se paga sozinho" subtitle="Saldo acumulado considerando reajustes anuais da tarifa de energia.">
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KPI label="Payback" value={`${fmtNum(energy.paybackYears, 1)} anos`} />
                <KPI label="Economia em 25 anos" value={brl(energy.savings25y, 0)} />
                <KPI label="Retorno sobre o investimento" value={`${fmtNum(energy.roi25y, 1)}×`} />
                <KPI label="Rentabilidade (TIR)" value={tir ? `${fmtNum(tir * 100, 1)}% a.a.` : "—"} />
              </div>
              <CashflowChart data={energy.cashflow} payback={energy.paybackYears} />
              {tir > 0 && (
                <p className="mt-4 rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
                  <Sparkles className="mr-1.5 inline h-4 w-4 text-sun-600" />
                  O retorno equivale a uma aplicação rendendo <b className="text-ink-900">{fmtNum((Math.pow(1 + tir, 1 / 12) - 1) * 100, 2)}% ao mês</b>, livre de imposto de renda — e seu imóvel ainda se valoriza.
                </p>
              )}
            </Section>
          )}

          {/* ======================================================== AMBIENTAL */}
          <Section eyebrow="05 · Sustentabilidade" title="Energia limpa, todos os dias">
            <div className="grid gap-4 sm:grid-cols-3">
              <Eco icon={<Leaf />} value={`${fmtNum(energy.co2TonsPerYear, 1)} t`} label="de CO₂ evitadas por ano" />
              <Eco icon={<TreePine />} value={fmtNum(energy.treesEquivalent)} label="árvores plantadas equivalentes (por ano)" />
              <Eco icon={<Sun />} value={`${fmtNum((energy.co2TonsPerYear * 25), 0)} t`} label="de CO₂ evitadas em 25 anos" />
            </div>
          </Section>

          {/* ====================================================== INVESTIMENTO */}
          <section className="print-break relative overflow-hidden bg-ink-950 px-6 py-12 text-white sm:px-12 sm:py-16">
            <div className="pointer-events-none absolute -right-20 -bottom-40 h-[420px] w-[420px] rounded-full bg-sun-500/20 blur-[100px]" />
            <p className="relative text-xs font-bold tracking-[0.2em] text-sun-400 uppercase">06 · Investimento</p>
            <div className="relative mt-4 grid gap-8 sm:grid-cols-[1fr_1.1fr] sm:items-end">
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Investimento total</h2>
                <p className="mt-2 text-sm text-ink-400">Sistema completo: equipamentos, projeto, homologação, instalação e monitoramento.</p>
              </div>
              <div className="sm:text-right">
                <p className="tnum font-display text-5xl font-semibold tracking-tight text-sun-gradient sm:text-6xl">{brl(price)}</p>
                <p className="mt-1 text-sm text-ink-400">à vista · {brl(price / Math.max(1, kwp * 1000))}/Wp</p>
              </div>
            </div>

            <div className="relative mt-10 grid gap-4 sm:grid-cols-2">
              {cardInstallment > 0 && (
                <PayCard icon={<CreditCard />} title="Cartão de crédito" main={`${inputs.cardInstallments}× de ${brl(cardInstallment)}`} sub={`Total ${brl(cardInstallment * inputs.cardInstallments)}`} />
              )}
              {cheapest && (
                <PayCard
                  icon={<Landmark />}
                  title="Financiamento solar"
                  main={`a partir de ${brl(cheapest.installment)}/mês`}
                  sub={cheaperThanBill ? `Menor que sua conta atual de ${brl(energy.monthlyBillBefore, 0)}` : `em ${cheapest.months} meses`}
                  highlight={!!cheaperThanBill}
                />
              )}
            </div>

            {financing.length > 0 && (
              <div className="relative mt-4 overflow-hidden rounded-2xl ring-1 ring-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.04] text-left text-xs text-ink-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Prazo</th>
                      <th className="px-4 py-3 text-right font-medium">Parcela</th>
                      <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Economia no mês</th>
                      <th className="px-4 py-3 text-right font-medium">Parcela − economia</th>
                    </tr>
                  </thead>
                  <tbody className="tnum divide-y divide-white/[0.06]">
                    {financing.map((f) => {
                      const diff = f.installment - energy.monthlySavings;
                      return (
                        <tr key={f.months}>
                          <td className="px-4 py-3 text-ink-300">{f.months}×</td>
                          <td className="px-4 py-3 text-right font-semibold">{brl(f.installment)}</td>
                          <td className="hidden px-4 py-3 text-right text-emerald-400 sm:table-cell">{brl(energy.monthlySavings)}</td>
                          <td className={cx("px-4 py-3 text-right font-semibold", diff <= 0 ? "text-emerald-400" : "text-ink-200")}>
                            {diff <= 0 ? `sobra ${brl(-diff)}` : brl(diff)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="border-t border-white/[0.06] px-4 py-3 text-[11px] text-ink-500">
                  Simulação com taxa de {fmtNum(inputs.financingRate, 2)}% a.m. — sujeita à aprovação de crédito pela instituição financeira.
                </p>
              </div>
            )}
            {inputs.paymentNotes && <p className="relative mt-5 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm whitespace-pre-line text-ink-300 ring-1 ring-white/10">{inputs.paymentNotes}</p>}
          </section>

          {/* ========================================================= GARANTIAS */}
          <Section eyebrow="07 · Segurança" title="Garantias que dão tranquilidade">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Warranty years={s.warranty_modules_performance_years} label="de eficiência dos módulos" />
              <Warranty years={s.warranty_modules_years} label="contra defeitos nos módulos" />
              <Warranty years={s.warranty_inverter_years} label="de garantia do inversor" />
              <Warranty years={s.warranty_installation_years} label="de garantia da instalação" />
            </div>
          </Section>

          {/* ========================================================== ETAPAS */}
          <Section eyebrow="08 · Próximos passos" title="Do “sim” à energia gerada" subtitle={`Prazo estimado de até ${inputs.installationDays} dias para instalação após a aprovação do projeto.`}>
            <ol className="relative grid gap-5 sm:grid-cols-5 sm:gap-3">
              <div className="absolute top-5 right-[10%] left-[10%] hidden h-px bg-gradient-to-r from-sun-300 via-sun-400 to-emerald-400 sm:block" />
              {[
                { icon: <FileSignature />, t: "Contrato", d: "Assinatura e definição do pagamento" },
                { icon: <HardHat />, t: "Projeto", d: "Engenharia e vistoria técnica" },
                { icon: <ShieldCheck />, t: "Homologação", d: "Aprovação junto à concessionária" },
                { icon: <Wrench />, t: "Instalação", d: "Equipe própria e certificada" },
                { icon: <Zap />, t: "Economia", d: "Troca do medidor e geração" },
              ].map((step, i) => (
                <li key={step.t} className="relative flex gap-4 sm:flex-col sm:items-center sm:text-center">
                  <div className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-sun-600 ring-2 ring-sun-300 [&>svg]:h-[18px] [&>svg]:w-[18px]">{step.icon}</div>
                  <div>
                    <p className="text-[11px] font-bold text-ink-400">ETAPA {i + 1}</p>
                    <p className="font-semibold text-ink-900">{step.t}</p>
                    <p className="text-xs text-ink-500">{step.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {/* ============================================================ SOBRE */}
          <Section eyebrow="09 · Quem somos" title={s.company_name}>
            <div className="grid gap-6 sm:grid-cols-[1.4fr_1fr]">
              <p className="leading-relaxed text-ink-600">{s.about}</p>
              <div className="grid content-start gap-2.5 text-sm">
                {data.seller?.name && (
                  <p className="flex items-center gap-2.5 text-ink-700">
                    <BadgeCheck className="h-4 w-4 text-sun-600" /> Consultor: <b>{data.seller.name}</b>
                  </p>
                )}
                {contactPhone && (
                  <p className="flex items-center gap-2.5 text-ink-700">
                    <Phone className="h-4 w-4 text-sun-600" /> {formatPhone(contactPhone)}
                  </p>
                )}
                {(s.email || data.seller?.email) && (
                  <p className="flex items-center gap-2.5 text-ink-700">
                    <Mail className="h-4 w-4 text-sun-600" /> {s.email || data.seller?.email}
                  </p>
                )}
                {s.address && (
                  <p className="flex items-center gap-2.5 text-ink-700">
                    <MapPin className="h-4 w-4 text-sun-600" /> {s.address}
                  </p>
                )}
                {s.cnpj && <p className="pl-6.5 text-xs text-ink-400">CNPJ {s.cnpj}</p>}
              </div>
            </div>
          </Section>

          {/* ============================================================== CTA */}
          <section className="no-print px-6 pt-12 pb-12 sm:px-12">
            <div className="relative overflow-hidden rounded-3xl bg-sun-gradient p-8 text-ink-950 sm:p-10">
              <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/20" />
              <h3 className="relative font-display text-2xl font-semibold tracking-tight sm:text-3xl">{accepted ? "Tudo certo! ☀️" : "Pronto para gerar sua própria energia?"}</h3>
              <p className="relative mt-2 max-w-md text-sm text-ink-900/75">
                {accepted ? "Recebemos o seu aceite. Em breve entraremos em contato para agendar a vistoria técnica." : "Aceite a proposta online ou fale com a gente para tirar qualquer dúvida."}
              </p>
              <div className="relative mt-6 flex flex-col gap-3 sm:flex-row">
                {!accepted && !expired && token && (
                  <Button size="lg" onClick={() => setAcceptOpen(true)}>
                    <Check className="h-5 w-5" /> Aceitar proposta
                  </Button>
                )}
                {contactPhone && (
                  <a href={whatsappUrl(contactPhone, waText)} target="_blank" rel="noreferrer">
                    <Button size="lg" variant="secondary" className="w-full">
                      <MessageCircle className="h-5 w-5 text-emerald-600" /> Falar no WhatsApp
                    </Button>
                  </a>
                )}
                <Button size="lg" variant="outline" className="ring-ink-950/20 hover:bg-white/30 sm:hidden" onClick={() => window.print()}>
                  <Download className="h-5 w-5" /> Baixar PDF
                </Button>
              </div>
            </div>
          </section>

          <footer className="border-t border-ink-100 px-6 py-6 text-[11px] leading-relaxed text-ink-400 sm:px-12">
            <p>
              Valores de geração e economia são estimativas baseadas em irradiação média de {fmtNum(inputs.sunHours, 2)} kWh/m²/dia, eficiência global de{" "}
              {fmtNum(inputs.performanceRatio * 100)}%, tarifa de {brl(inputs.tariff, 3)}/kWh com reajuste de {fmtNum(inputs.tariffIncrease, 1)}% a.a. e degradação dos módulos de{" "}
              {fmtNum(inputs.degradation, 1)}% a.a. A geração real varia conforme clima, sombreamento e orientação do telhado. Proposta nº {data.proposal.number}
              {data.proposal.valid_until && <> — válida até {formatDate(data.proposal.valid_until)}</>}.
            </p>
          </footer>
        </div>
      </div>

      {token && (
        <AcceptModal
          open={acceptOpen}
          onClose={() => setAcceptOpen(false)}
          token={token}
          defaultName={data.lead.name}
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

function Brand({ settings, dark }: { settings: CompanySettings; dark?: boolean }) {
  if (settings.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={settings.logo_url} alt={settings.company_name} className={cx("h-10 w-auto max-w-[180px] object-contain", dark && "brightness-0 invert")} />;
  }
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-sun-gradient shadow-glow">
        <Sun className="h-5 w-5 text-ink-950" strokeWidth={2.5} />
      </div>
      <span className={cx("font-display text-base font-semibold", dark ? "text-white" : "text-ink-900")}>{settings.company_name}</span>
    </div>
  );
}

function SunRays() {
  return (
    <svg className="pointer-events-none absolute -top-24 -right-24 h-[460px] w-[460px] opacity-[0.12]" viewBox="0 0 200 200" aria-hidden>
      {Array.from({ length: 24 }, (_, i) => (
        <line key={i} x1="100" y1="100" x2={100 + 100 * Math.cos((i * Math.PI) / 12)} y2={100 + 100 * Math.sin((i * Math.PI) / 12)} stroke="#fbbf24" strokeWidth="0.4" />
      ))}
      <circle cx="100" cy="100" r="34" fill="none" stroke="#fbbf24" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="56" fill="none" stroke="#fbbf24" strokeWidth="0.3" />
    </svg>
  );
}

function CoverStat({ icon, label, value, unit }: { icon: ReactNode; label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/[0.08] backdrop-blur">
      <div className="text-sun-400 [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
      <p className="mt-3 text-xs text-ink-400">{label}</p>
      <p className="tnum mt-0.5 font-display text-xl font-semibold tracking-tight sm:text-2xl">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-ink-400">{unit}</span>}
      </p>
    </div>
  );
}

function Section({ eyebrow, title, subtitle, children }: { eyebrow: string; title: ReactNode; subtitle?: string; children: ReactNode }) {
  return (
    <section className="avoid-break border-b border-ink-100 px-6 py-12 sm:px-12 sm:py-14">
      <p className="text-xs font-bold tracking-[0.2em] text-sun-600 uppercase">{eyebrow}</p>
      <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-2 max-w-xl text-sm text-ink-500">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function BillBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "before" | "after" }) {
  const w = Math.max(4, (value / Math.max(1, max)) * 100);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink-600">{label}</p>
        <p className={cx("tnum font-display text-xl font-semibold", tone === "before" ? "text-ink-900" : "text-emerald-600")}>{brl(value, 0)}</p>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-ink-100">
        <div className={cx("h-full rounded-full", tone === "before" ? "bg-ink-400" : "bg-emerald-500")} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

function Equipment({ icon, title, lines, tag }: { icon: ReactNode; title: string; lines: string[]; tag?: string }) {
  return (
    <div className="flex gap-4 rounded-2xl bg-ink-50 p-5 ring-1 ring-ink-200/60">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-sun-600 shadow-soft ring-1 ring-ink-200/60">{icon}</div>
      <div className="min-w-0">
        <p className="font-semibold text-ink-900">{title}</p>
        {lines.filter(Boolean).map((l) => (
          <p key={l} className="text-sm text-ink-500">
            {l}
          </p>
        ))}
        {tag && <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/15">{tag}</p>}
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl p-4 ring-1 ring-ink-200/70">
      <div className="text-ink-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</div>
      <p className="mt-2 text-[11px] text-ink-500 sm:text-xs">{label}</p>
      <p className="tnum font-display font-semibold text-ink-900 sm:text-lg">{value}</p>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-200/60">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="tnum mt-1 font-display text-lg font-semibold tracking-tight text-ink-950 sm:text-xl">{value}</p>
    </div>
  );
}

function Eco({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-600/10">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
      <p className="tnum mt-4 font-display text-2xl font-semibold tracking-tight text-emerald-900">{value}</p>
      <p className="text-sm text-emerald-800/70">{label}</p>
    </div>
  );
}

function PayCard({ icon, title, main, sub, highlight }: { icon: ReactNode; title: string; main: string; sub: string; highlight?: boolean }) {
  return (
    <div className={cx("rounded-2xl p-5 ring-1", highlight ? "bg-emerald-500/10 ring-emerald-400/30" : "bg-white/[0.04] ring-white/10")}>
      <div className="flex items-center gap-2 text-sm text-ink-400 [&>svg]:h-4 [&>svg]:w-4">
        {icon} {title}
      </div>
      <p className="tnum mt-2 font-display text-xl font-semibold">{main}</p>
      <p className={cx("mt-0.5 text-xs", highlight ? "font-semibold text-emerald-400" : "text-ink-500")}>{sub}</p>
    </div>
  );
}

function Warranty({ years, label }: { years: number; label: string }) {
  return (
    <div className="rounded-2xl p-5 text-center ring-1 ring-ink-200/70">
      <p className="font-display text-4xl font-semibold tracking-tight text-ink-950">
        {years}
        <span className="ml-1 text-base font-medium text-ink-400">{years === 1 ? "ano" : "anos"}</span>
      </p>
      <p className="mt-1 text-xs text-ink-500">{label}</p>
    </div>
  );
}

function SolarPanelIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M4 5h16l-2 10H6L4 5Z" />
      <path d="M5 10h14M9.3 5l-.6 10M14.7 5l.6 10M12 15v4M8 19h8" />
    </svg>
  );
}

function AcceptModal({ open, onClose, token, defaultName, onAccepted }: { open: boolean; onClose: () => void; token: string; defaultName: string; onAccepted: (name: string) => void }) {
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
    if (!json?.ok) return toast.error("Não foi possível registrar o aceite. Fale com a gente pelo WhatsApp.");
    toast.success("Proposta aceita! Em breve entraremos em contato.");
    onAccepted(name);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Aceitar proposta"
      subtitle="Confirme seu nome para registrar o aceite. Nossa equipe entra em contato para formalizar o contrato."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Voltar
          </Button>
          <Button form="accept-form" type="submit" loading={loading}>
            <Check className="h-4 w-4" /> Confirmar aceite
          </Button>
        </>
      }
    >
      <form id="accept-form" onSubmit={submit}>
        <Field label="Nome completo">
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <p className="mt-3 flex items-start gap-2 text-xs text-ink-500">
          <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          O aceite online não gera cobrança. Ele reserva as condições desta proposta enquanto preparamos o contrato.
        </p>
      </form>
    </Modal>
  );
}
