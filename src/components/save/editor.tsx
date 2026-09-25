"use client";

import { ArrowLeft, Check, Copy, CopyPlus, ExternalLink, FileText, Loader2, MessageCircle, Percent, PlugZap, Plus, Receipt, Trash2, User, Wallet, Wrench, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { useQuick } from "@/components/app/shell";
import { StepNav } from "@/components/proposal/checkout";
import { LeadPicker, PriceComp, Stepper } from "@/components/proposal/editor";
import { Badge, Button, Card, CardHeader, Field, ImageField, Input, MoneyInput, NumberInput, Segmented, Switch, Textarea, cx } from "@/components/ui";
import { PROPOSAL_STATUS } from "@/lib/constants";
import { addDays, whatsappUrl } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { brl, fmtNum, pct } from "@/lib/pricing";
import { CHARGER_OPTIONS, calcSave, mergeSave, type SaveCostItem, type SaveInputs } from "@/lib/save";
import { duplicateProposal } from "@/lib/proposal-actions";
import { supabase } from "@/lib/supabase/client";
import type { Lead, Proposal } from "@/lib/types";

export function SaveEditor({ proposal, initialLeadId }: { proposal?: Proposal; initialLeadId?: string | null }) {
  const router = useRouter();
  const { settings, settingsLoaded, user } = useApp();
  const { openLead } = useQuick();

  const [inputs, setInputs] = useState<SaveInputs | null>(proposal ? mergeSave(proposal.inputs as Partial<SaveInputs>) : null);
  const [leadId, setLeadId] = useState<string | null>(proposal?.lead_id ?? initialLeadId ?? null);
  const [title, setTitle] = useState(proposal?.title ?? "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sheet, setSheet] = useState(false);
  const current = useRef(proposal);
  current.current = proposal;

  const { data: leads } = useLive(async () => must(await supabase().from("leads").select("*").order("created_at", { ascending: false }).limit(1000)) as Lead[], [], ["leads"]);
  const lead = leads?.find((l) => l.id === leadId) ?? null;

  useEffect(() => {
    if (proposal || inputs || !settingsLoaded) return;
    setInputs(mergeSave(settings.saveDefaults));
  }, [proposal, inputs, settingsLoaded, settings.saveDefaults]);

  const result = useMemo(() => (inputs ? calcSave(inputs) : null), [inputs]);

  const set = <K extends keyof SaveInputs>(k: K, v: SaveInputs[K]) => {
    setInputs((i) => (i ? { ...i, [k]: v } : i));
    setDirty(true);
  };
  const setItem = (id: string, patch: Partial<SaveCostItem>) =>
    setInputs((i) => {
      if (!i) return i;
      setDirty(true);
      return { ...i, extraCosts: i.extraCosts.map((it) => (it.id === id ? { ...it, ...patch, value: (patch.qty ?? it.qty) * (patch.unit ?? it.unit) } : it)) };
    });

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
    // A infraestrutura por metro acompanha sempre a distância informada.
    const synced: SaveInputs = { ...inputs, extraCosts: inputs.extraCosts.map((it) => (it.key === "infra" ? { ...it, qty: inputs.distanceM, value: inputs.distanceM * it.unit } : it)) };
    const row = {
      lead_id: leadId,
      title: title || null,
      inputs: synced,
      power_kwp: inputs.chargerPowerKw,
      monthly_generation: 0,
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
      await sb.from("activities").insert({ lead_id: leadId, type: "proposta", content: `Orçamento S.A.V.E #${saved.number} criado — ${brl(saved.final_price)}`, created_by: user.id });
      if (lead && lead.segment === "solar") await sb.from("leads").update({ segment: "ambos" }).eq("id", lead.id);
      toast.success(`Orçamento S.A.V.E #${saved.number} salvo`);
      router.replace(`/propostas/${saved.id}`);
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
      const sb = supabase();
      await sb.from("activities").insert({ lead_id: saved.lead_id, type: "proposta", content: `Proposta S.A.V.E #${saved.number} enviada`, created_by: user.id });
      if (lead && ["novo", "contato", "visita"].includes(lead.status)) await sb.from("leads").update({ status: "proposta" }).eq("id", lead.id);
    }
    if (kind === "copy") {
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Link da proposta copiado");
    } else if (kind === "open") {
      if (win) win.location.href = url;
    } else {
      const first = lead?.name.split(" ")[0] ?? "";
      const msg = `Olá${first ? `, ${first}` : ""}! Segue a proposta do S.A.V.E — sistema de recarga para veículo elétrico de ${fmtNum(inputs!.chargerPowerKw, 1)} kW, instalado e pronto para uso.\n\nDetalhes e aceite online:\n${url}`;
      if (win) win.location.href = whatsappUrl(lead?.phone, msg);
    }
  }

  const status = proposal ? PROPOSAL_STATUS[proposal.status] : null;

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/propostas?tipo=save" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-ink-500 shadow-soft ring-1 ring-ink-200 hover:text-ink-900">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-sun-gradient text-ink-900">
                <PlugZap className="h-4 w-4" />
              </span>
              <h1 className="truncate font-display text-xl font-semibold tracking-tight sm:text-2xl">{proposal ? `S.A.V.E #${proposal.number}` : "Novo orçamento S.A.V.E"}</h1>
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
                "Sistema de Abastecimento de Veículo Elétrico"
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
              <Button
                variant="secondary"
                title="Criar uma cópia deste orçamento (ex.: opção B para o cliente)"
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
          { id: "s-cliente", label: "Cliente", done: !!leadId },
          { id: "s-carregador", label: "Carregador", done: inputs.chargerPowerKw > 0 },
          { id: "s-escopo", label: "Escopo", done: inputs.distanceM > 0 },
          { id: "s-custos", label: "Custos", done: result.directCost > 0 },
          { id: "s-preco", label: "Preço", done: result.valid && result.finalPrice > 0 },
          { id: "s-condicoes", label: "Condições", done: inputs.executionDays > 0 },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-5">
          <Card id="s-cliente" className="scroll-mt-28">
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
                <Input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} placeholder="Ex.: Garagem da sede · 2 vagas" />
              </Field>
            </div>
          </Card>

          <Card id="s-carregador" className="scroll-mt-28">
            <CardHeader icon={<PlugZap className="h-[18px] w-[18px]" />} title="2. Carregador veicular" subtitle="Wallbox de recarga em corrente alternada (modo 3)" />
            <div className="grid gap-5 px-5 pb-5">
              <div className="grid grid-cols-3 gap-2">
                {CHARGER_OPTIONS.map((o) => (
                  <button
                    key={o.kw}
                    type="button"
                    onClick={() => {
                      setInputs((i) => i && { ...i, chargerPowerKw: o.kw, phases: o.phases, currentA: o.currentA });
                      setDirty(true);
                    }}
                    className={cx(
                      "rounded-xl px-3 py-3 text-left ring-1 transition",
                      inputs.chargerPowerKw === o.kw ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-700 ring-ink-200 hover:ring-ink-300",
                    )}
                  >
                    <p className="font-display text-lg font-semibold">{o.label}</p>
                    <p className={cx("text-xs", inputs.chargerPowerKw === o.kw ? "text-ink-300" : "text-ink-500")}>{o.sub}</p>
                  </button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Potência">
                  <NumberInput value={inputs.chargerPowerKw} onChange={(v) => set("chargerPowerKw", v)} suffix="kW" digits={1} />
                </Field>
                <Field label="Alimentação">
                  <Segmented
                    className="w-full [&>button]:flex-1"
                    value={inputs.phases}
                    onChange={(v) => set("phases", v)}
                    options={[
                      { value: "mono", label: "Mono" },
                      { value: "tri", label: "Tri" },
                    ]}
                  />
                </Field>
                <Field label="Corrente">
                  <NumberInput value={inputs.currentA} onChange={(v) => set("currentA", v)} suffix="A" digits={0} />
                </Field>
                <Field label="Conector">
                  <Input value={inputs.connector} onChange={(e) => set("connector", e.target.value)} />
                </Field>
                <Field label="Marcas oferecidas" className="sm:col-span-2" hint="Aparece na proposta">
                  <Input value={inputs.chargerBrands} onChange={(e) => set("chargerBrands", e.target.value)} placeholder="Ex.: Belenus, Joult ou Riseon" />
                </Field>
                <Field label="Modelo (opcional)" className="sm:col-span-2">
                  <Input value={inputs.chargerModel} onChange={(e) => set("chargerModel", e.target.value)} />
                </Field>
              </div>
              <Field label="Foto real do carregador" hint="Sem foto, a proposta usa uma imagem ilustrativa do wallbox">
                <ImageField value={inputs.chargerImage} onChange={(v) => set("chargerImage", v)} folder="save" aspect="aspect-[21/9]" label="Enviar foto do wallbox" />
              </Field>
            </div>
          </Card>

          <Card id="s-escopo" className="scroll-mt-28">
            <CardHeader icon={<Wrench className="h-[18px] w-[18px]" />} title="3. Escopo da instalação" subtitle="O que entra no fornecimento" />
            <div className="grid gap-4 px-5 pb-5">
              <Field label="Distância do ponto de conexão até o wallbox" hint="Define o comprimento de cabos e eletrodutos">
                <div className="flex items-center gap-3">
                  <Stepper value={inputs.distanceM} min={1} onChange={(v) => set("distanceM", v)} />
                  <span className="text-sm text-ink-500">metros</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[10, 20, 30, 50, 80].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => set("distanceM", m)}
                        className={cx("h-8 rounded-lg px-2.5 text-xs font-semibold ring-1", inputs.distanceM === m ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-600 ring-ink-200")}
                      >
                        {m} m
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
              <div className="grid gap-2 sm:grid-cols-3">
                <ScopeToggle label="Quadro de proteção" hint="Disjuntores, DR e DPS" checked={inputs.includePanel} onChange={(v) => set("includePanel", v)} />
                <ScopeToggle label="Botão de emergência" hint="Cogumelo com trava" checked={inputs.includeEmergency} onChange={(v) => set("includeEmergency", v)} />
                <ScopeToggle label="Tomada industrial" hint="IEC 60309 · carregador portátil" checked={inputs.includeSocket} onChange={(v) => set("includeSocket", v)} />
              </div>
            </div>
          </Card>

          <Card id="s-custos" className="scroll-mt-28">
            <CardHeader icon={<Receipt className="h-[18px] w-[18px]" />} title="4. Custos" subtitle="Quantidade × valor unitário · não aparece para o cliente" />
            <div className="grid gap-2 px-5 pb-5">
              <div className="hidden grid-cols-[1fr_90px_140px_110px_36px] gap-2 px-1 text-[11px] font-semibold tracking-wide text-ink-400 uppercase sm:grid">
                <span>Item</span>
                <span>Qtd</span>
                <span>Valor unitário</span>
                <span className="text-right">Total</span>
                <span />
              </div>
              {inputs.extraCosts.map((it) => {
                const off = (it.key === "panel" && !inputs.includePanel) || (it.key === "emergency" && !inputs.includeEmergency) || (it.key === "socket" && !inputs.includeSocket);
                const qty = it.key === "infra" ? inputs.distanceM : it.qty;
                return (
                  <div key={it.id} className={cx("grid items-center gap-2 rounded-xl bg-ink-50 p-2 ring-1 ring-ink-200/60 sm:grid-cols-[1fr_90px_140px_110px_36px]", off && "opacity-40")}>
                    <Input value={it.label} onChange={(e) => setItem(it.id, { label: e.target.value })} className="h-9 sm:h-9" />
                    <NumberInput value={qty} onChange={(v) => (it.key === "infra" ? set("distanceM", v) : setItem(it.id, { qty: v }))} digits={0} suffix={it.key === "infra" ? "m" : "un"} className="[&_input]:h-9" />
                    <MoneyInput value={it.unit} onChange={(v) => setItem(it.id, { unit: v })} className="[&_input]:h-9" />
                    <p className="tnum text-right text-sm font-semibold">{off ? "—" : brl(qty * it.unit)}</p>
                    {it.key === "custom" ? (
                      <Button variant="ghost" size="icon" onClick={() => set("extraCosts", inputs.extraCosts.filter((x) => x.id !== it.id))} aria-label="Remover">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                className="justify-self-start"
                onClick={() => set("extraCosts", [...inputs.extraCosts, { id: crypto.randomUUID(), key: "custom", label: "", qty: 1, unit: 0, value: 0 }])}
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar item
              </Button>
            </div>
          </Card>

          <Card id="s-preco" className="scroll-mt-28">
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
            </div>
          </Card>

          <Card id="s-condicoes" className="scroll-mt-28">
            <CardHeader icon={<Wallet className="h-[18px] w-[18px]" />} title="6. Condições e garantias" subtitle="Aparecem na proposta do cliente" />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              <Field label="Prazo de execução" hint="Após a entrega do equipamento">
                <NumberInput value={inputs.executionDays} onChange={(v) => set("executionDays", v)} suffix="dias" digits={0} />
              </Field>
              <Field label="Validade da proposta">
                <NumberInput value={inputs.validityDays} onChange={(v) => set("validityDays", v)} suffix="dias" digits={0} />
              </Field>
              <Field label="Garantia da instalação">
                <NumberInput value={inputs.installWarrantyMonths} onChange={(v) => set("installWarrantyMonths", v)} suffix="meses" digits={0} />
              </Field>
              <Field label="Garantia de fabricação">
                <NumberInput value={inputs.factoryWarrantyYears} onChange={(v) => set("factoryWarrantyYears", v)} suffix="anos" digits={0} />
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
              <Field label="Condições gerais (uma por linha)" hint="Use {distancia} e {potencia} para preencher automaticamente" className="sm:col-span-2">
                <Textarea value={inputs.conditions.join("\n")} onChange={(e) => set("conditions", e.target.value.split("\n"))} className="min-h-[140px]" />
              </Field>
              <Field label="Anotações internas (não aparecem na proposta)" className="sm:col-span-2">
                <Textarea value={inputs.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>
          </Card>

        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20 grid gap-3">
            <SaveCheckout inputs={inputs} result={result} />
            <p className="px-2 text-center text-xs text-ink-500">
              <Receipt className="mr-1 inline h-3.5 w-3.5" />
              Na proposta do cliente aparece somente o <b>preço final</b>.
            </p>
          </div>
        </aside>
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
            <SaveCheckout inputs={inputs} result={result} />
          </div>
        </div>
      )}
    </div>
  );
}

function ScopeToggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cx("flex cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-3 ring-1 transition", checked ? "bg-sun-50 ring-sun-600/25" : "bg-ink-50 ring-ink-200/60")}>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-ink-500">{hint}</p>
      </div>
      <Switch checked={checked} onChange={onChange} />
    </label>
  );
}

function SaveCheckout({ inputs, result }: { inputs: SaveInputs; result: ReturnType<typeof calcSave> }) {
  const Row = ({ label, detail, value, strong }: { label: string; detail?: string; value: number; strong?: boolean }) => (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <div className="min-w-0">
        <p className={cx("text-[13px]", strong ? "font-semibold text-white" : "text-ink-300")}>{label}</p>
        {detail && <p className="truncate text-[11px] text-ink-500">{detail}</p>}
      </div>
      <p className={cx("tnum shrink-0 text-[13px]", strong ? "font-semibold text-white" : "text-ink-200")}>{brl(value)}</p>
    </div>
  );
  const comp = (name: string, c: SaveInputs["commission"]) => (c.mode === "percent" ? `${name} (${fmtNum(c.value, c.value % 1 ? 1 : 0)}%)` : name);
  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink-950 text-white shadow-lift">
      <div className="pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full bg-sun-500/20 blur-3xl" />
      <div className="relative px-6 pt-6">
        <p className="text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">Resumo S.A.V.E</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Mini label="Carregador" value={`${fmtNum(inputs.chargerPowerKw, 1)} kW`} />
          <Mini label="Distância" value={`${fmtNum(inputs.distanceM)} m`} />
          <Mini label="Execução" value={`${inputs.executionDays} dias`} />
        </div>
      </div>
      <div className="relative mt-5 border-t border-dashed border-white/10 px-6 pt-4">
        <p className="mb-1 text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">Custos diretos</p>
        {result.lines.map((l) => (
          <Row key={l.key} label={l.label} detail={l.detail} value={l.value} />
        ))}
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
