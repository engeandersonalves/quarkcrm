"use client";

import { Eye, EyeOff, Send } from "lucide-react";
import { cx } from "@/components/ui";
import { formatDateTime, relativeTime } from "@/lib/format";
import { useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";

type Row = { status: string; sent_at: string | null; viewed_at: string | null; last_viewed_at?: string | null; view_count: number };

/** Minutos desde a última abertura (para mostrar "vendo agora"). */
export const minutesSinceView = (r: Pick<Row, "viewed_at" | "last_viewed_at">, now = Date.now()) => {
  const at = r.last_viewed_at ?? r.viewed_at;
  return at ? (now - new Date(at).getTime()) / 60000 : Infinity;
};

/**
 * Situação do link da proposta (solar ou S.A.V.E): quantas vezes o cliente abriu,
 * quando foi a última vez e se está vendo agora. Atualiza sozinho em tempo real.
 */
export function ViewStatus({ id, className }: { id: string; className?: string }) {
  const { data: r } = useLive<Row | null>(
    async () => {
      const { data } = await supabase().from("proposals").select("*").eq("id", id).maybeSingle();
      return (data as Row | null) ?? null;
    },
    [id],
    ["proposals"],
  );
  if (!r) return null;

  if (r.view_count > 0) {
    const live = minutesSinceView(r) <= 10;
    const last = r.last_viewed_at ?? r.viewed_at;
    return (
      <span
        title={`Primeira abertura: ${formatDateTime(r.viewed_at)}${last && last !== r.viewed_at ? ` · última: ${formatDateTime(last)}` : ""}`}
        className={cx(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1",
          live ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-violet-50 text-violet-700 ring-violet-200",
          className,
        )}
      >
        {live ? (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
        {live ? "Cliente vendo agora" : `Cliente abriu ${r.view_count}×`}
        <span className="font-normal opacity-75">· última {relativeTime(last)}</span>
      </span>
    );
  }
  if (r.sent_at || r.status === "enviada") {
    return (
      <span className={cx("inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-800 ring-1 ring-amber-200", className)}>
        <EyeOff className="h-3.5 w-3.5" /> Ainda não abriu <span className="font-normal opacity-75">· enviada {relativeTime(r.sent_at)}</span>
      </span>
    );
  }
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full bg-ink-900/[0.05] px-2.5 py-1 text-[12px] font-semibold text-ink-500", className)}>
      <Send className="h-3.5 w-3.5" /> Envie o link para acompanhar a visualização
    </span>
  );
}
