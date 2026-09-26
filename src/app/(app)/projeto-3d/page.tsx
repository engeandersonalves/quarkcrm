"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// A cena 3D usa WebGL e localStorage: carrega só no navegador.
const Studio = dynamic(() => import("@/components/solar3d/studio").then((m) => m.Studio), {
  ssr: false,
  loading: () => (
    <div className="grid h-[70dvh] place-items-center rounded-2xl bg-white ring-1 ring-ink-200">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando o estúdio 3D…
      </div>
    </div>
  ),
});

export default function Page() {
  return <Studio />;
}
