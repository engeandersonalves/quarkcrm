"use client";

import {
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  CopyPlus,
  Download,
  Eye,
  FileSignature,
  KeyRound,
  Link2,
  Mail,
  MessageCircle,
  Save,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { moneyInWords } from "@/lib/br";
import {
  DOC_KINDS,
  DOC_STATUS,
  POWERS,
  ROLE_LABEL,
  documentTitle,
  emptyParty,
  missingFields,
  signersFor,
  type AluguelData,
  type DocData,
  type DocKind,
  type Party,
  type ProcuracaoData,
} from "@/lib/documents";
import { formatDateTime, whatsappUrl } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";
import type { DocumentSigner, Lead } from "@/lib/types";
import { useApp } from "../app/app-context";
import { Badge, Button, Card, Field, Input, Modal, MoneyInput, NumberInput, Segmented, Select, Switch, Textarea, cx } from "../ui";
import { DocumentView } from "./document-view";
import { PartyFields } from "./party-fields";

type LeadLite = Pick<Lead, "id" | "name" | "document" | "email" | "phone" | "address" | "city" | "state">;

export interface EditorDoc {
  id: string | null;
  kind: DocKind;
  data: DocData;
  lead_id: string | null;
  status: keyof typeof DOC_STATUS;
  signers: DocumentSigner[];
}

export const partyFromLead = (l: LeadLite): Partial<Party> => ({
  kind: (l.document ?? "").replace(/\D/g, "").length > 11 ? "pj" : "pf",
  name: l.name ?? "",
  doc: (l.document ?? "").replace(/\D/g, ""),
  email: l.email ?? "",
  phone: l.phone ?? "",
  address: l.address ?? "",
  city: l.city ?? "",
  state: l.state || "AL",
});

export function DocEditor({ initial, onReload }: { initial: EditorDoc; onReload?: () => void }) {
  const router = useRouter();
  const { user, settings } = useApp();
  const [data, setData] = useState<DocData>(initial.data);
  const [leadId, setLeadId] = useState<string | null>(initial.lead_id);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(!initial.id);
  const [sendOpen, setSendOpen] = useState(false);
  const [view, setView] = useState<"form" | "preview">("form");
  const kind = initial.kind;
  const signers = useMemo(() => [...initial.signers].sort((a, b) => a.position - b.position), [initial.signers]);
  const anySigned = signers.some((s) => s.signed_at);
  const locked = anySigned || initial.status === "cancelado";

  const { data: leads } = useLive(
    async () => must(await supabase().from("leads").select("id,name,document,email,phone,address,city,state").order("name").limit(3000)) as LeadLite[],
    [],
    [],
  );

  const update = (patch: Partial<ProcuracaoData> | Partial<AluguelData>) => {
    setData((d) => ({ ...d, ...patch }) as DocData);
    setDirty(true);
  };

  const save = async (): Promise<string | null> => {
    if (locked) return initial.id;
    setSaving(true);
    const row = { kind, title: documentTitle(kind, data), data, lead_id: leadId };
    const sb = supabase();
    const res = initial.id
      ? await sb.from("documents").update(row).eq("id", initial.id).select("id").single()
      : await sb.from("documents").insert({ ...row, created_by: user.id }).select("id").single();
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return null;
    }
    setDirty(false);
    if (!initial.id) {
      toast.success(`${DOC_KINDS[kind].label} criada`);
      router.replace(`/documentos/${res.data.id}`);
    } else toast.success("Salvo");
    return res.data.id as string;
  };

  /** Cria/atualiza quem assina, preservando os links já enviados. */
  const syncSigners = async (docId: string) => {
    const sb = supabase();
    const specs = signersFor(kind, data);
    const byRole = new Map(signers.map((s) => [s.role, s]));
    for (const [i, spec] of specs.entries()) {
      const cur = byRole.get(spec.role);
      const fields = { name: spec.name, email: spec.email || null, phone: spec.phone || null, cpf: spec.cpf || null, position: i };
      if (cur && !cur.signed_at) await sb.from("document_signers").update(fields).eq("id", cur.id);
      else if (!cur) await sb.from("document_signers").insert({ ...fields, document_id: docId, role: spec.role });
    }
    const keep = new Set(specs.map((s) => s.role));
    const stale = signers.filter((s) => !keep.has(s.role) && !s.signed_at).map((s) => s.id);
    if (stale.length) await sb.from("document_signers").delete().in("id", stale);
    if (initial.status === "rascunho") await sb.from("documents").update({ status: "enviado" }).eq("id", docId);
  };

  const openSend = async () => {
    const miss = missingFields(kind, data);
    if (miss.length) {
      toast.error("Complete antes de enviar", { description: miss.join(" · ") });
      return;
    }
    const id = locked ? initial.id : await save();
    if (!id) return;
    if (!locked) await syncSigners(id);
    if (!initial.id) {
      router.replace(`/documentos/${id}?enviar=1`);
      return;
    }
    onReload?.();
    setSendOpen(true);
  };

  const newVersion = async () => {
    const { data: row, error } = await supabase()
      .from("documents")
      .insert({ kind, title: documentTitle(kind, data), data, lead_id: leadId, created_by: user.id })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    toast.success("Nova versão criada — edite e envie de novo");
    router.push(`/documentos/${row.id}`);
  };

  const cancelDoc = async () => {
    if (!initial.id || !confirm("Cancelar este documento? Os links de assinatura deixam de funcionar.")) return;
    const { error } = await supabase().from("documents").update({ status: "cancelado" }).eq("id", initial.id);
    if (error) toast.error(error.message);
    else onReload?.();
  };

  const remove = async () => {
    if (!initial.id || !confirm("Excluir este documento definitivamente?")) return;
    const { error } = await supabase().from("documents").delete().eq("id", initial.id);
    if (error) return toast.error(error.message);
    toast.success("Documento excluído");
    router.push("/documentos");
  };

  const pickLead = (id: string, target: "grantor" | "tenant" | "landlord") => {
    setLeadId(id || null);
    const lead = leads?.find((l) => l.id === id);
    if (!lead) return;
    const party = emptyParty(partyFromLead(lead));
    if (kind === "procuracao") {
      const d = data as ProcuracaoData;
      update({ grantor: party, ucAddress: d.ucAddress || [lead.address, lead.city && `${lead.city}/${lead.state || "AL"}`].filter(Boolean).join(", ") });
    } else update({ [target]: party } as Partial<AluguelData>);
  };

  const status = DOC_STATUS[initial.status];
  const title = documentTitle(kind, data);
  const miss = missingFields(kind, data);

  return (
    <div className="animate-fade-up">
      {/* Cabeçalho */}
      <div className="no-print mb-5 flex flex-wrap items-center gap-3">
        <Link href="/documentos" className="grid h-10 w-10 place-items-center rounded-xl bg-white text-ink-600 shadow-soft ring-1 ring-ink-200/70 hover:text-ink-900" aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-400 uppercase">{DOC_KINDS[kind].label}</p>
          <h1 className="truncate font-display text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        </div>
        <Badge className={status.cls}>{status.label}</Badge>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {!locked && (
            <Button variant="secondary" onClick={save} loading={saving} disabled={!dirty}>
              <Save className="h-4 w-4" /> {dirty ? "Salvar" : "Salvo"}
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.print()}>
            <Download className="h-4 w-4" /> PDF
          </Button>
          {initial.status !== "cancelado" && (
            <Button variant="sun" onClick={openSend} loading={saving} className="flex-1 sm:flex-none">
              <Send className="h-4 w-4" /> {signers.length ? "Links de assinatura" : "Enviar para assinar"}
            </Button>
          )}
        </div>
      </div>

      {anySigned && (
        <div className="no-print mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="min-w-0 flex-1">
            <b>{initial.status === "assinado" ? "Documento assinado por todas as partes." : "Assinatura em andamento."}</b> O texto está protegido contra alterações. Para mudar algo,
            crie uma nova versão.
          </p>
          <Button size="sm" variant="secondary" onClick={newVersion}>
            <CopyPlus className="h-4 w-4" /> Nova versão
          </Button>
        </div>
      )}

      <Segmented
        className="no-print mb-4 lg:hidden"
        value={view}
        onChange={setView}
        options={[
          { value: "form", label: "Preencher" },
          { value: "preview", label: <><Eye className="h-3.5 w-3.5" /> Ver documento</> },
        ]}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        <fieldset disabled={locked} className={cx("no-print grid min-w-0 content-start gap-4", view === "preview" && "hidden lg:grid")}>
          {kind === "procuracao" ? (
            <ProcuracaoForm data={data as ProcuracaoData} update={update} leads={leads ?? []} leadId={leadId} onLead={(id) => pickLead(id, "grantor")} />
          ) : (
            <AluguelForm data={data as AluguelData} update={update} leads={leads ?? []} leadId={leadId} onLead={pickLead} />
          )}
          {!locked && initial.id && (
            <div className="flex flex-wrap gap-2 pt-2">
              {initial.status !== "cancelado" && signers.length > 0 && (
                <Button variant="ghost" size="sm" onClick={cancelDoc}>
                  <Ban className="h-4 w-4" /> Cancelar documento
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-rose-600" onClick={remove}>
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            </div>
          )}
        </fieldset>

        <div className={cx("min-w-0 print:block", view === "form" && "hidden lg:block")}>
          <div className="lg:sticky lg:top-6">
            {miss.length > 0 && !locked && (
              <div className="no-print mb-3 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200">
                <b>Falta preencher:</b> {miss.join(" · ")}
              </div>
            )}
            <div className="max-h-none overflow-visible lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:rounded-2xl print:max-h-none print:overflow-visible">
              <DocumentView kind={kind} data={data} signers={signers.length ? signers : undefined} company={{ company_name: settings.company_name, logo_url: settings.logo_url }} />
            </div>
          </div>
        </div>
      </div>

      {initial.id && (
        <SendModal
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          kind={kind}
          leadId={leadId}
          signers={signers}
          company={settings.company_name}
          onChanged={onReload}
        />
      )}
      <AutoOpenSend onOpen={() => setSendOpen(true)} enabled={!!initial.id && signers.length > 0} />
    </div>
  );
}

/** Abre o painel de envio quando a página chega com ?enviar=1 (primeiro envio de um documento novo). */
function AutoOpenSend({ onOpen, enabled }: { onOpen: () => void; enabled: boolean }) {
  const fired = useRef(false);
  useEffect(() => {
    if (!enabled || fired.current || new URLSearchParams(window.location.search).get("enviar") !== "1") return;
    fired.current = true;
    onOpen();
    window.history.replaceState(null, "", window.location.pathname);
  }, [enabled, onOpen]);
  return null;
}

/* ------------------------------------------------------------ formulários */

function Section({ icon, title, subtitle, children }: { icon?: ReactNode; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        {icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-900 text-brand-yellow">{icon}</span>}
        <div>
          <h2 className="font-display text-[15px] font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function LeadPicker({ leads, value, onChange, label }: { leads: LeadLite[]; value: string | null; onChange: (id: string) => void; label: string }) {
  return (
    <Field label={label} hint="Puxa nome, CPF, contato e endereço do cadastro do lead">
      <Select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecionar um lead…</option>
        {leads.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
            {l.city ? ` — ${l.city}` : ""}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function ProcuracaoForm({
  data,
  update,
  leads,
  leadId,
  onLead,
}: {
  data: ProcuracaoData;
  update: (p: Partial<ProcuracaoData>) => void;
  leads: LeadLite[];
  leadId: string | null;
  onLead: (id: string) => void;
}) {
  const g = data.grantee;
  const setG = (patch: Partial<ProcuracaoData["grantee"]>) => update({ grantee: { ...g, ...patch } });
  const toggle = (key: ProcuracaoData["powers"][number]) =>
    update({ powers: data.powers.includes(key) ? data.powers.filter((k) => k !== key) : [...data.powers, key] });
  return (
    <>
      <Section icon={<KeyRound className="h-4 w-4" />} title="Cliente (outorgante)" subtitle="Quem dá os poderes: o titular da conta de energia">
        <div className="mb-4">
          <LeadPicker leads={leads} value={leadId} onChange={onLead} label="Buscar no CRM" />
        </div>
        <PartyFields value={data.grantor} onChange={(grantor) => update({ grantor })} />
      </Section>

      <Section title="Unidade consumidora" subtitle="Aparece na conta de luz como “Conta contrato” ou “UC”">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nº da unidade consumidora">
            <Input value={data.uc} onChange={(e) => update({ uc: e.target.value })} placeholder="Ex.: 3001234567" inputMode="numeric" />
          </Field>
          <Field label="Validade">
            <Select value={String(data.validityMonths)} onChange={(e) => update({ validityMonths: Number(e.target.value) })}>
              {[6, 12, 24, 36].map((m) => (
                <option key={m} value={m}>
                  {m} meses
                </option>
              ))}
              <option value={0}>Indeterminada</option>
            </Select>
          </Field>
          <Field label="Endereço da instalação" className="col-span-2">
            <Input value={data.ucAddress} onChange={(e) => update({ ucAddress: e.target.value })} placeholder="Rua, número, bairro, cidade/UF" />
          </Field>
          <Field label="Distribuidora" className="col-span-2">
            <Input value={data.utility} onChange={(e) => update({ utility: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="Poderes" subtitle="Marque o que a sua equipe poderá fazer em nome do cliente">
        <div className="grid gap-2">
          {POWERS.map((p) => {
            const on = data.powers.includes(p.key);
            return (
              <button
                type="button"
                key={p.key}
                onClick={() => toggle(p.key)}
                className={cx(
                  "flex items-start gap-3 rounded-xl p-3 text-left ring-1 transition",
                  on ? "bg-sun-50/70 ring-sun-300" : "bg-white ring-ink-200 hover:ring-ink-300",
                )}
              >
                <span className={cx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md ring-1", on ? "bg-ink-900 text-brand-yellow ring-ink-900" : "ring-ink-300")}>
                  {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink-900">{p.label}</span>
                  <span className="line-clamp-2 text-xs text-ink-500">{p.text}</span>
                </span>
              </button>
            );
          })}
        </div>
        <Field label="Outros poderes (opcional)" className="mt-3">
          <Textarea value={data.extraPowers} onChange={(e) => update({ extraPowers: e.target.value })} placeholder="Ex.: retirar documentos e receber correspondências da distribuidora" className="min-h-[64px]" />
        </Field>
        <div className="mt-3">
          <Switch checked={data.substabelecer} onChange={(v) => update({ substabelecer: v })} label="Permitir substabelecer (repassar os poderes a outra pessoa)" />
        </div>
      </Section>

      <Section title="Outorgado (sua empresa)" subtitle="Vem de Configurações → Empresa; ajuste se precisar">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Empresa ou procurador" className="col-span-2">
            <Input value={g.name} onChange={(e) => setG({ name: e.target.value })} />
          </Field>
          <Field label="CNPJ / CPF">
            <Input value={g.doc} onChange={(e) => setG({ doc: e.target.value })} inputMode="numeric" />
          </Field>
          <Field label="Cidade">
            <Input value={g.city} onChange={(e) => setG({ city: e.target.value })} />
          </Field>
          <Field label="Endereço" className="col-span-2">
            <Input value={g.address} onChange={(e) => setG({ address: e.target.value })} />
          </Field>
          <Field label="Responsável técnico">
            <Input value={g.techName} onChange={(e) => setG({ techName: e.target.value })} placeholder="Opcional" />
          </Field>
          <Field label="Registro (CREA/CFT)">
            <Input value={g.techRegistry} onChange={(e) => setG({ techRegistry: e.target.value })} placeholder="Opcional" />
          </Field>
        </div>
      </Section>

      <PlaceDate data={data} update={update} />
    </>
  );
}

function PlaceDate({ data, update }: { data: { place: string; date: string }; update: (p: { place?: string; date?: string }) => void }) {
  return (
    <Section title="Local e data">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Local">
          <Input value={data.place} onChange={(e) => update({ place: e.target.value })} />
        </Field>
        <Field label="Data">
          <Input type="date" value={data.date} onChange={(e) => update({ date: e.target.value })} />
        </Field>
      </div>
    </Section>
  );
}

function AluguelForm({
  data,
  update,
  leads,
  leadId,
  onLead,
}: {
  data: AluguelData;
  update: (p: Partial<AluguelData>) => void;
  leads: LeadLite[];
  leadId: string | null;
  onLead: (id: string, target: "tenant" | "landlord") => void;
}) {
  const [leadAs, setLeadAs] = useState<"tenant" | "landlord">("tenant");
  const pr = data.property;
  const setP = (patch: Partial<AluguelData["property"]>) => update({ property: { ...pr, ...patch } });
  return (
    <>
      <Section title="Buscar no CRM" subtitle="Preencha uma das partes com os dados de um lead">
        <div className="grid gap-3">
          <Segmented
            size="sm"
            value={leadAs}
            onChange={setLeadAs}
            options={[
              { value: "tenant", label: "Lead é o locatário" },
              { value: "landlord", label: "Lead é o locador" },
            ]}
          />
          <LeadPicker leads={leads} value={leadId} onChange={(id) => onLead(id, leadAs)} label="Lead" />
        </div>
      </Section>

      <Section title="Locador(a)" subtitle="Dono do imóvel">
        <PartyFields value={data.landlord} onChange={(landlord) => update({ landlord })} />
      </Section>
      <Section title="Locatário(a)" subtitle="Quem vai alugar">
        <PartyFields value={data.tenant} onChange={(tenant) => update({ tenant })} />
      </Section>

      <Section title="Imóvel">
        <div className="grid grid-cols-2 gap-3">
          <Segmented
            className="col-span-2 justify-self-start"
            size="sm"
            value={pr.purpose}
            onChange={(purpose) => setP({ purpose })}
            options={[
              { value: "residencial", label: "Residencial" },
              { value: "comercial", label: "Comercial" },
              { value: "usina", label: "Usina solar" },
            ]}
          />
          <Field label="Endereço completo" className="col-span-2">
            <Input value={pr.address} onChange={(e) => setP({ address: e.target.value })} placeholder="Rua, número, complemento e bairro" />
          </Field>
          <Field label="Cidade">
            <Input value={pr.city} onChange={(e) => setP({ city: e.target.value })} />
          </Field>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <Field label="UF">
              <Input value={pr.state} maxLength={2} onChange={(e) => setP({ state: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="CEP">
              <Input value={pr.cep} onChange={(e) => setP({ cep: e.target.value })} inputMode="numeric" />
            </Field>
          </div>
          <Field label="Descrição (opcional)" className="col-span-2">
            <Input
              value={pr.description}
              onChange={(e) => setP({ description: e.target.value })}
              placeholder={pr.purpose === "usina" ? "Ex.: área de 2.000 m² / telhado do galpão de 800 m²" : "Ex.: casa com 3 quartos, garagem para 2 carros"}
            />
          </Field>
        </div>
      </Section>

      <Section title="Valores e prazo">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Aluguel mensal" className="col-span-2" hint={data.rent > 0 ? <span className="italic">{moneyInWords(data.rent)}</span> : undefined}>
            <MoneyInput value={data.rent} onChange={(rent) => update({ rent })} />
          </Field>
          <Field label="Vencimento (dia)">
            <NumberInput value={data.dueDay} onChange={(v) => update({ dueDay: Math.min(31, Math.max(1, Math.round(v))) })} digits={0} />
          </Field>
          <Field label="Prazo">
            <Select value={String(data.months)} onChange={(e) => update({ months: Number(e.target.value) })}>
              {[6, 12, 24, 30, 36, 48, 60, 120, 180, 240, 300].map((m) => (
                <option key={m} value={m}>
                  {m} meses{m >= 24 && m % 12 === 0 ? ` (${m / 12} anos)` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Início">
            <Input type="date" value={data.startDate} onChange={(e) => update({ startDate: e.target.value })} />
          </Field>
          <Field label="Reajuste anual">
            <Select value={data.index} onChange={(e) => update({ index: e.target.value as AluguelData["index"] })}>
              <option>IGP-M</option>
              <option>IPCA</option>
              <option>INPC</option>
            </Select>
          </Field>
          <Field label="Forma de pagamento" className="col-span-2">
            <Input value={data.payment} onChange={(e) => update({ payment: e.target.value })} placeholder="Ex.: PIX para a chave 000.000.000-00" />
          </Field>
          <Field label="Multa por atraso">
            <NumberInput value={data.lateFee} onChange={(lateFee) => update({ lateFee })} suffix="%" digits={0} />
          </Field>
          <Field label="Multa rescisória">
            <NumberInput value={data.penaltyMonths} onChange={(penaltyMonths) => update({ penaltyMonths: Math.round(penaltyMonths) })} suffix="aluguéis" digits={0} />
          </Field>
        </div>
        <div className="mt-3">
          <Switch checked={data.chargesByTenant} onChange={(chargesByTenant) => update({ chargesByTenant })} label="IPTU, condomínio, água e energia por conta do locatário" />
        </div>
      </Section>

      <Section title="Garantia">
        <Segmented
          size="sm"
          value={data.guarantee}
          onChange={(guarantee) => update({ guarantee })}
          options={[
            { value: "nenhuma", label: "Sem garantia" },
            { value: "caucao", label: "Caução" },
            { value: "fiador", label: "Fiador" },
            { value: "seguro", label: "Seguro fiança" },
          ]}
        />
        {data.guarantee === "caucao" && (
          <Field label="Caução (máximo 3 aluguéis)" className="mt-3" hint={data.rent > 0 ? `Total: ${(data.rent * data.depositMonths).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : undefined}>
            <Select value={String(data.depositMonths)} onChange={(e) => update({ depositMonths: Number(e.target.value) })}>
              {[1, 2, 3].map((m) => (
                <option key={m} value={m}>
                  {m} {m === 1 ? "aluguel" : "aluguéis"}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {data.guarantee === "fiador" && (
          <div className="mt-4">
            <PartyFields value={data.guarantor} onChange={(guarantor) => update({ guarantor })} />
          </div>
        )}
      </Section>

      <Section title="Testemunhas e cláusulas extras" subtitle="Testemunhas também assinam pelo link (opcional)">
        <div className="grid grid-cols-2 gap-3">
          {data.witnesses.map((w, i) => (
            <div key={i} className="col-span-2 grid grid-cols-2 gap-3 sm:col-span-1 sm:grid-cols-1">
              <Field label={`Testemunha ${i + 1}`}>
                <Input value={w.name} onChange={(e) => update({ witnesses: data.witnesses.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="Nome" />
              </Field>
              <Field label="CPF">
                <Input value={w.doc} onChange={(e) => update({ witnesses: data.witnesses.map((x, j) => (j === i ? { ...x, doc: e.target.value } : x)) })} inputMode="numeric" />
              </Field>
            </div>
          ))}
          <Field label="Cláusulas extras (uma por linha)" className="col-span-2">
            <Textarea value={data.extraClauses} onChange={(e) => update({ extraClauses: e.target.value })} placeholder="Ex.: É permitida a permanência de animais de estimação de pequeno porte." />
          </Field>
        </div>
      </Section>

      <PlaceDate data={data} update={update} />
    </>
  );
}

/* ---------------------------------------------------------------- envio */

function SendModal({
  open,
  onClose,
  kind,
  leadId,
  signers,
  company,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  kind: DocKind;
  leadId: string | null;
  signers: DocumentSigner[];
  company: string;
  onChanged?: () => void;
}) {
  const { user } = useApp();
  const [mailing, setMailing] = useState<string | null>(null);
  const url = (t: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/assinar/${t}`;
  const message = (s: DocumentSigner) => {
    const first = s.name.split(/[\s(]/)[0];
    const what =
      kind === "procuracao"
        ? `a procuração que nos permite cuidar de todo o processo do seu sistema junto à Equatorial`
        : s.role === "testemunha1" || s.role === "testemunha2"
          ? "o contrato de locação em que você é testemunha"
          : "o contrato de locação";
    return `Olá, ${first}! Aqui é da ${company || "Quark Energia"}. Segue ${what}, para assinatura eletrônica.\n\nÉ só abrir o link, conferir e assinar com o dedo pelo celular — leva 1 minuto ✍️\n${url(s.token)}`;
  };

  const log = (content: string, type = "whatsapp") => {
    if (leadId) supabase().from("activities").insert({ lead_id: leadId, type, content, created_by: user.id }).then(() => {});
  };

  const sendMail = async (s: DocumentSigner) => {
    setMailing(s.id);
    const res = await fetch("/api/documents/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signerId: s.id }) }).catch(() => null);
    setMailing(null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && json.ok) {
      toast.success(`E-mail enviado para ${s.email}`);
      log(`Link de assinatura enviado por e-mail: ${DOC_KINDS[kind].label}`, "email");
    } else toast.error(json.error ?? "Não foi possível enviar o e-mail");
  };

  const done = signers.filter((s) => s.signed_at).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Enviar para assinatura"
      subtitle={`${done} de ${signers.length} ${signers.length === 1 ? "assinatura" : "assinaturas"} · cada pessoa tem o seu link`}
      footer={
        <Button variant="secondary" onClick={() => { onChanged?.(); onClose(); }}>
          Fechar
        </Button>
      }
    >
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${signers.length ? (done / signers.length) * 100 : 0}%` }} />
      </div>
      <div className="grid gap-3">
        {signers.map((s) => (
          <div key={s.id} className="rounded-2xl p-4 ring-1 ring-ink-200">
            <div className="flex items-start gap-3">
              <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", s.signed_at ? "bg-emerald-50 text-emerald-600" : "bg-ink-100 text-ink-500")}>
                {s.signed_at ? <CheckCircle2 className="h-5 w-5" /> : <FileSignature className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.name}</p>
                <p className="text-xs text-ink-500">
                  {ROLE_LABEL[s.role] ?? s.role} ·{" "}
                  {s.signed_at ? (
                    <span className="font-semibold text-emerald-700">assinou {formatDateTime(s.signed_at)}</span>
                  ) : s.viewed_at ? (
                    <span className="font-semibold text-amber-700">abriu {formatDateTime(s.viewed_at)}, ainda não assinou</span>
                  ) : (
                    "ainda não abriu"
                  )}
                </p>
              </div>
            </div>
            {!s.signed_at && (
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={whatsappUrl(s.phone, message(s))}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => log(`Link de assinatura enviado no WhatsApp: ${DOC_KINDS[kind].label} (${ROLE_LABEL[s.role] ?? s.role})`)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-[13px] font-semibold text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-9"
                  onClick={async () => {
                    await navigator.clipboard.writeText(url(s.token)).catch(() => {});
                    toast.success("Link copiado");
                  }}
                >
                  <Link2 className="h-4 w-4" /> Copiar link
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-9"
                  onClick={async () => {
                    await navigator.clipboard.writeText(message(s)).catch(() => {});
                    toast.success("Mensagem copiada");
                  }}
                >
                  <Copy className="h-4 w-4" /> Copiar mensagem
                </Button>
                {s.email && (
                  <Button size="sm" variant="secondary" className="h-9" loading={mailing === s.id} onClick={() => sendMail(s)}>
                    <Mail className="h-4 w-4" /> E-mail
                  </Button>
                )}
                <a href={url(s.token)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-ink-500 hover:bg-ink-100">
                  <Eye className="h-4 w-4" /> Ver como cliente
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-xl bg-ink-50 p-3 text-xs leading-relaxed text-ink-500">
        A assinatura eletrônica tem validade jurídica (MP 2.200-2/2001 e Lei 14.063/2020): registramos nome, CPF, data, hora, IP e o código de verificação do texto. Se a
        distribuidora pedir assinatura com certificado gov.br, baixe o PDF e assine gratuitamente em assinador.iti.br.
      </p>
    </Modal>
  );
}
