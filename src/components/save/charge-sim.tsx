"use client";

import { Gauge, Play, RotateCcw, Timer, Trophy, Volume2, VolumeX, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { EV } from "@/lib/capture-sims";
import { brl, fmtNum } from "@/lib/pricing";

type Phase = "idle" | "charging" | "full" | "estop" | "tripped";

const START_SOC = 20;
const REAL_SECONDS_FULL = 14; // 20% → 100% em ~14 s de animação (time-lapse)
const HAZARDS = ["Fumaça saindo perto do carregador!", "Cabo pisado e danificado no chão!", "Água acumulando na tomada do carro!", "Cheiro de queimado na garagem!"];
const KM_PER_KWH = 100 / EV.kwhPer100km;
const GAS_KM_PER_L = 10;

/** Bipe curto (Web Audio) para dar o clima de jogo. */
function useBeep(enabled: boolean) {
  const ctx = useRef<AudioContext | null>(null);
  return useCallback(
    (freq: number, ms: number, type: OscillatorType = "sine", volume = 0.08) => {
      if (!enabled || typeof window === "undefined") return;
      try {
        ctx.current ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const c = ctx.current;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(volume, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + ms / 1000);
        o.connect(g).connect(c.destination);
        o.start();
        o.stop(c.currentTime + ms / 1000);
      } catch {
        // sem áudio: segue o jogo
      }
    },
    [enabled],
  );
}

const fmtTime = (hours: number) => {
  const m = Math.round(hours * 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
};

/** Hora simulada a partir das 22:00 ("23:46"). */
const clock = (hours: number) => {
  const m = (22 * 60 + Math.round(hours * 60)) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export function ChargeSimulator({ powerKw, batteryKwh = 60, tariff = 0.95, emergencyIncluded = true }: { powerKw: number; batteryKwh?: number; tariff?: number; emergencyIncluded?: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [soc, setSoc] = useState(START_SOC);
  const [challenge, setChallenge] = useState(true);
  const [sound, setSound] = useState(true);
  const [hazard, setHazard] = useState<{ text: string; at: number } | null>(null);
  const [reaction, setReaction] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [shake, setShake] = useState(0);
  const [twist, setTwist] = useState(0);
  const [pressed, setPressed] = useState(false);
  const raf = useRef(0);
  const last = useRef(0);
  const hazardAt = useRef<number | null>(null);
  const hazardUsed = useRef(false);
  const beep = useBeep(sound);

  useEffect(() => {
    try {
      const b = Number(localStorage.getItem("save-sim-best"));
      if (b > 0) setBest(b);
    } catch {}
  }, []);

  const stopLoop = () => cancelAnimationFrame(raf.current);

  // Laço da recarga (time-lapse) + evento de risco do modo desafio.
  useEffect(() => {
    if (phase !== "charging") return;
    last.current = performance.now();
    const tick = (t: number) => {
      const dt = (t - last.current) / 1000;
      last.current = t;
      setSoc((s) => {
        const next = Math.min(100, s + (dt * (100 - START_SOC)) / REAL_SECONDS_FULL);
        if (next >= 100) {
          setPhase("full");
          beep(880, 180);
          setTimeout(() => beep(1320, 260), 180);
        }
        return next;
      });
      if (challenge && !hazardUsed.current && hazardAt.current && t >= hazardAt.current) {
        hazardUsed.current = true;
        hazardAt.current = null;
        setHazard({ text: HAZARDS[Math.floor(Math.random() * HAZARDS.length)], at: performance.now() });
        beep(660, 120, "square", 0.06);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return stopLoop;
  }, [phase, challenge, beep]);

  // Sem reação em 3 s: as proteções do S.A.V.E desligam sozinhas.
  useEffect(() => {
    if (!hazard || phase !== "charging") return;
    const id = setTimeout(() => {
      setPhase("tripped");
      setHazard(null);
      setShake((n) => n + 1);
      beep(220, 400, "sawtooth", 0.07);
    }, 3000);
    return () => clearTimeout(id);
  }, [hazard, phase, beep]);

  const start = () => {
    if (phase === "estop") return;
    if (soc >= 100) setSoc(START_SOC);
    setReaction(null);
    setHazard(null);
    hazardUsed.current = !challenge;
    hazardAt.current = challenge ? performance.now() + 2500 + Math.random() * 4000 : null;
    beep(520, 90);
    setTimeout(() => beep(780, 120), 90);
    setPhase("charging");
  };

  const emergency = () => {
    setPressed(true);
    setTimeout(() => setPressed(false), 160);
    if (phase === "estop") return;
    stopLoop();
    if (hazard) {
      const r = (performance.now() - hazard.at) / 1000;
      setReaction(r);
      if (!best || r < best) {
        setBest(r);
        try {
          localStorage.setItem("save-sim-best", String(r));
        } catch {}
      }
    } else setReaction(null);
    setHazard(null);
    hazardAt.current = null;
    setPhase("estop");
    setShake((n) => n + 1);
    beep(180, 90, "square", 0.09);
    setTimeout(() => beep(440, 500, "sawtooth", 0.05), 100);
  };

  const release = () => {
    setTwist((n) => n + 1);
    beep(300, 60, "triangle");
    setTimeout(() => setPhase("idle"), 650);
  };

  const reset = () => {
    stopLoop();
    setPhase("idle");
    setSoc(START_SOC);
    setHazard(null);
    setReaction(null);
  };

  const energy = ((soc - START_SOC) / 100) * batteryKwh;
  const hours = energy / (Math.max(0.1, powerKw) * 0.9);
  const km = energy * KM_PER_KWH;
  const cost = (energy / 0.9) * tariff;
  const gasCost = (km / GAS_KM_PER_L) * EV.gasPrice;
  const charging = phase === "charging";
  const alarm = phase === "estop" || phase === "tripped";
  const cableColor = alarm ? "#ef4444" : charging ? "#9BD373" : phase === "full" ? "#6CC690" : "#64748b";
  const rating = reaction == null ? null : reaction < 0.6 ? { t: "Reflexo de piloto", e: "🏁" } : reaction < 1.2 ? { t: "Muito seguro", e: "✅" } : { t: "Dá para melhorar", e: "⚠️" };

  return (
    <div key={shake} className={cx("relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1C1234] via-[#140d28] to-[#07060F] text-white shadow-[0_30px_70px_-30px_rgba(28,18,52,0.8)] ring-1 ring-white/10", shake > 0 && alarm && "sim-shake")}>
      {alarm && <div key={`f${shake}`} className="sim-flash pointer-events-none absolute inset-0 z-20 bg-red-600" />}
      <div className="pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full bg-[#9BD373]/15 blur-3xl" />

      {/* topo */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className={cx("h-2.5 w-2.5 rounded-full", alarm ? "bg-red-500" : charging ? "sim-led bg-[#9BD373]" : phase === "full" ? "bg-[#6CC690]" : "bg-slate-400")} />
          <p className="text-sm font-semibold">
            {phase === "idle" && "Pronto para carregar"}
            {charging && `Carregando · ${fmtNum(powerKw, powerKw % 1 ? 1 : 0)} kW`}
            {phase === "full" && "Bateria cheia! Pode sair."}
            {phase === "estop" && "PARADA DE EMERGÊNCIA ACIONADA"}
            {phase === "tripped" && "PROTEÇÃO AUTOMÁTICA ATUOU"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setChallenge((v) => !v)} disabled={charging} className={cx("rounded-full px-3 py-1 text-[11px] font-bold ring-1 transition disabled:opacity-50", challenge ? "bg-[#F3EA3B] text-[#1C1234] ring-transparent" : "text-white/60 ring-white/20")}>
            🎯 Modo desafio {challenge ? "ligado" : "desligado"}
          </button>
          <button onClick={() => setSound((v) => !v)} aria-label={sound ? "Desligar som" : "Ligar som"} className="grid h-7 w-7 place-items-center rounded-full text-white/60 ring-1 ring-white/20 hover:text-white">
            {sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="relative grid gap-0 lg:grid-cols-[1.25fr_1fr]">
        {/* cena */}
        <div className="relative flex flex-col justify-center gap-6 p-4 sm:p-6">
          {hazard && (
            <div className="sim-hazard absolute inset-x-4 top-4 z-10 rounded-2xl px-4 py-3 text-center text-[#1C1234] shadow-xl sm:inset-x-6">
              <p className="text-sm font-black tracking-wide uppercase">⚠️ {hazard.text}</p>
              <p className="text-xs font-bold">Aperte o botão de EMERGÊNCIA agora!</p>
            </div>
          )}
          <svg viewBox="0 0 640 300" className="w-full">
            <defs>
              <linearGradient id="sim-batt" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor={alarm ? "#ef4444" : "#F3EA3B"} />
                <stop offset="1" stopColor={alarm ? "#b91c1c" : "#6CC690"} />
              </linearGradient>
              <linearGradient id="sim-car" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f4f1fb" />
                <stop offset="1" stopColor="#c9c2e4" />
              </linearGradient>
            </defs>
            {/* garagem */}
            <rect x="0" y="0" width="150" height="250" fill="#ffffff" opacity="0.04" />
            <rect x="0" y="250" width="640" height="50" fill="#ffffff" opacity="0.05" />
            <line x1="0" y1="250" x2="640" y2="250" stroke="#ffffff" strokeOpacity="0.12" />
            {/* wallbox */}
            <g transform="translate(46 70)">
              <rect width="62" height="96" rx="14" fill="#232c3a" stroke="#ffffff" strokeOpacity="0.15" />
              <rect x="9" y="12" width="44" height="26" rx="5" fill="#0b1220" />
              <text x="31" y="30" textAnchor="middle" fontSize="12" fontWeight="800" fill={alarm ? "#ef4444" : "#9BD373"} fontFamily="monospace">
                {alarm ? "STOP" : `${Math.floor(soc)}%`}
              </text>
              <circle cx="31" cy="62" r="13" fill="none" stroke={cableColor} strokeWidth="3.5" className={charging ? "sim-led" : undefined} />
              <path d="M28 55 l-3 8 h5 l-3 8" stroke={cableColor} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <text x="31" y="88" textAnchor="middle" fontSize="7" fontWeight="700" fill="#ffffff" opacity="0.5" fontFamily="sans-serif">S.A.V.E</text>
            </g>
            {/* cabo */}
            <path id="sim-cable" d="M77 166 C 77 236, 240 236, 300 196" fill="none" stroke="#0b0812" strokeWidth="9" strokeLinecap="round" />
            <path d="M77 166 C 77 236, 240 236, 300 196" fill="none" stroke={cableColor} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={charging ? "8 9" : undefined} className={charging ? "lp-flow" : undefined} />
            {charging &&
              [0, 0.35, 0.7].map((d) => (
                <circle key={d} r="4" fill="#F3EA3B" className="sim-spark" style={{ offsetPath: "path('M77 166 C 77 236, 240 236, 300 196')", animationDelay: `${d}s` }} />
              ))}
            {/* carro */}
            <g transform="translate(270 112)">
              <path d="M10 112 C 12 80, 44 62, 86 58 L 190 56 C 226 56, 256 72, 278 94 L 300 99 C 312 102, 314 116, 308 124 L 16 126 Z" fill="url(#sim-car)" />
              <path d="M70 64 L 98 40 C 108 32, 122 30, 136 30 L 196 30 C 214 30, 228 40, 240 56 Z" fill="#b9b1d8" />
              <path d="M84 60 L 104 44 L 150 44 L 150 60 Z" fill="#7CC4FF" opacity="0.75" />
              <path d="M160 60 L 160 44 L 198 44 C 210 44, 220 50, 226 60 Z" fill="#7CC4FF" opacity="0.75" />
              <rect x="22" y="88" width="16" height="10" rx="3" fill={cableColor} />
              <circle cx="76" cy="126" r="24" fill="#120b24" />
              <circle cx="76" cy="126" r="10" fill="#9a97ae" />
              <circle cx="246" cy="126" r="24" fill="#120b24" />
              <circle cx="246" cy="126" r="10" fill="#9a97ae" />
            </g>
            {/* bateria */}
            <g transform="translate(360 22)">
              <rect width="200" height="58" rx="14" fill="#0b0812" stroke={alarm ? "#ef4444" : "#ffffff"} strokeOpacity={alarm ? 1 : 0.2} strokeWidth="2" />
              <rect x="200" y="19" width="10" height="20" rx="3" fill="#ffffff" opacity="0.3" />
              <rect x="6" y="6" width={Math.max(4, (188 * soc) / 100)} height="46" rx="9" fill="url(#sim-batt)" />
              <text x="100" y="38" textAnchor="middle" fontSize="20" fontWeight="900" fill="#ffffff" fontFamily="sans-serif" style={{ paintOrder: "stroke" }} stroke="#0b0812" strokeWidth="4">
                {Math.floor(soc)}%
              </text>
            </g>
          </svg>

          {/* relógio simulado + linha do tempo da bateria */}
          <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between text-[11px] font-semibold text-white/55">
              <span>🔌 <span className="hidden sm:inline">Plugou às </span>22:00</span>
              <span className="tabular-nums">
                🕒 <span className="hidden sm:inline">Agora: </span><b className="text-white">{clock(hours)}</b>
              </span>
              <span>🏁 <span className="hidden sm:inline">Pronto às </span>{clock(((100 - START_SOC) / 100) * batteryKwh / (Math.max(0.1, powerKw) * 0.9))}</span>
            </div>
            <div className="relative mt-3 h-2 rounded-full bg-white/10">
              <div className={cx("absolute inset-y-0 left-0 rounded-full", alarm ? "bg-red-500" : "bg-gradient-to-r from-[#F3EA3B] to-[#6CC690]")} style={{ width: `${soc}%` }} />
              {[START_SOC, 80, 100].map((m) => (
                <span key={m} className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded bg-white/40" style={{ left: `calc(${m}% - 1px)` }} />
              ))}
            </div>
            <div className="relative mt-1.5 h-4 text-[10px] text-white/40">
              <span className="absolute" style={{ left: `${START_SOC}%`, transform: "translateX(-50%)" }}>{START_SOC}%</span>
              <span className="absolute whitespace-nowrap" style={{ left: "80%", transform: "translateX(-50%)" }}>80%<span className="hidden sm:inline"> · ideal</span></span>
              <span className="absolute right-0">100%</span>
            </div>
          </div>
        </div>

        {/* painel */}
        <div className="relative border-t border-white/10 p-5 sm:p-6 lg:border-t-0 lg:border-l">
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: <Timer className="h-3.5 w-3.5" />, k: "Tempo de recarga", v: fmtTime(hours), s: "simulado" },
              { icon: <Zap className="h-3.5 w-3.5" />, k: "Energia na bateria", v: `${fmtNum(energy, 1)} kWh`, s: `de ${batteryKwh} kWh` },
              { icon: <Gauge className="h-3.5 w-3.5" />, k: "Autonomia ganha", v: `+${fmtNum(km, 0)} km`, s: "aprox." },
              { icon: <span className="text-[11px]">R$</span>, k: "Custo da recarga", v: brl(cost), s: `gasolina: ${brl(gasCost, 0)}` },
            ].map((x) => (
              <div key={x.k} className="rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-white/50 uppercase">
                  {x.icon} {x.k}
                </p>
                <p className="mt-1 font-display text-xl font-semibold tabular-nums">{x.v}</p>
                <p className="text-[10px] text-white/40">{x.s}</p>
              </div>
            ))}
          </div>

          {/* controles */}
          <div className="mt-5 flex items-center gap-5">
            <div className="flex flex-1 flex-col gap-2">
              {phase === "estop" ? (
                <button onClick={release} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-[#1C1234] transition hover:bg-[#F3EA3B]">
                  <RotateCcw className="h-4 w-4" /> Girar para destravar
                </button>
              ) : (
                <button
                  onClick={phase === "tripped" ? reset : start}
                  disabled={charging}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] text-sm font-bold text-[#1C1234] shadow-[0_12px_30px_-12px_rgba(243,234,59,0.7)] transition hover:brightness-105 disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                  {phase === "idle" ? (soc > START_SOC ? "Continuar recarga" : "Plugar e carregar") : phase === "full" ? "Carregar de novo" : phase === "tripped" ? "Religar o sistema" : "Carregando…"}
                </button>
              )}
              {(soc > START_SOC || phase === "full") && phase !== "charging" && (
                <button onClick={reset} className="text-[11px] font-semibold text-white/45 hover:text-white">
                  Recomeçar do zero
                </button>
              )}
            </div>

            {/* botão cogumelo */}
            <div className="flex flex-col items-center">
              <div className="relative grid h-[104px] w-[104px] place-items-center rounded-full bg-[conic-gradient(from_0deg,#facc15_0_25%,#1C1234_0_50%,#facc15_0_75%,#1C1234_0)] p-[5px] shadow-[0_10px_30px_-8px_rgba(0,0,0,0.8)]">
                <div className="grid h-full w-full place-items-center rounded-full bg-[#facc15]">
                  <button
                    key={twist}
                    onClick={emergency}
                    aria-label="Botão de emergência"
                    className={cx(
                      "h-[74px] w-[74px] rounded-full bg-[radial-gradient(circle_at_35%_30%,#ff8a8a_0%,#ef2b2b_38%,#a30d0d_100%)] text-[10px] font-black tracking-wider text-white/90 transition duration-100",
                      pressed ? "translate-y-[3px] scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_4px_10px_rgba(0,0,0,0.45)]" : "shadow-[0_8px_0_#6b0606,0_12px_18px_rgba(0,0,0,0.55),inset_0_-6px_12px_rgba(0,0,0,0.35)]",
                      phase === "estop" && "translate-y-[4px] shadow-[0_3px_0_#6b0606,inset_0_4px_10px_rgba(0,0,0,0.45)]",
                      twist > 0 && "sim-twist",
                      hazard && "ring-4 ring-white/80",
                    )}
                  >
                    STOP
                  </button>
                </div>
              </div>
              <p className="mt-2 text-[10px] font-bold tracking-[0.18em] text-[#facc15] uppercase">Emergência</p>
            </div>
          </div>

          {/* mensagem */}
          <div className="mt-4 min-h-[62px] rounded-2xl bg-white/[0.05] p-3.5 text-[13px] leading-relaxed ring-1 ring-white/10">
            {phase === "estop" && reaction != null && rating && (
              <p>
                {rating.e} <b>Você reagiu em {fmtNum(reaction, 2)} s: {rating.t}!</b> O circuito foi desligado na hora, com segurança.
                {best && <span className="block text-white/50">Seu recorde: {fmtNum(best, 2)} s</span>}
              </p>
            )}
            {phase === "estop" && reaction == null && <p>🛑 Recarga interrompida na hora. O botão fica travado até você girar para destravar, como no equipamento real.</p>}
            {phase === "tripped" && <p>🛡️ Você não apertou, mas tudo bem: as proteções do circuito do S.A.V.E (disjuntor e DR) cortaram a energia sozinhas. Segurança em dobro.</p>}
            {phase === "idle" && <p className="text-white/60">{challenge ? "Comece a recarga e fique de olho: em algum momento vai surgir um risco. Aperte a emergência o mais rápido que puder!" : "Aperte “Plugar e carregar” e veja quanto tempo o seu carregador leva. Teste o botão de emergência quando quiser."}</p>}
            {charging && !hazard && <p className="text-white/60">⚡ Energia fluindo. Cada segundo aqui representa vários minutos de recarga real.</p>}
            {charging && hazard && <p className="font-bold text-[#facc15]">Rápido! Aperte o botão vermelho!</p>}
            {phase === "full" && (
              <p>
                🔋 <b>Carro pronto!</b> {fmtTime(hours)} para ganhar <b>+{fmtNum(km, 0)} km</b> por cerca de <b>{brl(cost)}</b>. O mesmo trajeto a gasolina custaria {brl(gasCost, 0)}.
              </p>
            )}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/40">
            <Trophy className="h-3 w-3" /> {emergencyIncluded ? "O botão de emergência tipo cogumelo já está incluso no seu S.A.V.E." : "Botão de emergência tipo cogumelo disponível como opcional."}
          </p>
        </div>
      </div>
    </div>
  );
}
