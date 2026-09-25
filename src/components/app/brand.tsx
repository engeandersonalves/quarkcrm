/* eslint-disable @next/next/no-img-element */
import { cx } from "../ui";

/** Logotipo oficial da Quark Energia (arquivos em /public/brand). */
export function BrandLogo({ variant = "white", className }: { variant?: "white" | "color" | "symbol"; className?: string }) {
  const src = variant === "symbol" ? "/brand/symbol.png" : variant === "color" ? "/brand/logo-h-color.png" : "/brand/logo-h-white.png";
  return <img src={src} alt="Quark Energia" className={cx("h-9 w-auto select-none", className)} draggable={false} />;
}
