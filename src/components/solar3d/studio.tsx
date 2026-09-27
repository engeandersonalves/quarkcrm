"use client";

import { Calculator, Download, FilePlus2, FileText, Home, Redo2, Undo2, Upload, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cx } from "../ui";
import { ElectricalStudio } from "./electrical-studio";
import { ReportView } from "./report-view";
import { RoofStudio, type Update } from "./roof-studio";
import { LABEL_CSS } from "./three-utils";
import { electricalReport } from "@/lib/solar3d/board";
import { roofPlanes } from "@/lib/solar3d/geometry";
import { analyze, defaultProject, loadProject, normalizeProject, saveProject, type Project } from "@/lib/solar3d/project";

type Tab = "telhado" | "eletrica" | "relatorio";

const ROOF_TO_PROPOSAL: Record<string, string> = {
  colonial: "Telhado cerâmico",
  fibrocimento: "Telhado fibrocimento",
  metalico: "Telhado metálico",
  laje: "Laje",
  solo: "Solo",
};

/** `standalone`: versão sem CRM (navegador local) — esconde o atalho para o orçamento. */
export function Studio({ standalone = false }: { standalone?: boolean } = {}) {
  const router = useRouter();
  const [project, setProject] = useState<Project>(() => loadProject() ?? defaultProject());
  const [tab, setTab] = useState<Tab>("telhado");
  const [images, setImages] = useState<{ roof?: string; board?: string }>({});
  const undo = useRef<Project[]>([]);
  const redo = useRef<Project[]>([]);
  const [, force] = useState(0);
  const lastPush = useRef(0);

  const update: Update = useCallback((fn, opts) => {
    setProject((prev) => {
      let next = fn(prev);
      if (next === prev) return prev;
      if (opts?.geometry) {
        // limpa conjuntos de módulos de águas que deixaram de existir e invalida sombras antigas
        const ids = new Set(next.buildings.flatMap((b) => roofPlanes(b).map((p) => p.id)));
        next = { ...next, arrays: next.arrays.filter((a) => ids.has(a.planeId)), shading: {} };
      }
      if (opts?.history !== false) {
        const now = Date.now();
        // agrupa edições rápidas (digitação, arrastar controles) num único passo de desfazer
        if (now - lastPush.current > 600) {
          undo.current.push(prev);
          if (undo.current.length > 80) undo.current.shift();
        }
        lastPush.current = now;
        redo.current = [];
      }
      return next;
    });
    force((v) => v + 1);
  }, []);

  const doUndo = useCallback(() => {
    const prev = undo.current.pop();
    if (!prev) return;
    setProject((cur) => {
      redo.current.push(cur);
      return prev;
    });
    force((v) => v + 1);
  }, []);
  const doRedo = useCallback(() => {
    const next = redo.current.pop();
    if (!next) return;
    setProject((cur) => {
      undo.current.push(cur);
      return next;
    });
    force((v) => v + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        doRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doUndo, doRedo]);

  // salvamento automático no aparelho
  useEffect(() => {
    const t = setTimeout(() => saveProject(project), 500);
    return () => clearTimeout(t);
  }, [project]);

  const report = useMemo(
    () => analyze(project),
    // a data/hora do sol não muda a geração
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.buildings, project.arrays, project.obstacles, project.module, project.site, project.performanceRatio, project.shading, project.structureBrand, project.supportSpacing],
  );
  const elec = useMemo(() => electricalReport(project, report.modules), [project, report.modules]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name.replace(/[^\w\-]+/g, "_") || "projeto"}.quark3d.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const p = normalizeProject(JSON.parse(await f.text()));
        if (!p) throw new Error();
        update(() => p);
        toast.success("Projeto importado.");
      } catch {
        toast.error("Arquivo inválido.");
      }
    };
    input.click();
  };
  const newProject = () => {
    if (!confirm("Começar um projeto novo? O atual pode ser recuperado com Desfazer (Ctrl+Z).")) return;
    update(() => defaultProject());
  };
  const toProposal = () => {
    if (!report.modules) return toast.error("Posicione os módulos no telhado primeiro.");
    const main = [...report.arrays].sort((a, b) => b.modules - a.modules)[0];
    const q = new URLSearchParams({
      origem: "3d",
      hsp: report.effectiveHsp.toFixed(2),
      modulos: String(report.modules),
      wp: String(project.module.power),
      inversor: String(project.electrical.inverter.powerKw),
      pr: project.performanceRatio.toFixed(2),
      marcaInversor: project.electrical.inverter.brand,
      estrutura: ROOF_TO_PROPOSAL[main.plane.roofType] ?? "",
    });
    router.push(`/propostas/nova?${q}`);
  };
  const snapshot = (key: "roof" | "board") => (img: string) => {
    setImages((s) => ({ ...s, [key]: img }));
    const a = document.createElement("a");
    a.href = img;
    a.download = `${project.name.replace(/[^\w\-]+/g, "_") || "projeto"}-${key === "roof" ? "telhado" : "quadro"}.png`;
    a.click();
    toast.success("Imagem salva e anexada ao memorial.");
  };

  const TABS: { id: Tab; label: string; short: string; icon: typeof Home }[] = [
    { id: "telhado", label: "Telhado e sol", short: "Telhado", icon: Home },
    { id: "eletrica", label: "Quadro elétrico", short: "Quadro", icon: Zap },
    { id: "relatorio", label: "Memorial", short: "Memorial", icon: FileText },
  ];

  return (
    <div className="space-y-3">
      <style>{LABEL_CSS}</style>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="rounded-lg bg-ink-900 px-2 py-1 text-[10px] font-bold tracking-[0.16em] text-brand-lime">3D</span>
          <input
            value={project.name}
            onChange={(e) => update((p) => ({ ...p, name: e.target.value }))}
            className="min-w-0 flex-1 rounded-lg bg-transparent px-1 font-display text-xl font-semibold text-ink-950 focus:bg-white focus:ring-2 focus:ring-sun-500 focus:outline-none sm:text-2xl"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 print:hidden">
          <IconBtn title="Desfazer (Ctrl+Z)" onClick={doUndo} disabled={!undo.current.length}>
            <Undo2 className="h-4 w-4" />
          </IconBtn>
          <IconBtn title="Refazer (Ctrl+Y)" onClick={doRedo} disabled={!redo.current.length}>
            <Redo2 className="h-4 w-4" />
          </IconBtn>
          <IconBtn title="Novo projeto" onClick={newProject}>
            <FilePlus2 className="h-4 w-4" />
          </IconBtn>
          <IconBtn title="Importar projeto (.json)" onClick={importJson}>
            <Upload className="h-4 w-4" />
          </IconBtn>
          <IconBtn title="Exportar projeto (.json)" onClick={exportJson}>
            <Download className="h-4 w-4" />
          </IconBtn>
          {!standalone && (
            <button onClick={toProposal} className="flex h-9 items-center gap-1.5 rounded-xl bg-sun-gradient px-3 text-sm font-semibold text-ink-950 shadow-glow hover:brightness-105">
              <Calculator className="h-4 w-4" /> Criar orçamento
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-ink-100 p-1 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cx("flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition sm:flex-none sm:px-4", tab === t.id ? "bg-white text-ink-900 shadow-soft" : "text-ink-500 hover:text-ink-800")}
          >
            <t.icon className="h-4 w-4" /> <span className="sm:hidden">{t.short}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
        <div className="ml-auto hidden items-center gap-3 px-3 text-[12px] text-ink-500 md:flex">
          <span>
            <b className="text-ink-800">{report.modules}</b> módulos · <b className="text-ink-800">{report.kwp.toFixed(2).replace(".", ",")}</b> kWp
          </span>
          <span>
            <b className="text-ink-800">{Math.round(report.monthlyAvg).toLocaleString("pt-BR")}</b> kWh/mês
          </span>
        </div>
      </div>

      {tab === "telhado" && <RoofStudio project={project} report={report} update={update} onSnapshot={snapshot("roof")} />}
      {tab === "eletrica" && <ElectricalStudio project={project} report={report} elec={elec} update={update} onSnapshot={snapshot("board")} />}
      {tab === "relatorio" && <ReportView project={project} report={report} elec={elec} images={images} />}
    </div>
  );
}

function IconBtn({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button title={title} aria-label={title} onClick={onClick} disabled={disabled} className="grid h-9 w-9 place-items-center rounded-xl bg-white text-ink-700 shadow-soft ring-1 ring-ink-200 transition hover:bg-ink-50 disabled:opacity-40">
      {children}
    </button>
  );
}
