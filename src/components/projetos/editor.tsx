"use client";

import { AlertTriangle, ArrowLeft, Check, ChevronDown, Download, Eye, FileSpreadsheet, FileText, FolderDown, ImagePlus, Loader2, Plus, Save, Trash2, Upload, Zap } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button, Card, Field, Input, NumberInput, Select, Switch, cx } from "@/components/ui";
import { must, useLive } from "@/lib/live";
import { fmtNum } from "@/lib/pricing";
import {
  BRANCHES,
  BREAKERS,
  CLASSES,
  MEMORIAL_IMAGES,
  MODALITIES,
  PHASES,
  PROJECT_ITEMS,
  PROJECT_STATUS,
  REQUEST_LABEL,
  REQUEST_TYPES,
  UFS,
  VOLTAGES,
  calc,
  emptyInverter,
  emptyModule,
  missing,
  mm2,
  normalizeProject,
  packageProgress,
  type InverterSpecs,
  type ModuleSpecs,
  type Phase,
  type ProjectData,
  type ProjectFile,
  type ProjectFiles,
  type ProjectStatus,
  type PvInverter,
  type PvModule,
} from "@/lib/solar-project";
import { projectError, projectFileUrl, removeProjectFile, uploadProjectFile } from "@/lib/solar-project-db";
import { supabase } from "@/lib/supabase/client";
import { statusCls, type ProjectRow } from "./status";

interface Equipment {
  id: string;
  kind: "modulo" | "inversor";
  brand: string;
  model: string;
  specs: Record<string, unknown>;
  datasheet: ProjectFile | null;
}

const ACCEPT = "application/pdf,image/png,image/jpeg";
const sizeKb = (b: number) => (b > 1024 * 1024 ? `${fmtNum(b / 1024 / 1024, 1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/* ------------------------------------------------------------------ peças */

function Section({ id, title, subtitle, children, right }: { id: string; title: string; subtitle?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-[17px] font-semibold text-ink-900">{title}</h2>
          {subtitle && <p className="text-[13px] text-ink-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

const G = ({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) => (
  <div className={cx("grid grid-cols-[minmax(0,1fr)] gap-3", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3", cols === 4 && "sm:grid-cols-2 lg:grid-cols-4")}>{children}</div>
);

function Txt({ label, value, onChange, placeholder, className, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string; hint?: string }) {
  const id = useId();
  return (
    <Field label={label} className={className} hint={hint} htmlFor={id}>
      <Input id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </Field>
  );
}
function Num({ label, value, onChange, suffix, digits = 2, className }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; digits?: number; className?: string }) {
  const id = useId();
  return (
    <Field label={label} className={className} htmlFor={id}>
      <NumberInput id={id} value={value} onChange={onChange} suffix={suffix} digits={digits} />
    </Field>
  );
}
function Sel<T extends string | number>({ label, value, options, onChange, className, labels }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void; className?: string; labels?: Record<string, string> }) {
  const id = useId();
  return (
    <Field label={label} className={className} htmlFor={id}>
      <Select id={id} value={String(value)} onChange={(e) => onChange((typeof options[0] === "number" ? Number(e.target.value) : e.target.value) as T)}>
        {options.map((o) => (
          <option key={String(o)} value={String(o)}>
            {labels?.[String(o)] ?? String(o)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/* ------------------------------------------------------------------ editor */

export function ProjectEditor({ id }: { id: string }) {
  const [row, setRow] = useState<ProjectRow | null>(null);
  const [d, setD] = useState<ProjectData | null>(null);
  const [files, setFiles] = useState<ProjectFiles>({});
  const [status, setStatus] = useState<ProjectStatus>("rascunho");
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const { data, error } = await supabase().from("solar_projects").select("*").eq("id", id).single();
      {
        if (!live) return;
        if (error || !data) return setLoadErr(projectError(error?.message ?? "Projeto não encontrado"));
        const r = data as ProjectRow;
        setRow(r);
        setD(normalizeProject(r.data));
        setFiles(r.files ?? {});
        setStatus(r.status);
      }
    })();
    return () => {
      live = false;
    };
  }, [id]);

  const { data: equipment, reload: reloadEquipment } = useLive(async () => must(await supabase().from("solar_equipment").select("*").order("brand")) as Equipment[], [], ["solar_equipment"]);

  const save = useCallback(
    async (next: { data?: ProjectData; status?: ProjectStatus; files?: ProjectFiles }) => {
      setSaving(true);
      try {
        const patch: Record<string, unknown> = {};
        if (next.data) {
          patch.data = next.data;
          patch.title = next.data.client.name || "Projeto";
        }
        if (next.status) patch.status = next.status;
        if (next.files) patch.files = next.files;
        const { error } = await supabase().from("solar_projects").update(patch).eq("id", id);
        if (error) throw new Error(projectError(error.message));
        if (next.data) setDirty(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
      } finally {
        setSaving(false);
      }
    },
    [id],
  );

  // Salva sozinho 1 s depois da última alteração.
  const update = useCallback(
    (fn: (p: ProjectData) => ProjectData) => {
      setD((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        setDirty(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void save({ data: next }), 1000);
        return next;
      });
    },
    [save],
  );
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const setFile = async (key: string, f: ProjectFile | null) => {
    const prev = files[key];
    const next = { ...files };
    if (f) next[key] = f;
    else delete next[key];
    setFiles(next);
    await save({ files: next });
    // Arquivo próprio do projeto (não o datasheet compartilhado do cadastro) sai do armazenamento.
    if (prev && prev.path.startsWith(`${id}/`) && prev.path !== f?.path) void removeProjectFile(prev.path);
  };

  const upload = async (key: string, file: File) => {
    if (file.size > 20 * 1024 * 1024) return void toast.error("Arquivo acima de 20 MB");
    setBusy(`up-${key}`);
    try {
      await setFile(key, await uploadProjectFile(id, key, file, file.name));
      toast.success("Arquivo anexado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar");
    } finally {
      setBusy(null);
    }
  };

  const open = async (f: ProjectFile) => {
    try {
      window.open(await projectFileUrl(f.path), "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir");
    }
  };

  const gen = async (what: "xlsx" | "form" | "memorial" | "pacote") => {
    if (!d) return;
    const miss = missing(d);
    if (miss.length && !confirm(`Ainda falta preencher:\n\n• ${miss.join("\n• ")}\n\nGerar mesmo assim?`)) return;
    if (dirty) await save({ data: d });
    setBusy(what);
    try {
      const docs = await import("./project-docs");
      const { saveBlob } = await import("@/components/bf/download-pdf");
      if (what === "xlsx") saveBlob(await docs.formXlsx(d), docs.docName(d, "Formulario-Solicitacao", "xlsx"));
      else if (what === "form") saveBlob(await docs.formPdf(d, files), docs.docName(d, "Formulario-Solicitacao", "pdf"));
      else if (what === "memorial") saveBlob(await docs.memorialPdf(d, await docs.memorialImages(files)), docs.docName(d, "Memorial-Tecnico-Descritivo", "pdf"));
      else {
        const [formulario, memorial] = await Promise.all([docs.formPdf(d, files), docs.memorialImages(files).then((imgs) => docs.memorialPdf(d, imgs))]);
        const { pdf, missing: absent } = await docs.projectPackage(d, files, { formulario, memorial });
        saveBlob(pdf, docs.docName(d, "Projeto-Fotovoltaico", "pdf"));
        if (absent.length) toast.warning(`Pasta gerada sem: ${absent.join(", ")}`, { duration: 9000 });
        else if (status === "rascunho") {
          setStatus("pronto");
          void save({ status: "pronto" });
        }
      }
      toast.success(what === "xlsx" ? "Excel do formulário baixado" : what === "pacote" ? "Pasta completa baixada" : "PDF baixado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar");
    } finally {
      setBusy(null);
    }
  };

  /* -------------------------------------------- equipamentos (biblioteca) */
  const libModules = (equipment ?? []).filter((e) => e.kind === "modulo");
  const libInverters = (equipment ?? []).filter((e) => e.kind === "inversor");
  const findLib = (kind: Equipment["kind"], brand: string, model: string) => (equipment ?? []).find((e) => e.kind === kind && e.brand.trim().toLowerCase() === brand.trim().toLowerCase() && e.model.trim().toLowerCase() === model.trim().toLowerCase());

  const saveToLibrary = async (kind: Equipment["kind"], item: PvModule | PvInverter, datasheet?: ProjectFile | null) => {
    if (!item.brand.trim() || !item.model.trim()) return void toast.error("Preencha fabricante e modelo");
    const specs = { ...item } as Record<string, unknown>;
    delete specs.qty;
    const existing = findLib(kind, item.brand, item.model);
    const body: Record<string, unknown> = { kind, brand: item.brand.trim(), model: item.model.trim(), specs };
    if (datasheet !== undefined) body.datasheet = datasheet;
    const { error } = existing ? await supabase().from("solar_equipment").update(body).eq("id", existing.id) : await supabase().from("solar_equipment").insert(body);
    if (error) return void toast.error(projectError(error.message));
    toast.success(existing ? "Cadastro do equipamento atualizado" : "Equipamento salvo no cadastro");
    void reloadEquipment();
  };

  const c = useMemo(() => (d ? calc(d) : null), [d]);
  if (loadErr)
    return (
      <Card className="mx-auto mt-10 max-w-lg p-6 text-center">
        <p className="font-semibold">{loadErr}</p>
        <Link href="/projetos" className="mt-3 inline-block text-sm font-semibold text-emerald-700">
          Voltar aos projetos
        </Link>
      </Card>
    );
  if (!d || !c || !row)
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
      </div>
    );

  const setClient = (k: keyof ProjectData["client"], v: string) => update((p) => ({ ...p, client: { ...p.client, [k]: v } }));
  const setUc = <K extends keyof ProjectData["uc"]>(k: K, v: ProjectData["uc"][K]) => update((p) => ({ ...p, uc: { ...p.uc, [k]: v } }));
  const setRt = (k: keyof ProjectData["rt"], v: string) => update((p) => ({ ...p, rt: { ...p.rt, [k]: v } }));
  const setGen = <K extends keyof ProjectData["generation"]>(k: K, v: ProjectData["generation"][K]) => update((p) => ({ ...p, generation: { ...p.generation, [k]: v } }));
  const setEnt = (k: keyof ProjectData["entrance"], v: string) => update((p) => ({ ...p, entrance: { ...p.entrance, [k]: v } }));
  const setProt = <K extends keyof ProjectData["protection"]>(k: K, v: ProjectData["protection"][K]) => update((p) => ({ ...p, protection: { ...p.protection, [k]: v } }));
  const setMod = (i: number, patch: Partial<PvModule>) => update((p) => ({ ...p, modules: p.modules.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));
  const setInv = (i: number, patch: Partial<PvInverter>) => update((p) => ({ ...p, inverters: p.inverters.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));
  const miss = missing(d);
  const prog = packageProgress(d, files);

  return (
    <div className="animate-fade-up mx-auto max-w-6xl">
      {/* cabeçalho */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/projetos" className="grid h-10 w-10 place-items-center rounded-xl bg-white text-ink-600 shadow-soft ring-1 ring-ink-200/70 hover:text-ink-900 dark:bg-white/5 dark:ring-white/10" aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-auto">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-400 uppercase">Projeto fotovoltaico</p>
          <h1 className="truncate font-display text-xl font-semibold tracking-tight sm:text-2xl">{d.client.name.trim() || "Projeto sem cliente"}</h1>
        </div>
        <span className="inline-flex flex-1 items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 sm:flex-none">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : dirty ? <Save className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5 text-emerald-600" />}
          {saving ? "Salvando…" : dirty ? "Alterações não salvas" : "Salvo"}
        </span>
        <Select
          value={status}
          onChange={(e) => {
            const s = e.target.value as ProjectStatus;
            setStatus(s);
            void save({ status: s });
          }}
          className={cx("w-auto font-semibold ring-1", statusCls(status))}
          aria-label="Situação do projeto"
        >
          {PROJECT_STATUS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_370px] lg:items-start">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
          {/* resumo */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Módulos", `${fmtNum(c.kwp, 2)} kWp`, `${c.moduleQty} módulos`],
              ["Inversor", `${fmtNum(c.inverterKw, 2)} kW`, `relação CC/CA ${fmtNum(c.dcAcRatio, 2)}`],
              ["Potência disponibilizada", `${fmtNum(c.pdKw, 2)} kW`, c.pgOk ? "geração dentro da PD" : c.pg ? "geração ACIMA da PD" : "—"],
              ["Geração estimada", `${fmtNum(c.monthly, 0)} kWh`, "por mês"],
            ].map(([k, v, s], i) => (
              <Card key={k} className={cx("p-4", i === 2 && c.pg > 0 && !c.pgOk && "ring-2 ring-rose-400")}>
                <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">{k}</p>
                <p className="tnum mt-1 font-display text-lg font-semibold text-ink-900">{v}</p>
                <p className={cx("text-[12px]", i === 2 && c.pg > 0 && !c.pgOk ? "font-semibold text-rose-600" : "text-ink-500")}>{s}</p>
              </Card>
            ))}
          </div>

          <Section id="cliente" title="Titular da unidade consumidora" subtitle="Como está na conta de energia">
            <G cols={2}>
              <Txt label="Nome / razão social" value={d.client.name} onChange={(v) => setClient("name", v)} className="sm:col-span-2" />
              <Txt label="CPF / CNPJ" value={d.client.doc} onChange={(v) => setClient("doc", v)} />
              <div className="grid grid-cols-2 gap-3">
                <Txt label="RG" value={d.client.rg} onChange={(v) => setClient("rg", v)} />
                <Txt label="Expedição" value={d.client.rgDate} onChange={(v) => setClient("rgDate", v)} placeholder="dd/mm/aaaa" />
              </div>
              <Txt label="Celular" value={d.client.phone} onChange={(v) => setClient("phone", v)} />
              <Txt label="E-mail" value={d.client.email} onChange={(v) => setClient("email", v)} />
              <Txt label="Endereço (rua e número)" value={d.client.address} onChange={(v) => setClient("address", v)} className="sm:col-span-2" />
              <Txt label="Bairro" value={d.client.district} onChange={(v) => setClient("district", v)} />
              <Txt label="CEP" value={d.client.cep} onChange={(v) => setClient("cep", v)} />
              <Txt label="Município" value={d.client.city} onChange={(v) => setClient("city", v)} />
              <Sel label="UF" value={d.client.state as (typeof UFS)[number]} options={UFS} onChange={(v) => setClient("state", v)} />
            </G>
          </Section>

          <Section id="uc" title="Unidade consumidora e padrão de entrada" subtitle="Campos das listas do formulário da Equatorial">
            <G cols={2}>
              <Txt label="Conta contrato" value={d.uc.account} onChange={(v) => setUc("account", v)} />
              <Sel label="Modalidade de compensação" value={d.uc.modality} options={MODALITIES} onChange={(v) => setUc("modality", v)} />
              <Sel label="Tipo de solicitação" value={d.uc.requestType} options={REQUEST_TYPES} labels={REQUEST_LABEL} onChange={(v) => setUc("requestType", v)} className="sm:col-span-2" />
              <Sel label="Classe" value={d.uc.cls} options={CLASSES} onChange={(v) => setUc("cls", v)} />
              <Txt label="Ramo de atividade" value={d.uc.activity} onChange={(v) => setUc("activity", v)} placeholder="Residencial, comércio…" />
              <Sel
                label="Tipo de ligação"
                value={d.uc.phase}
                options={PHASES}
                onChange={(v: Phase) =>
                  update((p) => ({ ...p, uc: { ...p.uc, phase: v, voltage: v === "MONOFÁSICO" ? (p.uc.voltage === 380 ? 220 : p.uc.voltage) : 380 } }))
                }
              />
              <Sel label="Tensão de atendimento (V)" value={d.uc.voltage as (typeof VOLTAGES)[number]} options={VOLTAGES} onChange={(v) => setUc("voltage", v)} />
              <Sel label="Disjuntor de entrada (A)" value={d.uc.breakerA as (typeof BREAKERS)[number]} options={BREAKERS} onChange={(v) => setUc("breakerA", v)} />
              <Num label="Carga declarada" value={d.uc.declaredLoadKw} onChange={(v) => setUc("declaredLoadKw", v)} suffix="kW" />
              <Sel label="Tipo de ramal" value={d.uc.branch} options={BRANCHES} onChange={(v) => setUc("branch", v)} />
              <Txt label="Poste / transformador mais próximo" value={d.uc.pole} onChange={(v) => setUc("pole", v)} placeholder="Se não houver: deixe vazio" />
              <Txt label="Coordenada X (UTM)" value={d.uc.utmX} onChange={(v) => setUc("utmX", v)} placeholder="8932240.03 m S" />
              <Txt label="Coordenada Y (UTM)" value={d.uc.utmY} onChange={(v) => setUc("utmY", v)} placeholder="805918.67 m E" />
              <div className="flex items-end pb-2 sm:col-span-2">
                <Switch checked={d.uc.specialLoads} onChange={(v) => setUc("specialLoads", v)} label="Possui cargas especiais" />
              </div>
            </G>
            <details className="group mt-4 rounded-2xl bg-ink-50/70 p-3 dark:bg-white/[0.04]">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13.5px] font-semibold text-ink-700 [&::-webkit-details-marker]:hidden">
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180" /> Ramal, caixa de medição e aterramento (memorial)
              </summary>
              <div className="mt-3">
                <G cols={2}>
                  <Txt label="Cabo fase do ramal (mm²)" value={d.entrance.phaseMm2} onChange={(v) => setEnt("phaseMm2", v)} placeholder={`automático: ${mm2(c.entranceCable)}`} />
                  <Txt label="Cabo neutro do ramal (mm²)" value={d.entrance.neutralMm2} onChange={(v) => setEnt("neutralMm2", v)} placeholder="igual ao fase" />
                  <Txt label="Caixa de medição" value={d.entrance.meterBox} onChange={(v) => setEnt("meterBox", v)} className="sm:col-span-2" />
                  <Txt label="Dimensões da caixa" value={d.entrance.meterBoxDims} onChange={(v) => setEnt("meterBoxDims", v)} />
                  <Txt label="Onde está instalada" value={d.entrance.meterBoxPlace} onChange={(v) => setEnt("meterBoxPlace", v)} />
                  <Txt label="Cabo de aterramento da caixa (mm²)" value={d.entrance.groundMm2} onChange={(v) => setEnt("groundMm2", v)} />
                </G>
              </div>
            </details>
          </Section>

          <Section
            id="modulos"
            title="Módulos fotovoltaicos"
            subtitle="Dados do datasheet do módulo (vão para a Tabela 4 do memorial)"
            right={
              <Button variant="secondary" size="sm" onClick={() => update((p) => ({ ...p, modules: [...p.modules, emptyModule()].slice(0, 10) }))}>
                <Plus className="h-4 w-4" /> Outro módulo
              </Button>
            }
          >
            <div className="grid gap-4">
              {d.modules.map((m, i) => (
                <EquipmentBox
                  key={i}
                  title={d.modules.length > 1 ? `Módulo ${i + 1}` : undefined}
                  library={libModules}
                  onPick={(e) => setMod(i, { ...(e.specs as unknown as ModuleSpecs), brand: e.brand, model: e.model })}
                  onSave={() => saveToLibrary("modulo", m)}
                  onRemove={d.modules.length > 1 ? () => update((p) => ({ ...p, modules: p.modules.filter((_, j) => j !== i) })) : undefined}
                  inLibrary={!!findLib("modulo", m.brand, m.model)}
                >
                  <G cols={4}>
                    <Txt label="Fabricante" value={m.brand} onChange={(v) => setMod(i, { brand: v })} />
                    <Txt label="Modelo" value={m.model} onChange={(v) => setMod(i, { model: v })} />
                    <Num label="Potência" value={m.powerW} onChange={(v) => setMod(i, { powerW: v })} suffix="W" digits={0} />
                    <Num label="Quantidade" value={m.qty} onChange={(v) => setMod(i, { qty: v })} digits={0} />
                  </G>
                  <Datasheet>
                    <G cols={4}>
                      <Txt label="Voc (V)" value={m.voc} onChange={(v) => setMod(i, { voc: v })} />
                      <Txt label="Isc (A)" value={m.isc} onChange={(v) => setMod(i, { isc: v })} />
                      <Txt label="Vmp (V)" value={m.vmp} onChange={(v) => setMod(i, { vmp: v })} />
                      <Txt label="Imp (A)" value={m.imp} onChange={(v) => setMod(i, { imp: v })} />
                      <Txt label="Eficiência (%)" value={m.efficiency} onChange={(v) => setMod(i, { efficiency: v })} />
                      <Num label="Comprimento" value={m.lengthM} onChange={(v) => setMod(i, { lengthM: v })} suffix="m" digits={3} />
                      <Num label="Largura" value={m.widthM} onChange={(v) => setMod(i, { widthM: v })} suffix="m" digits={3} />
                      <Txt label="Peso (kg)" value={m.weightKg} onChange={(v) => setMod(i, { weightKg: v })} />
                    </G>
                  </Datasheet>
                </EquipmentBox>
              ))}
            </div>
          </Section>

          <Section
            id="inversores"
            title="Inversor"
            subtitle="Dados do datasheet do inversor (Tabela 5 do memorial e item 2 do formulário)"
            right={
              <Button variant="secondary" size="sm" onClick={() => update((p) => ({ ...p, inverters: [...p.inverters, emptyInverter()].slice(0, 9) }))}>
                <Plus className="h-4 w-4" /> Outro inversor
              </Button>
            }
          >
            <div className="grid gap-4">
              {d.inverters.map((v, i) => {
                const lib = findLib("inversor", v.brand, v.model);
                return (
                  <EquipmentBox
                    key={i}
                    title={d.inverters.length > 1 ? `Inversor ${i + 1}` : undefined}
                    library={libInverters}
                    onPick={(e) => {
                      setInv(i, { ...(e.specs as unknown as InverterSpecs), brand: e.brand, model: e.model });
                      if (i === 0 && e.datasheet && !files.datasheet) void setFile("datasheet", e.datasheet);
                    }}
                    onSave={() => saveToLibrary("inversor", v, i === 0 ? (files.datasheet ?? lib?.datasheet ?? null) : undefined)}
                    onRemove={d.inverters.length > 1 ? () => update((p) => ({ ...p, inverters: p.inverters.filter((_, j) => j !== i) })) : undefined}
                    inLibrary={!!lib}
                  >
                    <G cols={4}>
                      <Txt label="Fabricante" value={v.brand} onChange={(x) => setInv(i, { brand: x })} />
                      <Txt label="Modelo" value={v.model} onChange={(x) => setInv(i, { model: x })} />
                      <Num label="Potência nominal CA" value={v.powerKw} onChange={(x) => setInv(i, { powerKw: x })} suffix="kW" />
                      <Num label="Quantidade" value={v.qty} onChange={(x) => setInv(i, { qty: x })} digits={0} />
                      <Num label="Corrente nominal CA" value={v.acA} onChange={(x) => setInv(i, { acA: x })} suffix="A" digits={1} />
                      <Txt label="Faixa de tensão (V)" value={v.voltageRange} onChange={(x) => setInv(i, { voltageRange: x })} placeholder="180-280" />
                      <Txt label="Fator de potência" value={v.pf} onChange={(x) => setInv(i, { pf: x })} />
                      <Num label="Rendimento" value={v.efficiency} onChange={(x) => setInv(i, { efficiency: x })} suffix="%" digits={1} />
                      <Txt label="DHT de corrente (%)" value={v.thd} onChange={(x) => setInv(i, { thd: x })} />
                      <Sel label="Saída" value={v.phases} options={[1, 2, 3] as const} labels={{ 1: "1 F + N", 2: "2 F + N", 3: "3 F + N" }} onChange={(x) => setInv(i, { phases: x })} />
                    </G>
                    <Datasheet>
                      <G cols={4}>
                        <Txt label="Máx. potência CC (kW)" value={v.maxDcKw} onChange={(x) => setInv(i, { maxDcKw: x })} />
                        <Txt label="Máx. tensão CC (V)" value={v.maxDcV} onChange={(x) => setInv(i, { maxDcV: x })} />
                        <Txt label="Máx. corrente CC (A)" value={v.maxDcA} onChange={(x) => setInv(i, { maxDcA: x })} />
                        <Txt label="Tensão de partida (V)" value={v.startV} onChange={(x) => setInv(i, { startV: x })} />
                        <Txt label="MPPT máx. (V)" value={v.mpptMaxV} onChange={(x) => setInv(i, { mpptMaxV: x })} />
                        <Txt label="MPPT mín. (V)" value={v.mpptMinV} onChange={(x) => setInv(i, { mpptMinV: x })} />
                        <Txt label="Nº de strings" value={v.strings} onChange={(x) => setInv(i, { strings: x })} />
                        <Txt label="Nº de MPPTs" value={v.mppts} onChange={(x) => setInv(i, { mppts: x })} />
                        <Txt label="Máx. potência CA (kW)" value={v.acMaxKw} onChange={(x) => setInv(i, { acMaxKw: x })} />
                        <Txt label="Tensão nominal CA (V)" value={v.acV} onChange={(x) => setInv(i, { acV: x })} />
                        <Txt label="Mín. tensão CA (V)" value={v.acMinV} onChange={(x) => setInv(i, { acMinV: x })} />
                        <Txt label="Máx. tensão CA (V)" value={v.acMaxV} onChange={(x) => setInv(i, { acMaxV: x })} />
                      </G>
                    </Datasheet>
                  </EquipmentBox>
                );
              })}
            </div>
          </Section>

          <Section id="protecao" title="Geração, proteção e cabos" subtitle="Calculado automaticamente; ajuste se o seu projeto for diferente">
            <G cols={4}>
              <Num label="Irradiação (HSP)" value={d.generation.hsp} onChange={(v) => setGen("hsp", v)} suffix="kWh/m²" />
              <Num label="Performance ratio" value={Math.round(d.generation.pr * 100)} onChange={(v) => setGen("pr", v / 100)} suffix="%" digits={0} />
              <Num label="Temp. máxima média" value={d.generation.tempMax} onChange={(v) => setGen("tempMax", v)} suffix="°C" digits={0} />
              <Txt label="Fonte da irradiação" value={d.generation.source} onChange={(v) => setGen("source", v)} />
              <Num label={`Disjuntor CA (auto: ${c.acBreaker} A)`} value={d.protection.acBreakerA} onChange={(v) => setProt("acBreakerA", v)} suffix="A" digits={0} />
              <Num label={`Polos (auto: ${c.acPoles})`} value={d.protection.acPoles} onChange={(v) => setProt("acPoles", v)} digits={0} />
              <Num label={`Cabo CA (auto: ${mm2(c.acCable)} mm²)`} value={d.cables.acMm2} onChange={(v) => update((p) => ({ ...p, cables: { ...p.cables, acMm2: v } }))} suffix="mm²" digits={1} />
              <Txt label="Cabo CC (mm²)" value={d.cables.dcMm2} onChange={(v) => update((p) => ({ ...p, cables: { ...p.cables, dcMm2: v } }))} />
              <Txt label="Chave de seccionamento CC" value={d.protection.dcSwitch} onChange={(v) => setProt("dcSwitch", v)} className="sm:col-span-2" />
              <Txt label="DPS CA · classe" value={d.protection.dpsClass} onChange={(v) => setProt("dpsClass", v)} />
              <Txt label="DPS CA · tensão" value={d.protection.dpsV} onChange={(v) => setProt("dpsV", v)} />
              <Txt label="DPS CA · In" value={d.protection.dpsIn} onChange={(v) => setProt("dpsIn", v)} />
              <Txt label="DPS CA · Imáx" value={d.protection.dpsMax} onChange={(v) => setProt("dpsMax", v)} />
              <Num label="Hastes de aterramento" value={d.protection.rods} onChange={(v) => setProt("rods", v)} digits={0} />
              <Txt label="Terra dos módulos (mm²)" value={d.protection.groundModuleMm2} onChange={(v) => setProt("groundModuleMm2", v)} />
              <Txt label="Fusíveis" value={d.protection.fuses} onChange={(v) => setProt("fuses", v)} className="sm:col-span-2 lg:col-span-4" />
            </G>
            <p className="mt-3 text-[12.5px] text-ink-500">
              Proteções de tensão do inversor: {c.protMin} – {c.protMax} V · disjuntor = primeiro padrão acima da corrente do inversor + 8 A · cabo pela capacidade de condução (NBR 5410).
            </p>
          </Section>

          <Section id="consumo" title="Carga e consumo" subtitle="Levantamento de carga e histórico de 12 meses (opcional)">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="text-left text-[11.5px] text-ink-500">
                    <th className="pb-1.5 font-semibold">Equipamento</th>
                    <th className="w-24 pb-1.5 font-semibold">Potência (W)</th>
                    <th className="w-16 pb-1.5 font-semibold">Qtd.</th>
                    <th className="w-16 pb-1.5 font-semibold">FP</th>
                    <th className="w-16 pb-1.5 font-semibold">FD</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {d.loads.map((l, i) => {
                    const set = (patch: Partial<typeof l>) => update((p) => ({ ...p, loads: p.loads.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
                    return (
                      <tr key={i}>
                        <td className="py-1 pr-2">
                          <Input value={l.name} onChange={(e) => set({ name: e.target.value })} />
                        </td>
                        <td className="py-1 pr-2">
                          <NumberInput value={l.w} onChange={(v) => set({ w: v })} digits={0} />
                        </td>
                        <td className="py-1 pr-2">
                          <NumberInput value={l.qty} onChange={(v) => set({ qty: v })} digits={0} />
                        </td>
                        <td className="py-1 pr-2">
                          <NumberInput value={l.fp} onChange={(v) => set({ fp: v })} />
                        </td>
                        <td className="py-1 pr-2">
                          <NumberInput value={l.fd} onChange={(v) => set({ fd: v })} />
                        </td>
                        <td>
                          <button type="button" aria-label="Remover" onClick={() => update((p) => ({ ...p, loads: p.loads.filter((_, j) => j !== i) }))} className="grid h-9 w-8 place-items-center text-ink-400 hover:text-rose-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => update((p) => ({ ...p, loads: [...p.loads, { name: "", w: 0, qty: 1, fp: 0.92, fd: 1 }] }))} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700">
                <Plus className="h-4 w-4" /> Equipamento
              </button>
              <span className="text-[12.5px] text-ink-500">
                Carga instalada: <b>{fmtNum(c.loadTotal.ci, 2)} kW</b> · demanda {fmtNum(c.loadTotal.dkw, 2)} kW
              </span>
            </div>
            <p className="mt-5 mb-2 text-[13px] font-semibold text-ink-700">Consumo dos últimos 12 meses (kWh)</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map((m, i) => (
                <Field key={m} label={m}>
                  <NumberInput
                    value={d.consumption[i] ?? 0}
                    onChange={(v) =>
                      update((p) => {
                        const arr = Array.from({ length: 12 }, (_, j) => p.consumption[j] ?? 0);
                        arr[i] = v;
                        return { ...p, consumption: arr.some((x) => x > 0) ? arr : [] };
                      })
                    }
                    digits={0}
                  />
                </Field>
              ))}
            </div>
          </Section>

          <Section id="rt" title="Responsável técnico" subtitle="Vem do último projeto; vai no formulário, no comissionamento e na assinatura do memorial">
            <G cols={2}>
              <Txt label="Nome completo" value={d.rt.name} onChange={(v) => setRt("name", v)} />
              <Txt label="Título profissional" value={d.rt.title} onChange={(v) => setRt("title", v)} />
              <Txt label="Registro profissional" value={d.rt.register} onChange={(v) => setRt("register", v)} />
              <Sel label="UF do registro" value={d.rt.registerUf as (typeof UFS)[number]} options={UFS} onChange={(v) => setRt("registerUf", v)} />
              <Txt label="E-mail" value={d.rt.email} onChange={(v) => setRt("email", v)} />
              <Txt label="Celular" value={d.rt.mobile} onChange={(v) => setRt("mobile", v)} />
              <Txt label="Telefone fixo" value={d.rt.landline} onChange={(v) => setRt("landline", v)} />
              <Txt label="Endereço de correspondência" value={d.rt.address} onChange={(v) => setRt("address", v)} />
              <Txt label="Bairro" value={d.rt.district} onChange={(v) => setRt("district", v)} />
              <Txt label="Município" value={d.rt.city} onChange={(v) => setRt("city", v)} />
              <Sel label="UF" value={d.rt.uf as (typeof UFS)[number]} options={UFS} onChange={(v) => setRt("uf", v)} />
              <Txt label="CEP" value={d.rt.cep} onChange={(v) => setRt("cep", v)} />
            </G>
          </Section>
        </div>

        {/* pasta */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pb-2 [scrollbar-width:thin]">
          <Card className="overflow-hidden">
            <div className="bg-ink-950 p-5 text-white">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-brand-lime uppercase">Pasta do projeto</p>
              <p className="mt-1 font-display text-2xl font-semibold">
                {prog.count} de {prog.total} itens
              </p>
              <div className="mt-3 flex gap-1">
                {prog.done.map((ok, i) => (
                  <span key={i} className={cx("h-1.5 flex-1 rounded-full", ok ? "bg-brand-lime" : "bg-white/15")} />
                ))}
              </div>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => gen("pacote")}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F3E93B] to-[#9FDB7C] text-[14.5px] font-bold text-ink-950 disabled:opacity-60"
              >
                {busy === "pacote" ? <Loader2 className="h-5 w-5 animate-spin" /> : <FolderDown className="h-5 w-5" />} Baixar pasta completa (PDF)
              </button>
              <p className="mt-2 text-center text-[11.5px] text-white/50">Índice + os 7 itens na ordem da distribuidora</p>
            </div>
            {miss.length > 0 && (
              <div className="flex gap-2.5 border-b border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  <b>Falta preencher:</b> {miss.join(", ")}.
                </p>
              </div>
            )}
            <div className="divide-y divide-ink-100 dark:divide-white/[0.06]">
              {PROJECT_ITEMS.map((it, i) => {
                const f = files[it.key];
                const ok = prog.done[i];
                return (
                  <div key={it.key} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className={cx("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold", ok ? "bg-emerald-600 text-white" : "bg-ink-100 text-ink-500 dark:bg-white/10")}>{ok ? <Check className="h-4 w-4" strokeWidth={3} /> : it.n}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold">{it.title}</p>
                        <p className="truncate text-[12px] text-ink-500">{it.auto ? it.hint : f ? `${f.name} · ${sizeKb(f.size)}` : it.hint}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-10">
                      {it.key === "formulario" ? (
                        <>
                          <SmallBtn onClick={() => gen("xlsx")} busy={busy === "xlsx"} disabled={!!busy} icon={<FileSpreadsheet className="h-3.5 w-3.5" />}>
                            Excel
                          </SmallBtn>
                          <SmallBtn onClick={() => gen("form")} busy={busy === "form"} disabled={!!busy} icon={<FileText className="h-3.5 w-3.5" />}>
                            PDF
                          </SmallBtn>
                        </>
                      ) : it.key === "memorial" ? (
                        <SmallBtn onClick={() => gen("memorial")} busy={busy === "memorial"} disabled={!!busy} icon={<FileText className="h-3.5 w-3.5" />}>
                          Gerar PDF
                        </SmallBtn>
                      ) : (
                        <>
                          <UploadBtn busy={busy === `up-${it.key}`} disabled={!!busy} onFile={(file) => upload(it.key, file)} label={f ? "Trocar" : "Anexar"} />
                          {f && (
                            <>
                              <SmallBtn onClick={() => open(f)} icon={<Eye className="h-3.5 w-3.5" />}>
                                Ver
                              </SmallBtn>
                              <SmallBtn onClick={() => confirm(`Remover "${f.name}" do projeto?`) && void setFile(it.key, null)} icon={<Trash2 className="h-3.5 w-3.5" />}>
                                Remover
                              </SmallBtn>
                            </>
                          )}
                          {it.key === "datasheet" && !f && (() => {
                            const lib = findLib("inversor", d.inverters[0]?.brand ?? "", d.inverters[0]?.model ?? "");
                            return lib?.datasheet ? (
                              <SmallBtn onClick={() => void setFile("datasheet", lib.datasheet)} icon={<Zap className="h-3.5 w-3.5" />}>
                                Usar o do cadastro
                              </SmallBtn>
                            ) : null;
                          })()}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-[14px] font-semibold">Imagens do memorial</p>
            <p className="mb-3 text-[12px] text-ink-500">Opcionais: entram nas figuras do memorial (JPG ou PNG)</p>
            <div className="grid gap-2.5">
              {MEMORIAL_IMAGES.map((m) => {
                const f = files[m.key];
                return (
                  <div key={m.key} className="flex items-center gap-3">
                    <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-xl", f ? "bg-emerald-50 text-emerald-700" : "bg-ink-50 text-ink-400 dark:bg-white/5")}>{f ? <Check className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">{m.title}</p>
                      <p className="truncate text-[11.5px] text-ink-500">{f ? f.name : m.hint}</p>
                    </div>
                    <UploadBtn busy={busy === `up-${m.key}`} disabled={!!busy} onFile={(file) => (file.type.startsWith("image/") ? upload(m.key, file) : toast.error("Envie uma imagem JPG ou PNG"))} label={f ? "Trocar" : "Anexar"} accept="image/png,image/jpeg" />
                    {f && (
                      <button type="button" aria-label={`Remover ${m.title}`} onClick={() => void setFile(m.key, null)} className="text-ink-400 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SmallBtn({ children, onClick, icon, busy, disabled }: { children: ReactNode; onClick: () => void; icon: ReactNode; busy?: boolean; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold ring-1 ring-ink-200 transition hover:ring-ink-300 disabled:opacity-50 dark:ring-white/15">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon} {children}
    </button>
  );
}

function UploadBtn({ onFile, busy, disabled, label, accept = ACCEPT }: { onFile: (f: File) => void; busy?: boolean; disabled?: boolean; label: string; accept?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
      <button type="button" disabled={disabled} onClick={() => ref.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink-950 px-3 text-[12.5px] font-semibold text-white transition disabled:opacity-50 dark:bg-white dark:text-ink-950">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {label}
      </button>
    </>
  );
}

function Datasheet({ children }: { children: ReactNode }) {
  return (
    <details className="group mt-3">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-emerald-700 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" /> Dados do datasheet
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function EquipmentBox({
  title,
  children,
  library,
  onPick,
  onSave,
  onRemove,
  inLibrary,
}: {
  title?: string;
  children: ReactNode;
  library: Equipment[];
  onPick: (e: Equipment) => void;
  onSave: () => void;
  onRemove?: () => void;
  inLibrary: boolean;
}) {
  return (
    <div className="rounded-2xl bg-ink-50/60 p-3 ring-1 ring-ink-200/60 sm:p-4 dark:bg-white/[0.03] dark:ring-white/[0.07]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {title && <p className="mr-auto text-[13.5px] font-semibold">{title}</p>}
        {library.length > 0 && (
          <Select
            value=""
            onChange={(e) => {
              const it = library.find((x) => x.id === e.target.value);
              if (it) onPick(it);
            }}
            className={cx("h-9 w-auto max-w-full text-[13px] sm:h-9", !title && "mr-auto")}
            aria-label="Escolher do cadastro"
          >
            <option value="">Escolher do cadastro…</option>
            {library.map((x) => (
              <option key={x.id} value={x.id}>
                {x.brand} {x.model}
              </option>
            ))}
          </Select>
        )}
        <button type="button" onClick={onSave} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 dark:ring-emerald-500/30 dark:hover:bg-emerald-500/10">
          <Download className="h-3.5 w-3.5 rotate-180" /> {inLibrary ? "Atualizar cadastro" : "Salvar no cadastro"}
        </button>
        {onRemove && (
          <button type="button" aria-label="Remover" onClick={onRemove} className="grid h-9 w-9 place-items-center rounded-full text-ink-400 hover:text-rose-600">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
