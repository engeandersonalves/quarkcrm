"use client";

import {
  ArrowRight,
  Check,
  ChevronLeft,
  Leaf,
  Plus,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  MOUNTS,
  PLACES,
  fmt,
  kitKwp,
  sizeSystem,
  type CartItem,
  type Grid,
  type Mount,
  type Place,
} from "@/lib/store";
import { MountArt, PlaceArt } from "./art";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ blocos */

export function Tile({ icon: Icon, color, className }: { icon: LucideIcon; color: string; className?: string }) {
  return (
    <span className={cx("ios-tile h-10 w-10 rounded-[11px]", className)}>
      <Icon className="relative h-[21px] w-[21px]" style={{ color }} strokeWidth={2.2} />
    </span>
  );
}

export function Section({ id, eyebrow, title, text, children, className }: { id: string; eyebrow: string; title: ReactNode; text?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cx("scroll-mt-32 px-4 py-14 sm:px-6 sm:py-20", className)}>
      <div className="mx-auto max-w-6xl">
        <p className="text-[13px] font-semibold tracking-[0.04em] text-[#9BD373] uppercase">{eyebrow}</p>
        <h2 className="mt-1.5 max-w-3xl text-[30px] leading-[1.08] font-bold tracking-[-0.03em] text-white sm:text-[44px]">{title}</h2>
        {text && <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-[#8E8E93] sm:text-[17px]">{text}</p>}
        <div className="mt-8 sm:mt-10">{children}</div>
      </div>
    </section>
  );
}

export function AddButton({ added, onClick, label = "Adicionar à cotação", full }: { added: boolean; onClick: () => void; label?: string; full?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition active:scale-[0.97]",
        full && "w-full",
        added ? "bg-[#30D158]/15 text-[#30D158] ring-1 ring-[#30D158]/40" : "bg-[#fff] text-black hover:bg-white/90",
      )}
    >
      {added ? <Check className="h-4 w-4" strokeWidth={3} /> : <Plus className="h-4 w-4" strokeWidth={2.8} />}
      {added ? "Na sua cotação" : label}
    </button>
  );
}

export function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl bg-[#2C2C2E]/70 px-3 py-2.5">
      <p className="text-[11px] font-medium text-[#8E8E93]">{label}</p>
      <p className="mt-0.5 text-[17px] font-semibold tracking-tight text-white tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-[12px] font-medium text-[#8E8E93]">{unit}</span>}
      </p>
    </div>
  );
}

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-sheet-up relative flex max-h-[92dvh] w-full flex-col rounded-t-[32px] bg-[#1C1C1E] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] sm:max-w-lg sm:rounded-[32px]">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-2">
          <h3 className="text-[20px] font-bold tracking-tight text-white">{title}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-[rgba(118,118,128,0.24)] text-[#AEAEB2]" aria-label="Fechar">
            <X className="h-4 w-4" strokeWidth={2.6} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-6">{children}</div>
        {footer && <div className="border-t border-white/[0.08] px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

/* --------------------------------------------------- gráfico de economia */

export function SavingsChart() {
  // Conta de luz sobe ~8% ao ano; com solar, paga-se praticamente a taxa mínima.
  const years = Array.from({ length: 10 }, (_, i) => i + 1);
  const without = years.map((y) => Math.pow(1.08, y - 1));
  const max = without[without.length - 1];
  return (
    <div className="mt-6 rounded-[28px] bg-[#1C1C1E] p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[17px] font-semibold">A conta de luz sobe. A sua economia também.</p>
          <p className="text-[14px] text-[#8E8E93]">Conta de luz nos próximos 10 anos (exemplo com reajuste médio de 8% ao ano)</p>
        </div>
        <div className="flex gap-4 text-[13px]">
          <span className="flex items-center gap-1.5 text-[#D1D1D6]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF453A]" /> Sem energia solar
          </span>
          <span className="flex items-center gap-1.5 text-[#D1D1D6]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#9BD373]" /> Com energia solar
          </span>
        </div>
      </div>
      <div className="mt-6 flex h-44 items-end gap-1.5 sm:gap-3">
        {years.map((y, i) => (
          <div key={y} className="group flex flex-1 flex-col items-center gap-1.5">
            <div className="flex h-36 w-full items-end justify-center gap-[3px]">
              <div className="w-1/2 max-w-[18px] rounded-t-[5px] bg-[#FF453A]/85" style={{ height: `${(without[i] / max) * 100}%` }} title={`Ano ${y}: sem solar`} />
              <div className="w-1/2 max-w-[18px] rounded-t-[5px] bg-[#9BD373]" style={{ height: `${(0.1 * without[i] / max) * 100 + 4}%` }} title={`Ano ${y}: com solar`} />
            </div>
            <span className="text-[11px] text-[#8E8E93] tabular-nums">{y}º</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- monte o seu */

const GRIDS: { id: Grid | "nao-sei"; label: string; text: string }[] = [
  { id: "mono", label: "Monofásico", text: "2 fios no padrão" },
  { id: "bi", label: "Bifásico", text: "3 fios no padrão" },
  { id: "tri", label: "Trifásico", text: "4 fios no padrão" },
  { id: "nao-sei", label: "Não sei", text: "A gente descobre na visita" },
];

export function Builder({ tariff, sun, onAdd, initialPlace }: { tariff: number; sun: number; onAdd: (i: CartItem) => void; initialPlace: Place }) {
  const [step, setStep] = useState(0);
  const [place, setPlace] = useState<Place>(initialPlace);
  const [bill, setBill] = useState(450);
  const [mount, setMount] = useState<Mount | null>(null);
  const [grid, setGrid] = useState<Grid | "nao-sei" | null>(null);
  const max = place === "casa" ? 3000 : place === "comercio" ? 30000 : 20000;
  const s = useMemo(() => sizeSystem({ bill, place, grid: grid && grid !== "nao-sei" ? grid : "bi", tariff, sunHours: sun }), [bill, place, grid, tariff, sun]);
  const steps = ["Onde", "Conta de luz", "Telhado", "Rede", "Resultado"];
  const canNext = step === 0 ? true : step === 1 ? bill > 0 : step === 2 ? !!mount : step === 3 ? !!grid : true;
  const mountLabel = MOUNTS.find((m) => m.id === mount)?.label ?? "";

  return (
    <div className="overflow-hidden rounded-[32px] bg-[#1C1C1E]">
      {/* progresso */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4 sm:px-7">
        {steps.map((t, i) => (
          <div key={t} className="flex flex-1 flex-col gap-1.5">
            <div className={cx("h-1.5 rounded-full transition-all duration-500", i <= step ? "bg-gradient-to-r from-[#F3EA3B] to-[#9BD373]" : "bg-white/10")} />
            <span className={cx("hidden text-[12px] font-medium sm:block", i === step ? "text-white" : "text-[#6C6C70]")}>{t}</span>
          </div>
        ))}
      </div>

      <div className="p-5 sm:p-8">
        {step === 0 && (
          <Q title="Onde vai ser instalado?">
            <div className="grid gap-3 sm:grid-cols-3">
              {PLACES.map((p) => (
                <Choice key={p.id} on={place === p.id} onClick={() => { setPlace(p.id); setBill(p.id === "casa" ? 450 : p.id === "comercio" ? 2500 : 1500); setStep(1); }}>
                  <PlaceArt place={p.id} className="h-28 w-full rounded-[18px]" />
                  <p className="mt-3 text-[17px] font-semibold">{p.short}</p>
                  <p className="text-[13px] text-[#8E8E93]">{p.text}</p>
                </Choice>
              ))}
            </div>
          </Q>
        )}

        {step === 1 && (
          <Q title="Quanto vem a sua conta de luz por mês?" text="Use a média dos últimos meses. Não precisa ser exato.">
            <div className="mx-auto max-w-xl text-center">
              <p className="text-[56px] leading-none font-bold tracking-[-0.04em] tabular-nums sm:text-[72px]">
                <span className="mr-1 align-top text-[24px] text-[#8E8E93]">R$</span>
                {fmt(bill)}
              </p>
              <input
                type="range"
                min={100}
                max={max}
                step={place === "casa" ? 10 : 50}
                value={Math.min(bill, max)}
                onChange={(e) => setBill(Number(e.target.value))}
                className="store-range mt-8 w-full"
                style={{ "--p": `${((Math.min(bill, max) - 100) / (max - 100)) * 100}%` } as React.CSSProperties}
                aria-label="Valor da conta de luz"
              />
              <div className="mt-2 flex justify-between text-[12px] text-[#6C6C70]">
                <span>R$ 100</span>
                <span>R$ {fmt(max)}+</span>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {(place === "casa" ? [200, 350, 500, 800, 1200] : place === "comercio" ? [1000, 2500, 5000, 10000, 20000] : [800, 1500, 3000, 6000, 12000]).map((v) => (
                  <button key={v} onClick={() => setBill(v)} className={cx("h-9 rounded-full px-4 text-[14px] font-semibold tabular-nums transition", bill === v ? "bg-[#fff] text-black" : "bg-[#2C2C2E] text-white")}>
                    R$ {fmt(v)}
                  </button>
                ))}
              </div>
            </div>
          </Q>
        )}

        {step === 2 && (
          <Q title="Onde as placas vão ficar?" text="Escolha o tipo de telhado ou estrutura. Cada um tem uma fixação própria.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {MOUNTS.map((m) => (
                <Choice key={m.id} on={mount === m.id} onClick={() => { setMount(m.id); setStep(3); }}>
                  <div className="grid place-items-center rounded-[18px] bg-black/60 py-2">
                    <MountArt mount={m.id} className="h-28 w-40 sm:h-32 sm:w-48" />
                  </div>
                  <p className="mt-3 text-[16px] font-semibold">{m.label}</p>
                  <p className="text-[13px] leading-snug text-[#8E8E93]">{m.text}</p>
                </Choice>
              ))}
            </div>
          </Q>
        )}

        {step === 3 && (
          <Q title="Qual é o tipo de ligação?" text="Aparece na sua conta de luz como “tipo de fornecimento”.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {GRIDS.map((g) => (
                <Choice key={g.id} on={grid === g.id} onClick={() => { setGrid(g.id); setStep(4); }}>
                  <div className="flex h-12 items-end gap-1.5">
                    {Array.from({ length: g.id === "mono" ? 2 : g.id === "bi" ? 3 : g.id === "tri" ? 4 : 0 }, (_, i) => (
                      <span key={i} className="w-2.5 rounded-full" style={{ height: `${24 + i * 6}px`, background: ["#F3EA3B", "#9BD373", "#FF9F0A", "#AEAEB2"][i] }} />
                    ))}
                    {g.id === "nao-sei" && <span className="text-[34px] leading-none font-bold text-[#636366]">?</span>}
                  </div>
                  <p className="mt-3 text-[16px] font-semibold">{g.label}</p>
                  <p className="text-[13px] text-[#8E8E93]">{g.text}</p>
                </Choice>
              ))}
            </div>
          </Q>
        )}

        {step === 4 && (
          <div className="animate-fade-up">
            <p className="text-[14px] font-medium text-[#9BD373]">Seu sistema ideal</p>
            <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
              <p className="text-[56px] leading-none font-bold tracking-[-0.04em] tabular-nums sm:text-[76px]">
                {fmt(s.kwp, 2)}
                <span className="ml-1.5 text-[24px] font-semibold text-[#8E8E93]">kWp</span>
              </p>
              <p className="mb-2 text-[15px] text-[#AEAEB2]">
                {s.modules} placas · {mountLabel.toLowerCase()} · {PLACES.find((p) => p.id === place)?.short.toLowerCase()}
              </p>
            </div>

            {/* placas desenhadas */}
            <div className="mt-6 flex flex-wrap gap-1.5">
              {Array.from({ length: Math.min(s.modules, 60) }, (_, i) => (
                <span
                  key={i}
                  className="h-7 w-[18px] rounded-[3px] bg-gradient-to-br from-[#3a3a40] to-[#0e0e11] shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.18)]"
                  style={{ animation: `ios-rise .4s ${i * 0.02}s both` }}
                />
              ))}
              {s.modules > 60 && <span className="self-center pl-1 text-[13px] text-[#8E8E93]">+{s.modules - 60}</span>}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Geração estimada" value={`~${fmt(s.generation)}`} unit="kWh/mês" />
              <Stat label="Área necessária" value={`${s.area}`} unit="m²" />
              <Stat label="Economia na conta" value={`até ${s.savingPct}%`} />
              <Stat label="Por ano, no bolso" value={`~R$ ${fmt(s.saving * 12)}`} />
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-2xl bg-[#9BD373]/10 px-4 py-3">
                <Leaf className="h-5 w-5 text-[#9BD373]" />
                <p className="text-[14px] text-[#C9EBA8]">
                  Evita ~{fmt(s.co2Kg)} kg de CO₂ por ano, como plantar {fmt(Math.max(1, s.trees))} árvores.
                </p>
              </div>
              {s.kit && (
                <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3">
                  <Sun className="h-5 w-5 text-[#F3EA3B]" />
                  <p className="text-[14px] text-[#D1D1D6]">
                    Kit pronto mais próximo: <b className="text-white">Kit {s.kit.name}</b> ({fmt(kitKwp(s.kit.modules), 2)} kWp)
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() =>
                  onAdd({
                    key: "custom:sistema",
                    kind: "custom",
                    title: `Sistema ${fmt(s.kwp, 2)} kWp (${s.modules} placas)`,
                    detail: `${PLACES.find((p) => p.id === place)?.short}, ${mountLabel}, ${grid === "nao-sei" ? "ligação a confirmar" : GRIDS.find((g) => g.id === grid)?.label}, conta ~R$ ${fmt(bill)}`,
                  })
                }
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] text-[16px] font-semibold text-black active:scale-[0.98]"
              >
                <Plus className="h-5 w-5" strokeWidth={2.8} /> Adicionar à minha cotação
              </button>
              <button onClick={() => { setStep(0); setMount(null); setGrid(null); }} className="h-12 rounded-full bg-[#2C2C2E] px-6 text-[15px] font-semibold">
                Refazer
              </button>
            </div>
            <p className="mt-3 text-[12px] text-[#6C6C70]">Estimativa com {fmt(sun, 1)} horas de sol por dia. O projeto final é confirmado na visita técnica.</p>
          </div>
        )}

        {step > 0 && step < 4 && (
          <div className="mt-8 flex items-center justify-between">
            <button onClick={() => setStep(step - 1)} className="inline-flex h-11 items-center gap-1 rounded-full px-3 text-[15px] font-semibold text-[#AEAEB2] hover:text-white">
              <ChevronLeft className="h-5 w-5" /> Voltar
            </button>
            <button disabled={!canNext} onClick={() => setStep(step + 1)} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#fff] px-6 text-[15px] font-semibold text-black disabled:opacity-30">
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Q({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <div className="animate-fade-up">
      <p className="text-[24px] leading-tight font-bold tracking-tight sm:text-[28px]">{title}</p>
      {text && <p className="mt-1 text-[15px] text-[#8E8E93]">{text}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={cx("relative rounded-[24px] p-3 text-left transition active:scale-[0.98]", on ? "bg-[#2C2C2E] ring-2 ring-[#9BD373]" : "bg-[#2C2C2E]/50 hover:bg-[#2C2C2E]")}>
      {children}
      {on && (
        <span className="absolute top-3 right-3 grid h-6 w-6 place-items-center rounded-full bg-[#9BD373] text-black">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

