"use client";

import { Check, ChevronDown, Copy, Gift, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PRIZES, chances, prizeByKey, spinAngle } from "@/lib/catalog-wheel";

/**
 * Roleta de prêmios do catálogo. O prêmio vem do servidor (1 giro por WhatsApp);
 * a roleta só anima até ele. O prêmio fica salvo no aparelho e entra na reserva.
 */

export type WonPrize = { prize: string; label: string; code: string };

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const GOLD = "linear-gradient(100deg,#F7E7A1 0%,#E2C35C 45%,#C9A13B 100%)";
const goldText = { background: GOLD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } as const;
const SIZE = 320;
const R = 150;
const C = SIZE / 2;

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

const pt = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
};

function Wheel({ angle, spinning }: { angle: number; spinning: boolean }) {
  const slice = 360 / PRIZES.length;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]">
      {/* ponteiro */}
      <div className="absolute top-[-6px] left-1/2 z-10 -translate-x-1/2 drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">
        <svg width="34" height="40" viewBox="0 0 34 40" aria-hidden>
          <path d="M17 40 L2 8 A16 16 0 0 1 32 8 Z" fill="url(#pin)" />
          <circle cx="17" cy="13" r="5" fill="#0B1A12" />
          <defs>
            <linearGradient id="pin" x1="0" x2="1">
              <stop offset="0" stopColor="#F7E7A1" />
              <stop offset="1" stopColor="#C9A13B" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="absolute inset-0 rounded-full p-[10px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]" style={{ background: GOLD }}>
        <div
          className="h-full w-full"
          style={{ transform: `rotate(${angle}deg)`, transition: spinning ? "transform 5.6s cubic-bezier(0.12, 0.72, 0.08, 1)" : "none" }}
        >
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" aria-hidden>
            {PRIZES.map((p, i) => {
              const a0 = i * slice;
              const a1 = (i + 1) * slice;
              const [x0, y0] = pt(a0, R);
              const [x1, y1] = pt(a1, R);
              const mid = a0 + slice / 2;
              const [tx, ty] = pt(mid, R * 0.62);
              return (
                <g key={p.key}>
                  <path d={`M${C},${C} L${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1} Z`} fill={p.fill} stroke="#0B1A12" strokeOpacity="0.25" strokeWidth="1.5" />
                  <g transform={`translate(${tx} ${ty}) rotate(${mid})`}>
                    {p.short.map((line, k) => (
                      <text key={k} x="0" y={(k - (p.short.length - 1) / 2) * 17 + 6} textAnchor="middle" fill={p.ink} fontSize={k === 0 ? 17 : 12} fontWeight={900} letterSpacing="0.5" fontFamily="var(--font-outfit), system-ui, sans-serif">
                        {line}
                      </text>
                    ))}
                  </g>
                </g>
              );
            })}
            {/* luzes */}
            {Array.from({ length: 18 }, (_, k) => {
              const [lx, ly] = pt(k * 20, R + 1);
              return <circle key={k} cx={lx} cy={ly} r="3" fill="#FFF6D5" opacity={k % 2 ? 0.95 : 0.55} />;
            })}
            <circle cx={C} cy={C} r="34" fill="#0B1A12" stroke="#E2C35C" strokeWidth="4" />
          </svg>
        </div>
      </div>
      {/* centro */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 grid h-[56px] w-[56px] -translate-x-1/2 -translate-y-1/2 place-items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/symbol.png" alt="" className="h-8 w-8 object-contain" />
      </div>
    </div>
  );
}

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 1.8 + Math.random() * 1.4,
        color: ["#E2C35C", "#1F9D55", "#F7E7A1", "#FFFFFF", "#9FDB7C"][i % 5],
        rot: Math.random() * 360,
        w: 6 + Math.random() * 6,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <style>{`@keyframes qw-fall{0%{transform:translate3d(0,-20px,0) rotate(0)}100%{transform:translate3d(0,620px,0) rotate(720deg);opacity:0}}`}</style>
      {bits.map((b, i) => (
        <span key={i} className="absolute top-0 block rounded-[2px]" style={{ left: `${b.left}%`, width: b.w, height: b.w * 0.45, background: b.color, transform: `rotate(${b.rot}deg)`, animation: `qw-fall ${b.dur}s ${b.delay}s cubic-bezier(.2,.6,.3,1) forwards` }} />
      ))}
    </div>
  );
}

export function WheelModal({
  open,
  onClose,
  won,
  profile,
  until,
  onWon,
  spin,
}: {
  open: boolean;
  onClose: () => void;
  won: WonPrize | null;
  profile: { name: string; phone: string } | null;
  until: string;
  onWon: (w: WonPrize, p: { name: string; phone: string }, token?: string) => void;
  spin: (name: string, phone: string) => Promise<{ prize: string; label: string; code: string; token?: string; existing?: boolean }>;
}) {
  const [name, setName] = useState(profile?.name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<(WonPrize & { existing?: boolean }) | null>(won);
  const [showResult, setShowResult] = useState(!!won);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showResult && open) setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 150);
  }, [showResult, open]);
  const valid = name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10;

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !spinning && onClose();
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = prev;
    };
  }, [open, spinning, onClose]);
  useEffect(() => {
    if (won) {
      setResult(won);
      setShowResult(true);
      setAngle(spinAngle(won.prize, 0));
    }
  }, [won]);

  const go = async () => {
    if (!valid || busy || spinning) return;
    setBusy(true);
    setErr("");
    try {
      const r = await spin(name.trim(), phone);
      setBusy(false);
      setSpinning(true);
      setAngle((a) => a - (a % 360) + spinAngle(r.prize, 7, Math.random() * 2 - 1));
      setTimeout(() => {
        setSpinning(false);
        setResult({ prize: r.prize, label: r.label, code: r.code, existing: r.existing });
        setShowResult(true);
        onWon({ prize: r.prize, label: r.label, code: r.code }, { name: name.trim(), phone }, r.token);
      }, 5800);
    } catch (e) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : "Não foi possível girar agora.");
    }
  };

  if (!open) return null;
  const p = prizeByKey(result?.prize);
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-[3px] sm:items-center sm:p-6" onClick={() => !spinning && onClose()} role="dialog" aria-modal aria-label="Roleta de prêmios">
      <div onClick={(e) => e.stopPropagation()} className="bf-rise relative max-h-[96dvh] w-full max-w-[440px] overflow-y-auto rounded-t-[30px] bg-[#0A0F0C] px-5 pt-6 pb-6 font-[family-name:var(--font-outfit)] text-white shadow-2xl sm:rounded-[30px] sm:px-7">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(226,195,92,0.35), rgba(226,195,92,0))" }} />
        {showResult && p && <Confetti />}
        <button type="button" onClick={onClose} disabled={spinning} aria-label="Fechar" className="absolute top-3 right-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 ring-1 ring-white/15 disabled:opacity-40">
          <X className="h-5 w-5" />
        </button>
        <div className="relative text-center">
          <p className="text-[11px] font-black tracking-[0.22em] uppercase" style={goldText}>
            Roleta Black Quark
          </p>
          <h2 className="mt-1 text-[26px] leading-tight font-bold tracking-[-0.03em]">{showResult && p ? "Você ganhou!" : "Gire e ganhe na sua scooter"}</h2>
          {!showResult && <p className="mt-1 text-[14px] text-white/60">Capacete, baú, suporte ou até R$ 300 de desconto.</p>}
        </div>

        <div className="relative mt-5">
          <Wheel angle={angle} spinning={spinning} />
        </div>

        {showResult && p && result ? (
          <div ref={resultRef} className="relative mt-5 rounded-[22px] bg-white p-5 text-center text-[#0B1A12]">
            {result.existing && <p className="mb-1 text-[12px] font-semibold text-[#0B1A12]/50">Você já tinha girado com este WhatsApp</p>}
            <p className="text-[12px] font-bold tracking-[0.16em] text-[#1F9D55] uppercase">Seu prêmio</p>
            <p className="mt-0.5 text-[26px] leading-tight font-extrabold tracking-[-0.03em]">{result.label}</p>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(result.code).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              })}
              className="mx-auto mt-3 flex items-center gap-2 rounded-[14px] border-2 border-dashed border-[#0B1A12]/20 px-4 py-2 text-[20px] font-black tracking-[0.12em] tabular-nums"
            >
              {result.code} {copied ? <Check className="h-4 w-4 text-[#1F9D55]" strokeWidth={3} /> : <Copy className="h-4 w-4 text-[#0B1A12]/40" />}
            </button>
            <p className="mt-2 text-[12.5px] text-[#0B1A12]/55">Já fica aplicado na sua reserva. Válido na compra de uma scooter até {until}.</p>
            <button type="button" onClick={onClose} className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-[#0B1A12] text-[15px] font-bold text-white">
              Escolher minha scooter
            </button>
          </div>
        ) : (
          <div className="relative mt-5">
            <div className="grid gap-2">
              <label className="sr-only" htmlFor="w-name">
                Seu nome
              </label>
              <input id="w-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" className="h-12 w-full rounded-[14px] bg-white/[0.08] px-4 text-[16px] text-white ring-1 ring-white/15 outline-none placeholder:text-white/40 focus:ring-2 focus:ring-[#E2C35C]" />
              <label className="sr-only" htmlFor="w-phone">
                WhatsApp
              </label>
              <input id="w-phone" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="WhatsApp com DDD" inputMode="tel" autoComplete="tel" className="h-12 w-full rounded-[14px] bg-white/[0.08] px-4 text-[16px] text-white ring-1 ring-white/15 outline-none placeholder:text-white/40 focus:ring-2 focus:ring-[#E2C35C]" />
            </div>
            {err && <p className="mt-2 rounded-[12px] bg-[#FF453A]/15 px-3 py-2 text-[13px] text-[#FF9A90]">{err}</p>}
            <button type="button" disabled={!valid || busy || spinning} onClick={go} className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-full text-[16.5px] font-black text-[#0B1A12] transition active:scale-[0.98] disabled:opacity-50" style={{ background: GOLD }}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Gift className="h-5 w-5" />} {spinning ? "Girando…" : "Girar a roleta"}
            </button>
            <p className="mt-2 text-center text-[11.5px] text-white/45">1 giro por WhatsApp. Usamos seu contato só para entregar o prêmio.</p>
          </div>
        )}

        <details className="group relative mt-4 text-[12px] text-white/55">
          <summary className="flex cursor-pointer list-none items-center justify-center gap-1 font-semibold [&::-webkit-details-marker]:hidden">
            Regulamento <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
          </summary>
          <ul className="mt-2 grid list-disc gap-1 pl-5 text-left leading-snug">
            <li>Um giro por pessoa (WhatsApp). O prêmio sorteado fica vinculado ao seu contato.</li>
            <li>Válido na compra de uma scooter da Quark Mobilidade até {until}, apresentando o código.</li>
            <li>Brindes conforme disponibilidade; cupons não são cumulativos entre si nem trocados por dinheiro.</li>
            <li>Chances: {chances().map((c) => `${c.label} ${c.pct.toLocaleString("pt-BR")}%`).join(" · ")}.</li>
          </ul>
        </details>
      </div>
    </div>,
    document.body,
  );
}

/** Botão flutuante da roleta (vira "Seu prêmio" depois do giro). */
export function WheelButton({ won, onOpen }: { won: WonPrize | null; onOpen: () => void }) {
  const p = prizeByKey(won?.prize);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx("fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full py-2 pr-4 pl-2 text-[13.5px] font-bold shadow-[0_18px_40px_-14px_rgba(0,0,0,0.6)] transition active:scale-[0.97] sm:right-6 sm:bottom-6", won ? "bg-[#0B1A12] text-white" : "text-[#0B1A12]")}
      style={won ? undefined : { background: GOLD }}
    >
      <span className={cx("grid h-9 w-9 place-items-center rounded-full", won ? "bg-white/10" : "bg-[#0B1A12] text-[#E2C35C]")}>
        <Gift className={cx("h-[18px] w-[18px]", !won && "animate-[wiggle_1.6s_ease-in-out_infinite]")} />
      </span>
      {won && p ? (
        <span className="text-left leading-tight">
          <span className="block text-[10px] font-semibold tracking-[0.12em] text-white/50 uppercase">Seu prêmio</span>
          <span className="block" style={goldText}>
            {p.kind === "cupom" ? `R$ ${p.value} OFF` : p.label.split(" com ")[0]}
          </span>
        </span>
      ) : (
        "Gire e ganhe"
      )}
      <style>{`@keyframes wiggle{0%,80%,100%{transform:rotate(0)}85%{transform:rotate(-14deg)}90%{transform:rotate(12deg)}95%{transform:rotate(-8deg)}}`}</style>
    </button>
  );
}
