"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Download, Loader2, Printer, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { forwardRef, use, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Button, Card, Skeleton } from "@/components/ui";
import { DEFAULT_INPUTS } from "@/lib/defaults";
import { must, useLive } from "@/lib/live";
import { providerInfo } from "@/lib/monitoring/catalog";
import { CO2_KG_PER_KWH, daysInMonth, monthLabel, monthShort, reportStats, shiftMonth } from "@/lib/monitoring/report";
import type { DayValue, MonthValue } from "@/lib/monitoring/types";
import { fmtKwh, fmtKwp, type PlantRow } from "@/lib/monitoring/view";
import { dataUrlToBytes, jpegToPdf } from "@/lib/pdf-image";
import { supabase } from "@/lib/supabase/client";

const PAGE_W = 794; // A4 a 96 dpi
const PAGE_H = 1123;
const GREEN = "#7CB955";
const INK = "#1C1234";
const todayLocal = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const nf = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: 0 }));
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ddmm = (day: string) => day.slice(8, 10) + "/" + day.slice(5, 7);
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

interface Data {
  days: DayValue[];
  months: MonthValue[];
  notes: Record<string, string>;
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const { settings } = useApp();
  const today = todayLocal();
  const month = /^\d{4}-\d{2}$/.test(search.get("mes") ?? "") ? search.get("mes")! : today.slice(0, 7);
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [scale, setScale] = useState(0.6);
  const boxRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  const { data: plant, loading } = useLive(
    async () => must(await supabase().from("monitoring_plants").select("*, lead:leads(id,name,phone)").eq("id", id).maybeSingle()) as (PlantRow & { lead?: { id: string; name: string; phone?: string | null } | null }) | null,
    [id],
    ["monitoring_plants"],
  );

  useEffect(() => {
    let alive = true;
    setData(null);
    fetch(`/api/monitoring/plant/${id}?month=${month}&year=${month.slice(0, 4)}&devices=0`)
      .then((r) => r.json())
      .then((j) => alive && setData({ days: j.days ?? [], months: j.months ?? [], notes: j.notes ?? (j.error ? { geral: j.error } : {}) }))
      .catch(() => alive && setData({ days: [], months: [], notes: { geral: "Não foi possível carregar os dados agora." } }));
    return () => {
      alive = false;
    };
  }, [id, month]);

  // A folha A4 é encolhida para caber na tela; a exportação usa o tamanho real.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / PAGE_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [plant]);

  const inputs = { ...DEFAULT_INPUTS, ...settings.defaults };
  const capacity = plant?.capacity_kwp != null ? Number(plant.capacity_kwp) : null;
  const stats = useMemo(
    () => reportStats({ month, days: data?.days ?? [], months: data?.months ?? [], capacityKwp: capacity, tariff: inputs.tariff, sunHours: inputs.sunHours, performanceRatio: inputs.performanceRatio, today }),
    [data, month, capacity, inputs.tariff, inputs.sunHours, inputs.performanceRatio, today],
  );

  const go = (delta: number) => router.replace(`/monitoramento/${id}/relatorio?mes=${shiftMonth(month, delta)}`);
  const fileName = `relatorio-geracao-${slug(plant?.name ?? "usina")}-${month}`;

  const render = async () => {
    const { toJpeg } = await import("html-to-image");
    const node = paperRef.current!;
    const opts = { pixelRatio: 2, cacheBust: true, width: PAGE_W, height: PAGE_H, backgroundColor: "#ffffff", quality: 0.95 };
    await toJpeg(node, opts).catch(() => null); // 1ª passada carrega fontes e imagens
    return toJpeg(node, opts);
  };
  const pdfBlob = async () => new Blob([jpegToPdf(dataUrlToBytes(await render()), PAGE_W * 2, PAGE_H * 2).buffer as ArrayBuffer], { type: "application/pdf" });
  const download = (href: string, name: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
  };
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o arquivo");
    }
    setBusy(null);
  };
  const savePdf = () =>
    run("pdf", async () => {
      const url = URL.createObjectURL(await pdfBlob());
      download(url, `${fileName}.pdf`);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Relatório salvo em PDF");
    });
  const print = () =>
    run("print", async () => {
      const img = await render();
      const w = window.open("", "_blank");
      if (!w) return void toast.error("Libere as janelas pop-up para imprimir");
      w.document.write(`<html><head><title>Relatório de geração</title><style>@page{size:A4;margin:0}body{margin:0}img{width:100%;display:block}</style></head><body><img src="${img}" onload="setTimeout(()=>{window.print()},200)"></body></html>`);
      w.document.close();
    });
  const share = () =>
    run("share", async () => {
      const file = new File([await pdfBlob()], `${fileName}.pdf`, { type: "application/pdf" });
      const first = plant?.lead?.name?.split(" ")[0];
      const text = `${first ? `Olá, ${first}! ` : ""}Segue o relatório de geração da sua usina em ${monthLabel(month)}: ${fmtKwh(stats.total)} gerados, cerca de ${brl(stats.savings)} de economia. ☀️`;
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text }).catch(() => {});
        return;
      }
      const url = URL.createObjectURL(file);
      download(url, file.name);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      const phone = (plant?.lead?.phone ?? "").replace(/\D/g, "");
      const to = phone ? (phone.startsWith("55") ? phone : `55${phone}`) : "";
      window.open(`https://wa.me/${to}?text=${encodeURIComponent(`${text}\n\n(o PDF foi baixado: é só anexar aqui)`)}`, "_blank", "noopener");
    });

  if (loading && !plant) return <Skeleton className="h-[60vh]" />;
  if (!plant)
    return (
      <Card className="p-8 text-center text-sm text-ink-600">
        Usina não encontrada. <Link href="/monitoramento" className="font-semibold text-sun-700">Voltar</Link>
      </Card>
    );

  const company = settings.legal_name || settings.company_name;
  const future = month >= today.slice(0, 7);

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href={`/monitoramento/${id}`} className="grid h-10 w-10 place-items-center rounded-xl bg-white text-ink-600 shadow-soft ring-1 ring-ink-200/70 hover:text-ink-900" aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-400 uppercase">Relatório de geração</p>
          <h1 className="truncate font-display text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">{plant.name}</h1>
        </div>
        <div className="flex w-full items-center justify-between gap-1 rounded-xl bg-white p-1 shadow-soft ring-1 ring-ink-200/70 sm:w-auto">
          <button onClick={() => go(-1)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-50 hover:text-ink-900" aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[132px] text-center text-sm font-semibold inline-block text-ink-900 first-letter:uppercase">{monthLabel(month)}</span>
          <button onClick={() => go(1)} disabled={future} className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-50 hover:text-ink-900 disabled:opacity-30" aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
          <Button onClick={savePdf} disabled={!!busy || !data}>
            {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF
          </Button>
          <Button variant="secondary" onClick={print} disabled={!!busy || !data}>
            {busy === "print" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Imprimir
          </Button>
          <Button variant="secondary" onClick={share} disabled={!!busy || !data}>
            {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Enviar
          </Button>
        </div>
      </div>

      {data?.notes.geral && <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">{data.notes.geral}</p>}

      <div ref={boxRef} className="w-full">
        {!data ? (
          <div style={{ width: PAGE_W * scale, height: PAGE_H * scale }} className="mx-auto"><Skeleton className="h-full w-full" /></div>
        ) : (
          <div className="palette-classic mx-auto overflow-hidden rounded-xl shadow-[0_20px_50px_-20px_rgba(28,18,52,0.45)] ring-1 ring-ink-900/10" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: PAGE_W, height: PAGE_H }}>
              <Paper
                ref={paperRef}
                plant={plant}
                month={month}
                data={data}
                stats={stats}
                company={company}
                contact={[settings.whatsapp || settings.phone, settings.email, settings.instagram].filter(Boolean).join("  ·  ")}
              />
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-ink-500">
        Expectativa: {nf(inputs.sunHours, 2)} h de sol pleno × {nf(inputs.performanceRatio * 100, 0)}% de rendimento. Economia pela tarifa de {brl(inputs.tariff)}/kWh. Ajuste em Configurações.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- a folha */

type Stats = ReturnType<typeof reportStats>;

const Paper = forwardRef<HTMLDivElement, { plant: PlantRow & { lead?: { name: string } | null }; month: string; data: Data; stats: Stats; company: string; contact: string }>(function Paper(
  { plant, month, data, stats, company, contact },
  ref,
) {
  const info = providerInfo(plant.provider);
  const dim = daysInMonth(month);
  const dayMap = new Map(data.days.map((d) => [d.day, d.kwh]));
  const days = Array.from({ length: dim }, (_, i) => {
    const day = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { day, n: i + 1, kwh: dayMap.get(day) ?? 0 };
  });
  const year = month.slice(0, 4);
  const monMap = new Map(data.months.map((m) => [m.month, m.kwh]));
  const months = Array.from({ length: 12 }, (_, i) => {
    const mm = `${year}-${String(i + 1).padStart(2, "0")}`;
    return { mm, kwh: monMap.get(mm) ?? 0 };
  });
  const yearTotal = months.reduce((t, m) => t + m.kwh, 0);
  const expectedDay = stats.expected && stats.elapsed ? stats.expected / stats.elapsed : null;
  const pct = stats.pctExpected;
  const brand = info?.manual ? "Planilha importada" : (info?.name ?? plant.provider);

  return (
    <div ref={ref} className="relative flex flex-col bg-white font-sans text-[#1C1234]" style={{ width: PAGE_W, height: PAGE_H }}>
      {/* faixa superior */}
      <div className="relative overflow-hidden px-12 pt-10 pb-8" style={{ background: INK }}>
        <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "#9BD373" }} />
        <div className="relative flex items-start justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-h-white.png" alt={company} className="h-10 w-auto" />
          <div className="text-right">
            <p className="text-[10px] font-semibold tracking-[0.28em] text-white/50 uppercase">Relatório de geração</p>
            <p className="mt-1 font-display text-2xl font-semibold text-white first-letter:uppercase">{monthLabel(month)}</p>
          </div>
        </div>
        <div className="relative mt-8 flex items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="truncate font-display text-[26px] leading-tight font-semibold text-white">{plant.name}</p>
            <p className="mt-1 truncate text-[12px] text-white/60">
              {[plant.lead?.name !== plant.name ? plant.lead?.name : null, plant.address].filter(Boolean).join("  ·  ") || "Usina fotovoltaica"}
            </p>
          </div>
          <div className="flex shrink-0 gap-6 text-right">
            <div>
              <p className="text-[9px] font-semibold tracking-[0.2em] text-white/45 uppercase">Potência</p>
              <p className="mt-0.5 text-[13px] font-semibold text-white">{fmtKwp(plant.capacity_kwp)}</p>
            </div>
            <div>
              <p className="text-[9px] font-semibold tracking-[0.2em] text-white/45 uppercase">Monitoramento</p>
              <p className="mt-0.5 text-[13px] font-semibold text-white">{brand}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-12 pt-7 pb-6">
        {/* destaque */}
        <div className="grid grid-cols-[1.25fr_1fr_1fr] gap-3">
          <div className="rounded-2xl p-5" style={{ background: "#F2F8EC" }}>
            <p className="text-[10px] font-bold tracking-[0.2em] text-[#4F7F31] uppercase">Energia gerada no mês</p>
            <p className="tnum mt-2 font-display text-[40px] leading-none font-semibold">
              {nf(stats.total, 0)}
              <span className="ml-1.5 text-lg font-medium text-[#1C1234]/50">kWh</span>
            </p>
            {pct !== null && (
              <div className="mt-4">
                <div className="h-1.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct * 100)}%`, background: GREEN }} />
                </div>
                <p className="mt-1.5 text-[11px] text-[#1C1234]/60">
                  <b className="text-[#1C1234]">{nf(pct * 100, 0)}%</b> do esperado ({nf(stats.expected, 0)} kWh{stats.elapsed < stats.daysInMonth ? ` até o dia ${stats.elapsed}` : ""})
                </p>
              </div>
            )}
          </div>
          <Kpi label="Economia estimada" value={brl(stats.savings)} sub="na conta de energia" />
          <Kpi label="CO₂ evitado" value={`${nf(stats.co2Kg, stats.co2Kg < 100 ? 1 : 0)} kg`} sub={`≈ ${nf(stats.co2Kg / 7, 0)} árvores/mês`} />
        </div>
        <div className="mt-3 grid grid-cols-4 gap-3">
          <Kpi small label="Média diária" value={`${nf(stats.avg)} kWh`} />
          <Kpi small label="Melhor dia" value={stats.best ? `${nf(stats.best.kwh)} kWh` : "—"} sub={stats.best ? ddmm(stats.best.day) : undefined} />
          <Kpi small label="Produtividade" value={stats.specific !== null ? `${nf(stats.specific)} kWh/kWp` : "—"} />
          <Kpi small label="Dias com geração" value={`${stats.daysWithData} de ${stats.elapsed}`} />
        </div>

        {/* geração diária */}
        <Section title="Geração diária" right={expectedDay ? `linha tracejada: esperado (${nf(expectedDay)} kWh/dia)` : undefined}>
          <Bars values={days.map((d) => d.kwh)} labels={days.map((d) => (d.n === 1 || d.n % 5 === 0 ? String(d.n) : ""))} height={185} reference={expectedDay} best />
        </Section>

        <div className="mt-1 grid grid-cols-[1fr_250px] gap-6">
          {/* histórico do ano */}
          <Section title={`Histórico de ${year}`} right={`${nf(yearTotal, 0)} kWh no ano`}>
            <Bars values={months.map((m) => m.kwh)} labels={months.map((m) => monthShort(m.mm))} height={150} highlight={Number(month.slice(5, 7)) - 1} />
          </Section>
          {/* tabela compacta */}
          <Section title="Dia a dia (kWh)">
            <div className="grid grid-cols-4 gap-x-2 gap-y-[3px] text-[10px]">
              {days.map((d) => (
                <div key={d.day} className="flex justify-between border-b border-[#1C1234]/[0.06] pb-[2px]">
                  <span className="text-[#1C1234]/45">{String(d.n).padStart(2, "0")}</span>
                  <span className="tnum font-medium">{d.kwh ? nf(d.kwh, d.kwh >= 100 ? 0 : 1) : "—"}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="mt-auto flex items-end justify-between border-t border-[#1C1234]/10 pt-4 text-[9.5px] leading-relaxed text-[#1C1234]/50">
          <p className="max-w-[460px]">
            Dados de {brand}. Economia estimada pela tarifa cadastrada; CO₂ pelo fator médio do SIN ({CO2_KG_PER_KWH.toLocaleString("pt-BR")} kg/kWh). Expectativa calculada com a irradiação média da região.
          </p>
          <p className="text-right">
            <b className="text-[#1C1234]/80">{company}</b>
            <br />
            {contact}
          </p>
        </div>
      </div>
    </div>
  );
});

function Kpi({ label, value, sub, small }: { label: string; value: string; sub?: string; small?: boolean }) {
  return (
    <div className={small ? "rounded-xl px-4 py-3 ring-1 ring-[#1C1234]/[0.08]" : "rounded-2xl p-5 ring-1 ring-[#1C1234]/[0.08]"}>
      <p className="text-[9.5px] font-bold tracking-[0.18em] text-[#1C1234]/45 uppercase">{label}</p>
      <p className={small ? "tnum mt-1 text-[15px] font-semibold" : "tnum mt-2 font-display text-[24px] leading-tight font-semibold"}>{value}</p>
      {sub && <p className="mt-0.5 text-[10.5px] text-[#1C1234]/50">{sub}</p>}
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[11px] font-bold tracking-[0.18em] uppercase">{title}</p>
        {right && <p className="text-[10px] text-[#1C1234]/50">{right}</p>}
      </div>
      {children}
    </div>
  );
}

/** Barras estáticas (sem interação) para a exportação em imagem. */
function Bars({ values, labels, height, reference, highlight, best }: { values: number[]; labels: string[]; height: number; reference?: number | null; highlight?: number; best?: boolean }) {
  const top = Math.max(...values, reference ?? 0, 0.001) * 1.12;
  const plot = height - 18;
  const bestIdx = best ? values.reduce((b, v, i) => (v > values[b] ? i : b), 0) : -1;
  return (
    <div className="relative" style={{ height }}>
      <div className="absolute inset-x-0 border-t border-[#1C1234]/15" style={{ top: plot }} />
      {reference ? <div className="absolute inset-x-0 border-t border-dashed border-[#1C1234]/35" style={{ top: plot - (reference / top) * plot }} /> : null}
      <div className="absolute inset-x-0 top-0 flex items-end gap-[3px]" style={{ height: plot }}>
        {values.map((v, i) => (
          <div key={i} className="relative flex h-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-[28px] rounded-t-[4px]"
              style={{ height: v > 0 ? Math.max(2, (v / top) * plot) : 0, background: highlight === undefined || highlight === i ? GREEN : "#D7E9C8" }}
            />
            {(i === bestIdx || i === highlight) && v > 0 && (
              <span className="tnum absolute text-[9px] font-semibold whitespace-nowrap" style={{ bottom: (v / top) * plot + 3 }}>
                {nf(v, v >= 100 ? 0 : 1)}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex gap-[3px]">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 text-center text-[9px] text-[#1C1234]/45 capitalize">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
