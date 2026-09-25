"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useReward } from "./rewards";
import { ROOF_TYPES, SEGMENTS, SOURCES, STAGES, UFS } from "@/lib/constants";
import { notify } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";
import type { Lead, Segment } from "@/lib/types";
import { useApp } from "./app-context";
import { Button, Field, Input, Modal, MoneyInput, NumberInput, Segmented, Select, Textarea, cx } from "../ui";

type Form = Partial<Lead>;

const empty = (ownerId: string): Form => ({
  name: "",
  phone: "",
  email: "",
  city: "",
  state: "",
  source: "Indicação",
  status: "novo",
  segment: "solar",
  temperature: "morno",
  connection_type: "bi",
  consumption_kwh: null,
  avg_bill: null,
  owner_id: ownerId,
});

export function LeadFormModal({
  open,
  onClose,
  lead,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  lead?: Lead | null;
  onCreated?: (id: string) => void;
}) {
  const { user, profiles, settings } = useApp();
  const router = useRouter();
  const { reward } = useReward();
  const [form, setForm] = useState<Form>(empty(user.id));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(lead ? { ...lead } : empty(user.id));
  }, [open, lead, user.id]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const tariff = settings.defaults.tariff ?? 0.95;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return toast.error("Informe o nome do cliente");
    setSaving(true);
    const payload = { ...form };
    delete (payload as Record<string, unknown>).id;
    delete (payload as Record<string, unknown>).created_at;
    delete (payload as Record<string, unknown>).updated_at;
    if (!payload.consumption_kwh && payload.avg_bill) payload.consumption_kwh = Math.round(payload.avg_bill / (payload.tariff || tariff));

    const sb = supabase();
    if (lead?.id) {
      const { error } = await sb.from("leads").update(payload).eq("id", lead.id);
      setSaving(false);
      if (error) return toast.error(dbHint(error.message));
      toast.success("Lead atualizado");
      onClose();
    } else {
      const { data, error } = await sb.from("leads").insert(payload).select("id").single();
      setSaving(false);
      if (error) return toast.error(dbHint(error.message));
      toast.success("Lead cadastrado", { description: "Equipe notificada por e-mail." });
      notify("lead", data.id);
      reward("lead", data.id);
      onClose();
      if (onCreated) onCreated(data.id);
      else router.push(`/leads/${data.id}`);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={lead ? "Editar lead" : "Novo lead"}
      subtitle={lead ? undefined : "Cadastre o cliente — a equipe recebe um alerta por e-mail."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button form="lead-form" type="submit" loading={saving}>
            {lead ? "Salvar alterações" : "Cadastrar lead"}
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Interesse do cliente" className="sm:col-span-2">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(SEGMENTS) as Segment[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => set("segment", k)}
                className={cx(
                  "rounded-xl px-3 py-2.5 text-left ring-1 transition",
                  (form.segment ?? "solar") === k ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-700 ring-ink-200 hover:ring-ink-300",
                )}
              >
                <p className="text-sm font-semibold">{k === "solar" ? "☀️ Solar" : k === "save" ? "⚡ S.A.V.E" : "☀️⚡ Ambos"}</p>
                <p className={cx("text-[11px]", (form.segment ?? "solar") === k ? "text-ink-300" : "text-ink-500")}>{SEGMENTS[k].label}</p>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Nome completo *" className="sm:col-span-2">
          <Input autoFocus value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Maria Oliveira" />
        </Field>
        <Field label="WhatsApp / telefone">
          <Input type="tel" inputMode="tel" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="(00) 00000-0000" />
        </Field>
        <Field label="E-mail">
          <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="cliente@email.com" />
        </Field>
        <Field label="Cidade">
          <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="UF">
          <Select value={form.state ?? ""} onChange={(e) => set("state", e.target.value)}>
            <option value="">—</option>
            {UFS.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </Select>
        </Field>
        <Field label="Endereço de instalação" className="sm:col-span-2">
          <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="Rua, número, bairro" />
        </Field>

        {form.segment !== "save" && (
        <div className="sm:col-span-2 mt-2 border-t border-ink-100 pt-4">
          <p className="mb-3 text-xs font-bold tracking-wider text-ink-400 uppercase">Consumo de energia</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Consumo médio">
              <NumberInput value={form.consumption_kwh} onChange={(v) => set("consumption_kwh", v || null)} suffix="kWh" digits={0} />
            </Field>
            <Field label="Conta média">
              <MoneyInput value={form.avg_bill} onChange={(v) => set("avg_bill", v || null)} />
            </Field>
            <Field label="Ligação">
              <Segmented
                className="w-full [&>button]:flex-1"
                value={form.connection_type ?? "bi"}
                onChange={(v) => set("connection_type", v)}
                options={[
                  { value: "mono", label: "Mono" },
                  { value: "bi", label: "Bi" },
                  { value: "tri", label: "Tri" },
                ]}
              />
            </Field>
            <Field label="Tipo de telhado">
              <Select value={form.roof_type ?? ""} onChange={(e) => set("roof_type", e.target.value)}>
                <option value="">—</option>
                {ROOF_TYPES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Field>
            <Field label="Tarifa (R$/kWh)">
              <NumberInput value={form.tariff} onChange={(v) => set("tariff", v || null)} digits={3} placeholder={String(tariff).replace(".", ",")} />
            </Field>
            <Field label="Valor estimado">
              <MoneyInput value={form.estimated_value} onChange={(v) => set("estimated_value", v || null)} digits={0} />
            </Field>
          </div>
        </div>

        )}

        <div className="sm:col-span-2 mt-2 border-t border-ink-100 pt-4">
          <p className="mb-3 text-xs font-bold tracking-wider text-ink-400 uppercase">Funil</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Etapa">
              <Select value={form.status} onChange={(e) => set("status", e.target.value as Lead["status"])}>
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Origem">
              <Select value={form.source ?? ""} onChange={(e) => set("source", e.target.value)}>
                {SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="Temperatura">
              <Segmented
                className="w-full [&>button]:flex-1"
                value={form.temperature ?? "morno"}
                onChange={(v) => set("temperature", v)}
                options={[
                  { value: "frio", label: "❄️ Frio" },
                  { value: "morno", label: "🌤️ Morno" },
                  { value: "quente", label: "🔥 Quente" },
                ]}
              />
            </Field>
            <Field label="Responsável">
              <Select value={form.owner_id ?? ""} onChange={(e) => set("owner_id", e.target.value || null)}>
                <option value="">—</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name ?? p.email}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Observações" className="sm:col-span-2">
              <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Informações importantes sobre o cliente…" />
            </Field>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** Traduz o erro de coluna inexistente (banco sem a atualização mais recente). */
export function dbHint(message: string) {
  return /segment|column|coluna/i.test(message) ? "Banco de dados desatualizado: rode novamente o supabase/schema.sql no SQL Editor do Supabase." : message;
}
