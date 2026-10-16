"use client";

import { Check, CheckCheck, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button, cx } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { ALARM_LABEL, type AlarmKind, type Severity } from "@/lib/monitoring/alarms";
import { useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";

export type AlarmRow = {
  id: string;
  plant_id: string;
  device_sn: string;
  kind: AlarmKind;
  severity: Severity;
  message: string;
  value: number | null;
  threshold: number | null;
  started_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  acknowledged_at: string | null;
  plant?: { id: string; name: string } | null;
};

export const SEVERITY_STYLE: Record<Severity, { label: string; chip: string; dot: string }> = {
  critical: { label: "Crítico", chip: "bg-rose-50 text-rose-700 ring-rose-600/20", dot: "bg-rose-500" },
  warning: { label: "Alerta", chip: "bg-amber-50 text-amber-800 ring-amber-600/20", dot: "bg-amber-400" },
  info: { label: "Info", chip: "bg-sky-50 text-sky-800 ring-sky-600/20", dot: "bg-sky-400" },
};

const dur = (a: string, b: string | null) => {
  const m = Math.max(0, Math.round(((b ? new Date(b).getTime() : Date.now()) - new Date(a).getTime()) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} dias`;
};

/** Alarmes em tempo real (abertos primeiro). `plantId` filtra uma usina; sem ele, mostra o nome da usina. */
export function useAlarms(opts: { plantId?: string; status: "abertos" | "todos"; limit?: number }) {
  return useLive<AlarmRow[] | null>(
    async () => {
      let q = supabase().from("monitoring_alarms").select("*, plant:monitoring_plants(id,name)").order("started_at", { ascending: false }).limit(opts.limit ?? 200);
      if (opts.plantId) q = q.eq("plant_id", opts.plantId);
      if (opts.status === "abertos") q = q.is("resolved_at", null);
      const { data, error } = await q;
      if (error) return null;
      const rows = (data ?? []) as AlarmRow[];
      // Abertos primeiro, críticos antes
      const rank = (a: AlarmRow) => (a.resolved_at ? 2 : a.severity === "critical" ? 0 : 1);
      return rows.sort((a, b) => rank(a) - rank(b) || b.started_at.localeCompare(a.started_at));
    },
    [opts.plantId, opts.status, opts.limit],
    ["monitoring_alarms"],
  );
}

export async function acknowledge(body: { id?: string; plantId?: string; all?: boolean }) {
  const res = await fetch("/api/monitoring/alarms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const json = res ? await res.json().catch(() => ({})) : {};
  if (!res?.ok) toast.error(json.error ?? "Não foi possível reconhecer agora");
  return !!res?.ok;
}

export function AlarmList({ rows, showPlant, compact, onChanged }: { rows: AlarmRow[]; showPlant?: boolean; compact?: boolean; onChanged?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!rows.length) return null;
  return (
    <ul className="grid gap-2">
      {rows.map((a) => {
        const st = SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.warning;
        const open = !a.resolved_at;
        return (
          <li key={a.id} className={cx("flex items-start gap-3 rounded-xl p-3 ring-1 transition", open ? "bg-white ring-ink-200 dark:bg-white/[0.03]" : "bg-ink-50/60 opacity-70 ring-ink-200/60 dark:bg-white/[0.02]")}>
            <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0">
              {open && a.severity === "critical" && <span className={cx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", st.dot)} />}
              <span className={cx("relative inline-flex h-2.5 w-2.5 rounded-full", open ? st.dot : "bg-ink-300")} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-semibold text-ink-900">{ALARM_LABEL[a.kind] ?? a.kind}</p>
                <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-bold ring-1", open ? st.chip : "bg-ink-100 text-ink-500 ring-ink-500/15")}>{open ? st.label : "Resolvido"}</span>
                {a.acknowledged_at && open && <span className="text-[10px] font-semibold text-ink-500">· reconhecido</span>}
                {showPlant && a.plant && (
                  <Link href={`/monitoramento/${a.plant.id}`} className="inline-flex items-center gap-0.5 text-xs font-medium text-sun-700 hover:underline">
                    {a.plant.name} <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
              <p className="mt-0.5 text-[13px] text-ink-600">{a.message}</p>
              {!compact && (
                <p className="mt-1 text-[11px] text-ink-400">
                  {a.device_sn ? `Inversor ${a.device_sn} · ` : ""}desde {relativeTime(a.started_at)} · {open ? `há ${dur(a.started_at, null)}` : `durou ${dur(a.started_at, a.resolved_at)}`}
                </p>
              )}
            </div>
            {open && !a.acknowledged_at && (
              <Button
                size="sm"
                variant="ghost"
                loading={busy === a.id}
                onClick={async () => {
                  setBusy(a.id);
                  if (await acknowledge({ id: a.id })) onChanged?.();
                  setBusy(null);
                }}
                title="Marcar como visto"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function AckAllButton({ plantId, onDone }: { plantId?: string; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        if (await acknowledge({ plantId, all: true })) {
          toast.success("Alarmes reconhecidos");
          onDone?.();
        }
        setBusy(false);
      }}
    >
      <CheckCheck className="h-4 w-4" /> Reconhecer todos
    </Button>
  );
}
