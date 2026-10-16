"use client";

import { ArrowLeft, BookmarkCheck, Camera, Check, ChevronDown, Copy, CopyPlus, ExternalLink, Loader2, MessageCircle, Plus, Settings2, Trash2, User, Wallet, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { useReward } from "@/components/app/rewards";
import { useQuick } from "@/components/app/shell";
import { LeadPicker } from "@/components/proposal/editor";
import { TrackingCard } from "@/components/proposal/tracking-card";
import { ViewStatus } from "@/components/proposal/view-status";
import { Badge, Button, Card, CardHeader, Field, ImageField, Input, MoneyInput, NumberInput, Segmented, Switch, Textarea, cx } from "@/components/ui";
import { PROPOSAL_STATUS } from "@/lib/constants";
import { DEFAULT_INPUTS, toStoredSettings } from "@/lib/defaults";
import { addDays, whatsappUrl } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import {
  MAINT_PARTS,
  MAINT_SECTIONS,
  MAINT_SERVICES,
  SEVERITY,
  TRACK_CLICKS,
  kwpOf,
  maintTotal,
  mergeMaint,
  soilingLoss,
  type FindingSeverity,
  type MaintFinding,
  type MaintInputs,
  type MaintService,
} from "@/lib/maintenance";
import { brl, fmtNum } from "@/lib/pricing";
import { duplicateProposal } from "@/lib/proposal-actions";
import { supabase } from "@/lib/supabase/client";
import type { Lead, Proposal } from "@/lib/types";
import { MAINT_ICONS } from "./icons";

const QUICK_FINDINGS: { title: string; severity: FindingSeverity }[] = [
  { title: "Placas com sujeira acumulada", severity: "atencao" },
  { title: "Conector com sinais de aquecimento", severity: "critico" },
  { title: "DPS com sinalizador de fim de vida", severity: "critico" },
  { title: "Bornes oxidados no quadro", severity: "atencao" },
  { title: "Inversor sem monitoramento", severity: "atencao" },
  { title: "Estrutura firme e sem corrosão", severity: "ok" },
];

export function MaintenanceEditor({ proposal, initialLeadId }: { proposal?: Proposal; initialLeadId?: string | null }) {
  const router = useRouter();
  const { settings, settingsLoaded, user, profile } = useApp();
  const isAdmin = profile?.role === "admin";
  const { openLead } = useQuick();
  const { reward } = useReward();

  const [inputs, setInputs] = useState<MaintInputs | null>(() => {
    if (!proposal) return null;
    const raw = proposal.inputs as Partial<MaintInputs>;
    const m = mergeMaint(raw);
    // Orçamentos do formato antigo: deduz o valor por placa a partir do preço final
    if (raw.pricePerModule === undefined && m.moduleQty > 0) m.pricePerModule = Math.round((Number(proposal.final_price) / m.moduleQty) * 100) / 100;
    return m;
  });
  const [leadId, setLeadId] = useState<string | null>(proposal?.lead_id ?? initialLeadId ?? null);
  const [title, setTitle] = useState(proposal?.title ?? "");
  const [saving, setSaving] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [dirty, setDirty] = useState(false);
  const current = useRef(proposal);
  current.current = proposal;

  const { data: leads } = useLive(async () => must(await supabase().from("leads").select("*").order("created_at", { ascending: false }).limit(1000)) as Lead[], [], ["leads"]);
  const lead = leads?.find((l) => l.id === leadId) ?? null;

  useEffect(() => {
    if (proposal || inputs || !settingsLoaded) return;
    const solar = { ...DEFAULT_INPUTS, ...settings.defaults };
    setInputs(mergeMaint({ tariff: solar.tariff, sunHours: solar.sunHours, performanceRatio: solar.performanceRatio }, settings.maintDefaults));
  }, [proposal, inputs, settingsLoaded, settings.defaults, settings.maintDefaults]);

  const set = <K extends keyof MaintInputs>(k: K, v: MaintInputs[K]) => {
    setInputs((i) => (i ? { ...i, [k]: v } : i));
    setDirty(true);
  };
  const toggle = (k: "services" | "parts", key: string) => {
    setInputs((i) => (i ? { ...i, [k]: i[k].includes(key) ? i[k].filter((x) => x !== key) : [...i[k], key] } : i));
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

  if (!inputs) {
    return (
      <div className="grid h-[60vh] place-items-center text-ink-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const total = maintTotal(inputs);
  const kwp = kwpOf(inputs);
  const loss = soilingLoss(inputs);

  async function save(opts: { silent?: boolean; extra?: Partial<Proposal> } = {}): Promise<Proposal | null> {
    if (!inputs) return null;
    if (!leadId) {
      toast.error("Selecione o cliente do orçamento");
      return null;
    }
    if (!(total > 0)) {
      toast.error("Informe o número de placas e o valor por placa");
      return null;
    }
    setSaving(true);
    const row = {
      lead_id: leadId,
      title: title || null,
      inputs,
      power_kwp: Math.round(kwp * 100) / 100,
      monthly_generation: Math.round(loss.monthlyKwh),
      direct_cost: 0,
      commission_value: 0,
      tax_value: 0,
      profit_value: 0,
      final_price: total,
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
      const msg = `Olá${first ? `, ${first}` : ""}! Segue a proposta de manutenção das suas ${fmtNum(inputs!.moduleQty)} placas solares: limpeza, revisão elétrica completa e relatório, tudo incluso por ${brl(total)}.\n\n${url}`;
      if (win) win.location.href = whatsappUrl(lead?.phone, msg);
    }
  }

  async function saveAsDefault() {
    if (!inputs) return;
    setSavingDefaults(true);
    const { services, parts, pricePerModule, cardInstallments, paymentNotes, validityDays, scheduleDays, serviceWarrantyDays, conditions, coverImage, showLoss, soilingPct } = inputs;
    const maintDefaults: Partial<MaintInputs> = { services, parts, pricePerModule, cardInstallments, paymentNotes, validityDays, scheduleDays, serviceWarrantyDays, conditions, coverImage, showLoss, soilingPct };
    const { error } = await supabase().from("settings").upsert({ id: 1, data: toStoredSettings({ ...settings, maintDefaults }) });
    setSavingDefaults(false);
    if (error) toast.error(error.message);
    else toast.success("Padrão salvo para os próximos orçamentos de manutenção");
  }

  const status = proposal ? PROPOSAL_STATUS[proposal.status] : null;

  return (
    <div className="animate-fade-up pb-24 lg:pb-0">
      {/* cabeçalho */}
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
              <h1 className="truncate font-display text-xl font-semibold tracking-tight sm:text-2xl">{proposal ? `Manutenção #${proposal.number}` : "Orçamento de manutenção"}</h1>
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
                "Limpeza e revisão elétrica, tudo incluso"
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

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-5">
          {/* cliente + sistema */}
          <Card>
            <CardHeader icon={<User className="h-[18px] w-[18px]" />} title="Cliente e sistema" />
            <div className="grid grid-cols-2 gap-4 px-5 pb-5 sm:grid-cols-4">
              <Field label="Cliente *" className="col-span-2 sm:col-span-4">
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
              <Field label="Placas">
                <NumberInput value={inputs.moduleQty} onChange={(v) => set("moduleQty", v)} suffix="un" digits={0} />
              </Field>
              <Field label="Potência da placa">
                <NumberInput value={inputs.modulePowerW} onChange={(v) => set("modulePowerW", v)} suffix="W" digits={0} />
              </Field>
              <Field label="Inversores">
                <NumberInput value={inputs.inverterQty} onChange={(v) => set("inverterQty", v)} suffix="un" digits={0} />
              </Field>
              <Field label="Marca do inversor">
                <Input value={inputs.inverterBrand} onChange={(e) => set("inverterBrand", e.target.value)} placeholder="Opcional" />
              </Field>
            </div>
          </Card>

          {/* incluso */}
          <Card>
            <CardHeader icon={<Check className="h-[18px] w-[18px]" />} title="O que está incluso" subtitle="Toque para tirar ou colocar" action={<Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20">{inputs.services.length} itens</Badge>} />
            <div className="grid grid-cols-2 gap-2 px-5 pb-5 sm:grid-cols-3 xl:grid-cols-4">
              {MAINT_SERVICES.map((s) => (
                <Tile key={s.key} s={s} on={inputs.services.includes(s.key)} onClick={() => toggle("services", s.key)} />
              ))}
            </div>
            <div className="border-t border-ink-100 px-5 py-4">
              <p className="mb-2.5 text-sm font-semibold text-ink-900">
                Troca se necessário <span className="text-xs font-normal text-ink-500">· sem quantidade, só se a vistoria indicar</span>
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MAINT_PARTS.map((s) => (
                  <Tile key={s.key} s={s} on={inputs.parts.includes(s.key)} onClick={() => toggle("parts", s.key)} tone="amber" />
                ))}
              </div>
            </div>
          </Card>

          {/* valor */}
          <Card>
            <CardHeader icon={<Wallet className="h-[18px] w-[18px]" />} title="Valor" subtitle="Valor por placa, com tudo incluso" />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-[1fr_1.3fr] sm:items-end">
              <Field label="Valor por placa">
                <MoneyInput value={inputs.pricePerModule} onChange={(v) => set("pricePerModule", v)} suffix="/placa" />
              </Field>
              <div className="rounded-2xl bg-ink-950 px-5 py-3.5 text-white">
                <p className="text-xs text-ink-400">
                  {fmtNum(inputs.moduleQty)} placas × {brl(inputs.pricePerModule)}
                </p>
                <p className="tnum font-display text-3xl font-semibold tracking-tight text-brand-lime">{brl(total)}</p>
              </div>
              <Field label="Cartão de crédito">
                <Segmented
                  className="w-full [&>button]:flex-1"
                  value={String(inputs.cardInstallments)}
                  onChange={(v) => set("cardInstallments", Number(v))}
                  options={[
                    { value: "0", label: "Não" },
                    { value: "3", label: "3x" },
                    { value: "6", label: "6x" },
                    { value: "10", label: "10x" },
                  ]}
                />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Validade">
                  <NumberInput value={inputs.validityDays} onChange={(v) => set("validityDays", v)} suffix="d" digits={0} />
                </Field>
                <Field label="Agenda em">
                  <NumberInput value={inputs.scheduleDays} onChange={(v) => set("scheduleDays", v)} suffix="d" digits={0} />
                </Field>
                <Field label="Garantia">
                  <NumberInput value={inputs.serviceWarrantyDays} onChange={(v) => set("serviceWarrantyDays", v)} suffix="d" digits={0} />
                </Field>
              </div>
            </div>
          </Card>

          {/* vistoria */}
          <Card>
            <CardHeader icon={<Camera className="h-[18px] w-[18px]" />} title="Fotos da vistoria" subtitle="Opcional · aparecem na proposta com selo de gravidade" />
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
                <div key={f.id} className="grid gap-3 rounded-2xl bg-ink-50 p-3 ring-1 ring-ink-200/60 sm:grid-cols-[140px_minmax(0,1fr)]">
                  <ImageField value={f.photo} onChange={(v) => setFinding(f.id, { photo: v })} folder="manutencao" aspect="aspect-[4/3]" label="Foto" />
                  <div className="grid content-start gap-2">
                    <div className="flex gap-2">
                      <Input value={f.title} onChange={(e) => setFinding(f.id, { title: e.target.value })} placeholder="O que foi encontrado" className="h-9 flex-1" />
                      <Button variant="ghost" size="icon" onClick={() => set("findings", inputs.findings.filter((x) => x.id !== f.id))} aria-label="Remover">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Segmented
                      className="w-full [&>button]:flex-1"
                      value={f.severity}
                      onChange={(v) => setFinding(f.id, { severity: v })}
                      options={(Object.keys(SEVERITY) as FindingSeverity[]).map((k) => ({ value: k, label: SEVERITY[k].label }))}
                    />
                    <Input value={f.text} onChange={(e) => setFinding(f.id, { text: e.target.value })} placeholder="Detalhe (opcional)" className="h-9" />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* mais opções */}
          <details className="group rounded-2xl bg-white shadow-soft ring-1 ring-ink-200/70 dark:bg-white/[0.03]">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4">
              <Settings2 className="h-[18px] w-[18px] text-ink-500" />
              <span className="flex-1 text-sm font-semibold text-ink-900">Mais opções</span>
              <span className="hidden text-xs text-ink-500 sm:inline">título, capa, condições</span>
              <ChevronDown className="h-4 w-4 text-ink-400 transition group-open:rotate-180" />
            </summary>
            <div className="grid gap-4 border-t border-ink-100 px-5 py-5">
              <Field label="Título da proposta">
                <Input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="Ex.: Manutenção preventiva · residência"
                />
              </Field>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3 ring-1 ring-ink-200/60">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Mostrar quanto a sujeira está custando</p>
                  <p className="text-xs text-ink-500">
                    Com {fmtNum(inputs.soilingPct)}% de perda: ≈ {brl(loss.lostMonth, 0)}/mês para {fmtNum(kwp, 2)} kWp
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {inputs.showLoss && <NumberInput value={inputs.soilingPct} onChange={(v) => set("soilingPct", v)} suffix="%" digits={0} className="w-24 [&_input]:h-9" />}
                  <Switch checked={inputs.showLoss} onChange={(v) => set("showLoss", v)} />
                </div>
              </div>
              <Field label="Forma de pagamento (opcional)">
                <Input value={inputs.paymentNotes} onChange={(e) => set("paymentNotes", e.target.value)} placeholder="Ex.: Pix após a execução" />
              </Field>
              <Field label="Foto da capa" hint="Sem foto, usa uma imagem de placas solares">
                <ImageField value={inputs.coverImage} onChange={(v) => set("coverImage", v)} folder="manutencao" aspect="aspect-[21/9]" label="Enviar foto da capa" />
              </Field>
              <Field label="Condições (uma por linha)">
                <Textarea value={inputs.conditions.join("\n")} onChange={(e) => set("conditions", e.target.value.split("\n"))} className="min-h-[100px]" />
              </Field>
              <Field label="Anotações internas (não aparecem)">
                <Textarea value={inputs.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-[60px]" />
              </Field>
              {isAdmin && (
                <div>
                  <Button variant="secondary" size="sm" onClick={saveAsDefault} loading={savingDefaults}>
                    <BookmarkCheck className="h-4 w-4" /> Salvar como padrão
                  </Button>
                </div>
              )}
            </div>
          </details>
        </div>

        <aside className="grid content-start gap-3 lg:sticky lg:top-20 lg:self-start">
          <Summary inputs={inputs} total={total} kwp={kwp} />
          {proposal && <TrackingCard proposalId={proposal.id} sections={MAINT_SECTIONS} clicks={TRACK_CLICKS} />}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-ink-200/70 bg-white/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-ink-500">Valor final</p>
            <p className="tnum font-display text-xl font-semibold tracking-tight">{brl(total)}</p>
          </div>
          <Button onClick={() => save()} loading={saving}>
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}

function Tile({ s, on, onClick, tone }: { s: MaintService; on: boolean; onClick: () => void; tone?: "amber" }) {
  const Icon = MAINT_ICONS[s.icon];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cx(
        "flex items-start gap-2.5 rounded-xl p-3 text-left ring-1 transition",
        on ? (tone === "amber" ? "bg-amber-50 ring-amber-600/30" : "bg-emerald-50 ring-emerald-600/30") : "bg-ink-50 opacity-55 ring-ink-200 hover:opacity-90",
      )}
    >
      <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg", on ? (tone === "amber" ? "bg-amber-500 text-white" : "bg-emerald-600 text-white") : "bg-ink-200 text-ink-500")}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] leading-tight font-semibold text-ink-900">{s.label}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-ink-500">{tone === "amber" ? (on ? "Se necessário" : "Não incluir") : on ? "Incluso" : "Fora"}</span>
      </span>
    </button>
  );
}

function Summary({ inputs, total, kwp }: { inputs: MaintInputs; total: number; kwp: number }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink-950 p-6 text-white shadow-lift">
      <div className="pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full bg-sun-500/20 blur-3xl" />
      <p className="relative text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">Resumo</p>
      <div className="relative mt-4 grid grid-cols-3 gap-2">
        <Mini label="Sistema" value={`${fmtNum(kwp, 1)} kWp`} />
        <Mini label="Placas" value={fmtNum(inputs.moduleQty)} />
        <Mini label="Por placa" value={brl(inputs.pricePerModule, 0)} />
      </div>
      <div className="relative mt-5 flex items-end justify-between gap-3 border-t border-white/10 pt-4">
        <p className="pb-1 text-sm text-ink-400">Valor final</p>
        <p className="tnum font-display text-[34px] leading-none font-semibold tracking-tight text-brand-lime">{brl(total)}</p>
      </div>
      <p className="relative mt-3 text-xs text-ink-400">
        {inputs.services.length} serviços inclusos · {inputs.parts.length} trocas se necessário
        {inputs.cardInstallments > 1 ? ` · até ${inputs.cardInstallments}x no cartão` : ""}
      </p>
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
