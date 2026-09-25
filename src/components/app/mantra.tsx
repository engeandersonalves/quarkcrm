"use client";

import { Quote as QuoteIcon } from "lucide-react";
import { useMemo } from "react";
import { pickDaily, quotePool } from "@/lib/inspiration";
import { cx } from "../ui";
import { useApp } from "./app-context";

/** Frase do dia de cada etapa (muda diariamente e é diferente em cada tela). */
export function Mantra({ seed, className }: { seed: number; className?: string }) {
  const { settings } = useApp();
  const q = useMemo(() => pickDaily(quotePool(settings.app.customQuotes, settings.app.useDefaultQuotes), seed), [settings.app, seed]);
  if (!q || !settings.app.showTips) return null;
  return (
    <div className={cx("mb-5 flex items-center gap-3 overflow-hidden rounded-2xl bg-ink-950 px-4 py-3 text-white", className)}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sun-gradient text-ink-950">
        <QuoteIcon className="h-4 w-4" />
      </span>
      <p className="min-w-0 flex-1 font-serif text-[15px] leading-snug italic sm:text-base">
        “{q.text}” <span className="ml-1 font-sans text-[11px] tracking-wider text-white/50 not-italic uppercase">— {q.author}</span>
      </p>
    </div>
  );
}
