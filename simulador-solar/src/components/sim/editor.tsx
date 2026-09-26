"use client";

import { BatteryCharging, Cable, Car, CloudSun, Cog, Droplets, Factory, Flame, Fuel, Home, MapPin, Plus, Receipt, Sun, Trash2, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { cx, Input } from "@/components/ui";
import { CITIES, cityById, dateLabel, MONTHS } from "@/lib/sim/climate";
import { fioBPct } from "@/lib/sim/engine";
import { LOAD_LABEL, loadTemplate } from "@/lib/sim/loads";
import { gravityKWh, hydrogenKWh, makeStorage, newId, pumpedKWh, TECHS } from "@/lib/sim/storage";
import type { EventKind, GridEvent, Load, Scenario, StorageTech, StorageUnit, Strategy } from "@/lib/sim/types";
import { n0, n1, Num, Pick, Section, Toggle } from "./common";

export type Update = (fn: (draft: Scenario) => void) => void;

const DAYS_OPTS = [
  { value: "todos", label: "Todos os dias" },
  { value: "uteis", label: "Dias úteis" },
  { value: "fds", label: "Fins de semana" },
] as const;

export const STRATEGIES: { value: Strategy; label: string; text: string }[] = [
  { value: "autoconsumo", label: "Máximo autoconsumo", text: "Sobra solar → baterias → cargas flexíveis → rede. Baterias cobrem a noite." },
  { value: "anti-corte", label: "Anti-corte (preditivo)", text: "Nos dias com corte anunciado, injeta de manhã e deixa a bateria vazia para absorver o que seria cortado na janela." },
  { value: "cargas-primeiro", label: "Cargas flexíveis primeiro", text: "Sobra → boiler/bomba/carro/máquinas → baterias → rede. Usa a energia como calor, água e trabalho antes de estocar." },
  { value: "injetar-primeiro", label: "Injetar primeiro (créditos)", text: "Sobra → rede (até o limite) → baterias → cargas. Útil para comparar com a compensação da Lei 14.300." },
  { value: "tarifa-branca", label: "Arbitragem tarifa branca", text: "Bateria só descarrega na ponta/intermediário (17h–22h se sem tarifa branca)." },
  { value: "reserva-backup", label: "Reserva para apagão", text: "Mantém um SOC mínimo reservado para faltas de energia; libera na falta." },
  { value: "peak-shaving", label: "Corte de pico de demanda", text: "Rede até o limite de demanda; acima disso, bateria. Para comércio/indústria com demanda contratada." },
];

export function Editor({ s, update }: { s: Scenario; update: Update }) {
  return (
    <div className="flex flex-col gap-3">
      <SiteSection s={s} update={update} />
      <PvSection s={s} update={update} />
      <StorageSection s={s} update={update} />
      <LoadsSection s={s} update={update} />
      <GridSection s={s} update={update} />
      <ControlSection s={s} update={update} />
      <TariffSection s={s} update={update} />
    </div>
  );
}

function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={cx("grid gap-2.5", cols === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}>{children}</div>;
}

/* ----------------------------------------------------------------- Local */

function SiteSection({ s, update }: { s: Scenario; update: Update }) {
  const month = monthOfDoy(s.sim.startDay);
  const dayInMonth = s.sim.startDay - MONTH_START[month];
  return (
    <Section title="Local, clima e período" icon={<MapPin className="h-4 w-4" />}>
      <div className="flex flex-col gap-2.5">
        <Pick
          label="Cidade (clima típico)"
          value={s.site.cityId}
          onChange={(id) =>
            update((d) => {
              const c = cityById(id);
              d.site.cityId = id;
              d.site.lat = c.lat;
              d.site.lon = c.lon;
            })
          }
          options={CITIES.map((c) => ({ value: c.id, label: `${c.name} – ${c.uf}` }))}
        />
        <Grid cols={3}>
          <Num label="Latitude" unit="°" digits={2} value={s.site.lat} onChange={(v) => update((d) => void (d.site.lat = clamp(v, -34, 6)))} />
          <Num label="Longitude" unit="°" digits={2} value={s.site.lon} onChange={(v) => update((d) => void (d.site.lon = clamp(v, -75, -30)))} />
          <Num label="Albedo do solo" digits={2} value={s.site.albedo} onChange={(v) => update((d) => void (d.site.albedo = clamp(v, 0, 0.9)))} />
        </Grid>
        <Grid cols={3}>
          <Pick
            label="Início — mês"
            value={month}
            onChange={(m) => update((d) => void (d.sim.startDay = MONTH_START[m] + Math.min(dayInMonth, 28)))}
            options={MONTHS.map((m, i) => ({ value: i, label: m }))}
          />
          <Num label="Dia" digits={0} value={dayInMonth} onChange={(v) => update((d) => void (d.sim.startDay = MONTH_START[month] + clamp(Math.round(v), 1, 31)))} />
          <Pick
            label="Duração"
            value={s.sim.days}
            onChange={(v) => update((d) => {
              d.sim.days = v;
              if (v >= 180 && d.sim.stepMin < 30) d.sim.stepMin = 60;
            })}
            options={[1, 2, 3, 7, 14, 28, 60, 90, 180, 365].map((v) => ({ value: v, label: v === 1 ? "1 dia" : v === 365 ? "1 ano" : `${v} dias` }))}
          />
        </Grid>
        <Grid cols={3}>
          <Pick
            label="Passo de tempo"
            value={s.sim.stepMin}
            onChange={(v) => update((d) => void (d.sim.stepMin = v))}
            options={([5, 10, 15, 30, 60] as const).map((v) => ({ value: v, label: `${v} min` }))}
          />
          <Num label="Semente do clima" digits={0} value={s.sim.seed} onChange={(v) => update((d) => void (d.sim.seed = Math.max(0, Math.round(v))))} />
          <Num label="Nebulosidade" unit="×" digits={2} value={s.sim.cloudiness} onChange={(v) => update((d) => void (d.sim.cloudiness = clamp(v, 0, 2.5)))} />
        </Grid>
        <p className="text-[11.5px] leading-snug text-ink-400">
          Começa em {dateLabel(s.sim.startDay)}. Nebulosidade 0 = céu sempre limpo; 1 = clima típico do local; 2 = bem mais nublado. Mude a semente para outro sorteio de dias
          nublados.
        </p>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------- FV */

function PvSection({ s, update }: { s: Scenario; update: Update }) {
  const ratio = s.inverter.acKW > 0 ? s.pv.kWp / s.inverter.acKW : 0;
  return (
    <Section title="Gerador fotovoltaico e inversor" icon={<Sun className="h-4 w-4" />} right={<span className="tnum text-[12px] font-semibold text-ink-500">{n1(s.pv.kWp)} kWp</span>}>
      <div className="flex flex-col gap-2.5">
        <Grid cols={3}>
          <Num label="Potência FV" unit="kWp" digits={2} value={s.pv.kWp} onChange={(v) => update((d) => void (d.pv.kWp = Math.max(0, v)))} />
          <Num label="Inclinação" unit="°" digits={0} value={s.pv.tilt} onChange={(v) => update((d) => void (d.pv.tilt = clamp(v, 0, 90)))} />
          <Num label="Azimute (0 = N)" unit="°" digits={0} value={s.pv.azimuth} onChange={(v) => update((d) => void (d.pv.azimuth = ((v % 360) + 360) % 360))} />
          <Num label="Coef. temperatura" unit="%/°C" digits={2} value={s.pv.tempCoeff} onChange={(v) => update((d) => void (d.pv.tempCoeff = clamp(v, -1, 0)))} />
          <Num label="NOCT" unit="°C" digits={0} value={s.pv.noct} onChange={(v) => update((d) => void (d.pv.noct = clamp(v, 35, 60)))} />
          <Num label="Perdas (sujeira, cabos)" unit="%" digits={1} value={s.pv.lossesPct} onChange={(v) => update((d) => void (d.pv.lossesPct = clamp(v, 0, 60)))} />
          <Num label="Idade" unit="anos" digits={0} value={s.pv.ageYears} onChange={(v) => update((d) => void (d.pv.ageYears = clamp(v, 0, 40)))} />
          <Num label="Degradação" unit="%/ano" digits={2} value={s.pv.degradationPctYear} onChange={(v) => update((d) => void (d.pv.degradationPctYear = clamp(v, 0, 3)))} />
          <div className="flex items-end pb-1.5">
            <Toggle label="Bifacial" checked={s.pv.bifacial} onChange={(v) => update((d) => void (d.pv.bifacial = v))} />
          </div>
        </Grid>
        <div className="mt-1 h-px bg-ink-100" />
        <Grid cols={3}>
          <Num label="Inversor (AC)" unit="kW" digits={1} value={s.inverter.acKW} onChange={(v) => update((d) => void (d.inverter.acKW = Math.max(0.1, v)))} />
          <Num label="Eficiência máx." unit="%" digits={1} value={s.inverter.etaMax * 100} onChange={(v) => update((d) => void (d.inverter.etaMax = clamp(v, 50, 99.5) / 100))} />
          <Num label="Consumo em vazio" unit="W" digits={0} value={s.inverter.tareW} onChange={(v) => update((d) => void (d.inverter.tareW = clamp(v, 0, 2000)))} />
          <Num label="Surto (partida)" unit="kW" digits={1} value={s.inverter.surgeKW} onChange={(v) => update((d) => void (d.inverter.surgeKW = Math.max(0, v)))} />
          <div className="col-span-2 flex items-end pb-1.5">
            <Toggle label="Híbrido com backup (EPS / ilhamento)" checked={s.inverter.backup} onChange={(v) => update((d) => void (d.inverter.backup = v))} />
          </div>
        </Grid>
        <p className="text-[11.5px] text-ink-400">
          Relação DC/AC: <b className={cx("tnum", ratio > 1.4 ? "text-amber-700" : "text-ink-600")}>{ratio.toFixed(2)}</b>. Acima de ~1,3 o inversor ceifa o pico (clipping).
        </p>
      </div>
    </Section>
  );
}

/* --------------------------------------------------------- Armazenamento */

function StorageSection({ s, update }: { s: Scenario; update: Update }) {
  const total = s.storage.reduce((a, u) => a + u.capacityKWh, 0);
  return (
    <Section title="Armazenamento de energia" icon={<BatteryCharging className="h-4 w-4" />} right={<span className="tnum text-[12px] font-semibold text-ink-500">{n1(total)} kWh</span>}>
      <div className="flex flex-col gap-3">
        {s.storage.map((u, i) => (
          <StorageCard key={u.id} u={u} update={(fn) => update((d) => fn(d.storage[i]))} remove={() => update((d) => void d.storage.splice(i, 1))} />
        ))}
        {!s.storage.length && <p className="text-[12.5px] text-ink-500">Sem armazenamento. Adicione uma tecnologia para comparar:</p>}
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(TECHS) as StorageTech[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update((d) => void d.storage.push(defaultUnit(t, d.storage.length + 1)))}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-ink-50 px-2.5 text-[12px] font-semibold text-ink-700 ring-1 ring-ink-200 transition hover:bg-white hover:ring-ink-300"
            >
              <Plus className="h-3 w-3" />
              <span className="h-2 w-2 rounded-full" style={{ background: TECHS[t].color }} />
              {TECHS[t].short}
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}

function defaultUnit(t: StorageTech, priority: number): StorageUnit {
  if (t === "gravity") {
    const cap = Math.round(gravityKWh(50, 30) * 10) / 10;
    return makeStorage(t, cap, { priority, physical: { massT: 50, heightM: 30 }, name: `Gravitacional ${n1(cap)} kWh` });
  }
  if (t === "pumped") {
    const cap = Math.round(pumpedKWh(100, 40) * 10) / 10;
    return makeStorage(t, cap, { priority, physical: { volumeM3: 100, heightM: 40 }, name: `Reservatório ${n1(cap)} kWh` });
  }
  if (t === "hydrogen") return makeStorage(t, hydrogenKWh(3), { priority, physical: { h2Kg: 3 }, chargeKW: 2, dischargeKW: 1.5, name: "H₂ 3 kg" });
  if (t === "supercap") return makeStorage(t, 0.5, { priority, chargeKW: 10, dischargeKW: 10 });
  if (t === "flow") return makeStorage(t, 20, { priority });
  if (t === "lead") return makeStorage(t, 9.6, { priority, socMin: 0.5 });
  return makeStorage(t, 10, { priority });
}

function StorageCard({ u, update, remove }: { u: StorageUnit; update: (fn: (x: StorageUnit) => void) => void; remove: () => void }) {
  const info = TECHS[u.tech];
  const rt = u.etaCharge * u.etaDischarge;
  const setRt = (v: number) =>
    update((x) => {
      const e = Math.sqrt(clamp(v / 100, 0.1, 1));
      x.etaCharge = e;
      x.etaDischarge = e;
    });
  return (
    <div className="rounded-xl bg-ink-50/60 p-3 ring-1 ring-ink-200/70">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: info.color }} />
        <Input value={u.name} onChange={(e) => update((x) => void (x.name = e.target.value))} className="h-8 bg-white text-[13px] font-semibold sm:h-8" />
        <button type="button" onClick={remove} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remover">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-2.5 text-[11.5px] leading-snug text-ink-500">
        <b className="text-ink-700">{info.label}.</b> {info.notes}
      </p>
      {u.tech === "gravity" && (
        <Physical
          a={{ label: "Massa", unit: "t", value: u.physical?.massT ?? 0 }}
          b={{ label: "Altura de elevação", unit: "m", value: u.physical?.heightM ?? 0 }}
          onChange={(a, b) =>
            update((x) => {
              x.physical = { massT: a, heightM: b };
              scaleTo(x, gravityKWh(a, b));
            })
          }
          formula="E = m·g·h"
        />
      )}
      {u.tech === "pumped" && (
        <Physical
          a={{ label: "Volume", unit: "m³", value: u.physical?.volumeM3 ?? 0 }}
          b={{ label: "Desnível", unit: "m", value: u.physical?.heightM ?? 0 }}
          onChange={(a, b) =>
            update((x) => {
              x.physical = { volumeM3: a, heightM: b };
              scaleTo(x, pumpedKWh(a, b));
            })
          }
          formula="E = ρ·V·g·h"
        />
      )}
      {u.tech === "hydrogen" && (
        <div className="mb-2.5">
          <Num
            label="Hidrogênio armazenado (tanque)"
            unit="kg"
            digits={1}
            value={u.physical?.h2Kg ?? 0}
            onChange={(v) =>
              update((x) => {
                x.physical = { h2Kg: v };
                scaleTo(x, hydrogenKWh(v));
              })
            }
            hint="33,3 kWh/kg (PCI). A eficiência da célula entra na descarga."
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Num label="Capacidade" unit="kWh" digits={1} value={u.capacityKWh} onChange={(v) => update((x) => scaleTo(x, Math.max(0.01, v)))} />
        <Num label="Potência de carga" unit="kW" digits={1} value={u.chargeKW} onChange={(v) => update((x) => void (x.chargeKW = Math.max(0, v)))} />
        <Num label="Potência de descarga" unit="kW" digits={1} value={u.dischargeKW} onChange={(v) => update((x) => void (x.dischargeKW = Math.max(0, v)))} />
        <Num label="Eficiência ida e volta" unit="%" digits={0} value={rt * 100} onChange={setRt} />
        <Num label="SOC mínimo" unit="%" digits={0} value={u.socMin * 100} onChange={(v) => update((x) => void (x.socMin = clamp(v / 100, 0, 0.95)))} />
        <Num label="SOC inicial" unit="%" digits={0} value={u.socInitial * 100} onChange={(v) => update((x) => void (x.socInitial = clamp(v / 100, 0, 1)))} />
        <Num label="Autodescarga" unit="%/dia" digits={2} value={u.selfDischargePctDay} onChange={(v) => update((x) => void (x.selfDischargePctDay = clamp(v, 0, 50)))} />
        <Num label="Vida em ciclos" digits={0} value={u.cycleLife} onChange={(v) => update((x) => void (x.cycleLife = Math.max(1, v)))} />
        <Num label="Investimento" unit="R$" digits={0} value={u.capex} onChange={(v) => update((x) => void (x.capex = Math.max(0, v)))} />
        <Num label="Prioridade" digits={0} value={u.priority} onChange={(v) => update((x) => void (x.priority = Math.round(v)))} hint="Menor = usada primeiro" />
      </div>
    </div>
  );
}

/** Ajusta a capacidade mantendo a relação potência/energia e o custo por kWh. */
function scaleTo(x: StorageUnit, cap: number) {
  const r = cap / Math.max(x.capacityKWh, 1e-9);
  x.capacityKWh = Math.round(cap * 100) / 100;
  x.chargeKW = Math.round(x.chargeKW * r * 100) / 100;
  x.dischargeKW = Math.round(x.dischargeKW * r * 100) / 100;
  x.capex = Math.round(x.capex * r);
}

function Physical({
  a,
  b,
  onChange,
  formula,
}: {
  a: { label: string; unit: string; value: number };
  b: { label: string; unit: string; value: number };
  onChange: (a: number, b: number) => void;
  formula: string;
}) {
  return (
    <div className="mb-2.5 grid grid-cols-2 gap-2.5 rounded-lg bg-white p-2.5 ring-1 ring-ink-200/60">
      <Num label={a.label} unit={a.unit} digits={1} value={a.value} onChange={(v) => onChange(Math.max(0, v), b.value)} />
      <Num label={b.label} unit={b.unit} digits={1} value={b.value} onChange={(v) => onChange(a.value, Math.max(0, v))} />
      <p className="col-span-2 text-[11px] text-ink-400">
        {formula} — capacidade recalculada automaticamente (g = 9,81 m/s²).
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ Cargas */

const LOAD_ICON: Record<Load["kind"], ReactNode> = {
  profile: <Home className="h-3.5 w-3.5" />,
  appliance: <Zap className="h-3.5 w-3.5" />,
  motor: <Cog className="h-3.5 w-3.5" />,
  pump: <Droplets className="h-3.5 w-3.5" />,
  ev: <Car className="h-3.5 w-3.5" />,
  waterheater: <Flame className="h-3.5 w-3.5" />,
  deferrable: <Factory className="h-3.5 w-3.5" />,
};

function LoadsSection({ s, update }: { s: Scenario; update: Update }) {
  return (
    <Section title="Cargas: casa, máquinas e flexíveis" icon={<Home className="h-4 w-4" />} right={<span className="tnum text-[12px] font-semibold text-ink-500">{s.loads.filter((l) => l.enabled).length} ativas</span>}>
      <div className="flex flex-col gap-3">
        {s.loads.map((l, i) => (
          <LoadCard key={l.id} l={l} update={(fn) => update((d) => fn(d.loads[i]))} remove={() => update((d) => void d.loads.splice(i, 1))} />
        ))}
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(LOAD_LABEL) as Load["kind"][]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => update((d) => void d.loads.push(loadTemplate(k)))}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-ink-50 px-2.5 text-[12px] font-semibold text-ink-700 ring-1 ring-ink-200 transition hover:bg-white hover:ring-ink-300"
            >
              <Plus className="h-3 w-3" />
              {LOAD_ICON[k]}
              {LOAD_LABEL[k]}
            </button>
          ))}
        </div>
        <p className="text-[11.5px] leading-snug text-ink-400">
          Cargas flexíveis (bomba, carro, boiler, deslocáveis e motores &quot;só com sol&quot;) são os &quot;armazenamentos invisíveis&quot;: transformam sobra solar em água na
          caixa, calor, quilômetros e trabalho.
        </p>
      </div>
    </Section>
  );
}

function LoadCard({ l, update, remove }: { l: Load; update: (fn: (x: Load) => void) => void; remove: () => void }) {
  const u = <K extends Load>(fn: (x: K) => void) => update((x) => fn(x as K));
  return (
    <div className={cx("rounded-xl p-3 ring-1 ring-ink-200/70", l.enabled ? "bg-ink-50/60" : "bg-ink-50/30 opacity-60")}>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-ink-600 ring-1 ring-ink-200" title={LOAD_LABEL[l.kind]}>
          {LOAD_ICON[l.kind]}
        </span>
        <Input value={l.name} onChange={(e) => update((x) => void (x.name = e.target.value))} className="h-8 bg-white text-[13px] font-semibold sm:h-8" />
        <button
          type="button"
          onClick={() => update((x) => void (x.enabled = !x.enabled))}
          className={cx("h-8 shrink-0 rounded-lg px-2 text-[11.5px] font-bold", l.enabled ? "bg-sun-100 text-sun-700" : "bg-ink-100 text-ink-500")}
        >
          {l.enabled ? "Ligada" : "Desl."}
        </button>
        <button type="button" onClick={remove} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remover">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {l.kind === "profile" && (
          <>
            <Num label="Consumo diário" unit="kWh" digits={1} value={l.dailyKWh} onChange={(v) => u<typeof l>((x) => void (x.dailyKWh = Math.max(0, v)))} />
            <Pick
              label="Perfil horário"
              value={l.shape}
              onChange={(v) => u<typeof l>((x) => void (x.shape = v))}
              options={[
                { value: "residencial", label: "Residencial" },
                { value: "comercial", label: "Comercial" },
                { value: "rural", label: "Rural" },
                { value: "industrial", label: "Industrial (2 turnos)" },
                { value: "plano", label: "Constante" },
              ]}
            />
            <Num label="Fator fim de semana" unit="×" digits={2} value={l.weekendFactor} onChange={(v) => u<typeof l>((x) => void (x.weekendFactor = clamp(v, 0, 3)))} />
            <Num label="Aleatoriedade" unit="%" digits={0} value={l.noise * 100} onChange={(v) => u<typeof l>((x) => void (x.noise = clamp(v / 100, 0, 0.5)))} />
          </>
        )}
        {l.kind === "appliance" && (
          <>
            <Num label="Potência" unit="kW" digits={2} value={l.powerKW} onChange={(v) => u<typeof l>((x) => void (x.powerKW = Math.max(0, v)))} />
            <Num label="Ciclo de trabalho" unit="%" digits={0} value={l.duty * 100} onChange={(v) => u<typeof l>((x) => void (x.duty = clamp(v / 100, 0, 1)))} />
            <Window start={l.start} end={l.end} onChange={(a, b) => u<typeof l>((x) => ((x.start = a), (x.end = b)))} />
            <Pick label="Dias" value={l.days} onChange={(v) => u<typeof l>((x) => void (x.days = v))} options={[...DAYS_OPTS]} />
          </>
        )}
        {l.kind === "motor" && (
          <>
            <Num label="Potência no eixo" unit="kW" digits={2} value={l.shaftKW} onChange={(v) => u<typeof l>((x) => void (x.shaftKW = Math.max(0, v)))} hint={`≈ ${n1(l.shaftKW / 0.7355)} cv`} />
            <Num label="Fator de carga" unit="%" digits={0} value={l.loadFactor * 100} onChange={(v) => u<typeof l>((x) => void (x.loadFactor = clamp(v / 100, 0, 1.2)))} />
            <Num label="Rendimento" unit="%" digits={0} value={l.efficiency * 100} onChange={(v) => u<typeof l>((x) => void (x.efficiency = clamp(v / 100, 0.3, 0.99)))} />
            <Num label="Fator de potência" digits={2} value={l.powerFactor} onChange={(v) => u<typeof l>((x) => void (x.powerFactor = clamp(v, 0.3, 1)))} />
            <Num label="Corrente de partida" unit="× In" digits={1} value={l.startMultiplier} onChange={(v) => u<typeof l>((x) => void (x.startMultiplier = clamp(v, 1, 10)))} hint="Direta 6–8×; soft-starter 3×; inversor 1–1,5×" />
            <Pick label="Dias" value={l.days} onChange={(v) => u<typeof l>((x) => void (x.days = v))} options={[...DAYS_OPTS]} />
            <Window start={l.start} end={l.end} onChange={(a, b) => u<typeof l>((x) => ((x.start = a), (x.end = b)))} />
            <div className="col-span-2 flex items-end pb-1 sm:col-span-1">
              <Toggle label="Só com sobra solar" checked={l.solarOnly} onChange={(v) => u<typeof l>((x) => void (x.solarOnly = v))} />
            </div>
          </>
        )}
        {l.kind === "pump" && (
          <>
            <Num label="Potência elétrica" unit="kW" digits={2} value={l.powerKW} onChange={(v) => u<typeof l>((x) => void (x.powerKW = Math.max(0.01, v)))} />
            <Num label="Vazão" unit="m³/h" digits={1} value={l.flowM3h} onChange={(v) => u<typeof l>((x) => void (x.flowM3h = Math.max(0.01, v)))} />
            <Num
              label="Altura manométrica"
              unit="m"
              digits={0}
              value={l.headM}
              onChange={(v) => u<typeof l>((x) => void (x.headM = Math.max(0, v)))}
              hint={`Rendimento implícito ${n0(((1000 * 9.81 * (l.flowM3h / 3600) * l.headM) / (l.powerKW * 1000)) * 100)}%`}
            />
            <Num label="Água por dia" unit="m³" digits={1} value={l.dailyM3} onChange={(v) => u<typeof l>((x) => void (x.dailyM3 = Math.max(0, v)))} />
            <Window start={l.start} end={l.end} onChange={(a, b) => u<typeof l>((x) => ((x.start = a), (x.end = b)))} />
          </>
        )}
        {l.kind === "ev" && (
          <>
            <Num label="Carregador" unit="kW" digits={1} value={l.chargerKW} onChange={(v) => u<typeof l>((x) => void (x.chargerKW = Math.max(0.1, v)))} />
            <Num label="Energia por dia" unit="kWh" digits={1} value={l.dailyKWh} onChange={(v) => u<typeof l>((x) => void (x.dailyKWh = Math.max(0, v)))} hint={`≈ ${n0(l.dailyKWh * 6.5)} km/dia`} />
            <Num label="Conecta às" unit="h" digits={1} value={l.plugIn} onChange={(v) => u<typeof l>((x) => void (x.plugIn = clamp(v, 0, 23.99)))} />
            <Num label="Sai às" unit="h" digits={1} value={l.plugOut} onChange={(v) => u<typeof l>((x) => void (x.plugOut = clamp(v, 0, 23.99)))} />
            <Pick label="Dias em casa" value={l.daysHome} onChange={(v) => u<typeof l>((x) => void (x.daysHome = v))} options={[...DAYS_OPTS]} />
            <div className="flex items-end pb-1">
              <Toggle label="Recarga inteligente (solar)" checked={l.smart} onChange={(v) => u<typeof l>((x) => void (x.smart = v))} />
            </div>
          </>
        )}
        {l.kind === "waterheater" && (
          <>
            <Num label="Tanque" unit="L" digits={0} value={l.tankLiters} onChange={(v) => u<typeof l>((x) => void (x.tankLiters = Math.max(10, v)))} />
            <Num label="Resistência" unit="kW" digits={1} value={l.heaterKW} onChange={(v) => u<typeof l>((x) => void (x.heaterKW = Math.max(0.1, v)))} />
            <Num label="Água quente/dia (40 °C)" unit="L" digits={0} value={l.dailyLiters} onChange={(v) => u<typeof l>((x) => void (x.dailyLiters = Math.max(0, v)))} />
            <Num label="Água fria" unit="°C" digits={0} value={l.coldC} onChange={(v) => u<typeof l>((x) => void (x.coldC = clamp(v, 5, 35)))} />
            <Num label="Mínima de conforto" unit="°C" digits={0} value={l.minC} onChange={(v) => u<typeof l>((x) => void (x.minC = clamp(v, x.coldC + 1, 80)))} />
            <Num label="Máxima do tanque" unit="°C" digits={0} value={l.maxC} onChange={(v) => u<typeof l>((x) => void (x.maxC = clamp(v, x.minC + 1, 90)))} />
            <Num label="Perdas térmicas" unit="kWh/dia" digits={1} value={l.lossKWhDay} onChange={(v) => u<typeof l>((x) => void (x.lossKWhDay = Math.max(0, v)))} />
            <div className="col-span-2 flex items-end pb-1">
              <Toggle label="Desviador de excedente solar" checked={l.diverter} onChange={(v) => u<typeof l>((x) => void (x.diverter = v))} hint="Sem desviador: termostato mantém a máxima com energia da rede." />
            </div>
          </>
        )}
        {l.kind === "deferrable" && (
          <>
            <Num label="Potência" unit="kW" digits={2} value={l.powerKW} onChange={(v) => u<typeof l>((x) => void (x.powerKW = Math.max(0.01, v)))} />
            <Num label="Energia por dia" unit="kWh" digits={1} value={l.dailyKWh} onChange={(v) => u<typeof l>((x) => void (x.dailyKWh = Math.max(0, v)))} />
            <Window start={l.start} end={l.end} onChange={(a, b) => u<typeof l>((x) => ((x.start = a), (x.end = b)))} />
            <div className="col-span-2 flex items-end pb-1 sm:col-span-1">
              <Toggle label="Precisa completar" checked={l.mustComplete} onChange={(v) => u<typeof l>((x) => void (x.mustComplete = v))} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Window({ start, end, onChange }: { start: number; end: number; onChange: (a: number, b: number) => void }) {
  return (
    <>
      <Num label="Das" unit="h" digits={1} value={start} onChange={(v) => onChange(clamp(v, 0, 23.99), end)} />
      <Num label="Até" unit="h" digits={1} value={end} onChange={(v) => onChange(start, clamp(v, 0, 24))} />
    </>
  );
}

/* ------------------------------------------------------------------- Rede */

const EVENT_LABEL: Record<EventKind, string> = {
  curtailment: "Corte de injeção (curtailment)",
  "gd-trip": "Desligamento remoto da GD",
  outage: "Apagão (falta de energia)",
};

function GridSection({ s, update }: { s: Scenario; update: Update }) {
  const g = s.grid;
  return (
    <Section title="Rede, cortes e apagões" icon={<Cable className="h-4 w-4" />}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {(
            [
              ["on-grid", "On-grid", "Injeta tudo"],
              ["zero-grid", "Zero grid", "Não injeta"],
              ["export-limit", "Limite", "Injeta até X kW"],
              ["off-grid", "Off-grid", "Sem rede"],
            ] as const
          ).map(([v, t, sub]) => (
            <button
              key={v}
              type="button"
              onClick={() => update((d) => void (d.grid.mode = v))}
              className={cx(
                "rounded-xl px-2.5 py-2 text-left ring-1 transition",
                g.mode === v ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-700 ring-ink-200 hover:ring-ink-300",
              )}
            >
              <div className="text-[13px] font-bold">{t}</div>
              <div className={cx("text-[11px]", g.mode === v ? "text-white/70" : "text-ink-400")}>{sub}</div>
            </button>
          ))}
        </div>
        <Grid cols={3}>
          {g.mode === "export-limit" && <Num label="Limite de injeção" unit="kW" digits={1} value={g.exportLimitKW} onChange={(v) => update((d) => void (d.grid.exportLimitKW = Math.max(0, v)))} />}
          {g.mode !== "off-grid" && <Num label="Limite de importação" unit="kW" digits={1} value={g.importLimitKW} onChange={(v) => update((d) => void (d.grid.importLimitKW = Math.max(0, v)))} />}
        </Grid>
        {g.mode !== "off-grid" && (
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-3">
              <Toggle label="Carregar baterias pela rede (horário barato)" checked={g.gridCharge} onChange={(v) => update((d) => void (d.grid.gridCharge = v))} />
            </div>
            {g.gridCharge && (
              <>
                <Num label="Das" unit="h" digits={1} value={g.gridChargeStart} onChange={(v) => update((d) => void (d.grid.gridChargeStart = clamp(v, 0, 23.99)))} />
                <Num label="Até" unit="h" digits={1} value={g.gridChargeEnd} onChange={(v) => update((d) => void (d.grid.gridChargeEnd = clamp(v, 0, 24)))} />
              </>
            )}
          </div>
        )}

        <div className="h-px bg-ink-100" />
        <div className="text-[12.5px] font-bold text-ink-800">Eventos programados</div>
        {g.events.map((e, i) => (
          <EventCard key={e.id} e={e} update={(fn) => update((d) => fn(d.grid.events[i]))} remove={() => update((d) => void d.grid.events.splice(i, 1))} />
        ))}
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(EVENT_LABEL) as EventKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() =>
                update((d) =>
                  void d.grid.events.push({
                    id: newId("ev"),
                    kind: k,
                    start: k === "outage" ? 18 : 10,
                    end: k === "outage" ? 22 : 15,
                    days: k === "outage" ? "todos" : "domingos",
                    probability: k === "outage" ? 0.2 : 1,
                    exportFraction: 0,
                    months: [],
                  }),
                )
              }
              className="inline-flex h-7 items-center gap-1 rounded-full bg-ink-50 px-2.5 text-[12px] font-semibold text-ink-700 ring-1 ring-ink-200 hover:bg-white"
            >
              <Plus className="h-3 w-3" />
              {EVENT_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {g.mode === "off-grid" || g.events.some((e) => e.kind === "outage") ? (
        <div className="mt-4 rounded-xl bg-ink-50/60 p-3 ring-1 ring-ink-200/70">
          <div className="mb-2 flex items-center gap-2 text-[12.5px] font-bold text-ink-800">
            <Fuel className="h-4 w-4 text-ink-500" /> Gerador (diesel/gasolina)
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-3">
              <Toggle label="Gerador instalado" checked={s.generator.enabled} onChange={(v) => update((d) => void (d.generator.enabled = v))} />
            </div>
            {s.generator.enabled && (
              <>
                <Num label="Potência" unit="kW" digits={1} value={s.generator.kW} onChange={(v) => update((d) => void (d.generator.kW = Math.max(0, v)))} />
                <Num label="Liga com SOC abaixo de" unit="%" digits={0} value={s.generator.startSoc * 100} onChange={(v) => update((d) => void (d.generator.startSoc = clamp(v / 100, 0, 0.95)))} />
                <Num label="Consumo" unit="L/kWh" digits={2} value={s.generator.litersPerKWh} onChange={(v) => update((d) => void (d.generator.litersPerKWh = Math.max(0, v)))} />
                <Num label="Combustível" unit="R$/L" digits={2} value={s.generator.fuelPrice} onChange={(v) => update((d) => void (d.generator.fuelPrice = Math.max(0, v)))} />
              </>
            )}
          </div>
        </div>
      ) : null}
    </Section>
  );
}

function EventCard({ e, update, remove }: { e: GridEvent; update: (fn: (x: GridEvent) => void) => void; remove: () => void }) {
  return (
    <div className="rounded-xl bg-ink-50/60 p-3 ring-1 ring-ink-200/70">
      <div className="mb-2.5 flex items-center gap-2">
        <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", e.kind === "outage" ? "bg-rose-500" : e.kind === "gd-trip" ? "bg-amber-500" : "bg-ink-400")} />
        <select
          value={e.kind}
          onChange={(ev) => update((x) => void (x.kind = ev.target.value as EventKind))}
          className="h-8 flex-1 rounded-lg bg-white px-2 text-[13px] font-semibold text-ink-800 ring-1 ring-ink-200"
        >
          {(Object.keys(EVENT_LABEL) as EventKind[]).map((k) => (
            <option key={k} value={k}>
              {EVENT_LABEL[k]}
            </option>
          ))}
        </select>
        <button type="button" onClick={remove} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remover evento">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Num label="Das" unit="h" digits={1} value={e.start} onChange={(v) => update((x) => void (x.start = clamp(v, 0, 23.99)))} />
        <Num label="Até" unit="h" digits={1} value={e.end} onChange={(v) => update((x) => void (x.end = clamp(v, 0, 24)))} />
        <Pick
          label="Dias"
          value={e.days}
          onChange={(v) => update((x) => void (x.days = v))}
          options={[...DAYS_OPTS, { value: "domingos", label: "Domingos" }]}
        />
        <Num label="Probabilidade no dia" unit="%" digits={0} value={e.probability * 100} onChange={(v) => update((x) => void (x.probability = clamp(v / 100, 0, 1)))} />
        {e.kind === "curtailment" && (
          <Num label="Injeção ainda permitida" unit="%" digits={0} value={e.exportFraction * 100} onChange={(v) => update((x) => void (x.exportFraction = clamp(v / 100, 0, 1)))} />
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1">
        {MONTHS.map((m, i) => {
          const on = e.months.includes(i + 1);
          return (
            <button
              key={m}
              type="button"
              onClick={() => update((x) => void (x.months = on ? x.months.filter((v) => v !== i + 1) : [...x.months, i + 1].sort((a, b) => a - b)))}
              className={cx("h-6 rounded-md px-1.5 text-[11px] font-semibold ring-1", on ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-500 ring-ink-200")}
            >
              {m}
            </button>
          );
        })}
        <span className="self-center pl-1 text-[11px] text-ink-400">{e.months.length ? "só nos meses marcados" : "ano todo"}</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Controle */

function ControlSection({ s, update }: { s: Scenario; update: Update }) {
  const cur = STRATEGIES.find((x) => x.value === s.control.strategy)!;
  return (
    <Section title="Controle (EMS)" icon={<CloudSun className="h-4 w-4" />}>
      <div className="flex flex-col gap-2.5">
        <Pick label="Estratégia de despacho" value={s.control.strategy} onChange={(v) => update((d) => void (d.control.strategy = v))} options={STRATEGIES.map((x) => ({ value: x.value, label: x.label }))} />
        <p className="text-[12px] leading-snug text-ink-500">{cur.text}</p>
        <Grid>
          {s.control.strategy === "reserva-backup" && (
            <Num label="Reserva para apagão" unit="%" digits={0} value={s.control.backupReserve * 100} onChange={(v) => update((d) => void (d.control.backupReserve = clamp(v / 100, 0, 1)))} />
          )}
          {s.control.strategy === "peak-shaving" && (
            <Num label="Limite de demanda" unit="kW" digits={1} value={s.control.peakLimitKW} onChange={(v) => update((d) => void (d.control.peakLimitKW = Math.max(0, v)))} />
          )}
        </Grid>
      </div>
    </Section>
  );
}

/* ----------------------------------------------------------------- Tarifa */

function TariffSection({ s, update }: { s: Scenario; update: Update }) {
  const t = s.tariff;
  return (
    <Section title="Tarifa e Lei 14.300" icon={<Receipt className="h-4 w-4" />} open={false}>
      <div className="flex flex-col gap-2.5">
        <Grid cols={3}>
          <Num label="Tarifa cheia" unit="R$/kWh" digits={3} value={t.price} onChange={(v) => update((d) => void (d.tariff.price = Math.max(0, v)))} />
          <Num label="Fio B" unit="R$/kWh" digits={3} value={t.fioB} onChange={(v) => update((d) => void (d.tariff.fioB = Math.max(0, v)))} />
          <Num label="Ano (fio B)" digits={0} value={t.year} onChange={(v) => update((d) => void (d.tariff.year = clamp(Math.round(v), 2022, 2040)))} hint={`${n0(fioBPct(t.year) * 100)}% do fio B cobrado`} />
          <Num label="Emissão da rede" unit="kg/kWh" digits={3} value={t.co2} onChange={(v) => update((d) => void (d.tariff.co2 = Math.max(0, v)))} />
        </Grid>
        <Toggle label="Tarifa branca" checked={t.branca} onChange={(v) => update((d) => void (d.tariff.branca = v))} />
        {t.branca && (
          <Grid cols={3}>
            <Num label="Ponta" unit="×" digits={2} value={t.peakMult} onChange={(v) => update((d) => void (d.tariff.peakMult = Math.max(0, v)))} />
            <Num label="Intermediário" unit="×" digits={2} value={t.midMult} onChange={(v) => update((d) => void (d.tariff.midMult = Math.max(0, v)))} />
            <Num label="Fora de ponta" unit="×" digits={2} value={t.offMult} onChange={(v) => update((d) => void (d.tariff.offMult = Math.max(0, v)))} />
            <Num label="Ponta das" unit="h" digits={0} value={t.peakStart} onChange={(v) => update((d) => void (d.tariff.peakStart = clamp(Math.round(v), 0, 23)))} />
            <Num label="Ponta até" unit="h" digits={0} value={t.peakEnd} onChange={(v) => update((d) => void (d.tariff.peakEnd = clamp(Math.round(v), 1, 24)))} />
          </Grid>
        )}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ util */

const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
function monthOfDoy(doy: number) {
  let m = 0;
  for (let i = 0; i < 12; i++) if (doy > MONTH_START[i]) m = i;
  return m;
}
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, Number.isFinite(x) ? x : a));

