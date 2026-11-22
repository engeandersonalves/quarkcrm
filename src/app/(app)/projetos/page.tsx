"use client";

import { ChevronRight, FolderKanban, Loader2, Plus, Search, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Segmented, Skeleton, cx } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { fmtNum } from "@/lib/pricing";
import { calc, normalizeProject, packageProgress, projectFromLead, type InverterSpecs, type LeadLike, type ModuleSpecs } from "@/lib/solar-project";
import { statusCls, statusLabel, type ProjectRow } from "@/components/projetos/status";
import { projectError } from "@/lib/solar-project-db";
import { supabase } from "@/lib/supabase/client";

type Filter = "todos" | "andamento" | "enviados" | "concluidos";

export default function ProjectsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("todos");
  const [creating, setCreating] = useState(false);
  const { data, loading, error } = useLive(async () => must(await supabase().from("solar_projects").select("*").order("updated_at", { ascending: false }).limit(500)) as ProjectRow[], [], ["solar_projects"]);
  const all = data ?? [];
  const rows = useMemo(
    () =>
      all.filter((p) =>
        filter === "todos" ? true : filter === "andamento" ? ["rascunho", "pronto"].includes(p.status) : filter === "enviados" ? ["enviado", "aprovado", "vistoria"].includes(p.status) : p.status === "concluido",
      ),
    [all, filter],
  );
  const kwp = all.reduce((t, p) => t + calc(normalizeProject(p.data)).kwp, 0);

  return (
    <div className="animate-fade-up mx-auto max-w-5xl">
      <PageHeader
        icon={<FolderKanban />}
        eyebrow="Ferramentas"
        title="Projetos fotovoltaicos"
        subtitle="Formulário da distribuidora, memorial técnico e a pasta completa para enviar à Equatorial"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Novo projeto
          </Button>
        }
      />

      {error && <Card className="mb-4 p-4 text-sm text-amber-800">{projectError(String(error))}</Card>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: "Projetos", v: fmtNum(all.length) },
          { k: "Em preenchimento", v: fmtNum(all.filter((p) => p.status === "rascunho").length) },
          { k: "Na distribuidora", v: fmtNum(all.filter((p) => ["enviado", "aprovado", "vistoria"].includes(p.status)).length) },
          { k: "Potência projetada", v: `${fmtNum(kwp, 2)} kWp` },
        ].map((s) => (
          <Card key={s.k} className="p-4">
            <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">{s.k}</p>
            <p className="tnum mt-1 font-display text-xl font-semibold text-ink-900">{s.v}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 mb-4 max-w-full overflow-x-auto">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "todos", label: "Todos" },
            { value: "andamento", label: "Em andamento" },
            { value: "enviados", label: "Na distribuidora" },
            { value: "concluidos", label: "Homologados" },
          ]}
        />
      </div>

      {loading ? (
        <div className="grid gap-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : !rows.length ? (
        <Card>
          <Empty
            icon={<Sun className="h-6 w-6" />}
            title={all.length ? "Nenhum projeto neste filtro" : "Nenhum projeto ainda"}
            text="Escolha o lead: os dados do cliente e os equipamentos da proposta já entram no projeto. Você completa o resto, anexa RG, TRT e diagramas, e baixa a pasta pronta."
            action={<Button onClick={() => setCreating(true)}>Criar projeto</Button>}
          />
        </Card>
      ) : (
        <Card className="divide-y divide-ink-100 overflow-hidden">
          {rows.map((p) => {
            const d = normalizeProject(p.data);
            const c = calc(d);
            const prog = packageProgress(d, p.files ?? {});
            return (
              <Link key={p.id} href={`/projetos/${p.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-ink-50 sm:px-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sun-50 text-sun-700 ring-1 ring-sun-200/70">
                  <Sun className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{d.client.name.trim() || p.title || "Projeto sem cliente"}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
                    {c.kwp > 0 && <span>{fmtNum(c.kwp, 2)} kWp</span>}
                    {c.inverterKw > 0 && <span>· {fmtNum(c.inverterKw, 2)} kW</span>}
                    {d.client.city && <span>· {d.client.city}</span>}
                    <span>· {relativeTime(p.updated_at)}</span>
                  </p>
                </div>
                <div className="hidden items-center gap-1 sm:flex" title={`${prog.count} de ${prog.total} itens da pasta`}>
                  {prog.done.map((ok, i) => (
                    <span key={i} className={cx("h-2 w-3.5 rounded-full", ok ? "bg-emerald-500" : "bg-ink-200")} />
                  ))}
                  <span className="ml-1 text-xs font-semibold text-ink-500 tabular-nums">
                    {prog.count}/{prog.total}
                  </span>
                </div>
                <Badge className={cx("ring-1", statusCls(p.status))}>{statusLabel(p.status)}</Badge>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" />
              </Link>
            );
          })}
        </Card>
      )}

      <NewProject open={creating} onClose={() => setCreating(false)} onCreated={(id) => router.push(`/projetos/${id}`)} lastData={all[0]?.data} />
    </div>
  );
}

interface LeadOption extends LeadLike {
  id: string;
}

function NewProject({ open, onClose, onCreated, lastData }: { open: boolean; onClose: () => void; onCreated: (id: string) => void; lastData?: unknown }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { data: leads } = useLive(
    async () => (open ? (must(await supabase().from("leads").select("id,name,document,phone,email,address,city,state,connection_type,consumption_kwh").order("updated_at", { ascending: false }).limit(2000)) as LeadOption[]) : []),
    [open],
    [],
  );
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (leads ?? []).filter((l) => !t || l.name.toLowerCase().includes(t) || (l.document ?? "").includes(t) || (l.phone ?? "").includes(t)).slice(0, 40);
  }, [leads, q]);

  const create = async (lead: LeadOption | null) => {
    setBusy(lead?.id ?? "blank");
    try {
      const sb = supabase();
      const [{ data: props }, { data: equip }] = await Promise.all([
        lead ? sb.from("proposals").select("id,status,inputs,updated_at").eq("lead_id", lead.id).order("updated_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
        sb.from("solar_equipment").select("kind,brand,model,specs"),
      ]);
      const proposals = (props ?? []) as { id: string; status: string; inputs: Record<string, unknown> }[];
      const proposal = proposals.find((p) => p.status === "aceita") ?? proposals[0] ?? null;
      const eq = (equip ?? []) as { kind: string; brand: string; model: string; specs: Record<string, unknown> }[];
      const data = projectFromLead(lead, proposal, {
        last: lastData ? normalizeProject(lastData) : null,
        modules: eq.filter((e) => e.kind === "modulo").map((e) => ({ brand: e.brand, model: e.model, specs: e.specs as unknown as ModuleSpecs })),
        inverters: eq.filter((e) => e.kind === "inversor").map((e) => ({ brand: e.brand, model: e.model, specs: e.specs as unknown as InverterSpecs })),
      });
      const { data: row, error } = await sb
        .from("solar_projects")
        .insert({ lead_id: lead?.id ?? null, proposal_id: proposal?.id ?? null, title: lead?.name ?? "Novo projeto", data })
        .select("id")
        .single();
      if (error || !row) throw new Error(projectError(error?.message ?? "Não foi possível criar"));
      onCreated((row as { id: string }).id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o projeto");
      setBusy(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo projeto fotovoltaico" subtitle="Escolha o cliente: dados e equipamentos da proposta entram automaticamente">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar lead por nome, CPF ou telefone" className="pl-9" />
      </div>
      <div className="mt-3 max-h-[50vh] divide-y divide-ink-100 overflow-y-auto rounded-2xl ring-1 ring-ink-200/70">
        {list.map((l) => (
          <button key={l.id} type="button" disabled={!!busy} onClick={() => create(l)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-50 disabled:opacity-60">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{l.name}</span>
              <span className="block truncate text-xs text-ink-500">{[l.city, l.phone, l.document].filter(Boolean).join(" · ") || "sem dados"}</span>
            </span>
            {busy === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4 text-ink-300" />}
          </button>
        ))}
        {!list.length && <p className="px-4 py-6 text-center text-sm text-ink-500">Nenhum lead encontrado.</p>}
      </div>
      <button type="button" disabled={!!busy} onClick={() => create(null)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-ink-900 disabled:opacity-60">
        {busy === "blank" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Começar em branco
      </button>
    </Modal>
  );
}
