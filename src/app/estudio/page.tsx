"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Estúdio 3D sem login: roda no navegador, salva no próprio aparelho.
const Studio = dynamic(() => import("@/components/solar3d/studio").then((m) => m.Studio), {
  ssr: false,
  loading: () => (
    <div className="grid h-[70dvh] place-items-center text-sm font-semibold text-ink-500">
      <span className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando o estúdio 3D…
      </span>
    </div>
  ),
});

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-[1500px] p-3 sm:p-5">
      <Studio standalone />
    </main>
  );
}
