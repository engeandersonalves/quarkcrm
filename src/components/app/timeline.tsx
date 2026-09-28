"use client";

import { ArrowRightLeft, CalendarClock, CheckCircle2, FileSignature, FileText, MapPin, MessageCircle, MessageSquare, PhoneCall, Send, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { Avatar, Empty, cx } from "@/components/ui";
import type { FeedItem } from "@/lib/team";
import type { Profile } from "@/lib/types";

export const FEED_ICON: Record<string, { icon: typeof MessageSquare; cls: string }> = {
  nota: { icon: MessageSquare, cls: "bg-ink-100 text-ink-600" },
  ligacao: { icon: PhoneCall, cls: "bg-sky-100 text-sky-700" },
  whatsapp: { icon: MessageCircle, cls: "bg-emerald-100 text-emerald-700" },
  visita: { icon: MapPin, cls: "bg-violet-100 text-violet-700" },
  email: { icon: Send, cls: "bg-indigo-100 text-indigo-700" },
  reuniao: { icon: Users, cls: "bg-indigo-100 text-indigo-700" },
  tarefa: { icon: CheckCircle2, cls: "bg-sun-100 text-sun-700" },
  etapa: { icon: ArrowRightLeft, cls: "bg-ink-900 text-white" },
  documento: { icon: FileSignature, cls: "bg-amber-100 text-amber-800" },
  lead: { icon: UserPlus, cls: "bg-gradient-to-br from-[#F3EA3B] to-[#9BD373] text-[#1C1234]" },
  proposta: { icon: FileText, cls: "bg-amber-100 text-amber-800" },
  envio: { icon: Send, cls: "bg-[#1C1234] text-[#F3EA3B]" },
};


const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === y.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
};
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });


/** Linha do tempo de ações agrupada por dia (Central da equipe e Perfil). */
export function Timeline({ feed, total, more, showUser, byId }: { feed: FeedItem[]; total: number; more: () => void; showUser: boolean; byId: Map<string, Profile> }) {
  if (!feed.length) return <Empty icon={<CalendarClock className="h-6 w-6" />} title="Nenhuma ação no período" text="Quando alguém registrar contatos, concluir tarefas ou criar propostas, aparece aqui." />;
  const groups: { day: string; items: FeedItem[] }[] = [];
  for (const it of feed) {
    const day = dayLabel(it.at);
    const g = groups[groups.length - 1];
    if (g?.day === day) g.items.push(it);
    else groups.push({ day, items: [it] });
  }
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.day}>
          <p className="sticky top-14 z-10 mb-2 inline-flex rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold tracking-wide text-ink-500 uppercase ring-1 ring-ink-900/5 backdrop-blur lg:top-2">{g.day}</p>
          <ol className="relative space-y-1 before:absolute before:top-2 before:bottom-2 before:left-[17px] before:w-px before:bg-gradient-to-b before:from-ink-900/10 before:via-ink-900/10 before:to-transparent">
            {g.items.map((it) => {
              const ic = FEED_ICON[it.kind === "atividade" ? it.type : it.kind] ?? FEED_ICON[it.type] ?? FEED_ICON.nota;
              const Icon = ic.icon;
              const who = it.user ? byId.get(it.user) : null;
              return (
                <li key={it.id} className="relative flex items-start gap-3 rounded-2xl p-1.5 transition hover:bg-white/60">
                  <span className={cx("relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-white/80", ic.cls)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm text-ink-800">
                      {showUser && who && <b className="font-semibold text-ink-950">{(who.full_name ?? who.email ?? "").split(" ")[0]} </b>}
                      <span className="break-words">{it.text}</span>
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-400">
                      <span className="tabular-nums">{hhmm(it.at)}</span>
                      {it.leadId && it.leadName && (
                        <Link href={`/leads/${it.leadId}`} className="font-semibold text-sun-700 hover:underline">
                          {it.leadName}
                        </Link>
                      )}
                    </p>
                  </div>
                  {showUser && who && (
                    <Link href={`/perfil/${who.id}`} title={`Perfil de ${who.full_name ?? ""}`}>
                      <Avatar name={who.full_name} src={who.avatar_url} className="mt-0.5 h-7 w-7" />
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
      {total > feed.length && (
        <button onClick={more} className="w-full rounded-2xl bg-ink-900/[0.04] py-3 text-sm font-semibold text-ink-600 hover:bg-ink-900/[0.07]">
          Ver mais ({total - feed.length})
        </button>
      )}
    </div>
  );
}

