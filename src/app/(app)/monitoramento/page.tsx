"use client";

import { Activity, AlertTriangle, ChevronRight, CircleOff, Gauge, Loader2, Plus, RefreshCw, Search, Sun, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { BarChart, Donut, Sparkline } from "@/components/charts";
import { Alert3D, Bolt3D, Calendar3D, Coin3D, Gauge3D, House3D, IconTile, Inverter3D, Leaf3D, Panel3D, Sun3D } from "@/components/icons3d";
import { AlarmList, useAlarms } from "@/components/monitoring/alarm-list";
import { ConnectModal, ProviderMark } from "@/components/monitoring/connect-modal";
import { Badge, Button, Card, Empty, Input, PageHeader, Segmented, Select, Skeleton, cx } from "@/components/ui";
import { DEFAULT_INPUTS } from "@/lib/defaults";
import { relativeTime } from "@/lib/format";
import { CO2_KG_PER_KWH, monthShort } from "@/lib/monitoring/report";
import { must, useLive } from "@/lib/live";
import { PROVIDERS, providerInfo } from "@/lib/monitoring/catalog";
import type { PlantStatus } from "@/lib/monitoring/types";
import { STATUS_LABEL, attentionOf, fmtKw, fmtKwh, fmtKwp, lastDays, loadOf, summarize, yieldBand, yieldOf, type ConnectionRow, type PlantRow } from "@/lib/monitoring/view";
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
  const { profile, settings } = useApp();
  const tariff = { ...DEFAULT_INPUTS, ...settings.defaults }.tariff;
  const isAdmin = profile?.role === "admin";
  const [connectOpen, setConnectOpen] = useState(false);
  const [syncing, setSyncing] = useState<string | "all" | null>(null);
  const [filter, setFilter] = useState<Filter>("todas");
  const [provider, setProvider] = useState("todos");
  const [sort, setSort] = useState<Sort>("today");
  const [q, setQ] = useState("");

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

  // Histórico mensal (12 meses) já baixado e guardado no banco
  const monthsKeys = useMemo(() => {
    const now = new Date(Date.now() - 3 * 3600_000);
    return Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1)).toISOString().slice(0, 7));
  }, []);
  const { data: monthRows } = useLive(
    async () => {
      const { data, error } = await supabase().from("monitoring_months").select("plant_id, month, kwh").gte("month", monthsKeys[0]).limit(20000);
      return error ? [] : ((data ?? []) as { plant_id: string; month: string; kwh: number | null }[]);
    },
    [monthsKeys[0]],
    [],
  );

  const { data: alarmRows, reload: reloadAlarms } = useAlarms({ status: "abertos", limit: 50 });

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
    const res = await fetch("/api/monitoring/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId, auto: silent }) }).catch(() => null);
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

  // Ao abrir a tela: só pede atualização se a última tiver mais de 1 hora (os dados vêm do banco).
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || !connections?.length) return;
    const stale = connections.some((c) => c.status !== "syncing" && (!c.last_sync_at || Date.now() - new Date(c.last_sync_at).getTime() > 60 * 60_000) && !(c.retry_after && new Date(c.retry_after).getTime() > Date.now()));
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
  const loading = loadingConn || loadingPlants;
  const hour = Number(new Date(Date.now() - 3 * 3600_000).toISOString().slice(11, 13));
  const totalKwh = all.reduce((t, p) => t + (Number(p.total_kwh) || 0), 0);
  const fleetMonthly = useMemo(() => {
    const agg = new Map<string, number>();
    for (const r of monthRows ?? []) agg.set(r.month, (agg.get(r.month) ?? 0) + (Number(r.kwh) || 0));
    // Mês corrente: soma do que as usinas informam agora (mais atual que o histórico)
    agg.set(monthsKeys[11], Math.max(agg.get(monthsKeys[11]) ?? 0, s.monthKwh));
    return monthsKeys.map((m) => ({ label: monthShort(m), full: `${monthShort(m)}/${m.slice(2, 4)}`, value: agg.get(m) ?? 0 }));
  }, [monthRows, monthsKeys, s.monthKwh]);
  const yearKwh = fleetMonthly.filter((_, i) => monthsKeys[i].startsWith(monthsKeys[11].slice(0, 4))).reduce((t, m) => t + m.value, 0);
  const attention = all.map((p) => ({ p, why: attentionOf(p, hour) })).filter((x) => x.why) as { p: PlantRow; why: string }[];
  const top = all.filter((p) => yieldOf(p) !== null && p.provider !== "manual").sort((a, b) => (yieldOf(b) ?? 0) - (yieldOf(a) ?? 0)).slice(0, 5);
  const byProvider = PROVIDERS.map((pr) => {
    const list = all.filter((p) => p.provider === pr.id);
    return { pr, count: list.length, kwp: list.reduce((t, p) => t + (Number(p.capacity_kwp) || 0), 0), today: list.reduce((t, p) => t + (Number(p.today_kwh) || 0), 0) };
  }).filter((x) => x.count);
  const unknown = s.total - s.online - s.alarm - s.offline;
  const openAlarms = alarmRows ?? null;
  const limited = (connections ?? []).find((c) => c.retry_after && new Date(c.retry_after).getTime() > Date.now());
  const lastSync = (connections ?? []).map((c) => c.last_sync_at).filter(Boolean).sort().pop() ?? null;

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
              <Link href="/monitoramento/alarmes">
                <Button variant="secondary">
                  <AlertTriangle className="h-4 w-4" /> Alarmes
                  {!!alarmRows?.length && <span className="tnum ml-0.5 rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">{alarmRows.length}</span>}
                </Button>
              </Link>
            )}
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
                <div className="flex items-center gap-4">
                  <Sun3D size={76} className="animate-[float_6s_ease-in-out_infinite] drop-shadow-[0_10px_30px_rgba(255,170,0,0.35)]" />
                  <div>
                    <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.28em] text-[#C9E97A] uppercase">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                      </span>
                      Potência agora
                    </p>
                    <p className="tnum mt-1 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
                      {fmtKw(s.powerKw).replace(/ (k|M)W$/, "")}
                      <span className="ml-2 text-2xl font-normal text-white/50">{/MW$/.test(fmtKw(s.powerKw)) ? "MW" : "kW"}</span>
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-white/55">
                    <span>{s.capacityKwp ? `${Math.round((s.powerKw / s.capacityKwp) * 100)}% da capacidade` : `${s.total} usinas`}</span>
                    <span>{fmtKwp(s.capacityKwp)} instalados</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#F3EA3B] via-[#C9E97A] to-[#6CC690] transition-all duration-1000" style={{ width: `${s.capacityKwp ? Math.min(100, (s.powerKw / s.capacityKwp) * 100) : 0}%` }} />
                  </div>
                </div>
                <p className="mt-4 text-xs text-white/45">
                  {limited
                    ? `Pausa pedida pelo fabricante: nova leitura automática às ${new Date(limited.retry_after!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Os dados abaixo já estão salvos.`
                    : lastSync
                      ? `Dados salvos ${relativeTime(lastSync)} · atualização automática aos poucos, sem estourar o limite dos fabricantes`
                      : "Aguardando a primeira leitura"}
                </p>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10" style={DARK_CHART}>
                <p className="mb-2 text-xs font-semibold text-white/60">Geração da carteira · últimos 30 dias</p>
                {fleetDaily.some((d) => d.value > 0) ? (
                  <BarChart data={fleetDaily} format={(v) => fmtKwh(v)} color={GREEN} height={180} />
                ) : (
                  <p className="grid h-[180px] place-items-center text-center text-sm text-white/45">O histórico aparece conforme os dados são baixados.</p>
                )}
              </div>
            </div>
          </section>

          {/* ------------------------------------------------ indicadores */}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              { k: "Gerado hoje", v: fmtKwh(s.todayKwh), sub: `${s.online} de ${s.total} gerando`, icon: <Bolt3D size={40} />, tone: "#9BD373" },
              { k: "Neste mês", v: fmtKwh(s.monthKwh), sub: `≈ ${(s.monthKwh * tariff).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} economizados`, icon: <Calendar3D size={40} />, tone: "#8E6CF7" },
              { k: "No ano", v: yearKwh ? fmtKwh(yearKwh) : "—", sub: "histórico baixado", icon: <Panel3D size={42} />, tone: "#5B8DEF" },
              { k: "Economia no ano", v: yearKwh ? (yearKwh * tariff).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—", sub: `tarifa ${tariff.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/kWh`, icon: <Coin3D size={40} />, tone: "#FFC93C" },
              { k: "CO₂ evitado", v: `${((totalKwh * CO2_KG_PER_KWH) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} t`, sub: `${fmtKwh(totalKwh)} gerados no total`, icon: <Leaf3D size={40} />, tone: "#6CC690" },
              { k: "Usinas", v: String(s.total), sub: `${fmtKwp(s.capacityKwp)} · ${connections.length} ${connections.length === 1 ? "conta" : "contas"}`, icon: <House3D size={42} />, tone: "#F3EA3B" },
            ].map((x) => (
              <Card key={x.k} className="relative overflow-hidden p-4">
                <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full blur-2xl" style={{ background: `${x.tone}26` }} />
                <IconTile tone={x.tone}>{x.icon}</IconTile>
                <p className="mt-3 text-[10px] font-semibold tracking-[0.16em] text-ink-500 uppercase">{x.k}</p>
                <p className="tnum mt-0.5 font-display text-xl font-semibold text-ink-900">{x.v}</p>
                <p className="mt-0.5 truncate text-[11px] text-ink-500">{x.sub}</p>
              </Card>
            ))}
          </div>

          {/* ------------------------------------------------ gráficos e listas */}
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-3">
                <IconTile tone="#5B8DEF" className="h-11 w-11">
                  <Panel3D size={34} />
                </IconTile>
                <div>
                  <p className="font-display text-[15px] font-semibold text-ink-900">Geração mensal</p>
                  <p className="text-xs text-ink-500">Últimos 12 meses, todas as usinas</p>
                </div>
              </div>
              {fleetMonthly.some((m) => m.value > 0) ? (
                <BarChart data={fleetMonthly} format={(v) => fmtKwh(v)} color={GREEN} height={220} />
              ) : (
                <p className="grid h-[220px] place-items-center text-sm text-ink-500">O histórico mensal é baixado aos poucos, um mês por vez.</p>
              )}
            </Card>
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-3">
                <IconTile tone="#9BD373" className="h-11 w-11">
                  <Inverter3D size={34} />
                </IconTile>
                <div>
                  <p className="font-display text-[15px] font-semibold text-ink-900">Situação das usinas</p>
                  <p className="text-xs text-ink-500">Status informado pelos inversores</p>
                </div>
              </div>
              <Donut
                data={[
                  { label: "Gerando", value: s.online, color: "#3FBF6A" },
                  { label: "Alerta", value: s.alarm, color: "#F5B700" },
                  { label: "Offline", value: s.offline, color: "#E5484D" },
                  { label: "Sem status", value: unknown, color: "#A1A1AA" },
                ].filter((x) => x.value > 0)}
                center={String(s.total)}
                centerSub="usinas"
              />
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-3">
                <IconTile tone="#F5B700" className="h-11 w-11">
                  <Alert3D size={32} />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-semibold text-ink-900">{openAlarms ? "Alarmes ativos" : "Precisam de atenção"}</p>
                  <p className="text-xs text-ink-500">
                    {openAlarms ? (openAlarms.length ? `${openAlarms.length} ${openAlarms.length === 1 ? "alarme" : "alarmes"} agora` : "Tudo dentro dos limites") : attention.length ? `${attention.length} ${attention.length === 1 ? "usina" : "usinas"}` : "Tudo certo por aqui"}
                  </p>
                </div>
              </div>
              {openAlarms ? (
                openAlarms.length ? (
                  <AlarmList rows={openAlarms.slice(0, 4)} showPlant compact onChanged={reloadAlarms} />
                ) : (
                  <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200">Nenhuma tensão, temperatura ou frequência fora dos limites, e nenhuma usina parada.</p>
                )
              ) : attention.length ? (
                <ul className="grid gap-1.5">
                  {attention.slice(0, 6).map(({ p, why }) => (
                    <li key={p.id}>
                      <Link href={`/monitoramento/${p.id}`} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-ink-50 dark:hover:bg-white/[0.04]">
                        <span className={cx("h-2 w-2 shrink-0 rounded-full", why === "Offline" ? "bg-rose-500" : "bg-amber-400")} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">{p.name}</span>
                        <span className="shrink-0 text-[11px] text-ink-500">{why}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200">Nenhuma usina parada ou gerando abaixo do esperado.</p>
              )}
              <Link href="/monitoramento/alarmes" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sun-700 hover:underline">
                Todos os alarmes e limites <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Card>
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-3">
                <IconTile tone="#3FBF6A" className="h-11 w-11">
                  <Gauge3D size={32} />
                </IconTile>
                <div>
                  <p className="font-display text-[15px] font-semibold text-ink-900">Melhor desempenho hoje</p>
                  <p className="text-xs text-ink-500">kWh gerados por kWp instalado</p>
                </div>
              </div>
              {top.length ? (
                <ol className="grid gap-2">
                  {top.map((p, i) => {
                    const y = yieldOf(p) ?? 0;
                    return (
                      <li key={p.id}>
                        <Link href={`/monitoramento/${p.id}`} className="block rounded-xl px-2 py-1 transition hover:bg-ink-50 dark:hover:bg-white/[0.04]">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="tnum w-4 text-xs font-bold text-ink-400">{i + 1}</span>
                            <span className="min-w-0 flex-1 truncate font-medium text-ink-900">{p.name}</span>
                            <span className="tnum text-xs font-semibold text-emerald-700">{y.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="mt-1 ml-6 h-1 overflow-hidden rounded-full bg-ink-100">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#C9E97A] to-[#3FBF6A]" style={{ width: `${Math.min(100, (y / Math.max(0.1, yieldOf(top[0]) ?? 1)) * 100)}%` }} />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-sm text-ink-500">Aparece quando as usinas informarem a geração de hoje.</p>
              )}
            </Card>
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-3">
                <IconTile tone="#8E6CF7" className="h-11 w-11">
                  <House3D size={34} />
                </IconTile>
                <div>
                  <p className="font-display text-[15px] font-semibold text-ink-900">Por fabricante</p>
                  <p className="text-xs text-ink-500">Usinas, potência e geração de hoje</p>
                </div>
              </div>
              <ul className="grid gap-2">
                {byProvider.map(({ pr, count, kwp, today }) => (
                  <li key={pr.id} className="flex items-center gap-2.5">
                    <ProviderMark id={pr.id} className="h-8 w-8 text-[10px]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">{pr.name}</p>
                      <p className="text-[11px] text-ink-500">
                        {count} {count === 1 ? "usina" : "usinas"} · {fmtKwp(kwp)}
                      </p>
                    </div>
                    <span className="tnum text-xs font-semibold text-ink-700">{fmtKwh(today)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* --------------------------------------------------- conexões */}
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {connections.map((c) => {
              const info = providerInfo(c.provider);
              const paused = c.retry_after && new Date(c.retry_after).getTime() > Date.now();
              return (
                <div key={c.id} className="glass flex min-w-[280px] items-center gap-3 rounded-2xl p-3 pr-2">
                  <ProviderMark id={c.provider} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{c.label}</p>
                    <p className={cx("truncate text-xs", c.status === "error" ? "text-rose-600" : paused ? "text-amber-700" : "text-ink-500")} title={c.last_error ?? undefined}>
                      {c.status === "syncing" || syncing === c.id
                        ? "Baixando dados…"
                        : paused
                          ? `Pausa do fabricante até ${new Date(c.retry_after!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
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
                <PlantCard key={p.id} p={p} spark={days.slice(-14).map((d) => byPlant.get(p.id)?.get(d) ?? 0)} />
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

function PlantCard({ p, spark }: { p: PlantRow; spark: number[] }) {
  const load = loadOf(p);
  const y = yieldOf(p);
  const band = yieldBand(y);
  return (
    <Link href={`/monitoramento/${p.id}`} className="glass group relative flex flex-col overflow-hidden rounded-2xl p-4 text-left transition hover:-translate-y-0.5">
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
          <p className="tnum font-display text-2xl font-semibold text-ink-900">{p.provider === "manual" ? fmtKwh(p.month_kwh) : fmtKw(p.power_kw)}</p>
          <p className="text-xs text-ink-500">{p.provider === "manual" ? `no mês · ${fmtKwp(p.capacity_kwp)}` : `de ${fmtKwp(p.capacity_kwp)}`}</p>
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
    </Link>
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
