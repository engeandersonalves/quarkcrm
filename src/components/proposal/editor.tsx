"use client";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Hammer,
  Loader2,
  MessageCircle,
  Percent,
  Plus,
  Receipt,
  Search,
  Settings2,
  Sparkles,
  SunMedium,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { useQuick } from "@/components/app/shell";
import { Badge, Button, Card, CardHeader, Field, Input, MoneyInput, NumberInput, Segmented, Select, Textarea, cx } from "@/components/ui";
import { PROPOSAL_STATUS, ROOF_TYPES } from "@/lib/constants";
import { mergeInputs } from "@/lib/defaults";
import { addDays, formatPhone, whatsappUrl } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { brl, calcEnergy, calcPricing, fmtNum, type AmountMode, type PriceComponent, type ProposalInputs } from "@/lib/pricing";
import { supabase } from "@/lib/supabase/client";
import type { Lead, Proposal } from "@/lib/types";
import { BillPreview, Checkout, StepNav } from "./checkout";

const MODULE_BRANDS = ["JA Solar", "Jinko Solar", "Trina Solar", "LONGi", "Canadian Solar", "Risen", "Astronergy", "DAH Solar", "BYD", "Sunova", "Osda", "Honor Solar", "Znshine", "TW Solar"];
const INVERTER_BRANDS = ["Growatt", "Deye", "Sungrow", "SAJ", "GoodWe", "Solis", "Huawei", "Fronius", "WEG", "Chint", "SolarEdge", "Hoymiles", "APsystems", "Enphase", "Livoltek", "Solplanet"];
const TERMS = [12, 18, 24, 36, 48, 60, 72, 84, 96, 120];
const MODULE_POWERS = [550, 575, 585, 610, 620, 700];
const SIMULTANEITY = [
  { value: 20, emoji: "🌙", label: "Fica fora o dia todo" },
  { value: 30, emoji: "🏠", label: "Residência comum" },
  { value: 45, emoji: "☀️", label: "Alguém em casa de dia" },
  { value: 60, emoji: "🏪", label: "Comércio / empresa" },
];

export function ProposalEditor({ proposal, initialLeadId }: { proposal?: Proposal; initialLeadId?: string | null }) {
  const router = useRouter();
  const { settings, settingsLoaded, user } = useApp();
  const { openLead } = useQuick();

  const [inputs, setInputs] = useState<ProposalInputs | null>(proposal ? mergeInputs(proposal.inputs) : null);
  const [leadId, setLeadId] = useState<string | null>(proposal?.lead_id ?? initialLeadId ?? null);
  const [title, setTitle] = useState(proposal?.title ?? "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [billValue, setBillValue] = useState(0);
  const current = useRef(proposal);
  current.current = proposal;

  const { data: leads } = useLive(async () => must(await supabase().from("leads").select("*").order("created_at", { ascending: false }).limit(1000)) as Lead[], [], ["leads"]);
  const lead = leads?.find((l) => l.id === leadId) ?? null;

  // Novo orçamento: parte dos padrões configurados + dados de consumo do lead.
  useEffect(() => {
    if (proposal || inputs || !settingsLoaded) return;
    setInputs(mergeInputs(settings.defaults));
  }, [proposal, inputs, settingsLoaded, settings.defaults]);

  const leadAppliedFor = useRef<string | null>(proposal?.lead_id ?? null);
  useEffect(() => {
    if (!lead || !inputs || leadAppliedFor.current === lead.id) return;
    leadAppliedFor.current = lead.id;
    setInputs((i) =>
      i && {
        ...i,
        consumptionKwh: lead.consumption_kwh ?? i.consumptionKwh,
        tariff: lead.tariff ?? i.tariff,
        connectionType: lead.connection_type ?? i.connectionType,
        structureType: lead.roof_type ?? i.structureType,
      },
    );
    if (lead.avg_bill) setBillValue(lead.avg_bill);
  }, [lead, inputs]);

  const pricing = useMemo(() => (inputs ? calcPricing(inputs) : null), [inputs]);
  const energy = useMemo(() => (inputs && pricing ? calcEnergy(inputs, pricing.finalPrice) : null), [inputs, pricing]);

  const set = <K extends keyof ProposalInputs>(k: K, v: ProposalInputs[K]) => {
    setInputs((i) => (i ? { ...i, [k]: v } : i));
    setDirty(true);
  };

  // Autosave para orçamentos já existentes.
  useEffect(() => {
    if (!dirty || !proposal) return;
    const t = setTimeout(() => save({ silent: true }), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs, title, leadId, dirty]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!inputs || !pricing || !energy) {
    return (
      <div className="grid h-[60vh] place-items-center text-ink-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  async function save(opts: { silent?: boolean; extra?: Partial<Proposal> } = {}): Promise<Proposal | null> {
    if (!inputs || !pricing || !energy) return null;
    if (!leadId) {
      toast.error("Selecione o cliente do orçamento");
      return null;
    }
    if (!pricing.valid) {
      toast.error(pricing.error ?? "Revise os valores do orçamento");
      return null;
    }
    setSaving(true);
    const row = {
      lead_id: leadId,
      title: title || null,
      inputs,
      power_kwp: pricing.powerKwp,
      monthly_generation: Math.round(energy.monthlyGeneration),
      direct_cost: pricing.directCost,
      commission_value: pricing.commissionValue,
      tax_value: pricing.taxValue,
      profit_value: pricing.profitValue,
      final_price: pricing.finalPrice,
      valid_until: current.current?.valid_until && current.current.status !== "rascunho" ? current.current.valid_until : addDays(inputs.validityDays),
      ...opts.extra,
    };
    const sb = supabase();
    const res = current.current
      ? await sb.from("proposals").update(row).eq("id", current.current.id).select("*").single()
      : await sb.from("proposals").insert({ ...row, created_by: user.id }).select("*").single();
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return null;
    }
    setDirty(false);
    const saved = res.data as Proposal;
    if (!current.current) {
      await sb.from("activities").insert({ lead_id: leadId, type: "proposta", content: `Orçamento #${saved.number} criado — ${brl(saved.final_price)}`, created_by: user.id });
      if (lead && lead.estimated_value == null) await sb.from("leads").update({ estimated_value: saved.final_price }).eq("id", lead.id);
      toast.success(`Orçamento #${saved.number} salvo`);
      router.replace(`/propostas/${saved.id}`);
    } else if (!opts.silent) {
      toast.success("Orçamento salvo");
    }
    return saved;
  }

  async function share(kind: "copy" | "whatsapp" | "open") {
    // Abre a janela antes do await para não ser bloqueada pelo navegador.
    const win = kind === "open" || kind === "whatsapp" ? window.open("about:blank", "_blank") : null;
    const draft = !current.current || current.current.status === "rascunho";
    const saved = await save({ silent: true, extra: draft ? { status: "enviada", sent_at: new Date().toISOString(), valid_until: addDays(inputs!.validityDays) } : {} });
    if (!saved) {
      win?.close();
      return;
    }
    const url = `${window.location.origin}/p/${saved.public_token}`;
    if (draft) {
      const sb = supabase();
      await sb.from("activities").insert({ lead_id: saved.lead_id, type: "proposta", content: `Proposta #${saved.number} enviada`, created_by: user.id });
      if (lead && ["novo", "contato", "visita"].includes(lead.status)) await sb.from("leads").update({ status: "proposta" }).eq("id", lead.id);
    }
    if (kind === "copy") {
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Link da proposta copiado");
    } else if (kind === "open") {
      if (win) win.location.href = url;
    } else {
      const first = lead?.name.split(" ")[0] ?? "";
      const msg = `Olá${first ? `, ${first}` : ""}! ☀️\n\nPreparei sua proposta de energia solar: sistema de ${fmtNum(pricing!.powerKwp, 2)} kWp, com economia estimada de ${brl(energy!.monthlySavings)} por mês.\n\nConfira todos os detalhes aqui:\n${url}`;
      const wa = whatsappUrl(lead?.phone, msg);
      if (win) win.location.href = wa;
    }
  }

  const status = proposal ? PROPOSAL_STATUS[proposal.status] : null;
  const suggested = energy.requiredModulesForConsumption;
  const inverterHint =
    pricing.powerKwp > 0
      ? `Para ${fmtNum(pricing.powerKwp, 2)} kWp, um inversor entre ${fmtNum(pricing.powerKwp / 1.35, 1)} e ${fmtNum(pricing.powerKwp / 1.05, 1)} kW é o ideal (relação CC/CA 1,05–1,35).`
      : "";

  return (
    <div className="animate-fade-up">
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/propostas" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-ink-500 shadow-soft ring-1 ring-ink-200 hover:text-ink-900">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-xl font-semibold tracking-tight sm:text-2xl">{proposal ? `Orçamento #${proposal.number}` : "Novo orçamento"}</h1>
              {status && <Badge className={status.cls}>{status.label}</Badge>}
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-500">
              {saving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
                </>
              ) : dirty ? (
                "Alterações não salvas"
              ) : proposal ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" /> Salvo automaticamente
                </>
              ) : (
                "Preencha os dados e salve para gerar a proposta"
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {proposal && (
            <>
              <Button variant="secondary" onClick={() => share("open")}>
                <ExternalLink className="h-4 w-4" /> Ver proposta
              </Button>
              <Button variant="secondary" onClick={() => share("copy")}>
                <Copy className="h-4 w-4" /> Copiar link
              </Button>
              <Button variant="secondary" onClick={() => share("whatsapp")} className="text-emerald-700">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
            </>
          )}
          <Button onClick={() => save()} loading={saving} className="hidden lg:inline-flex">
            {proposal ? "Salvar" : "Salvar orçamento"}
          </Button>
        </div>
      </div>

      <StepNav
        steps={[
          { id: "sec-cliente", label: "Cliente", done: !!leadId },
          { id: "sec-conta", label: "Conta de luz", done: inputs.consumptionKwh > 0 && inputs.tariff > 0 },
          { id: "sec-kit", label: "Kit", done: inputs.kitPrice > 0 && inputs.moduleQty > 0 && inputs.modulePowerW > 0 },
          { id: "sec-instalacao", label: "Instalação", done: inputs.laborPerModule > 0 },
          { id: "sec-preco", label: "Preço", done: pricing.valid && pricing.finalPrice > 0 },
          { id: "sec-condicoes", label: "Condições", done: inputs.financingTerms.length > 0 },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-5">
          {/* Cliente */}
          <Card id="sec-cliente" className="scroll-mt-28">
            <CardHeader icon={<User className="h-[18px] w-[18px]" />} title="1. Cliente" subtitle="Quem vai receber a proposta" />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              <Field label="Cliente *" className="sm:col-span-2">
                <LeadPicker leads={leads ?? []} value={leadId} onChange={(id) => { setLeadId(id); setDirty(true); }} onNew={() => openLead(null, { onCreated: (id) => { setLeadId(id); setDirty(true); } })} />
              </Field>
              <Field label="Título da proposta (opcional)" className="sm:col-span-2">
                <Input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} placeholder="Ex.: Residência — Telhado principal" />
              </Field>
            </div>
          </Card>

          {/* Conta de luz */}
          <Card id="sec-conta" className="scroll-mt-28">
            <CardHeader icon={<Receipt className="h-[18px] w-[18px]" />} title="2. Conta de luz" subtitle="Base da economia real — já considera fio B (Lei 14.300), taxa mínima e iluminação pública" />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              <Field label="Valor médio da conta" hint="Digite o valor e o consumo é calculado pela tarifa">
                <MoneyInput
                  value={billValue || null}
                  digits={0}
                  placeholder={energy.monthlyBillBefore ? fmtNum(energy.monthlyBillBefore) : "0"}
                  onChange={(v) => {
                    setBillValue(v);
                    if (inputs.tariff > 0 && v > 0) set("consumptionKwh", Math.round(Math.max(0, v - inputs.publicLighting) / inputs.tariff));
                  }}
                />
              </Field>
              <Field label="Consumo médio mensal" hint={lead?.avg_bill ? `Conta informada no cadastro: ${brl(lead.avg_bill)}` : "Média dos últimos 12 meses da fatura"}>
                <NumberInput value={inputs.consumptionKwh} onChange={(v) => set("consumptionKwh", v)} suffix="kWh" digits={0} />
              </Field>
              <Field label="Tarifa cheia (com impostos)" hint="Total da fatura ÷ kWh consumidos">
                <NumberInput value={inputs.tariff} onChange={(v) => set("tariff", v)} prefix="R$" suffix="/kWh" digits={3} />
              </Field>
              <Field label="Fio B da distribuidora" hint={`Em ${new Date().getFullYear()} o cliente paga ${fmtNum(energy.fioBPct * 100)}% do fio B sobre a energia compensada`}>
                <NumberInput value={inputs.fioBTariff} onChange={(v) => set("fioBTariff", v)} prefix="R$" suffix="/kWh" digits={3} />
              </Field>
              <Field label="Iluminação pública (CIP)" hint="Continua na conta mesmo com energia solar">
                <MoneyInput value={inputs.publicLighting} onChange={(v) => set("publicLighting", v)} />
              </Field>
              <Field label="Tipo de ligação" hint={`Taxa mínima: ${energy.availabilityKwh} kWh (${brl(energy.availabilityKwh * inputs.tariff)})`}>
                <Segmented
                  className="w-full [&>button]:flex-1"
                  value={inputs.connectionType}
                  onChange={(v) => set("connectionType", v)}
                  options={[
                    { value: "mono", label: "Mono" },
                    { value: "bi", label: "Bifásica" },
                    { value: "tri", label: "Trifásica" },
                  ]}
                />
              </Field>
              <Field label="Consumo durante o dia (simultaneidade)" hint="Energia usada na hora em que é gerada não paga fio B" className="sm:col-span-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SIMULTANEITY.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => set("selfConsumption", o.value)}
                      className={cx(
                        "rounded-xl px-3 py-2.5 text-left ring-1 transition",
                        inputs.selfConsumption === o.value ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-700 ring-ink-200 hover:ring-ink-300",
                      )}
                    >
                      <p className="text-sm font-semibold">
                        {o.emoji} {o.value}%
                      </p>
                      <p className={cx("text-[11px]", inputs.selfConsumption === o.value ? "text-ink-300" : "text-ink-500")}>{o.label}</p>
                    </button>
                  ))}
                </div>
              </Field>
              <BillPreview energy={energy} inputs={inputs} />
            </div>
          </Card>

          {/* Equipamentos */}
          <Card id="sec-kit" className="scroll-mt-28">
            <CardHeader icon={<SunMedium className="h-[18px] w-[18px]" />} title="3. Kit fotovoltaico" subtitle="Equipamentos e preço do distribuidor" />
            <div className="grid gap-5 px-5 pb-5">
              <Field label="Preço do kit">
                <MoneyInput value={inputs.kitPrice} onChange={(v) => set("kitPrice", v)} className="[&_input]:h-12 [&_input]:text-lg [&_input]:font-semibold" />
              </Field>

              <div className="rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-200/60">
                <p className="mb-3 text-xs font-bold tracking-wider text-ink-500 uppercase">Módulos (placas)</p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Marca" className="sm:col-span-2">
                    <Input list="module-brands" value={inputs.moduleBrand} onChange={(e) => set("moduleBrand", e.target.value)} placeholder="Ex.: JA Solar" />
                  </Field>
                  <Field label="Potência">
                    <NumberInput value={inputs.modulePowerW} onChange={(v) => set("modulePowerW", v)} suffix="W" digits={0} />
                  </Field>
                  <Field label="Quantidade">
                    <Stepper value={inputs.moduleQty} onChange={(v) => set("moduleQty", v)} />
                  </Field>
                  <div className="flex flex-wrap items-center gap-1.5 sm:col-span-4">
                    <span className="mr-1 text-xs text-ink-500">Potências comuns:</span>
                    {MODULE_POWERS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => set("modulePowerW", w)}
                        className={cx(
                          "h-7 rounded-lg px-2.5 text-xs font-semibold ring-1 transition",
                          inputs.modulePowerW === w ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-600 ring-ink-200 hover:ring-ink-300",
                        )}
                      >
                        {w} W
                      </button>
                    ))}
                  </div>
                  <Field label="Modelo (opcional)" className="sm:col-span-4">
                    <Input value={inputs.moduleModel} onChange={(e) => set("moduleModel", e.target.value)} placeholder="Ex.: JAM72D40 Bifacial" />
                  </Field>
                </div>
                {suggested > 0 && inputs.modulePowerW > 0 && suggested !== inputs.moduleQty && (
                  <button
                    type="button"
                    onClick={() => set("moduleQty", suggested)}
                    className="mt-3 flex w-full items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-left text-[13px] text-ink-600 ring-1 ring-sun-300/60 transition hover:ring-sun-400"
                  >
                    <Sparkles className="h-4 w-4 shrink-0 text-sun-500" />
                    <span>
                      Para compensar {fmtNum(inputs.consumptionKwh)} kWh/mês, o ideal são <b className="text-ink-900">{suggested} placas</b> (
                      {fmtNum((suggested * inputs.modulePowerW) / 1000, 2)} kWp).
                    </span>
                    <span className="ml-auto font-semibold text-sun-700">Aplicar</span>
                  </button>
                )}
              </div>

              <div className="rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-200/60">
                <p className="mb-3 text-xs font-bold tracking-wider text-ink-500 uppercase">Inversor</p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Marca" className="sm:col-span-2">
                    <Input list="inverter-brands" value={inputs.inverterBrand} onChange={(e) => set("inverterBrand", e.target.value)} placeholder="Ex.: Growatt" />
                  </Field>
                  <Field label="Potência">
                    <NumberInput value={inputs.inverterPowerKw} onChange={(v) => set("inverterPowerKw", v)} suffix="kW" digits={1} />
                  </Field>
                  <Field label="Quantidade">
                    <Stepper value={inputs.inverterQty} min={1} onChange={(v) => set("inverterQty", v)} />
                  </Field>
                  <Field label="Modelo (opcional)" className="sm:col-span-2">
                    <Input value={inputs.inverterModel} onChange={(e) => set("inverterModel", e.target.value)} placeholder="Ex.: MIN 6000TL-X" />
                  </Field>
                  {inverterHint && (
                    <p className="flex items-center gap-1.5 text-xs text-ink-500 sm:col-span-4">
                      <Sparkles className="h-3.5 w-3.5 text-sun-500" /> {inverterHint}
                    </p>
                  )}
                  <Field label="Estrutura / telhado" className="sm:col-span-2">
                    <Select value={inputs.structureType} onChange={(e) => set("structureType", e.target.value)}>
                      {ROOF_TYPES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Pill label="Potência do sistema" value={`${fmtNum(pricing.powerKwp, 2)} kWp`} />
                <Pill label="Geração média" value={`${fmtNum(energy.monthlyGeneration)} kWh/mês`} />
                <Pill label="Inversor total" value={`${fmtNum(pricing.inverterTotalKw, 1)} kW`} />
              </div>
            </div>
            <datalist id="module-brands">{MODULE_BRANDS.map((b) => <option key={b} value={b} />)}</datalist>
            <datalist id="inverter-brands">{INVERTER_BRANDS.map((b) => <option key={b} value={b} />)}</datalist>
          </Card>

          {/* Custos */}
          <Card id="sec-instalacao" className="scroll-mt-28">
            <CardHeader icon={<Hammer className="h-[18px] w-[18px]" />} title="4. Instalação" subtitle="Mão de obra, material elétrico e outros custos" />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              <Field label="Mão de obra por placa" hint={<Calc>{fmtNum(inputs.moduleQty)} placas × {brl(inputs.laborPerModule)} = <b>{brl(inputs.laborPerModule * inputs.moduleQty)}</b></Calc>}>
                <MoneyInput value={inputs.laborPerModule} onChange={(v) => set("laborPerModule", v)} />
              </Field>
              <Field label="Material elétrico por kWp" hint={<Calc>{fmtNum(pricing.powerKwp, 2)} kWp × {brl(inputs.electricalPerKwp)} = <b>{brl(inputs.electricalPerKwp * pricing.powerKwp)}</b></Calc>}>
                <MoneyInput value={inputs.electricalPerKwp} onChange={(v) => set("electricalPerKwp", v)} />
              </Field>
              <div className="sm:col-span-2">
                <p className="mb-2 text-[13px] font-medium text-ink-600">Outros custos</p>
                <div className="grid gap-2">
                  {inputs.extraCosts.map((c, idx) => (
                    <div key={c.id} className="flex gap-2">
                      <Input
                        value={c.label}
                        placeholder="Descrição (ex.: projeto e homologação)"
                        onChange={(e) => set("extraCosts", inputs.extraCosts.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))}
                      />
                      <MoneyInput className="w-44 shrink-0" value={c.value} onChange={(v) => set("extraCosts", inputs.extraCosts.map((x, i) => (i === idx ? { ...x, value: v } : x)))} />
                      <Button variant="ghost" size="icon" type="button" onClick={() => set("extraCosts", inputs.extraCosts.filter((_, i) => i !== idx))} aria-label="Remover">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" type="button" onClick={() => set("extraCosts", [...inputs.extraCosts, { id: crypto.randomUUID(), label: "", value: 0 }])}>
                      <Plus className="h-3.5 w-3.5" /> Adicionar custo
                    </Button>
                    {["Projeto e homologação", "Frete", "Deslocamento", "Estrutura adicional"]
                      .filter((s) => !inputs.extraCosts.some((c) => c.label === s))
                      .slice(0, 3)
                      .map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => set("extraCosts", [...inputs.extraCosts, { id: crypto.randomUUID(), label: s, value: 0 }])}
                          className="h-8 rounded-lg px-2.5 text-xs font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                        >
                          + {s}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Preço */}
          <Card id="sec-preco" className="scroll-mt-28">
            <CardHeader icon={<Percent className="h-[18px] w-[18px]" />} title="5. Formação de preço" subtitle="Percentuais incidem sobre o preço final de venda" />
            <div className="grid gap-4 px-5 pb-5">
              <PriceComp label="Comissão" value={inputs.commission} amount={pricing.commissionValue} onChange={(v) => set("commission", v)} />
              <PriceComp label="Impostos" value={inputs.tax} amount={pricing.taxValue} onChange={(v) => set("tax", v)} />
              <PriceComp label="Lucro" value={inputs.profit} amount={pricing.profitValue} onChange={(v) => set("profit", v)} />
              <div className="grid gap-4 border-t border-ink-100 pt-4 sm:grid-cols-2">
                <Field label="Desconto ao cliente" hint="Sai do lucro">
                  <MoneyInput value={inputs.discount} onChange={(v) => set("discount", v)} />
                </Field>
                <Field label="Arredondar preço final para cima">
                  <Segmented
                    className="w-full [&>button]:flex-1"
                    value={String(inputs.roundTo)}
                    onChange={(v) => set("roundTo", Number(v))}
                    options={[
                      { value: "0", label: "Não" },
                      { value: "10", label: "R$ 10" },
                      { value: "50", label: "R$ 50" },
                      { value: "100", label: "R$ 100" },
                    ]}
                  />
                </Field>
              </div>
            </div>
          </Card>

          {/* Condições */}
          <Card id="sec-condicoes" className="scroll-mt-28">
            <CardHeader icon={<Wallet className="h-[18px] w-[18px]" />} title="6. Condições comerciais" subtitle="Aparecem na proposta do cliente" />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              <Field label="Validade da proposta">
                <NumberInput value={inputs.validityDays} onChange={(v) => set("validityDays", v)} suffix="dias" digits={0} />
              </Field>
              <Field label="Do pagamento à homologação" hint="Cronograma da obra na proposta">
                <NumberInput value={inputs.installationDays} onChange={(v) => set("installationDays", v)} suffix="dias" digits={0} />
              </Field>
              <Field label="Taxa do financiamento">
                <NumberInput value={inputs.financingRate} onChange={(v) => set("financingRate", v)} suffix="% a.m." />
              </Field>
              <Field label="Cartão de crédito">
                <div className="flex gap-2">
                  <NumberInput className="flex-1" value={inputs.cardInstallments} onChange={(v) => set("cardInstallments", v)} suffix="x" digits={0} />
                  <NumberInput className="flex-1" value={inputs.cardRate} onChange={(v) => set("cardRate", v)} suffix="% a.m." />
                </div>
              </Field>
              <Field label="Prazos do financiamento" className="sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  {TERMS.map((t) => {
                    const on = inputs.financingTerms.includes(t);
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => set("financingTerms", on ? inputs.financingTerms.filter((x) => x !== t) : [...inputs.financingTerms, t].sort((a, b) => a - b))}
                        className={cx("h-8 rounded-lg px-3 text-[13px] font-semibold ring-1 transition", on ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-500 ring-ink-200 hover:ring-ink-300")}
                      >
                        {t}x
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Observações de pagamento (aparece na proposta)" className="sm:col-span-2">
                <Textarea value={inputs.paymentNotes} onChange={(e) => set("paymentNotes", e.target.value)} placeholder="Ex.: 50% de entrada e 50% na instalação. Aceitamos PIX, boleto e cartão." />
              </Field>
              <Field label="Anotações internas (não aparece na proposta)" className="sm:col-span-2">
                <Textarea value={inputs.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>
          </Card>

          {/* Premissas */}
          <Collapsible icon={<Settings2 className="h-[18px] w-[18px]" />} title="Premissas técnicas" subtitle="Irradiação, perdas e projeções financeiras">
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
              <Field label="Irradiação (HSP)" hint="Média anual da cidade (CRESESB)">
                <NumberInput value={inputs.sunHours} onChange={(v) => set("sunHours", v)} suffix="kWh/m²" />
              </Field>
              <Field label="Performance ratio" hint="Eficiência global (0,75–0,85)">
                <NumberInput value={inputs.performanceRatio} onChange={(v) => set("performanceRatio", v)} digits={2} />
              </Field>
              <Field label="Reajuste da tarifa">
                <NumberInput value={inputs.tariffIncrease} onChange={(v) => set("tariffIncrease", v)} suffix="% a.a." digits={1} />
              </Field>
              <Field label="Degradação dos módulos">
                <NumberInput value={inputs.degradation} onChange={(v) => set("degradation", v)} suffix="% a.a." digits={1} />
              </Field>
            </div>
          </Collapsible>
        </div>

        {/* Checkout desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-8 grid gap-3">
            <Checkout inputs={inputs} pricing={pricing} energy={energy} />
            <p className="px-2 text-center text-xs text-ink-500">
              <Receipt className="mr-1 inline h-3.5 w-3.5" />
              Na proposta do cliente aparece somente o <b>preço final</b>.
            </p>
          </div>
        </aside>
      </div>

      {/* Barra mobile */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-ink-200/70 bg-white/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => setSheet(true)} className="min-w-0 flex-1 text-left">
            <p className="flex items-center gap-1 text-[11px] font-semibold text-ink-500">
              Preço final <ChevronDown className="h-3 w-3 rotate-180" />
            </p>
            <p className="tnum font-display text-xl font-semibold tracking-tight">{pricing.valid ? brl(pricing.finalPrice) : "—"}</p>
          </button>
          <Button variant="secondary" onClick={() => setSheet(true)}>
            <FileText className="h-4 w-4" /> Detalhes
          </Button>
          <Button onClick={() => save()} loading={saving}>
            Salvar
          </Button>
        </div>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={() => setSheet(false)} />
          <div className="animate-sheet-up absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-ink-950 pb-[env(safe-area-inset-bottom)]">
            <button onClick={() => setSheet(false)} className="absolute top-4 right-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
            <Checkout inputs={inputs} pricing={pricing} energy={energy} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ subcomponentes */

function Calc({ children }: { children: ReactNode }) {
  return <span className="tnum [&_b]:font-semibold [&_b]:text-ink-800">{children}</span>;
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-sun-50 px-3 py-2.5 ring-1 ring-sun-200/70">
      <p className="text-[11px] font-medium text-sun-800/80">{label}</p>
      <p className="tnum mt-0.5 text-sm font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function Stepper({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="flex h-11 items-center rounded-xl bg-white ring-1 ring-ink-200 focus-within:ring-2 focus-within:ring-sun-500 sm:h-10">
      <button type="button" className="h-full w-9 shrink-0 text-lg text-ink-400 hover:text-ink-900" onClick={() => onChange(Math.max(min, (value || 0) - 1))} aria-label="Menos">
        −
      </button>
      <input
        inputMode="numeric"
        className="tnum h-full w-full min-w-0 bg-transparent text-center text-[15px] font-semibold focus:outline-none sm:text-sm"
        value={value || ""}
        placeholder="0"
        onChange={(e) => onChange(Math.max(min, parseInt(e.target.value.replace(/\D/g, "") || "0", 10)))}
      />
      <button type="button" className="h-full w-9 shrink-0 text-lg text-ink-400 hover:text-ink-900" onClick={() => onChange((value || 0) + 1)} aria-label="Mais">
        +
      </button>
    </div>
  );
}

function PriceComp({ label, value, amount, onChange }: { label: string; value: PriceComponent; amount: number; onChange: (v: PriceComponent) => void }) {
  return (
    <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <Field label={label}>
        {value.mode === "percent" ? (
          <NumberInput value={value.value} onChange={(v) => onChange({ ...value, value: v })} suffix="%" />
        ) : (
          <MoneyInput value={value.value} onChange={(v) => onChange({ ...value, value: v })} />
        )}
      </Field>
      <Segmented<AmountMode>
        size="sm"
        className="h-10 items-center sm:h-10"
        value={value.mode}
        onChange={(mode) => onChange({ mode, value: mode === value.mode ? value.value : mode === "fixed" ? Math.round(amount) : 0 })}
        options={[
          { value: "percent", label: "%" },
          { value: "fixed", label: "R$" },
        ]}
      />
      <div className="flex h-10 items-center justify-between rounded-xl bg-ink-50 px-3.5 ring-1 ring-ink-200/60">
        <span className="text-xs text-ink-500">Valor</span>
        <span className={cx("tnum text-sm font-semibold", amount < 0 ? "text-rose-600" : "text-ink-900")}>{brl(amount)}</span>
      </div>
    </div>
  );
}

function Collapsible({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button type="button" className="w-full text-left" onClick={() => setOpen((o) => !o)}>
        <CardHeader icon={icon} title={title} subtitle={subtitle} action={<ChevronDown className={cx("mt-2 h-5 w-5 text-ink-400 transition", open && "rotate-180")} />} />
      </button>
      {open && children}
    </Card>
  );
}

function LeadPicker({ leads, value, onChange, onNew }: { leads: Lead[]; value: string | null; onChange: (id: string) => void; onNew: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = leads.find((l) => l.id === value);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = leads.filter((l) => `${l.name} ${l.city ?? ""} ${l.phone ?? ""}`.toLowerCase().includes(q.toLowerCase())).slice(0, 50);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-full items-center gap-3 rounded-xl bg-white px-3.5 text-left ring-1 ring-ink-200 transition hover:ring-ink-300 focus:ring-2 focus:ring-sun-500 focus:outline-none"
      >
        {selected ? (
          <>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-ink-900 text-xs font-bold text-white">{selected.name[0]?.toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{selected.name}</p>
              <p className="truncate text-xs text-ink-500">{[selected.city, formatPhone(selected.phone)].filter(Boolean).join(" · ") || "Sem contato"}</p>
            </div>
          </>
        ) : (
          <span className="flex-1 text-sm text-ink-400">Selecione um cliente…</span>
        )}
        <ChevronDown className="h-4 w-4 text-ink-400" />
      </button>
      {open && (
        <div className="animate-fade-up absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-ink-200">
          <div className="flex items-center gap-2 border-b border-ink-100 px-3.5">
            <Search className="h-4 w-4 text-ink-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, cidade ou telefone" className="h-11 w-full bg-transparent text-sm focus:outline-none" />
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {filtered.map((l) => (
              <button
                type="button"
                key={l.id}
                onClick={() => {
                  onChange(l.id);
                  setOpen(false);
                  setQ("");
                }}
                className={cx("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-ink-50", l.id === value && "bg-sun-50")}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  <p className="truncate text-xs text-ink-500">{[l.city, l.consumption_kwh ? `${fmtNum(l.consumption_kwh)} kWh/mês` : null].filter(Boolean).join(" · ")}</p>
                </div>
                {l.id === value && <Check className="h-4 w-4 text-sun-600" />}
              </button>
            ))}
            {!filtered.length && <p className="px-3 py-6 text-center text-sm text-ink-500">Nenhum lead encontrado</p>}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onNew();
            }}
            className="flex w-full items-center gap-2 border-t border-ink-100 px-4 py-3 text-sm font-semibold text-sun-700 hover:bg-sun-50"
          >
            <Plus className="h-4 w-4" /> Cadastrar novo lead
          </button>
        </div>
      )}
    </div>
  );
}
