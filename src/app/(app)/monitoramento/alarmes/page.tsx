"use client";

import { ArrowLeft, BellRing, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Alert3D, Bolt3D, Gauge3D, IconTile, Inverter3D } from "@/components/icons3d";
import { AckAllButton, AlarmList, useAlarms } from "@/components/monitoring/alarm-list";
import { Button, Card, Empty, Field, NumberInput, PageHeader, Segmented, Skeleton, Switch } from "@/components/ui";
import { DEFAULT_ALARM_RULES, type AlarmRules } from "@/lib/monitoring/alarms";

export default function AlarmsPage() {
  const { profile } = useApp();
  const isAdmin = profile?.role === "admin";
  const [status, setStatus] = useState<"abertos" | "todos">("abertos");
  const { data: rows, loading, reload } = useAlarms({ status, limit: 300 });
  const { data: openRows } = useAlarms({ status: "abertos", limit: 500 });
  const [rules, setRules] = useState<AlarmRules | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/monitoring/alarms")
      .then((r) => r.json())
      .then((j) => setRules(j.rules ?? DEFAULT_ALARM_RULES))
      .catch(() => setRules(DEFAULT_ALARM_RULES));
  }, []);

  const open = openRows ?? [];
  const crit = open.filter((a) => a.severity === "critical").length;
  const plantsAffected = new Set(open.map((a) => a.plant_id)).size;
  const set = <K extends keyof AlarmRules>(k: K, v: AlarmRules[K]) => setRules((r) => (r ? { ...r, [k]: v } : r));
  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/monitoring/alarms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rules }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setSaving(false);
    if (!res?.ok) return toast.error(json.error ?? "Não foi possível salvar");
    toast.success("Limites salvos", { description: "Valem a partir da próxima leitura dos inversores." });
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        icon={<BellRing />}
        eyebrow="Monitoramento"
        title="Alarmes"
        subtitle="Avisos automáticos de tensão, temperatura, frequência, strings e usinas paradas"
        actions={
          <Link href="/monitoramento">
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" /> Usinas
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { k: "Alarmes ativos", v: String(open.length), icon: <Alert3D size={34} />, tone: "#F5B700" },
          { k: "Críticos", v: String(crit), icon: <Bolt3D size={32} />, tone: "#E5484D" },
          { k: "Usinas afetadas", v: String(plantsAffected), icon: <Inverter3D size={34} />, tone: "#8E6CF7" },
          { k: "Reconhecidos", v: String(open.filter((a) => a.acknowledged_at).length), icon: <Gauge3D size={32} />, tone: "#3FBF6A" },
        ].map((x) => (
          <Card key={x.k} className="relative overflow-hidden p-4">
            <div className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full blur-2xl" style={{ background: `${x.tone}26` }} />
            <IconTile tone={x.tone} className="h-11 w-11">
              {x.icon}
            </IconTile>
            <p className="mt-2.5 text-[10px] font-semibold tracking-[0.14em] text-ink-500 uppercase">{x.k}</p>
            <p className="tnum font-display text-2xl font-semibold text-ink-900">{x.v}</p>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented
              value={status}
              onChange={setStatus}
              options={[
                { value: "abertos", label: `Ativos · ${open.length}` },
                { value: "todos", label: "Histórico" },
              ]}
            />
            {open.some((a) => !a.acknowledged_at) && <AckAllButton onDone={reload} />}
          </div>
          {rows === null ? (
            <Empty icon={<BellRing className="h-6 w-6" />} title="Alarmes ainda não ativados" text="Rode o arquivo supabase/schema.sql no Supabase para criar o histórico e os alarmes." />
          ) : loading && !rows.length ? (
            <Skeleton className="h-64" />
          ) : rows.length ? (
            <AlarmList rows={rows} showPlant onChanged={reload} />
          ) : (
            <p className="rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">{status === "abertos" ? "Nenhum alarme ativo. Todas as leituras dentro dos limites." : "Nenhum alarme registrado ainda."}</p>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <p className="font-display text-[15px] font-semibold text-ink-900">Limites dos alarmes</p>
          <p className="mt-0.5 text-xs text-ink-500">Avaliados a cada leitura dos inversores (a cada 1h30, aproximadamente).</p>
          {!rules ? (
            <Skeleton className="mt-4 h-72" />
          ) : (
            <fieldset disabled={!isAdmin} className="mt-4 grid grid-cols-2 gap-3 disabled:opacity-70">
              <p className="col-span-2 text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">Tensão</p>
              <Field label="Máx. monofásico (220 V)">
                <NumberInput value={rules.overMono} onChange={(v) => set("overMono", v)} suffix="V" digits={0} />
              </Field>
              <Field label="Máx. trifásico (entre fases)">
                <NumberInput value={rules.overTri} onChange={(v) => set("overTri", v)} suffix="V" digits={0} />
              </Field>
              <Field label="Mín. monofásico">
                <NumberInput value={rules.underMono} onChange={(v) => set("underMono", v)} suffix="V" digits={0} />
              </Field>
              <Field label="Mín. trifásico">
                <NumberInput value={rules.underTri} onChange={(v) => set("underTri", v)} suffix="V" digits={0} />
              </Field>
              <Field label="Máx. rede 127 V">
                <NumberInput value={rules.over127} onChange={(v) => set("over127", v)} suffix="V" digits={0} />
              </Field>
              <Field label="Mín. rede 127 V">
                <NumberInput value={rules.under127} onChange={(v) => set("under127", v)} suffix="V" digits={0} />
              </Field>
              <p className="col-span-2 mt-1 text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">Inversor e usina</p>
              <Field label="Temperatura de alerta">
                <NumberInput value={rules.tempWarn} onChange={(v) => set("tempWarn", v)} suffix="°C" digits={0} />
              </Field>
              <Field label="Temperatura crítica">
                <NumberInput value={rules.tempCrit} onChange={(v) => set("tempCrit", v)} suffix="°C" digits={0} />
              </Field>
              <Field label="Frequência mínima">
                <NumberInput value={rules.freqMin} onChange={(v) => set("freqMin", v)} suffix="Hz" />
              </Field>
              <Field label="Frequência máxima">
                <NumberInput value={rules.freqMax} onChange={(v) => set("freqMax", v)} suffix="Hz" />
              </Field>
              <Field label="Diferença entre strings">
                <NumberInput value={rules.stringMismatchPct} onChange={(v) => set("stringMismatchPct", v)} suffix="%" digits={0} />
              </Field>
              <Field label="Geração baixa (após 15h)">
                <NumberInput value={rules.lowYield} onChange={(v) => set("lowYield", v)} suffix="kWh/kWp" />
              </Field>
              <Field label="Sem leitura por">
                <NumberInput value={rules.staleHours} onChange={(v) => set("staleHours", v)} suffix="h" digits={0} />
              </Field>
              <div className="flex items-end pb-2">
                <Switch checked={rules.email} onChange={(v) => set("email", v)} label="Avisar por e-mail" />
              </div>
              <p className="col-span-2 text-[11px] leading-relaxed text-ink-500">
                Acima do limite: alerta. Mais de 5% acima: crítico. O e-mail vai para os endereços de Configurações → Alertas. Trifásico usa a tensão entre fases; sem ela, cada fase contra o máximo monofásico.
              </p>
              {isAdmin && (
                <Button className="col-span-2" onClick={save} loading={saving}>
                  <Save className="h-4 w-4" /> Salvar limites
                </Button>
              )}
            </fieldset>
          )}
        </Card>
      </div>
    </div>
  );
}
