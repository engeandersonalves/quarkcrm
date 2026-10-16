"use client";

import { ArrowLeft, Check, Eye, EyeOff, Loader2, Lock, PlugZap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { missingCredentials, PROVIDERS, type ProviderInfo } from "@/lib/monitoring/catalog";
import { useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";
import { Button, Field, Input, Modal, NumberInput, Select, Textarea, cx } from "../ui";

const BRANDS = ["AUXSOL", "Canadian Solar (CSI Cloud)", "Hoymiles", "WEG", "Intelbras", "Sofar", "SMA", "Fronius", "Enphase", "Outro"];

/** Selo com a inicial do fabricante na cor da marca. */
export function ProviderMark({ id, className }: { id: string; className?: string }) {
  const p = PROVIDERS.find((x) => x.id === id);
  return (
    <span
      className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]", className)}
      style={{ background: `linear-gradient(145deg, ${p?.color ?? "#555"}, ${p?.color ?? "#555"}b0)` }}
      aria-hidden
    >
      {(p?.name ?? "?").slice(0, 2)}
    </span>
  );
}

export function ConnectModal({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: () => void }) {
  const router = useRouter();
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [manual, setManual] = useState({ name: "", capacity: 0, brand: BRANDS[0], address: "", leadId: "" });
  const { data: leads } = useLive(async () => (open ? ((await supabase().from("leads").select("id,name,city").order("name").limit(3000)).data ?? []) as { id: string; name: string; city: string | null }[] : []), [open], []);
  const [values, setValues] = useState<Record<string, string>>({});
  const [label, setLabel] = useState("");
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = (p: ProviderInfo) => {
    setProvider(p);
    setError("");
    setValues(Object.fromEntries(p.fields.filter((f) => f.type === "select").map((f) => [f.key, f.options?.[0]?.value ?? ""])));
  };
  const close = () => {
    if (busy) return;
    setProvider(null);
    setValues({});
    setLabel("");
    setError("");
    onClose();
  };

  const submitManual = async () => {
    if (!manual.name.trim()) return setError("Informe o nome da usina.");
    setBusy(true);
    setError("");
    const res = await fetch("/api/monitoring/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: manual.name, capacityKwp: manual.capacity, brand: manual.brand, address: manual.address, leadId: manual.leadId }),
    }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok || !json.ok) return setError(json.error ?? "Não foi possível cadastrar.");
    toast.success("Usina cadastrada", { description: "Agora importe a planilha de geração." });
    onConnected();
    setProvider(null);
    setManual({ name: "", capacity: 0, brand: BRANDS[0], address: "", leadId: "" });
    onClose();
    router.push(`/monitoramento/${json.id}?importar=1`);
  };

  const submit = async () => {
    if (!provider) return;
    if (provider.manual) return submitManual();
    const miss = missingCredentials(provider.id, values);
    if (miss.length) return setError(`Preencha: ${miss.join(", ")}.`);
    setBusy(true);
    setError("");
    const res = await fetch("/api/monitoring/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: provider.id, label, credentials: values }),
    }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok || !json.ok) return setError(json.error ?? "Não foi possível conectar. Tente de novo.");
    toast.success(`${provider.platform} conectado`, { description: json.plants ? `${json.plants} ${json.plants === 1 ? "usina importada" : "usinas importadas"}` : "Nenhuma usina encontrada nesta conta ainda." });
    onConnected();
    setProvider(null);
    setValues({});
    setLabel("");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={provider ? (provider.manual ? "Cadastrar usina por planilha" : `Conectar ${provider.platform}`) : "Conectar conta de inversores"}
      subtitle={provider ? provider.brands : "Escolha o fabricante: importamos todas as usinas da conta"}
      footer={
        provider ? (
          <>
            <Button variant="ghost" onClick={() => setProvider(null)} disabled={busy}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
              {busy ? (provider.manual ? "Cadastrando…" : "Conectando e importando usinas…") : provider.manual ? "Cadastrar usina" : "Conectar e importar"}
            </Button>
          </>
        ) : undefined
      }
    >
      {!provider ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => pick(p)}
              className={cx(
                "group flex items-center gap-3 rounded-2xl bg-ink-50 p-3.5 text-left ring-1 ring-ink-200 transition hover:ring-sun-400 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]",
                p.id === "solarz" && "ring-2 ring-sun-400 sm:col-span-2",
              )}
            >
              <ProviderMark id={p.id} />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-semibold text-ink-900">{p.name}</span>
                <span className="block truncate text-xs text-ink-500">{p.id === "solarz" ? "Recomendado · um login traz as usinas de todos os fabricantes" : p.manual ? p.brands : p.platform}</span>
              </span>
              <span className="text-xs font-semibold text-sun-700 opacity-0 transition group-hover:opacity-100">Conectar →</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-200/70 dark:bg-white/[0.03]">
            <p className="mb-2 text-[11px] font-bold tracking-[0.16em] text-ink-500 uppercase">Como conseguir o acesso</p>
            <ol className="grid gap-1.5">
              {provider.steps.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-snug text-ink-700">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sun-100 text-[11px] font-bold text-sun-700">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>

          {provider.manual ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome da usina" className="sm:col-span-2">
                <Input value={manual.name} onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))} placeholder="Ex.: Residência Ana Paula" />
              </Field>
              <Field label="Fabricante do inversor">
                <Select value={manual.brand} onChange={(e) => setManual((m) => ({ ...m, brand: e.target.value }))}>
                  {BRANDS.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Potência instalada">
                <NumberInput value={manual.capacity} onChange={(capacity) => setManual((m) => ({ ...m, capacity }))} suffix="kWp" />
              </Field>
              <Field label="Endereço / cidade" className="sm:col-span-2">
                <Input value={manual.address} onChange={(e) => setManual((m) => ({ ...m, address: e.target.value }))} placeholder="Opcional" />
              </Field>
              <Field label="Cliente do CRM" className="sm:col-span-2">
                <Select value={manual.leadId} onChange={(e) => setManual((m) => ({ ...m, leadId: e.target.value }))}>
                  <option value="">Sem vínculo</option>
                  {(leads ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.city ? ` — ${l.city}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {provider.fields.map((f) => (
              <Field key={f.key} label={`${f.label}${f.optional ? " (opcional)" : ""}`} hint={f.hint} className={cx((f.type === "textarea" || f.type === "select") && "sm:col-span-2")}>
                {f.type === "select" ? (
                  <Select value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : f.type === "textarea" ? (
                  <Textarea value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className="min-h-[72px] font-mono text-xs" spellCheck={false} />
                ) : (
                  <div className="relative">
                    <Input
                      type={f.type === "password" && !show[f.key] ? "password" : "text"}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      autoComplete="off"
                      spellCheck={false}
                      className={f.type === "password" ? "pr-10" : undefined}
                    />
                    {f.type === "password" && (
                      <button type="button" onClick={() => setShow((s) => ({ ...s, [f.key]: !s[f.key] }))} className="absolute top-1/2 right-2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-ink-400 hover:text-ink-700" aria-label={show[f.key] ? "Ocultar" : "Mostrar"}>
                        {show[f.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                )}
              </Field>
            ))}
            <Field label="Nome da conexão (opcional)" className="sm:col-span-2">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`Ex.: ${provider.name} · clientes Maceió`} />
            </Field>
          </div>
          )}

          {error && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

          {!provider.manual && (
          <>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-500">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sun-600" />
            As credenciais são testadas direto no {provider.platform}, guardadas criptografadas e usadas só pelo servidor. Ninguém da equipe consegue vê-las depois.
          </p>
          <p className="-mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink-500">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sun-600" />
            Depois de conectar, as usinas são atualizadas ao abrir esta tela e todo dia pela manhã.
          </p>
          </>
          )}
        </div>
      )}
    </Modal>
  );
}
