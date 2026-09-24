"use client";

import { useId } from "react";
import { cx } from "./ui";

/** Marca: estrutura de andaime estilizada + nome. */
export function Logo({ className, compact, light = true }: { className?: string; compact?: boolean; light?: boolean }) {
  const gid = `lg-${useId().replace(/:/g, "")}`;
  return (
    <div className={cx("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 64 64" className="h-9 w-9 shrink-0" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#BEF264" />
            <stop offset=".5" stopColor="#4ADE80" />
            <stop offset="1" stopColor="#10B981" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill={light ? "rgb(255 255 255 / 0.07)" : "#0D0B2B"} />
        <g stroke={`url(#${gid})`} strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M20 14v36M44 14v36M20 22h24M20 36h24M20 22l24 14M20 50h24" />
        </g>
      </svg>
      {!compact && (
        <div className="leading-none">
          <p className={cx("font-display text-[17px] font-bold tracking-tight", light ? "text-white" : "text-ink-950")}>Quark</p>
          <p className={cx("mt-1 text-[10px] font-semibold tracking-[0.22em] uppercase", light ? "text-brand-300" : "text-brand-700")}>Locações</p>
        </div>
      )}
    </div>
  );
}
