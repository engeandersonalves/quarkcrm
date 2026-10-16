"use client";

import { Check, Clock, Eye, Laptop, MousePointerClick, Radar, Smartphone } from "lucide-react";
import { Card, cx } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";

type Ev = { kind: "open" | "section" | "time" | "click"; detail: string | null; value: number; device: string | null; created_at: string };

const fmtDur = (s: number) => {
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
};

/**
 * Rastreamento da proposta: quantas vezes abriu, quanto tempo leu, em que seções
 * parou mais e o que clicou. Atualiza em tempo real.
 */
export function TrackingCard({ proposalId, sections, clicks, className }: { proposalId: string; sections: { id: string; label: string }[]; clicks: Record<string, string>; className?: string }) {
  const { data } = useLive<Ev[] | null>(
    async () => {
      const { data, error } = await supabase().from("proposal_events").select("kind, detail, value, device, created_at").eq("proposal_id", proposalId).order("created_at", { ascending: true }).limit(3000);
      return error ? null : ((data ?? []) as Ev[]);
    },
    [proposalId],
    ["proposal_events"],
  );

  const evs = data ?? [];
  const opens = evs.filter((e) => e.kind === "open");
  const totalTime = evs.filter((e) => e.kind === "time").reduce((t, e) => t + e.value, 0);
  const timeBy = new Map<string, number>();
  for (const e of evs) if (e.kind === "time" && e.detail) timeBy.set(e.detail, (timeBy.get(e.detail) ?? 0) + e.value);
  const seen = new Set(evs.filter((e) => e.kind === "section" || e.kind === "time").map((e) => e.detail ?? ""));
  const maxTime = Math.max(1, ...timeBy.values());
  const last = evs.length ? evs[evs.length - 1].created_at : null;
  const live = last ? Date.now() - new Date(last).getTime() < 60_000 : false;
  const devices = new Set(opens.map((e) => e.device).filter(Boolean));
  const recent = evs
    .filter((e) => e.kind === "open" || e.kind === "click")
    .slice(-6)
    .reverse();
  const top = [...timeBy.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <Card className={cx("overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-700">
            <Radar className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">Rastreamento da proposta</p>
            <p className="text-xs text-ink-500">{data === null ? "Rode o supabase/schema.sql para ativar" : opens.length ? `Última atividade ${relativeTime(last)}` : "Aguardando o cliente abrir o link"}</p>
          </div>
        </div>
        {live && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Lendo agora
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 divide-x divide-ink-100 border-b border-ink-100">
        <Kpi icon={<Eye className="h-3.5 w-3.5" />} label="Aberturas" value={String(opens.length)} />
        <Kpi icon={<Clock className="h-3.5 w-3.5" />} label="Leitura" value={totalTime ? fmtDur(totalTime) : "—"} />
        <Kpi icon={<Check className="h-3.5 w-3.5" />} label="Seções" value={`${sections.filter((s) => seen.has(s.id)).length}/${sections.length}`} />
      </div>

      <div className="px-5 py-4">
        <p className="mb-2.5 text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase">Onde o cliente passou mais tempo</p>
        <ul className="grid gap-2">
          {sections.map((s) => {
            const t = timeBy.get(s.id) ?? 0;
            const ok = seen.has(s.id);
            return (
              <li key={s.id} className="grid grid-cols-[16px_minmax(0,1fr)_44px] items-center gap-2 text-[13px]">
                <span className={cx("grid h-4 w-4 place-items-center rounded-full", ok ? "bg-emerald-500 text-white" : "bg-ink-100")}>{ok && <Check className="h-2.5 w-2.5" strokeWidth={3} />}</span>
                <div className="min-w-0">
                  <p className={cx("truncate", ok ? "text-ink-800" : "text-ink-400")}>{s.label}</p>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink-100">
                    <div className="h-full rounded-full bg-violet-500 transition-all duration-700" style={{ width: `${(t / maxTime) * 100}%` }} />
                  </div>
                </div>
                <span className="tnum text-right text-xs text-ink-500">{t ? fmtDur(t) : ""}</span>
              </li>
            );
          })}
        </ul>
        {top && top[1] >= 30 && (
          <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-900 ring-1 ring-violet-200">
            Mais interesse em <b>{sections.find((s) => s.id === top[0])?.label ?? top[0]}</b>. Use isso no próximo contato.
          </p>
        )}
      </div>

      {recent.length > 0 && (
        <div className="border-t border-ink-100 px-5 py-4">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase">Atividade recente</p>
          <ul className="grid gap-1.5">
            {recent.map((e, idx) => (
              <li key={idx} className="flex items-center gap-2 text-[13px] text-ink-700">
                {e.kind === "open" ? (
                  e.device === "celular" ? <Smartphone className="h-3.5 w-3.5 text-ink-400" /> : <Laptop className="h-3.5 w-3.5 text-ink-400" />
                ) : (
                  <MousePointerClick className="h-3.5 w-3.5 text-violet-600" />
                )}
                <span className="min-w-0 flex-1 truncate">{e.kind === "open" ? `Abriu no ${e.device || "navegador"}` : (clicks[e.detail ?? ""] ?? e.detail)}</span>
                <span className="shrink-0 text-xs text-ink-400">{relativeTime(e.created_at)}</span>
              </li>
            ))}
          </ul>
          {devices.size > 1 && <p className="mt-2 text-xs text-ink-500">Abriu em mais de um aparelho: pode estar mostrando para alguém.</p>}
        </div>
      )}
    </Card>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="px-3 py-3 text-center">
      <p className="flex items-center justify-center gap-1 text-[10px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
        {icon} {label}
      </p>
      <p className="tnum mt-0.5 font-display text-lg font-semibold text-ink-900">{value}</p>
    </div>
  );
}
