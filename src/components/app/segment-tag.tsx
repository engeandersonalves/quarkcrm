import { SEGMENTS } from "@/lib/constants";
import type { Segment } from "@/lib/types";
import { cx } from "../ui";

/** Etiqueta do segmento do cliente: Solar, S.A.V.E ou ambos. */
export function SegmentTag({ segment, className }: { segment?: Segment | null; className?: string }) {
  const key = segment ?? "solar";
  const seg = SEGMENTS[key] ?? SEGMENTS.solar;
  const icon = key === "save" ? "⚡ " : key === "ambos" ? "☀️⚡ " : "☀️ ";
  return (
    <span className={cx("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ring-1 ring-inset", seg.cls, className)}>
      {icon}
      {seg.short}
    </span>
  );
}
