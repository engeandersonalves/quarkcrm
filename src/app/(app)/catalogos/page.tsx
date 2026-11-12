"use client";

import { ChevronDown, Copy, ExternalLink, Eye, Flame, Laptop, MessageCircle, Search, Smartphone, Timer, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Badge, Button, Card, Empty, Input, PageHeader, Skeleton, cx } from "@/components/ui";
import { CATALOG_ID, CATALOG_NAME } from "@/lib/catalog-mobilidade";
import { relativeTime, whatsappUrl } from "@/lib/format";
import { useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";

type Row = {
  id: string;
  lead_id: string | null;
  owner_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  visits: number;
  seconds: number;
  interest: string | null;
  device: string | null;
  first_at: string;
  last_at: string;
};
type Ev = { kind: string; detail: string | null; value: number; at: string };

const SECTION_LABEL: Record<string, string> = {
  capa: "Capa",
  estilo: "Estilo de vida",
  "modelo-t1": "T1",
  "modelo-cappuccino": "Cappuccino",
  "modelo-mz": "MZ",
  economia: "Simulador de economia",
  diferencial: "3x mais força",
  quiz: "Teste: qual é a sua",
  comparativo: "Comparativo",
  "quem-somos": "Quem somos",
  fechamento: "Fechamento",
};
const dur = (s: number) => (s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)}h${String(Math.round((s % 3600) / 60)).padStart(2, "0")}`);

export default function CatalogosPage() {
  const { user, profile } = useApp();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/catalogo/mobilidade?v=${user.id}`;

  const { data, error } = useLive<Row[] | null>(
    async () => {
      const { data, error } = await supabase().from("catalog_access").select("*").eq("catalog", CATALOG_ID).order("last_at", { ascending: false }).limit(1000);
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    },
    [],
    ["catalog_access"],
  );

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const digits = t.replace(/\D/g, "");
    return (data ?? []).filter((r) => !t || r.name.toLowerCase().includes(t) || (r.email ?? "").toLowerCase().includes(t) || (digits && r.phone.replace(/\D/g, "").includes(digits)));
  }, [data, q]);

  const all = data ?? [];
  const today = all.filter((r) => Date.now() - new Date(r.last_at).getTime() < 86400000).length;
  const visits = all.reduce((t, r) => t + r.visits, 0);
  const hot = all.filter((r) => r.interest).length;
  const avg = all.length ? Math.round(all.reduce((t, r) => t + r.seconds, 0) / all.length) : 0;

  return (
    <>
      <PageHeader
        eyebrow="Ferramentas"
        title="Catálogo Mobilidade"
        subtitle={`${CATALOG_NAME}: quem abriu, quantas vezes e o que mais viu`}
        icon={<Eye />}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Link copiado. Os acessos por ele ficam no seu nome."))}>
              <Copy className="h-4 w-4" /> Copiar meu link
            </Button>
            <a href={link} target="_blank" rel="noreferrer">
              <Button>
                <ExternalLink className="h-4 w-4" /> Abrir catálogo
              </Button>
            </a>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: Users, label: "Pessoas", value: String(all.length), sub: `${today} nas últimas 24 h` },
          { icon: Eye, label: "Visualizações", value: String(visits), sub: all.length ? `${(visits / all.length).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por pessoa` : "—" },
          { icon: Flame, label: "Quiseram um modelo", value: String(hot), sub: all.length ? `${Math.round((hot / all.length) * 100)}% dos acessos` : "—" },
          { icon: Timer, label: "Tempo médio", value: avg ? dur(avg) : "—", sub: "lendo o catálogo" },
        ].map((k) => (
          <Card key={k.label} className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">
              <k.icon className="h-3.5 w-3.5" /> {k.label}
            </p>
            <p className="tnum mt-1 font-display text-2xl font-semibold">{k.value}</p>
            <p className="text-xs text-ink-400">{k.sub}</p>
          </Card>
        ))}
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, telefone ou e-mail" className="pl-10" />
      </div>

      {error ? (
        <Card className="p-6 text-sm text-ink-600">Rode o supabase/schema.sql atualizado no SQL Editor do Supabase para ativar o controle de acessos do catálogo.</Card>
      ) : data === null ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <Card>
          <Empty icon={<Eye className="h-6 w-6" />} title={all.length ? "Ninguém com esse nome" : "Ninguém abriu ainda"} text="Envie o seu link: quem abrir informa nome, WhatsApp e e-mail, vira lead e aparece aqui em tempo real." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-ink-100">
            {rows.map((r) => (
              <AccessRow key={r.id} r={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} canDelete={profile?.role === "admin"} />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function AccessRow({ r, open, onToggle, canDelete }: { r: Row; open: boolean; onToggle: () => void; canDelete: boolean }) {
  const [evs, setEvs] = useState<Ev[] | null>(null);
  const toggle = async () => {
    onToggle();
    if (!open && evs === null) {
      const { data } = await supabase().from("catalog_events").select("kind, detail, value, at").eq("access_id", r.id).order("at", { ascending: false }).limit(200);
      setEvs((data ?? []) as Ev[]);
    }
  };
  const live = Date.now() - new Date(r.last_at).getTime() < 5 * 60_000;
  const sections = useMemo(() => [...new Set((evs ?? []).filter((e) => e.kind === "section").map((e) => e.detail ?? ""))], [evs]);
  const timeline = (evs ?? []).filter((e) => e.kind !== "time" && e.kind !== "section").slice(0, 30);
  const remove = async () => {
    if (!confirm(`Apagar o registro de acesso de ${r.name}? O lead continua no CRM.`)) return;
    const { error } = await supabase().from("catalog_access").delete().eq("id", r.id);
    if (error) toast.error(error.message);
  };

  return (
    <li>
      <button onClick={toggle} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-50 sm:px-5">
        <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink-100 text-sm font-bold text-ink-700">
          {r.name
            .split(/\s+/)
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
          {live && <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#1c1c1e]" title="Ativo agora" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate font-semibold text-ink-900">
            {r.name}
            {r.interest && <Badge className="bg-rose-50 text-rose-700 ring-rose-200">Quer a {r.interest}</Badge>}
          </p>
          <p className="truncate text-xs text-ink-500">
            {r.phone}
            {r.email ? ` · ${r.email}` : ""}
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="tnum text-sm font-semibold text-ink-900">
            {r.visits} {r.visits === 1 ? "visita" : "visitas"}
          </p>
          <p className="text-xs text-ink-500">{r.seconds ? `${dur(r.seconds)} lendo` : "—"}</p>
        </div>
        <div className="w-24 shrink-0 text-right text-xs text-ink-500">
          <p className="sm:hidden tnum font-semibold text-ink-900">{r.visits}× aberto</p>
          {live ? <span className="font-semibold text-emerald-600">Agora</span> : relativeTime(r.last_at)}
        </div>
        <ChevronDown className={cx("h-4 w-4 shrink-0 text-ink-400 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="grid gap-4 bg-ink-50/60 px-4 pt-1 pb-5 sm:px-5 lg:grid-cols-[1fr_1fr]">
          <div className="grid content-start gap-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white p-3 ring-1 ring-ink-900/5 dark:bg-[#1c1c1e]">
                <p className="tnum text-lg font-semibold">{r.visits}</p>
                <p className="text-[11px] text-ink-500">visitas</p>
              </div>
              <div className="rounded-xl bg-white p-3 ring-1 ring-ink-900/5 dark:bg-[#1c1c1e]">
                <p className="tnum text-lg font-semibold">{r.seconds ? dur(r.seconds) : "—"}</p>
                <p className="text-[11px] text-ink-500">tempo lendo</p>
              </div>
              <div className="rounded-xl bg-white p-3 ring-1 ring-ink-900/5 dark:bg-[#1c1c1e]">
                <p className="flex items-center justify-center gap-1 text-lg font-semibold">{r.device === "celular" ? <Smartphone className="h-4 w-4" /> : <Laptop className="h-4 w-4" />}</p>
                <p className="text-[11px] text-ink-500">{r.device || "aparelho"}</p>
              </div>
            </div>
            <p className="text-xs text-ink-500">
              Primeiro acesso {relativeTime(r.first_at)} · último {relativeTime(r.last_at)}
            </p>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">O que viu</p>
              {evs === null ? (
                <Skeleton className="h-8" />
              ) : sections.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(SECTION_LABEL).map(([id, l]) => (
                    <span key={id} className={cx("rounded-full px-2.5 py-1 text-xs font-semibold ring-1", sections.includes(id) ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "text-ink-400 ring-ink-200")}>
                      {l}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink-400">Ainda sem rolagem registrada.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={whatsappUrl(r.phone, `Olá, ${r.name.split(" ")[0]}! Vi que você olhou o nosso catálogo de scooters da Black Friday${r.interest ? ` e gostou da ${r.interest}` : ""}. Posso te ajudar a garantir a sua?`)} target="_blank" rel="noreferrer">
                <Button size="sm">
                  <MessageCircle className="h-4 w-4" /> Chamar no WhatsApp
                </Button>
              </a>
              {r.lead_id && (
                <Link href={`/leads/${r.lead_id}`}>
                  <Button size="sm" variant="secondary">
                    Abrir lead
                  </Button>
                </Link>
              )}
              {canDelete && (
                <Button size="sm" variant="ghost" className="text-rose-600" onClick={remove}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">Linha do tempo</p>
            {evs === null ? (
              <Skeleton className="h-32" />
            ) : timeline.length ? (
              <ol className="grid gap-1.5">
                {timeline.map((e, i) => (
                  <li key={i} className="flex items-center gap-2 text-[13px] text-ink-700">
                    <span className={cx("h-2 w-2 shrink-0 rounded-full", e.kind === "interest" ? "bg-rose-500" : e.kind === "open" ? "bg-emerald-500" : "bg-ink-300")} />
                    <span className="min-w-0 flex-1 truncate">
                      {e.kind === "open"
                        ? e.detail === "cadastro"
                          ? "Abriu o catálogo (cadastro)"
                          : "Voltou ao catálogo"
                        : e.kind === "interest"
                          ? `Clicou em “Quero a ${e.detail}”`
                          : e.detail?.startsWith("quiz-")
                            ? `Fez o teste: deu ${SECTION_LABEL[`modelo-${e.detail.slice(5)}`] ?? e.detail.slice(5)}`
                            : e.detail?.startsWith("whatsapp")
                              ? "Clicou no WhatsApp"
                              : e.detail}
                    </span>
                    <span className="shrink-0 text-xs text-ink-400">{relativeTime(e.at)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-ink-400">Sem eventos.</p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
