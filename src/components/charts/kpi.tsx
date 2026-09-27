"use client";

import type { ReactNode } from "react";
import { Card, cx } from "../ui";
import { DeltaBadge, SERIES, Sparkline } from ".";

/** Cartão de indicador: valor, variação contra o período anterior e minigráfico de tendência. */
export function KpiCard({ label, value, d, sub, icon, spark, dark, hideDelta }: { label: string; value: string; d: number | null; sub?: string; icon: ReactNode; spark?: number[]; dark?: boolean; hideDelta?: boolean }) {
  return (
    <Card className={cx("relative overflow-hidden p-4 sm:p-5", dark && "bg-ink-950 text-white ring-ink-950")}>
      {dark && <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-sun-500/25 blur-2xl" />}
      <div className="relative flex items-center justify-between gap-2">
        <p className={cx("text-xs font-semibold sm:text-[13px]", dark ? "text-ink-400" : "text-ink-500")}>{label}</p>
        <span className={cx("grid h-7 w-7 place-items-center rounded-lg", dark ? "bg-white/10 text-sun-400" : "bg-sun-50 text-sun-600")}>{icon}</span>
      </div>
      <p className={cx("tnum relative mt-2 truncate font-display text-xl font-semibold tracking-tight sm:text-[26px]", dark && "text-sun-gradient")}>{value}</p>
      <div className="relative mt-1 flex items-center gap-2">
        {!hideDelta && <DeltaBadge value={d} dark={dark} />}
        {sub && <span className={cx("truncate text-xs", dark ? "text-ink-500" : "text-ink-400")}>{sub}</span>}
      </div>
      {spark && <Sparkline values={spark} color={dark ? "#9BD373" : SERIES[0]} className="relative mt-3" />}
    </Card>
  );
}
