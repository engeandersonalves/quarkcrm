"use client";

import { Activity, AlertTriangle, ChevronRight, CircleOff, Gauge, Link2, Loader2, MapPin, Plus, RefreshCw, Search, Sun, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { BarChart, Sparkline } from "@/components/charts";
import { ConnectModal, ProviderMark } from "@/components/monitoring/connect-modal";
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Segmented, Select, Skeleton, cx } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { PROVIDERS, providerInfo } from "@/lib/monitoring/catalog";
import type { PlantStatus } from "@/lib/monitoring/types";
import { STATUS_LABEL, fmtKw, fmtKwh, fmtKwp, lastDays, loadOf, summarize, yieldBand, yieldOf, type ConnectionRow, type PlantRow } from "@/lib/monitoring/view";
import { supabase } from "@/lib/supabase/client";

type Filter = "todas" | PlantStatus;
type Sort = "today" | "power" | "yield" | "name";

const GREEN = "#9BD373";
/** Linhas e rótulos do gráfico legíveis sobre o painel escuro. */
const DARK_CHART = {
  "--color-ink-100": "rgba(255,255,255,0.07)",
  "--color-ink-300": "rgba(255,255,255,0.18)",
  "--color-ink-400": "rgba(255,255,255,0.45)",
  "--color-ink-700": "rgba(255,255,255,0.85)",
  "--color-ink-900": "#ffffff",
} as React.CSSProperties;
const STATUS_STYLE: Record<PlantStatus, { dot: string; badge: string; icon: typeof Zap }> = {
  online: { dot: "bg-emerald-400", badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", icon: Zap },
  alarm: { dot: "bg-amber-400", badge: "bg-amber-50 text-amber-800 ring-amber-600/20", icon: AlertTriangle },
  offline: { dot: "bg-rose-500", badge: "bg-rose-50 text-rose-700 ring-rose-600/20", icon: CircleOff },
  unknown: { dot: "bg-ink-400", badge: "bg-ink-100 text-ink-600 ring-ink-500/15", icon: Activity },
};

export default function MonitoringPage() {
  const { profile } = useApp();
  const isAdmin = profile?.role === "admin";
  const [connectOpen, setConnectOpen] = useState(false);
  const [syncing, setSyncing] = useState<string | "all" | null>(null);
  const [filter, setFilter] = useState<Filter>("todas");
  const [provider, setProvider] = useState("todos");
  const [sort, setSort] = useState<Sort>("today");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: connections, loading: loadingConn, reload: reloadConn } = useLive(
    async () => must(await supabase().from("monitoring_connections").select("*").order("created_at")) as ConnectionRow[],
    [],
    ["monitoring_connections"],
  );
  const { data: plants, loading: loadingPlants, reload: reloadPlants } = useLive(
    async () => must(await supabase().from("monitoring_plants").select("*, lead:leads(id,name)").order("name").limit(2000)) as PlantRow[],
    [],
    ["monitoring_plants"],
  );
  const days = useMemo(() => lastDays(30), []);
  const { data: daily, reload: reloadDaily } = useLive(
    async () => must(await supabase().from("monitoring_daily").select("plant_id, day, kwh").gte("day", days[0]).limit(20000)) as { plant_id: string; day: string; kwh: number }[],
    [days[0]],
    [],
  );

  const byPlant = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const d of daily ?? []) {
      if (!m.has(d.plant_id)) m.set(d.plant_id, new Map());
      m.get(d.plant_id)!.set(d.day, Number(d.kwh));
    }
    return m;
  }, [daily]);

  const sync = async (connectionId?: string, silent = false) => {
    setSyncing(connectionId ?? "all");
    const res = await fetch("/api/monitoring/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setSyncing(null);
    reloadConn();
    reloadPlants();
    reloadDaily();
    if (silent) return;
    if (!res?.ok) return toast.error(json.error ?? "Não foi possível atualizar agora");
    const failed = (json.results ?? []).filter((r: { ok: boolean }) => !r.ok);
    if (failed.length) toast.error(failed[0].error);
    else toast.success("Usinas atualizadas");
  };

  // Ao abrir a tela: atualiza sozinho se a última leitura tiver mais de 15 minutos.
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || !connections?.length) return;
    const stale = connections.some((c) => c.status !== "syncing" && (!c.last_sync_at || Date.now() - new Date(c.last_sync_at).getTime() > 15 * 60_000));
    auto.current = true;
    if (stale) sync(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections]);

  const removeConnection = async (c: ConnectionRow) => {
    if (!confirm(`Remover a conexão “${c.label}”? As usinas dela saem do monitoramento.`)) return;
    const res = await fetch(`/api/monitoring/connections?id=${c.id}`, { method: "DELETE" }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return toast.error(json.error ?? "Não foi possível remover");
    toast.success("Conexão removida");
    reloadConn();
    reloadPlants();
  };

  const all = plants ?? [];
  const s = summarize(all);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = all.filter(
      (p) =>
        (filter === "todas" || p.status === filter) &&
        (provider === "todos" || p.provider === provider) &&
        (!term || `${p.name} ${p.address ?? ""} ${p.lead?.name ?? ""}`.toLowerCase().includes(term)),
    );
    const v = (x: number | null) => x ?? -1;
    return list.sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : sort === "power" ? v(Number(b.power_kw)) - v(Number(a.power_kw)) : sort === "yield" ? v(yieldOf(b)) - v(yieldOf(a)) : v(Number(b.today_kwh)) - v(Number(a.today_kwh)),
    );
  }, [all, filter, provider, q, sort]);

  const fleetDaily = useMemo(() => days.map((d, i) => ({ label: i % 6 === 0 ? d.slice(8) : "", full: new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }), value: [...byPlant.values()].reduce((t, m) => t + (m.get(d) ?? 0), 0) })), [days, byPlant]);
  const openPlant = all.find((p) => p.id === openId) ?? null;
  const loading = loadingConn || loadingPlants;

  return (
    <div className="animate-fade-up">
      <PageHeader
        icon={<Activity />}
        eyebrow="Pós-venda"
        title="Monitoramento"
        subtitle="As usinas dos seus clientes, de todos os fabricantes, em um só lugar"
        actions={
          <>
            {!!connections?.length && (
              <Button variant="secondary" onClick={() => sync()} disabled={!!syncing}>
                <RefreshCw className={cx("h-4 w-4", syncing === "all" && "animate-spin")} /> {syncing === "all" ? "Atualizando…" : "Atualizar"}
              </Button>
            )}
            {isAdmin && (
              <Button onClick={() => setConnectOpen(true)}>
                <Plus className="h-4 w-4" /> Conectar inversor
              </Button>
            )}
          </>
        }
      />

      {loading ? (
        <div className="grid gap-3">
          <Skeleton className="h-40" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      ) : !connections?.length ? (
        <Welcome isAdmin={isAdmin} onConnect={() => setConnectOpen(true)} />
      ) : (
        <>
          {/* ------------------------------------------------ painel ao vivo */}
          <section className="relative overflow-hidden rounded-[28px] bg-ink-950 p-5 text-white shadow-lift sm:p-7">
            <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[#9BD373]/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-[#5B34D6]/25 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(155,211,115,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(155,211,115,0.06)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_80%_0%,#000,transparent_70%)]" />
            <div className="relative grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-center">
              <div>
                <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.28em] text-[#C9E97A] uppercase">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  Potência agora
                </p>
                <p className="tnum mt-2 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
                  {fmtKw(s.powerKw).replace(/ (k|M)W$/, "")}
                  <span className="ml-2 text-2xl font-normal text-white/50">{/MW$/.test(fmtKw(s.powerKw)) ? "MW" : "kW"}</span>
                </p>
                <p className="mt-1 text-sm text-white/55">
                  {s.capacityKwp ? `${Math.round((s.powerKw / s.capacityKwp) * 100)}% de ${fmtKwp(s.capacityKwp)} instalados` : `${s.total} usinas`}
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10 sm:grid-cols-4 lg:grid-cols-2">
                  {[
                    { k: "Hoje", v: fmtKwh(s.todayKwh) },
                    { k: "No mês", v: s.monthKwh ? fmtKwh(s.monthKwh) : "—" },
                    { k: "Gerando", v: `${s.online}/${s.total}` },
                    { k: "Atenção", v: String(s.alarm + s.offline), warn: s.alarm + s.offline > 0 },
                  ].map((x) => (
                    <div key={x.k} className="bg-[#120B24]/60 px-4 py-3">
                      <dt className="text-[10px] font-semibold tracking-[0.16em] text-white/45 uppercase">{x.k}</dt>
                      <dd className={cx("tnum mt-0.5 font-display text-lg font-semibold whitespace-nowrap", x.warn && "text-amber-300")}>{x.v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10" style={DARK_CHART}>
                <p className="mb-2 text-xs font-semibold text-white/60">Geração das usinas · últimos 30 dias</p>
                {fleetDaily.some((d) => d.value > 0) ? (
                  <BarChart data={fleetDaily} format={(v) => fmtKwh(v)} color={GREEN} height={180} />
                ) : (
                  <p className="grid h-[180px] place-items-center text-center text-sm text-white/45">O histórico começa a aparecer conforme as sincronizações acontecem.</p>
                )}
              </div>
            </div>
          </section>

          {/* --------------------------------------------------- conexões */}
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {connections.map((c) => {
              const info = providerInfo(c.provider);
              return (
                <div key={c.id} className="glass flex min-w-[270px] items-center gap-3 rounded-2xl p-3 pr-2">
                  <ProviderMark id={c.provider} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{c.label}</p>
                    <p className={cx("truncate text-xs", c.status === "error" ? "text-rose-600" : "text-ink-500")} title={c.last_error ?? undefined}>
                      {c.status === "syncing" || syncing === c.id
                        ? "Atualizando…"
                        : c.status === "error"
                          ? c.last_error ?? "Erro na última atualização"
                          : `${c.plants_count} ${c.plants_count === 1 ? "usina" : "usinas"} · ${c.last_sync_at ? relativeTime(c.last_sync_at) : info?.platform}`}
                    </p>
                  </div>
                  <button onClick={() => sync(c.id)} disabled={!!syncing} className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 transition hover:bg-ink-100 hover:text-ink-800 disabled:opacity-40" aria-label="Atualizar conexão" title="Atualizar">
                    {syncing === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </button>
                  {isAdmin && (
                    <button onClick={() => removeConnection(c)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 transition hover:bg-rose-50 hover:text-rose-600" aria-label="Remover conexão" title="Remover">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* ---------------------------------------------------- filtros */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-60">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar usina, cidade ou cliente" className="pl-10" />
            </div>
            <div className="max-w-full overflow-x-auto">
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "todas", label: `Todas · ${s.total}` },
                  { value: "online", label: `Gerando · ${s.online}` },
                  { value: "alarm", label: `Alerta · ${s.alarm}` },
                  { value: "offline", label: `Offline · ${s.offline}` },
                ]}
              />
            </div>
            <Select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-auto">
              <option value="todos">Todos os fabricantes</option>
              {PROVIDERS.filter((p) => connections.some((c) => c.provider === p.id)).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-auto">
              <option value="today">Mais geração hoje</option>
              <option value="power">Maior potência agora</option>
              <option value="yield">Melhor desempenho</option>
              <option value="name">Nome</option>
            </Select>
          </div>

          {/* ---------------------------------------------------- usinas */}
          {!shown.length ? (
            <Card className="mt-4">
              <Empty icon={<Sun className="h-6 w-6" />} title={all.length ? "Nenhuma usina neste filtro" : "Nenhuma usina importada ainda"} text={all.length ? "Ajuste a busca ou os filtros." : "Assim que a conta tiver usinas, elas aparecem aqui."} />
            </Card>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((p) => (
                <PlantCard key={p.id} p={p} spark={days.slice(-14).map((d) => byPlant.get(p.id)?.get(d) ?? 0)} onOpen={() => setOpenId(p.id)} />
              ))}
            </div>
          )}
        </>
      )}

      <ConnectModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnected={() => {
          reloadConn();
          reloadPlants();
          reloadDaily();
        }}
      />
      {openPlant && <PlantModal p={openPlant} days={days} series={byPlant.get(openPlant.id)} onClose={() => setOpenId(null)} onChanged={reloadPlants} />}
    </div>
  );
}

/* ------------------------------------------------------------- cartão */

function StatusBadge({ status }: { status: PlantStatus }) {
  const st = STATUS_STYLE[status];
  return (
    <Badge className={st.badge}>
      <span className="relative flex h-1.5 w-1.5">
        {status === "online" && <span className={cx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-70", st.dot)} />}
        <span className={cx("relative inline-flex h-1.5 w-1.5 rounded-full", st.dot)} />
      </span>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function PlantCard({ p, spark, onOpen }: { p: PlantRow; spark: number[]; onOpen: () => void }) {
  const load = loadOf(p);
  const y = yieldOf(p);
  const band = yieldBand(y);
  return (
    <button onClick={onOpen} className="glass group relative flex flex-col overflow-hidden rounded-2xl p-4 text-left transition hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <ProviderMark id={p.provider} className="h-9 w-9 text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-semibold text-ink-900">{p.name}</p>
          <p className="truncate text-xs text-ink-500">{(p.lead && p.lead.name !== p.name ? p.lead.name : null) ?? p.address ?? providerInfo(p.provider)?.platform}</p>
        </div>
        <StatusBadge status={p.status} />
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="tnum font-display text-2xl font-semibold text-ink-900">{fmtKw(p.power_kw)}</p>
          <p className="text-xs text-ink-500">de {fmtKwp(p.capacity_kwp)}</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div className="h-full rounded-full bg-gradient-to-r from-[#F3EA3B] to-[#6CC690] transition-all duration-700" style={{ width: `${Math.round((load ?? 0) * 100)}%` }} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        {[
          { k: "Hoje", v: fmtKwh(p.today_kwh) },
          { k: "Mês", v: fmtKwh(p.month_kwh) },
          { k: "Total", v: fmtKwh(p.total_kwh) },
        ].map((x) => (
          <div key={x.k}>
            <p className="text-ink-400">{x.k}</p>
            <p className="tnum mt-0.5 font-semibold text-ink-800">{x.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 h-8">{spark.some((v) => v > 0) ? <Sparkline values={spark} color={GREEN} /> : null}</div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-ink-100 pt-3 text-[11px] text-ink-500">
        {y !== null ? (
          <span className={cx("flex items-center gap-1 font-semibold", band === "high" ? "text-emerald-700" : band === "mid" ? "text-sun-700" : "text-amber-700")} title="kWh gerados hoje por kWp instalado">
            <Gauge className="h-3.5 w-3.5" /> {y.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh/kWp hoje
          </span>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-1">
          {p.last_update_at ? relativeTime(p.last_update_at) : relativeTime(p.synced_at)} <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------ detalhe */

function PlantModal({ p, days, series, onClose, onChanged }: { p: PlantRow; days: string[]; series?: Map<string, number>; onClose: () => void; onChanged: () => void }) {
  const [leadId, setLeadId] = useState(p.lead_id ?? "");
  const [saving, setSaving] = useState(false);
  const { data: leads } = useLive(async () => must(await supabase().from("leads").select("id,name,city").order("name").limit(3000)) as { id: string; name: string; city: string | null }[], [], []);
  const data = days.map((d, i) => ({ label: i % 6 === 0 ? d.slice(8) : "", full: new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }), value: series?.get(d) ?? 0 }));
  const withData = data.filter((d) => d.value > 0);
  const avg = withData.length ? withData.reduce((t, d) => t + d.value, 0) / withData.length : null;
  const best = withData.length ? Math.max(...withData.map((d) => d.value)) : null;
  const info = providerInfo(p.provider);

  const link = async () => {
    setSaving(true);
    const { error } = await supabase().from("monitoring_plants").update({ lead_id: leadId || null }).eq("id", p.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(leadId ? "Usina vinculada ao cliente" : "Vínculo removido");
    onChanged();
  };

  return (
    <Modal open onClose={onClose} size="lg" title={p.name} subtitle={`${info?.platform ?? p.provider} · ${p.address ?? "sem endereço"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={p.status} />
        <span className="text-xs text-ink-500">Última leitura {p.last_update_at ? relativeTime(p.last_update_at) : "—"} · sincronizado {relativeTime(p.synced_at)}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { k: "Potência agora", v: fmtKw(p.power_kw) },
          { k: "Hoje", v: fmtKwh(p.today_kwh) },
          { k: "No mês", v: fmtKwh(p.month_kwh) },
          { k: "Total gerado", v: fmtKwh(p.total_kwh) },
        ].map((x) => (
          <div key={x.k} className="rounded-2xl bg-ink-50 px-3.5 py-3 ring-1 ring-ink-200/60 dark:bg-white/[0.03]">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-ink-500 uppercase">{x.k}</p>
            <p className="tnum mt-0.5 font-display text-lg font-semibold text-ink-900">{x.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-ink-900">Geração por dia · últimos 30 dias</p>
          {avg !== null && (
            <p className="text-xs text-ink-500">
              média {fmtKwh(avg)} · melhor dia {fmtKwh(best)}
            </p>
          )}
        </div>
        {withData.length ? (
          <BarChart data={data} format={(v) => fmtKwh(v)} color={GREEN} height={200} />
        ) : (
          <p className="grid h-32 place-items-center rounded-2xl bg-ink-50 text-center text-sm text-ink-500 dark:bg-white/[0.03]">O histórico se forma a cada sincronização diária.</p>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-ink-500">Capacidade instalada</dt>
        <dd className="text-right font-medium text-ink-900">{fmtKwp(p.capacity_kwp)}</dd>
        <dt className="text-ink-500">Desempenho hoje</dt>
        <dd className="text-right font-medium text-ink-900">{yieldOf(p) !== null ? `${yieldOf(p)!.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWh/kWp` : "—"}</dd>
        <dt className="text-ink-500">Fabricante</dt>
        <dd className="text-right font-medium text-ink-900">{info?.name ?? p.provider}</dd>
        <dt className="text-ink-500">ID no fabricante</dt>
        <dd className="truncate text-right font-mono text-xs text-ink-700">{p.external_id}</dd>
        {p.address && (
          <>
            <dt className="text-ink-500">Endereço</dt>
            <dd className="flex items-center justify-end gap-1 text-right text-ink-900">
              <MapPin className="h-3.5 w-3.5 text-ink-400" /> {p.address}
            </dd>
          </>
        )}
      </dl>

      <div className="mt-5 rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-200/60 dark:bg-white/[0.03]">
        <Field label="Cliente do CRM" hint="Vincule para ver a usina na ficha do cliente">
          <div className="flex gap-2">
            <Select value={leadId} onChange={(e) => setLeadId(e.target.value)} className="flex-1">
              <option value="">Sem vínculo</option>
              {(leads ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.city ? ` — ${l.city}` : ""}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={link} loading={saving} disabled={leadId === (p.lead_id ?? "")}>
              <Link2 className="h-4 w-4" /> Salvar
            </Button>
          </div>
        </Field>
        {p.lead_id && (
          <Link href={`/leads/${p.lead_id}`} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-sun-700 hover:underline">
            Abrir ficha do cliente <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------- boas-vindas */

function Welcome({ isAdmin, onConnect }: { isAdmin: boolean; onConnect: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-ink-950 px-6 py-12 text-center text-white shadow-lift sm:py-16">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-[#9BD373]/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(155,211,115,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(155,211,115,0.06)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_50%_100%,#000,transparent_70%)]" />
      <div className="relative mx-auto max-w-xl">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
          <Activity className="h-8 w-8 text-[#C9E97A]" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-semibold sm:text-3xl">Todas as usinas em uma tela</h2>
        <p className="mt-2 text-white/60">Conecte a conta de cada fabricante uma vez. O app importa as usinas dos seus clientes e mostra a geração de cada uma, com alerta das que pararam.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {PROVIDERS.map((p) => (
            <span key={p.id} className="flex items-center gap-2 rounded-full bg-white/[0.06] py-1 pr-3 pl-1 text-xs font-semibold text-white/80 ring-1 ring-white/10">
              <ProviderMark id={p.id} className="h-6 w-6 rounded-full text-[9px]" /> {p.name}
            </span>
          ))}
        </div>
        {isAdmin ? (
          <Button onClick={onConnect} size="lg" className="mt-8 bg-white bg-none text-[#0B0818] ring-0 hover:brightness-100">
            <Plus className="h-4 w-4" /> Conectar primeira conta
          </Button>
        ) : (
          <p className="mt-8 text-sm text-white/50">Peça a um administrador para conectar as contas dos inversores.</p>
        )}
      </div>
    </section>
  );
}
