import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../ui";

/** Cores dos ícones do sistema (iOS). */
export const IOS = {
  blue: "#0A84FF",
  green: "#30D158",
  orange: "#FF9F0A",
  red: "#FF453A",
  yellow: "#FFD60A",
  indigo: "#5E5CE6",
  teal: "#64D2FF",
  mint: "#63E6E2",
  pink: "#FF375F",
  purple: "#BF5AF2",
  gray: "#AEAEB2",
  lime: "#B8E35A",
} as const;

const SIZES = {
  xs: { box: "h-[26px] w-[26px] rounded-[7px]", glyph: "h-[15px] w-[15px]" },
  sm: { box: "h-[30px] w-[30px] rounded-[8px]", glyph: "h-[17px] w-[17px]" },
  md: { box: "h-9 w-9 rounded-[10px]", glyph: "h-[19px] w-[19px]" },
  lg: { box: "h-12 w-12 rounded-[13px]", glyph: "h-6 w-6" },
  xl: { box: "h-16 w-16 rounded-[18px]", glyph: "h-8 w-8" },
};

/**
 * Ícone no estilo dos apps do iOS 27 escuro: quadrado arredondado grafite,
 * reflexo na borda e o símbolo colorido com um leve brilho.
 */
export function AppIcon({ icon: Icon, color = IOS.blue, size = "md", className, children }: { icon?: LucideIcon; color?: string; size?: keyof typeof SIZES; className?: string; children?: ReactNode }) {
  const s = SIZES[size];
  return (
    <span
      className={cx("app-icon overflow-hidden", s.box, className)}
      style={{ "--tint": color, backgroundImage: `radial-gradient(120% 90% at 50% 0%, ${color}2e, transparent 62%), linear-gradient(160deg, #3a3a3e 0%, #1f1f22 46%, #111113 100%)` } as CSSProperties}
      aria-hidden
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[inherit] bg-gradient-to-b from-white/[0.10] to-transparent" />
      {Icon ? <Icon className={cx("relative", s.glyph)} style={{ color, filter: `drop-shadow(0 0 6px ${color}66)` }} strokeWidth={2.2} /> : <span className="relative" style={{ color }}>{children}</span>}
    </span>
  );
}
