"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DadosProvider } from "@/lib/store";
import { Shell } from "./shell";

/** Páginas públicas (link de assinatura do cliente) não usam login nem carregam os dados da empresa. */
export function Raiz({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "";
  if (path.startsWith("/assinar")) return <>{children}</>;
  return (
    <DadosProvider>
      <Shell>{children}</Shell>
    </DadosProvider>
  );
}
