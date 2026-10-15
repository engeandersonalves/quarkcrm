"use client";

import { Activity, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useLive } from "@/lib/live";
import { STATUS_LABEL, fmtKw, fmtKwh, type PlantRow } from "@/lib/monitoring/view";
import { supabase } from "@/lib/supabase/client";
import { Card, CardHeader, cx } from "../ui";

const DOT: Record<string, string> = { online: "bg-emerald-400", alarm: "bg-amber-400", offline: "bg-rose-500", unknown: "bg-ink-400" };

/** Usinas monitoradas vinculadas ao cliente (some quando não há nenhuma). */
export function LeadPlants({ leadId }: { leadId: string }) {
  const { data } = useLive(
    async () => {
      const { data: rows } = await supabase().from("monitoring_plants").select("*").eq("lead_id", leadId).order("name");
      return (rows ?? []) as PlantRow[];
    },
    [leadId],
    ["monitoring_plants"],
  );
  if (!data?.length) return null;
  return (
    <Card>
      <CardHeader title="Usina monitorada" icon={<Activity className="h-4 w-4" />} action={<Link href="/monitoramento" className="text-[13px] font-semibold text-sun-700">Monitoramento</Link>} />
      <div className="grid gap-2 px-5 pb-5">
        {data.map((p) => (
          <Link key={p.id} href="/monitoramento" className="flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-2.5 ring-1 ring-ink-200/60 transition hover:ring-sun-300 dark:bg-white/[0.03]">
            <span className={cx("h-2 w-2 shrink-0 rounded-full", DOT[p.status])} title={STATUS_LABEL[p.status]} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-900">{p.name}</p>
              <p className="text-xs text-ink-500">
                {STATUS_LABEL[p.status]} · agora {fmtKw(p.power_kw)} · hoje {fmtKwh(p.today_kwh)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-ink-300" />
          </Link>
        ))}
      </div>
    </Card>
  );
}
