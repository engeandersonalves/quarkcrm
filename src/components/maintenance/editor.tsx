"use client";

import {
  ArrowLeft,
  BookmarkCheck,
  CalendarClock,
  Check,
  ClipboardCheck,
  Copy,
  CopyPlus,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircle,
  Percent,
  Plus,
  Receipt,
  Repeat,
  Sun,
  Trash2,
  User,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { useReward } from "@/components/app/rewards";
import { useQuick } from "@/components/app/shell";
import { StepNav } from "@/components/proposal/checkout";
import { LeadPicker, PriceComp } from "@/components/proposal/editor";
import { TrackingCard } from "@/components/proposal/tracking-card";
import { ViewStatus } from "@/components/proposal/view-status";
import { Badge, Button, Card, CardHeader, Field, ImageField, Input, MoneyInput, NumberInput, Segmented, Select, Switch, Textarea, cx } from "@/components/ui";
import { PROPOSAL_STATUS } from "@/lib/constants";
import { DEFAULT_INPUTS, toStoredSettings } from "@/lib/defaults";
import { addDays, whatsappUrl } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import {
  ACCESS_LABEL,
  BASIS_LABEL,
  MAINT_CATEGORIES,
  MAINT_SECTIONS,
  SEVERITY,
  TRACK_CLICKS,
  basisOf,
  buildClientItems,
  calcMaint,
  catalogOf,
  kwpOf,
  mergeMaint,
  planOf,
  qtyOf,
  soilingLoss,
  type FindingSeverity,
  type MaintCategory,
  type MaintFinding,
  type MaintInputs,
  type MaintItem,
} from "@/lib/maintenance";
import { brl, fmtNum, pct } from "@/lib/pricing";
import { duplicateProposal } from "@/lib/proposal-actions";
import { supabase } from "@/lib/supabase/client";
import type { Lead, Proposal } from "@/lib/types";

const STRUCTURES = ["Telhado cerâmico", "Telhado de fibrocimento", "Telhado metálico", "Laje", "Solo", "Carport"];
const QUICK_FINDINGS: { title: string; severity: FindingSeverity }[] = [
  { title: "Módulos com sujeira acumulada", severity: "atencao" },
  { title: "Conector MC4 com sinais de aquecimento", severity: "critico" },
  { title: "DPS com sinalizador de fim de vida", severity: "critico" },
  { title: "Bornes oxidados no quadro", severity: "atencao" },
  { title: "Inversor sem monitoramento", severity: "atencao" },
  { title: "Aterramento sem medição registrada", severity: "atencao" },
  { title: "Cabos expostos ao sol sem proteção", severity: "atencao" },
  { title: "Estrutura firme e sem corrosão", severity: "ok" },
];
const CAT_ORDER = Object.keys(MAINT_CATEGORIES) as MaintCategory[];

export function MaintenanceEditor({ proposal, initialLeadId }: { proposal?: Proposal; initialLeadId?: string | null }) {
  const router = useRouter();
  const { settings, settingsLoaded, user, profile } = useApp();
  const isAdmin = profile?.role === "admin";
  const { openLead } = useQuick();
  const { reward } = useReward();

  const [inputs, setInputs] = useState<MaintInputs | null>(proposal ? mergeMaint(proposal.inputs as Partial<MaintInputs>) : null);
  const [leadId, setLeadId] = useState<string | null>(proposal?.lead_id ?? initialLeadId ?? null);
  const [title, setTitle] = useState(proposal?.title ?? "");
  const [saving, setSaving] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sheet, setSheet] = useState(false);
  const current = useRef(proposal);
  current.current = proposal;

  const { data: leads } = useLive(async () => must(await supabase().from("leads").select("*").order("created_at", { ascending: false }).limit(1000)) as Lead[], [], ["leads"]);
  const lead = leads?.find((l) => l.id === leadId) ?? null;

  useEffect(() => {
    if (proposal || inputs || !settingsLoaded) return;
    const solar = { ...DEFAULT_INPUTS, ...settings.defaults };
    setInputs(mergeMaint({ tariff: solar.tariff, sunHours: solar.sunHours, performanceRatio: solar.performanceRatio }, settings.maintDefaults));
  }, [proposal, inputs, settingsLoaded, settings.defaults, settings.maintDefaults]);

  const result = useMemo(() => (inputs ? calcMaint(inputs) : null), [inputs]);

  const set = <K extends keyof MaintInputs>(k: K, v: MaintInputs[K]) => {
    setInputs((i) => (i ? { ...i, [k]: v } : i));
    setDirty(true);
  };
  const setItem = (id: string, patch: Partial<MaintItem>) => {
    setInputs((i) => (i ? { ...i, extraCosts: i.extraCosts.map((it) => (it.id === id ? { ...it, ...patch } : it)) } : i));
    setDirty(true);
  };
  const setFinding = (id: string, patch: Partial<MaintFinding>) => {
    setInputs((i) => (i ? { ...i, findings: i.findings.map((f) => (f.id === id ? { ...f, ...patch } : f)) } : i));
    setDirty(true);
  };

  useEffect(() => {
    if (!dirty || !proposal) return;
    const t = setTimeout(() => save({ silent: true }), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs, title, leadId, dirty]);

  if (!inputs || !result) {
    return (
      <div className="grid h-[60vh] place-items-center text-ink-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const kwp = kwpOf(inputs);
  const loss = soilingLoss(inputs);
  const plan = planOf(result.finalPrice, inputs);

  async function save(opts: { silent?: boolean; extra?: Partial<Proposal> } = {}): Promise<Proposal | null> {
    if (!inputs || !result) return null;
    if (!leadId) {
      toast.error("Selecione o cliente do orçamento");
      return null;
    }
    if (!result.valid) {
      toast.error(result.error ?? "Revise os valores do orçamento");
      return null;
    }
    setSaving(true);
    const synced: MaintInputs = {
      ...inputs,
      extraCosts: inputs.extraCosts.map((it) => ({ ...it, value: qtyOf(it, inputs) * it.unit })),
      clientItems: buildClientItems(inputs, result),
    };
    const row = {
      lead_id: leadId,
      title: title || null,
      inputs: synced,
      power_kwp: Math.round(kwp * 100) / 100,
      monthly_generation: Math.round(loss.monthlyKwh),
      direct_cost: result.directCost,
      commission_value: result.commissionValue,
      tax_value: result.taxValue,
      profit_value: result.profitValue,
      final_price: result.finalPrice,
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
      await sb.from("activities").insert({ lead_id: leadId, type: "proposta", content: `Orçamento de manutenção #${saved.number} criado — ${brl(saved.final_price)}`, created_by: user.id });
      toast.success(`Orçamento de manutenção #${saved.number} salvo`);
      router.replace(`/propostas/${saved.id}`);
      reward("proposta", saved.id);
    } else if (!opts.silent) {
      toast.success("Orçamento salvo");
    }
    return saved;
  }

  async function share(kind: "copy" | "whatsapp" | "open") {
    const win = kind === "open" || kind === "whatsapp" ? window.open("about:blank", "_blank") : null;
    const draft = !current.current || current.current.status === "rascunho";
    const saved = await save({ silent: true, extra: draft ? { status: "enviada", sent_at: new Date().toISOString(), valid_until: addDays(inputs!.validityDays) } : {} });
    if (!saved) {
      win?.close();
      return;
    }
    const url = `${window.location.origin}/p/${saved.public_token}`;
    if (draft) {
      reward("envio", saved.id);
      const sb = supabase();
      await sb.from("activities").insert({ lead_id: saved.lead_id, type: "proposta", content: `Proposta de manutenção #${saved.number} enviada`, created_by: user.id });
      if (lead && ["novo", "contato", "visita"].includes(lead.status)) await sb.from("leads").update({ status: "proposta" }).eq("id", lead.id);
    }
    if (kind === "copy") {
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Link da proposta copiado");
    } else if (kind === "open") {
      if (win) win.location.href = url;
    } else {
      const first = lead?.name.split(" ")[0] ?? "";
      const msg = `Olá${first ? `, ${first}` : ""}! Segue a proposta de manutenção do seu sistema solar de ${fmtNum(kwp, 2)} kWp: limpeza das placas, revisão elétrica completa e relatório técnico.\n\nDetalhes, fotos e aceite online:\n${url}`;
      if (win) win.location.href = whatsappUrl(lead?.phone, msg);
    }
  }

  async function saveAsDefault() {
    if (!inputs) return;
    setSavingDefaults(true);
    const {
      extraCosts,
      commission,
      tax,
      profit,
      roundTo,
      highlights,
      conditions,
      validityDays,
      serviceWarrantyDays,
      paymentNotes,
      cardInstallments,
      cardRate,
      planEnabled,
      planVisitsYear,
      planDiscountPct,
      soilingPct,
      showItemPrices,
      serviceHours,
      scheduleDays,
      coverImage,
    } = inputs;
    const maintDefaults: Partial<MaintInputs> = {
      extraCosts: extraCosts.map((it) => ({ ...it, value: 0 })),
      commission,
      tax,
      profit,
      roundTo,
      highlights,
      conditions,
      validityDays,
      serviceWarrantyDays,
      paymentNotes,
      cardInstallments,
      cardRate,
      planEnabled,
      planVisitsYear,
      planDiscountPct,
      soilingPct,
      showItemPrices,
      serviceHours,
      scheduleDays,
      coverImage,
    };
    const { error } = await supabase().from("settings").upsert({ id: 1, data: toStoredSettings({ ...settings, maintDefaults }) });
    setSavingDefaults(false);
    if (error) toast.error(error.message);
    else toast.success("Padrão salvo: os próximos orçamentos de manutenção já começam com estes preços e condições");
  }

  const status = proposal ? PROPOSAL_STATUS[proposal.status] : null;
  const onCount = inputs.extraCosts.filter((it) => it.on).length;

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/propostas?tipo=manutencao" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-ink-500 shadow-soft ring-1 ring-ink-200 hover:text-ink-900" aria-label="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-sun-gradient text-ink-900">
                <Wrench className="h-4 w-4" />
              </span>
              <h1 className="truncate font-display text-xl font-semibold tracking-tight sm:text-2xl">{proposal ? `Manutenção #${proposal.number}` : "Novo orçamento de manutenção"}</h1>
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
                "Limpeza, revisão elétrica e manutenção preventiva"
              )}
            </p>
            {proposal && <ViewStatus id={proposal.id} className="mt-1.5" />}
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
              <Button
                variant="secondary"
                title="Criar uma cópia deste orçamento"
                onClick={async () => {
                  if (dirty) await save({ silent: true });
                  try {
                    const copy = await duplicateProposal(proposal.id, user.id);
                    toast.success(`Cópia criada: #${copy.number}`);
                    router.push(`/propostas/${copy.id}`);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Não foi possível duplicar");
                  }
                }}
              >
                <CopyPlus className="h-4 w-4" /> Duplicar
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
          { id: "m-cliente", label: "Cliente", done: !!leadId },
          { id: "m-sistema", label: "Sistema", done: inputs.moduleQty > 0 },
          { id: "m-diagnostico", label: "Diagnóstico", done: inputs.findings.length > 0 },
          { id: "m-servicos", label: "Serviços", done: onCount > 0 },
          { id: "m-preco", label: "Preço", done: result.valid && result.finalPrice > 0 },
          { id: "m-plano", label: "Plano", done: !!plan },
          { id: "m-proposta", label: "Proposta", done: inputs.validityDays > 0 },
        ]}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-5">
          {/* 1. Cliente */}
          <Card id="m-cliente" className="scroll-mt-28">
            <CardHeader icon={<User className="h-[18px] w-[18px]" />} title="1. Cliente" subtitle="Quem vai receber a proposta" />
            <div className="grid gap-4 px-5 pb-5">
              <Field label="Cliente *">
                <LeadPicker
                  leads={leads ?? []}
                  value={leadId}
                  onChange={(id) => {
                    setLeadId(id);
                    setDirty(true);
                  }}
                  onNew={() =>
                    openLead(null, {
                      onCreated: (id) => {
                        setLeadId(id);
                        setDirty(true);
                      },
                    })
                  }
                />
              </Field>
              <Field label="Título da proposta (opcional)">
                <Input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="Ex.: Manutenção preventiva · residência"
                />
              </Field>
            </div>
          </Card>

          {/* 2. Sistema */}
          <Card id="m-sistema" className="scroll-mt-28">
            <CardHeader icon={<Sun className="h-[18px] w-[18px]" />} title="2. Sistema do cliente" subtitle="As quantidades dos serviços acompanham estes dados" action={<Badge className="bg-sun-50 text-sun-800 ring-sun-600/20">{fmtNum(kwp, 2)} kWp</Badge>} />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-4">
              <Field label="Módulos">
                <NumberInput value={inputs.moduleQty} onChange={(v) => set("moduleQty", v)} suffix="un" digits={0} />
              </Field>
              <Field label="Potência do módulo">
                <NumberInput value={inputs.modulePowerW} onChange={(v) => set("modulePowerW", v)} suffix="W" digits={0} />
              </Field>
              <Field label="Strings">
                <NumberInput value={inputs.stringQty} onChange={(v) => set("stringQty", v)} suffix="un" digits={0} />
              </Field>
              <Field label="Inversores">
                <NumberInput value={inputs.inverterQty} onChange={(v) => set("inverterQty", v)} suffix="un" digits={0} />
              </Field>
              <Field label="Quadros elétricos" hint="String box + quadro CA">
                <NumberInput value={inputs.panelQty} onChange={(v) => set("panelQty", v)} suffix="un" digits={0} />
              </Field>
              <Field label="Marca do inversor">
                <Input value={inputs.inverterBrand} onChange={(e) => set("inverterBrand", e.target.value)} placeholder="Ex.: Growatt" />
              </Field>
              <Field label="Marca dos módulos">
                <Input value={inputs.moduleBrand} onChange={(e) => set("moduleBrand", e.target.value)} placeholder="Ex.: Canadian" />
              </Field>
              <Field label="Instalado em">
                <NumberInput value={inputs.installYear || null} onChange={(v) => set("installYear", v)} digits={0} placeholder="Ano" />
              </Field>
              <Field label="Estrutura" className="sm:col-span-2">
                <Select value={inputs.structure} onChange={(e) => set("structure", e.target.value)}>
                  {STRUCTURES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Acesso ao telhado" className="sm:col-span-2">
                <Segmented
                  className="w-full [&>button]:flex-1"
                  value={inputs.roofAccess}
                  onChange={(v) => set("roofAccess", v)}
                  options={(Object.keys(ACCESS_LABEL) as MaintInputs["roofAccess"][]).map((k) => ({ value: k, label: ACCESS_LABEL[k].split(" ")[0] }))}
                />
              </Field>
              <Field label="Última limpeza" className="sm:col-span-2">
                <Input value={inputs.lastCleaning} onChange={(e) => set("lastCleaning", e.target.value)} placeholder="Ex.: nunca foi feita / há 1 ano" />
              </Field>
              <Field label="Distância até o cliente" hint="Ida; a volta é somada sozinha">
                <NumberInput value={inputs.distanceKm} onChange={(v) => set("distanceKm", v)} suffix="km" digits={0} />
              </Field>
              <div className="flex items-end pb-1">
                <Switch checked={inputs.hasMonitoring} onChange={(v) => set("hasMonitoring", v)} label="Já tem app ativo" />
              </div>
            </div>
          </Card>

          {/* 3. Diagnóstico */}
          <Card id="m-diagnostico" className="scroll-mt-28">
            <CardHeader icon={<ClipboardCheck className="h-[18px] w-[18px]" />} title="3. Diagnóstico da vistoria" subtitle="Opcional: fotos e achados aparecem na proposta com selo de gravidade" />
            <div className="grid gap-3 px-5 pb-5">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_FINDINGS.filter((q) => !inputs.findings.some((f) => f.title === q.title)).map((q) => (
                  <button
                    key={q.title}
                    type="button"
                    onClick={() => set("findings", [...inputs.findings, { id: crypto.randomUUID(), title: q.title, text: "", severity: q.severity, photo: "" }])}
                    className="inline-flex items-center gap-1 rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-700 ring-1 ring-ink-200 transition hover:ring-sun-400"
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEVERITY[q.severity].color }} />
                    <Plus className="h-3 w-3" /> {q.title}
                  </button>
                ))}
              </div>
              {inputs.findings.map((f) => (
                <div key={f.id} className="grid gap-3 rounded-2xl bg-ink-50 p-3 ring-1 ring-ink-200/60 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <ImageField value={f.photo} onChange={(v) => setFinding(f.id, { photo: v })} folder="manutencao" aspect="aspect-[4/3]" label="Foto" />
                  <div className="grid content-start gap-2">
                    <div className="flex gap-2">
                      <Input value={f.title} onChange={(e) => setFinding(f.id, { title: e.target.value })} placeholder="O que foi encontrado" className="h-9 flex-1" />
                      <Button variant="ghost" size="icon" onClick={() => set("findings", inputs.findings.filter((x) => x.id !== f.id))} aria-label="Remover achado">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Segmented
                      className="w-full [&>button]:flex-1"
                      value={f.severity}
                      onChange={(v) => setFinding(f.id, { severity: v })}
                      options={(Object.keys(SEVERITY) as FindingSeverity[]).map((k) => ({ value: k, label: SEVERITY[k].label }))}
                    />
                    <Textarea value={f.text} onChange={(e) => setFinding(f.id, { text: e.target.value })} placeholder="Detalhe para o cliente (opcional)" className="min-h-[60px]" />
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="justify-self-start"
                onClick={() => set("findings", [...inputs.findings, { id: crypto.randomUUID(), title: "", text: "", severity: "atencao", photo: "" }])}
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar achado
              </Button>
            </div>
          </Card>

          {/* 4. Serviços */}
          <Card id="m-servicos" className="scroll-mt-28">
            <CardHeader
              icon={<Wrench className="h-[18px] w-[18px]" />}
              title="4. Serviços e custos"
              subtitle="Ligue o que entra na visita · valores são custo, o cliente não vê"
              action={<Badge className="bg-ink-100 text-ink-700 ring-ink-500/15">{onCount} ativos</Badge>}
            />
            <div className="grid gap-5 px-5 pb-5">
              {CAT_ORDER.map((cat) => {
                const items = inputs.extraCosts.filter((it) => (catalogOf(it.key)?.category ?? "entrega") === cat && it.key !== "custom");
                if (!items.length) return null;
                return (
                  <div key={cat}>
                    <p className="mb-2 text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">{MAINT_CATEGORIES[cat].label}</p>
                    <div className="grid gap-2">
                      {items.map((it) => (
                        <ServiceRow key={it.id} it={it} inputs={inputs} onChange={(p) => setItem(it.id, p)} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {inputs.extraCosts.some((it) => it.key === "custom") && (
                <div>
                  <p className="mb-2 text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">Outros serviços</p>
                  <div className="grid gap-2">
                    {inputs.extraCosts
                      .filter((it) => it.key === "custom")
                      .map((it) => (
                        <ServiceRow key={it.id} it={it} inputs={inputs} onChange={(p) => setItem(it.id, p)} onRemove={() => set("extraCosts", inputs.extraCosts.filter((x) => x.id !== it.id))} />
                      ))}
                  </div>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="justify-self-start"
                onClick={() => set("extraCosts", [...inputs.extraCosts, { id: crypto.randomUUID(), key: "custom", label: "", qty: 1, unit: 0, value: 0, on: true, basis: "unidade" }])}
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar serviço
              </Button>
            </div>
          </Card>

          {/* 5. Preço */}
          <Card id="m-preco" className="scroll-mt-28">
            <CardHeader icon={<Percent className="h-[18px] w-[18px]" />} title="5. Formação de preço" subtitle="Percentuais incidem sobre o preço final de venda" />
            <div className="grid gap-4 px-5 pb-5">
              <PriceComp label="Comissão" value={inputs.commission} amount={result.commissionValue} onChange={(v) => set("commission", v)} />
              <PriceComp label="Impostos" value={inputs.tax} amount={result.taxValue} onChange={(v) => set("tax", v)} />
              <PriceComp label="Lucro" value={inputs.profit} amount={result.profitValue} onChange={(v) => set("profit", v)} />
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
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3 ring-1 ring-ink-200/60">
                <div>
                  <p className="text-sm font-semibold">Mostrar o valor de cada serviço na proposta</p>
                  <p className="text-xs text-ink-500">Valores de venda, proporcionais ao preço final. Custos e margem continuam ocultos.</p>
                </div>
                <Switch checked={inputs.showItemPrices} onChange={(v) => set("showItemPrices", v)} />
              </label>
            </div>
          </Card>

          {/* 6. Plano */}
          <Card id="m-plano" className="scroll-mt-28">
            <CardHeader icon={<Repeat className="h-[18px] w-[18px]" />} title="6. Plano de manutenção preventiva" subtitle="Oferta de visitas recorrentes com desconto" action={<Switch checked={inputs.planEnabled} onChange={(v) => set("planEnabled", v)} />} />
            {inputs.planEnabled && (
              <div className="grid gap-4 px-5 pb-5 sm:grid-cols-[1fr_1fr_1.2fr] sm:items-end">
                <Field label="Visitas por ano">
                  <Segmented
                    className="w-full [&>button]:flex-1"
                    value={String(inputs.planVisitsYear)}
                    onChange={(v) => set("planVisitsYear", Number(v))}
                    options={[
                      { value: "2", label: "2" },
                      { value: "3", label: "3" },
                      { value: "4", label: "4" },
                    ]}
                  />
                </Field>
                <Field label="Desconto por visita">
                  <NumberInput value={inputs.planDiscountPct} onChange={(v) => set("planDiscountPct", v)} suffix="%" digits={0} />
                </Field>
                {plan && (
                  <div className="rounded-xl bg-sun-50 px-4 py-2.5 ring-1 ring-sun-600/20">
                    <p className="text-xs text-ink-500">{plan.visits} visitas de</p>
                    <p className="tnum font-display text-lg font-semibold">
                      {brl(plan.perVisit)} <span className="text-xs font-normal text-ink-500">· {brl(plan.year, 0)}/ano</span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* 7. Proposta */}
          <Card id="m-proposta" className="scroll-mt-28">
            <CardHeader icon={<Wallet className="h-[18px] w-[18px]" />} title="7. Proposta, condições e garantia" subtitle="Aparece na proposta do cliente" />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              <div className="rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-200/60 sm:col-span-2">
                <p className="text-sm font-semibold">Estimativa de perda por sujeira</p>
                <p className="mt-0.5 text-xs text-ink-500">Mostrada na proposta como “quanto a sujeira está custando”. Seja conservador.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Field label="Perda estimada">
                    <NumberInput value={inputs.soilingPct} onChange={(v) => set("soilingPct", v)} suffix="%" digits={0} />
                  </Field>
                  <Field label="Tarifa">
                    <MoneyInput value={inputs.tariff} onChange={(v) => set("tariff", v)} suffix="/kWh" />
                  </Field>
                  <Field label="Sol pleno">
                    <NumberInput value={inputs.sunHours} onChange={(v) => set("sunHours", v)} suffix="h/dia" />
                  </Field>
                </div>
                <p className="mt-3 text-sm text-ink-700">
                  ≈ <b>{fmtNum(loss.lostKwh)} kWh</b> por mês, ou <b>{brl(loss.lostMonth)}</b>/mês ({brl(loss.lostYear, 0)} por ano).
                </p>
              </div>
              <Field label="Duração da visita">
                <NumberInput value={inputs.serviceHours} onChange={(v) => set("serviceHours", v)} suffix="horas" digits={0} />
              </Field>
              <Field label="Agendamento em até">
                <NumberInput value={inputs.scheduleDays} onChange={(v) => set("scheduleDays", v)} suffix="dias" digits={0} />
              </Field>
              <Field label="Validade da proposta">
                <NumberInput value={inputs.validityDays} onChange={(v) => set("validityDays", v)} suffix="dias" digits={0} />
              </Field>
              <Field label="Garantia do serviço">
                <NumberInput value={inputs.serviceWarrantyDays} onChange={(v) => set("serviceWarrantyDays", v)} suffix="dias" digits={0} />
              </Field>
              <Field label="Cartão de crédito">
                <div className="flex gap-2">
                  <NumberInput className="flex-1" value={inputs.cardInstallments} onChange={(v) => set("cardInstallments", v)} suffix="x" digits={0} />
                  <NumberInput className="flex-1" value={inputs.cardRate} onChange={(v) => set("cardRate", v)} suffix="% a.m." />
                </div>
              </Field>
              <Field label="Forma de pagamento">
                <Input value={inputs.paymentNotes} onChange={(e) => set("paymentNotes", e.target.value)} />
              </Field>
              <Field label="Foto da capa (opcional)" hint="Sem foto, a capa usa uma imagem de limpeza de placas" className="sm:col-span-2">
                <ImageField value={inputs.coverImage} onChange={(v) => set("coverImage", v)} folder="manutencao" aspect="aspect-[21/9]" label="Enviar foto da capa" />
              </Field>
              <Field label="Diferenciais da equipe (um por linha)" className="sm:col-span-2">
                <Textarea value={inputs.highlights.join("\n")} onChange={(e) => set("highlights", e.target.value.split("\n"))} className="min-h-[110px]" />
              </Field>
              <Field label="Condições gerais (uma por linha)" className="sm:col-span-2">
                <Textarea value={inputs.conditions.join("\n")} onChange={(e) => set("conditions", e.target.value.split("\n"))} className="min-h-[140px]" />
              </Field>
              <Field label="Anotações internas (não aparecem na proposta)" className="sm:col-span-2">
                <Textarea value={inputs.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
              {isAdmin && (
                <div className="sm:col-span-2">
                  <Button variant="secondary" size="sm" onClick={saveAsDefault} loading={savingDefaults}>
                    <BookmarkCheck className="h-4 w-4" /> Salvar preços e condições como padrão
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20 grid gap-3">
            <Checkout inputs={inputs} result={result} plan={plan} />
            {proposal && <TrackingCard proposalId={proposal.id} sections={MAINT_SECTIONS} clicks={TRACK_CLICKS} />}
            <p className="px-2 text-center text-xs text-ink-500">
              <Receipt className="mr-1 inline h-3.5 w-3.5" />
              Na proposta aparece o <b>preço final</b>
              {inputs.showItemPrices ? " e o valor de venda de cada serviço" : ""}.
            </p>
          </div>
        </aside>
        {proposal && (
          <div className="lg:hidden">
            <TrackingCard proposalId={proposal.id} sections={MAINT_SECTIONS} clicks={TRACK_CLICKS} />
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-ink-200/70 bg-white/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => setSheet(true)} className="min-w-0 flex-1 text-left">
            <p className="text-[11px] font-semibold text-ink-500">Preço final</p>
            <p className="tnum font-display text-xl font-semibold tracking-tight">{result.valid ? brl(result.finalPrice) : "—"}</p>
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
            <Checkout inputs={inputs} result={result} plan={plan} />
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceRow({ it, inputs, onChange, onRemove }: { it: MaintItem; inputs: MaintInputs; onChange: (p: Partial<MaintItem>) => void; onRemove?: () => void }) {
  const basis = basisOf(it);
  const qty = qtyOf(it, inputs);
  const cat = catalogOf(it.key);
  const conditional = it.conditional ?? cat?.conditional ?? false;
  return (
    <div className={cx("rounded-xl p-2.5 ring-1 transition", it.on ? "bg-white ring-ink-200" : "bg-ink-50 opacity-60 ring-ink-200/60")}>
      <div className="flex items-center gap-2.5">
        <Switch checked={it.on} onChange={(v) => onChange({ on: v })} />
        <Input value={it.label} onChange={(e) => onChange({ label: e.target.value })} className="h-9 flex-1 sm:h-9" placeholder="Nome do serviço" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 sm:pl-[52px]">
        <button
          type="button"
          onClick={() => onChange({ conditional: !conditional })}
          className={cx("rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 transition", conditional ? "bg-amber-50 text-amber-800 ring-amber-600/20" : "bg-ink-50 text-ink-400 ring-ink-200")}
          title="Peças trocadas só se a vistoria mostrar necessidade"
        >
          {conditional ? "Se necessário" : "Sempre"}
        </button>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-[11px] font-semibold text-rose-600 hover:underline">
            Remover
          </button>
        )}
        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          {basis === "unidade" ? (
            <NumberInput value={it.qty} onChange={(v) => onChange({ qty: v })} digits={0} suffix="un" className="w-[76px] shrink-0 sm:w-24 [&_input]:h-9" />
          ) : (
            <p className="w-[76px] shrink-0 truncate text-xs text-ink-500 sm:w-24" title="Calculado pelos dados do sistema">
              {basis === "sistema" ? "por sistema" : basis === "km" ? `${fmtNum(qty)} km` : `${fmtNum(qty)} ${qty === 1 ? BASIS_LABEL[basis].one : BASIS_LABEL[basis].many}`}
            </p>
          )}
          <span className="hidden text-xs text-ink-400 sm:inline">×</span>
          <MoneyInput value={it.unit} onChange={(v) => onChange({ unit: v })} className="min-w-0 flex-1 sm:w-32 sm:flex-none [&_input]:h-9" />
          <p className="tnum w-[78px] shrink-0 text-right text-[13px] font-semibold sm:w-24 sm:text-sm">{it.on ? brl(qty * it.unit) : "—"}</p>
        </div>
      </div>
    </div>
  );
}

function Checkout({ inputs, result, plan }: { inputs: MaintInputs; result: ReturnType<typeof calcMaint>; plan: ReturnType<typeof planOf> }) {
  const Row = ({ label, detail, value, strong }: { label: string; detail?: string; value: number; strong?: boolean }) => (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <div className="min-w-0">
        <p className={cx("text-[13px]", strong ? "font-semibold text-white" : "text-ink-300")}>{label}</p>
        {detail && <p className="truncate text-[11px] text-ink-500">{detail}</p>}
      </div>
      <p className={cx("tnum shrink-0 text-[13px]", strong ? "font-semibold text-white" : "text-ink-200")}>{brl(value)}</p>
    </div>
  );
  const comp = (name: string, c: MaintInputs["commission"]) => (c.mode === "percent" ? `${name} (${fmtNum(c.value, c.value % 1 ? 1 : 0)}%)` : name);
  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink-950 text-white shadow-lift">
      <div className="pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full bg-sun-500/20 blur-3xl" />
      <div className="relative px-6 pt-6">
        <p className="text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">Resumo da manutenção</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Mini label="Sistema" value={`${fmtNum(kwpOf(inputs), 1)} kWp`} />
          <Mini label="Módulos" value={fmtNum(inputs.moduleQty)} />
          <Mini label="Visita" value={`${inputs.serviceHours} h`} />
        </div>
      </div>
      <div className="relative mt-5 border-t border-dashed border-white/10 px-6 pt-4">
        <p className="mb-1 text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">Custos diretos</p>
        {result.lines.map((l) => (
          <Row key={l.key} label={l.label} detail={l.detail} value={l.value} />
        ))}
        {!result.lines.length && <p className="py-2 text-sm text-ink-500">Ligue ao menos um serviço.</p>}
        <div className="mt-1 border-t border-white/10 pt-1">
          <Row label="Custo total" value={result.directCost} strong />
        </div>
      </div>
      <div className="relative mt-3 border-t border-dashed border-white/10 px-6 pt-4">
        <p className="mb-1 text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">Formação de preço</p>
        <Row label={comp("Comissão", inputs.commission)} value={result.commissionValue} />
        <Row label={comp("Impostos", inputs.tax)} value={result.taxValue} />
        <Row label={comp("Lucro", inputs.profit)} detail={`Margem líquida ${pct(result.netMargin)}`} value={result.profitValue} />
        {result.discountValue > 0 && <Row label="Desconto" value={-result.discountValue} />}
        {result.roundingAdjust > 0 && <Row label="Arredondamento" value={result.roundingAdjust} />}
      </div>
      <div className="relative mt-4 bg-white/[0.03] px-6 py-5">
        {result.error ? (
          <p className="text-sm text-rose-300">{result.error}</p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <p className="pb-1 text-sm font-medium text-ink-400">Preço final</p>
              <p className="tnum font-display text-[34px] leading-none font-semibold tracking-tight text-brand-lime">{brl(result.finalPrice)}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <Mini label="Markup" value={`${fmtNum(result.markup, 2)}×`} />
              <Mini label="Lucro" value={brl(result.profitValue, 0)} />
            </div>
            {plan && (
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-ink-300 ring-1 ring-white/[0.06]">
                <CalendarClock className="h-3.5 w-3.5 text-brand-lime" /> Plano: {plan.visits}× {brl(plan.perVisit)} por ano ({brl(plan.year, 0)})
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.05] px-2 py-2 text-center ring-1 ring-white/[0.06]">
      <p className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">{label}</p>
      <p className="tnum mt-0.5 text-[13px] font-semibold text-ink-100">{value}</p>
    </div>
  );
}
