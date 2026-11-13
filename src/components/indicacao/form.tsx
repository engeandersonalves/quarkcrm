"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import {
  commissionText,
  parseCommission,
  type CommissionKind,
} from "@/lib/referral";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");
const GRAD = "bg-[linear-gradient(95deg,#F3E93B_0%,#9FDB7C_45%,#4FC38A_100%)]";
const GT = `${GRAD} bg-clip-text text-transparent`;

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
const digits = (v: string) => v.replace(/\D/g, "");

/* ---------------------------------------------------------------- ícones */

const I: Record<string, ReactNode> = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  heart: (
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" />
  ),
  phone: (
    <path d="M6.5 3h3l1.5 4-2 1.3a11 11 0 0 0 6.7 6.7L17 13l4 1.5v3A2.5 2.5 0 0 1 18.5 20 16 16 0 0 1 4 5.5 2.5 2.5 0 0 1 6.5 3z" />
  ),
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  pin: (
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
  ),
  note: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  arrow: <path d="M5 12h14m-5-6 6 6-6 6" />,
  back: <path d="M19 12H5m5-6-6 6 6 6" />,
  chat: <path d="M4 19.5 5.3 15A8 8 0 1 1 9 18.7z" />,
  share: (
    <>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="8" width="17" height="4" rx="1" />
      <path d="M5 12v8h14v-8M12 8v12M12 8S10.5 3.5 8 4.5 8.5 8 12 8zm0 0s1.5-4.5 4-3.5S15.5 8 12 8z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6z" />
      <path d="m8.8 12 2.2 2.2 4.3-4.4" />
    </>
  ),
  /* telhados */
  ceramico: (
    <>
      <path d="M2.5 11 12 4l9.5 7" />
      <path d="M5 10v9.5h14V10" />
      <path d="M5 13.5c1.2 0 1.2-1 2.3-1s1.2 1 2.4 1 1.2-1 2.3-1 1.2 1 2.3 1 1.2-1 2.4-1 1.1 1 2.3 1" />
    </>
  ),
  fibro: (
    <>
      <path d="M3 10.5 12 6l9 4.5" />
      <path d="M5 10v9.5h14V10" />
      <path d="M7 8.5v3M10 7v3M14 7v3M17 8.5v3" />
    </>
  ),
  metalico: (
    <>
      <path d="M3 11 12 5l9 6" />
      <path d="M5 10v9.5h14V10" />
      <path d="M8 8.2v4.3M12 6.8v5.7M16 8.2v4.3" />
    </>
  ),
  laje: (
    <>
      <rect x="4" y="7" width="16" height="12.5" rx="1" />
      <path d="M3 7h18M8 11h2M14 11h2M8 15h2M14 15h2" />
    </>
  ),
  solo: (
    <>
      <path d="M3 20h18" />
      <path d="m6 17 3-7h9l-3 7z" />
      <path d="M9 17v3M15 17v3" />
    </>
  ),
  naosei: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" />
    </>
  ),
  /* locais */
  casa: (
    <>
      <path d="M3 11 12 4l9 7" />
      <path d="M5.5 9.5V20h13V9.5M10 20v-5h4v5" />
    </>
  ),
  comercio: (
    <>
      <path d="M4 9.5 5.5 4h13L20 9.5" />
      <path d="M4 9.5c0 1.4 1.1 2.5 2.7 2.5s2.6-1.1 2.6-2.5c0 1.4 1.1 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1 2.5 2.6 2.5S20 10.9 20 9.5" />
      <path d="M5.5 12v8h13v-8M10 20v-4.5h4V20" />
    </>
  ),
  industria: (
    <>
      <path d="M3 20V10l5 3V10l5 3V6h4l1 14z" />
      <path d="M3 20h18M7 16.5h2M12 16.5h2" />
    </>
  ),
  rural: (
    <>
      <path d="M3 20h18M4.5 20V11L9 7l4.5 4v9" />
      <path d="M7.5 20v-4h3v4M15.5 20v-6.5a2.5 2.5 0 0 1 5 0V20" />
      <path d="M17 5.5c0-1.4 1.1-2.5 2.5-2.5" />
    </>
  ),
};
function Ico({
  n,
  className,
  w = 2,
}: {
  n: string;
  className?: string;
  w?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "h-5 w-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {I[n]}
    </svg>
  );
}

/* ------------------------------------------------------------- opções */

const ROOFS = [
  {
    id: "Telhado cerâmico",
    label: "Cerâmico",
    sub: "telha de barro",
    icon: "ceramico",
  },
  {
    id: "Telhado fibrocimento",
    label: "Fibrocimento",
    sub: "tipo Brasilit",
    icon: "fibro",
  },
  {
    id: "Telhado metálico",
    label: "Metálico",
    sub: "telha de zinco/aço",
    icon: "metalico",
  },
  { id: "Laje", label: "Laje", sub: "concreto", icon: "laje" },
  { id: "Solo", label: "No chão", sub: "estrutura no solo", icon: "solo" },
  { id: "", label: "Não sei", sub: "a gente vê na visita", icon: "naosei" },
] as const;

const PLACES = [
  { id: "Residência", icon: "casa" },
  { id: "Comércio", icon: "comercio" },
  { id: "Indústria", icon: "industria" },
  { id: "Rural", icon: "rural" },
] as const;

/* --------------------------------------------------------------- campos */

function Field({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-white/80">
        <span
          className={cx(
            "grid h-7 w-7 place-items-center rounded-[9px] text-[#0A0D0B]",
            GRAD,
          )}
        >
          <Ico n={icon} className="h-4 w-4" w={2.2} />
        </span>
        {label}
        {hint && <span className="font-normal text-white/40">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}

const INPUT =
  "h-14 w-full rounded-[18px] bg-white/[0.06] px-4 text-[17px] text-white ring-1 ring-white/10 outline-none transition placeholder:text-white/30 focus:bg-white/[0.09] focus:ring-2 focus:ring-[#6FBF8E]";

function Tile({
  on,
  onClick,
  icon,
  label,
  sub,
}: {
  on: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cx(
        "relative flex flex-col items-center gap-2 rounded-[20px] p-3.5 text-center ring-1 transition active:scale-[0.97]",
        on
          ? "bg-[#0f2117] ring-2 ring-[#6FBF8E]"
          : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.07]",
      )}
    >
      {on && (
        <span className="absolute top-2 right-2 grid h-5 w-5 place-items-center rounded-full bg-[#6FBF8E] text-[#0A0D0B]">
          <Ico n="check" className="h-3 w-3" w={3.4} />
        </span>
      )}
      <span
        className={cx(
          "grid h-12 w-12 place-items-center rounded-[15px]",
          on ? cx(GRAD, "text-[#0A0D0B]") : "bg-white/[0.07] text-white/80",
        )}
      >
        <Ico n={icon} className="h-6 w-6" w={1.8} />
      </span>
      <span className="text-[14px] leading-tight font-bold">{label}</span>
      {sub && (
        <span className="-mt-1.5 text-[11px] leading-tight text-white/45">
          {sub}
        </span>
      )}
    </button>
  );
}

function CommissionBanner() {
  return (
    <div
      className={cx(
        "bf-rise relative mt-6 overflow-hidden rounded-[28px] p-[1.5px]",
        GRAD,
      )}
    >
      <div className="relative flex items-center gap-4 rounded-[27px] bg-[#0b120d] p-4 sm:p-5">
        <div className="pointer-events-none absolute -top-10 -right-8 h-36 w-36 rounded-full bg-[#9FDB7C]/25 blur-3xl" />
        <span
          className={cx(
            "grid h-14 w-14 shrink-0 place-items-center rounded-[18px] text-[#0A0D0B] shadow-[0_12px_30px_-10px_rgba(159,219,124,0.9)]",
            GRAD,
          )}
        >
          <Ico n="gift" className="h-7 w-7" w={2} />
        </span>
        <div className="relative min-w-0">
          <p className="text-[12px] font-bold tracking-[0.16em] text-[#A9DE86] uppercase">
            Indicou, fechou, ganhou
          </p>
          <p
            className={cx(
              "mt-0.5 text-[26px] leading-[1.05] font-bold tracking-[-0.03em] sm:text-[30px]",
              GT,
            )}
          >
            Você escolhe a sua comissão
          </p>
          <p className="mt-1 text-[13px] text-white/55">
            % do valor do projeto ou um valor em R$
          </p>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- tela */

interface Form {
  referrer: string;
  referrerPhone: string;
  commissionKind: CommissionKind;
  commission: string;
  name: string;
  phone: string;
  roof: string | null;
  unit: "kwh" | "brl";
  amount: string;
  place: string;
  city: string;
  notes: string;
  website: string;
}

const EMPTY: Form = {
  referrer: "",
  referrerPhone: "",
  commissionKind: "percent",
  commission: "",
  name: "",
  phone: "",
  roof: null,
  unit: "kwh",
  amount: "",
  place: "Residência",
  city: "",
  notes: "",
  website: "",
};

export function ReferralForm({
  company,
}: {
  company: { company_name: string | null; whatsapp: string | null };
}) {
  const params = useSearchParams();
  const seller = params.get("v") ?? "";
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(() => ({
    ...EMPTY,
    referrer: (params.get("i") ?? "").slice(0, 80),
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const started = useRef(Date.now());
  const brand = company.company_name || "Quark Energia";
  const commissionValue = parseCommission(f.commissionKind, f.commission);
  const commission = commissionValue
    ? commissionText(f.commissionKind, commissionValue)
    : null;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setErr(null);
    setF((s) => ({ ...s, [k]: v }));
  };

  const ok0 =
    f.referrer.trim().length >= 2 &&
    digits(f.referrerPhone).length >= 10 &&
    !!commission;
  const ok1 = f.name.trim().length >= 2 && digits(f.phone).length >= 10;
  const canNext = step === 0 ? ok0 : step === 1 ? ok1 : true;

  const next = () => {
    setErr(null);
    if (step === 0 && f.referrer.trim().length < 2)
      return setErr("Digite o seu nome.");
    if (step === 0 && digits(f.referrerPhone).length < 10)
      return setErr("Digite o seu WhatsApp com DDD para receber a comissão.");
    if (step === 0 && !commission)
      return setErr(
        f.commissionKind === "percent"
          ? "Digite a porcentagem que você quer (ex.: 3)."
          : "Digite o valor em reais que você quer (ex.: 500).",
      );
    if (step === 1 && !f.name.trim())
      return setErr("Digite o nome de quem você está indicando.");
    if (step === 1 && digits(f.phone).length < 10)
      return setErr(
        "Digite o WhatsApp com DDD para a gente falar com a pessoa.",
      );
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    setErr(null);
    setBusy(true);
    const amount = Number(f.amount.replace(/\./g, "").replace(",", "."));
    const lines = [
      `Indicação de ${f.referrer.trim()} · WhatsApp ${f.referrerPhone}`,
      `Comissão escolhida por quem indicou: ${commission}`,
      `Local de instalação: ${f.place}${f.city.trim() ? ` · ${f.city.trim()}` : ""}`,
      `Telhado: ${f.roof || "não sabe"}`,
      amount > 0
        ? `Consumo médio: ${f.unit === "kwh" ? `${amount} kWh/mês` : `conta de R$ ${amount.toLocaleString("pt-BR")}/mês`}`
        : "Consumo médio: não informado",
      f.notes.trim() ? `Informações adicionais: ${f.notes.trim()}` : "",
    ].filter(Boolean);
    try {
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name.trim(),
          phone: f.phone,
          city: f.city.trim(),
          roof_type: f.roof || "",
          consumption_kwh: f.unit === "kwh" && amount > 0 ? amount : "",
          avg_bill: f.unit === "brl" && amount > 0 ? amount : "",
          segment: "solar",
          source: "Indicação",
          temperature: "morno",
          notes: lines.join("\n"),
          owner: seller,
          website: f.website,
          elapsed: Date.now() - started.current,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Não foi possível enviar agora.");
      setDone(f.name.trim().split(/\s+/)[0]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : "Não foi possível enviar agora. Tente de novo.",
      );
    } finally {
      setBusy(false);
    }
  };

  const again = () => {
    setF((s) => ({
      ...EMPTY,
      referrer: s.referrer,
      referrerPhone: s.referrerPhone,
      commissionKind: s.commissionKind,
      commission: s.commission,
    }));
    setDone(null);
    setStep(1);
    started.current = Date.now();
  };

  const shareUrl = () => {
    const u = new URL(window.location.href);
    u.searchParams.delete("i");
    return u.toString();
  };
  const shareText = () =>
    `Oi! Conhece alguém que quer economizar na conta de luz com energia solar? Indica pela ${brand}: ${shareUrl()}`;

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#050706] pb-16 font-[family-name:var(--font-outfit)] text-white antialiased selection:bg-[#6FBF8E]/40">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(111,191,142,0.22),transparent_70%)]" />
      <header className="relative mx-auto flex max-w-xl items-center justify-between px-4 pt-5 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bf/logo.png" alt={brand} className="h-8 w-auto" />
        <span className="rounded-full bg-white/[0.07] px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-[#A9DE86] uppercase ring-1 ring-white/10">
          Indique um amigo
        </span>
      </header>

      <main className="relative mx-auto max-w-xl px-4 sm:px-6">
        {done ? (
          <section className="bf-rise pt-12 text-center">
            <span
              className={cx(
                "mx-auto grid h-20 w-20 place-items-center rounded-[26px] text-[#0A0D0B] shadow-[0_20px_60px_-15px_rgba(111,191,142,0.8)]",
                GRAD,
              )}
            >
              <Ico n="check" className="h-10 w-10" w={3} />
            </span>
            <h1 className="mt-6 text-[40px] leading-[0.95] font-bold tracking-[-0.04em] sm:text-[48px]">
              Valeu, {f.referrer.trim().split(/\s+/)[0]}!
              <br />
              <span className={GT}>Indicação recebida.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-[17px] text-white/65">
              {commission && (
                <>
                  Se {done} fechar, você recebe a comissão que escolheu:{" "}
                  <b className="text-[#A9DE86]">{commission}</b>.{" "}
                </>
              )}
              A nossa equipe vai falar com {done} pelo WhatsApp, com todo
              cuidado, e fazer um estudo gratuito de economia. A gente te avisa
              como andou.
            </p>
            <div className="mt-8 grid gap-3">
              <button
                type="button"
                onClick={again}
                className={cx(
                  "inline-flex h-14 items-center justify-center gap-2 rounded-full text-[17px] font-bold text-[#0A0D0B] shadow-[0_14px_40px_-12px_rgba(111,191,142,0.9)]",
                  GRAD,
                )}
              >
                <Ico n="heart" className="h-5 w-5" w={2.4} /> Indicar outra
                pessoa
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareText())}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-white/[0.07] text-[16px] font-bold ring-1 ring-white/10"
              >
                <Ico n="share" className="h-5 w-5" /> Compartilhar este link com
                amigos
              </a>
            </div>
          </section>
        ) : (
          <>
            {step === 0 && <CommissionBanner />}
            {commission && step > 0 && (
              <p className="mt-6 flex items-center justify-center gap-2 rounded-full bg-white/[0.05] px-4 py-2 text-[13px] font-semibold text-white/75 ring-1 ring-white/10">
                <Ico n="gift" className="h-4 w-4 text-[#A9DE86]" /> Sua
                comissão: <b className="text-[#A9DE86]">{commission}</b>
              </p>
            )}
            {step === 0 && (
              <section className="bf-rise pt-8">
                <h1 className="text-[44px] leading-[0.92] font-bold tracking-[-0.05em] sm:text-[56px]">
                  Indique quem
                  <br />
                  <span className={GT}>merece economizar.</span>
                </h1>
                <p className="mt-4 text-[17px] text-white/65">
                  Conhece alguém que paga caro na conta de luz? Leva 1 minuto:
                  você indica, a gente faz o estudo de energia solar sem custo e
                  cuida de tudo.
                </p>
                <ul className="mt-6 grid gap-2.5">
                  {[
                    [
                      "gift",
                      "Você escolhe a comissão",
                      "Se a indicação fechar, você recebe o que combinou.",
                    ],
                    [
                      "shield",
                      "Atendimento cuidadoso",
                      "Falamos com a pessoa com respeito e sem insistência.",
                    ],
                    [
                      "bolt",
                      "Estudo gratuito",
                      "Projeto sob medida, instalação e pós-venda em Maceió.",
                    ],
                  ].map(([ic, t, s]) => (
                    <li
                      key={t}
                      className="flex items-center gap-3 rounded-[20px] bg-white/[0.04] p-3.5 ring-1 ring-white/[0.07]"
                    >
                      <span
                        className={cx(
                          "grid h-11 w-11 shrink-0 place-items-center rounded-[13px] text-[#0A0D0B]",
                          GRAD,
                        )}
                      >
                        <Ico n={ic} className="h-5 w-5" w={2.2} />
                      </span>
                      <span>
                        <b className="block text-[15px] leading-tight">{t}</b>
                        <span className="text-[13px] text-white/50">{s}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* progresso */}
            <div
              className={cx(
                "flex items-center gap-2",
                step === 0 ? "mt-8" : "pt-8",
              )}
            >
              {["Você", "Indicado", "Imóvel"].map((t, k) => (
                <div key={t} className="flex-1">
                  <div
                    className={cx(
                      "h-1.5 rounded-full transition-colors",
                      k <= step ? GRAD : "bg-white/10",
                    )}
                  />
                  <p
                    className={cx(
                      "mt-1.5 text-[12px] font-semibold",
                      k === step ? "text-white" : "text-white/40",
                    )}
                  >
                    {k + 1}. {t}
                  </p>
                </div>
              ))}
            </div>

            <form
              className="mt-6 grid gap-5 rounded-[30px] bg-[#0b0f0d] p-5 ring-1 ring-white/[0.07] sm:p-7"
              onSubmit={(e) => {
                e.preventDefault();
                if (step < 2) next();
                else submit();
              }}
            >
              <input
                tabIndex={-1}
                autoComplete="off"
                value={f.website}
                onChange={(e) => set("website", e.target.value)}
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
                aria-hidden
              />

              {step === 0 && (
                <div key="s0" className="bf-rise grid gap-5">
                  <Field label="Seu nome" icon="user">
                    <input
                      id="i-referrer"
                      autoFocus
                      autoComplete="name"
                      value={f.referrer}
                      onChange={(e) => set("referrer", e.target.value)}
                      placeholder="Como podemos te chamar?"
                      maxLength={80}
                      className={INPUT}
                    />
                  </Field>
                  <Field
                    label="Seu WhatsApp"
                    icon="phone"
                    hint="para receber a comissão"
                  >
                    <input
                      inputMode="tel"
                      autoComplete="tel"
                      value={f.referrerPhone}
                      onChange={(e) =>
                        set("referrerPhone", maskPhone(e.target.value))
                      }
                      placeholder="(82) 9 0000-0000"
                      className={INPUT}
                    />
                  </Field>
                  <div>
                    <p className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-white/80">
                      <span
                        className={cx(
                          "grid h-7 w-7 place-items-center rounded-[9px] text-[#0A0D0B]",
                          GRAD,
                        )}
                      >
                        <Ico n="gift" className="h-4 w-4" w={2.2} />
                      </span>
                      Sua comissão
                      <span className="font-normal text-white/40">
                        · você escolhe
                      </span>
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ["percent", "% do projeto", "sobre o valor fechado"],
                          ["fixed", "Valor em R$", "um valor fixo"],
                        ] as const
                      ).map(([k, t, sub]) => (
                        <button
                          key={k}
                          type="button"
                          aria-pressed={f.commissionKind === k}
                          onClick={() => {
                            set("commissionKind", k);
                            set("commission", "");
                          }}
                          className={cx(
                            "relative rounded-[18px] p-3.5 text-left ring-1 transition active:scale-[0.98]",
                            f.commissionKind === k
                              ? "bg-[#0f2117] ring-2 ring-[#6FBF8E]"
                              : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.07]",
                          )}
                        >
                          {f.commissionKind === k && (
                            <span className="absolute top-2.5 right-2.5 grid h-5 w-5 place-items-center rounded-full bg-[#6FBF8E] text-[#0A0D0B]">
                              <Ico n="check" className="h-3 w-3" w={3.4} />
                            </span>
                          )}
                          <span
                            className={cx(
                              "text-[22px] leading-none font-bold",
                              f.commissionKind === k ? GT : "text-white/70",
                            )}
                          >
                            {k === "percent" ? "%" : "R$"}
                          </span>
                          <span className="mt-1.5 block text-[15px] leading-tight font-bold">
                            {t}
                          </span>
                          <span className="text-[12px] text-white/45">
                            {sub}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="relative mt-2">
                      {f.commissionKind === "fixed" && (
                        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[17px] font-semibold text-white/40">
                          R$
                        </span>
                      )}
                      <input
                        id="i-commission"
                        inputMode="decimal"
                        value={f.commission}
                        onChange={(e) =>
                          set(
                            "commission",
                            e.target.value.replace(/[^\d.,]/g, "").slice(0, 10),
                          )
                        }
                        placeholder={
                          f.commissionKind === "percent"
                            ? "Quantos %? Ex.: 3"
                            : "Quanto? Ex.: 500"
                        }
                        className={cx(
                          INPUT,
                          f.commissionKind === "fixed" ? "pl-12" : "pr-12",
                        )}
                      />
                      {f.commissionKind === "percent" && (
                        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[17px] font-semibold text-white/40">
                          %
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[12px] text-white/40">
                      Paga quando a indicação fechar contrato. A equipe confirma
                      com você.
                    </p>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div key="s1" className="bf-rise grid gap-5">
                  <p className="text-[22px] leading-tight font-bold tracking-[-0.02em]">
                    Quem você quer indicar?
                  </p>
                  <Field label="Nome do cliente" icon="heart">
                    <input
                      id="i-name"
                      autoFocus
                      autoComplete="off"
                      value={f.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="Nome de quem vai receber o estudo"
                      maxLength={120}
                      className={INPUT}
                    />
                  </Field>
                  <Field
                    label="WhatsApp do cliente"
                    icon="phone"
                    hint="com DDD"
                  >
                    <input
                      id="i-phone"
                      inputMode="tel"
                      autoComplete="off"
                      value={f.phone}
                      onChange={(e) => set("phone", maskPhone(e.target.value))}
                      placeholder="(82) 9 0000-0000"
                      className={INPUT}
                    />
                  </Field>
                </div>
              )}

              {step === 2 && (
                <div key="s2" className="bf-rise grid gap-6">
                  <div>
                    <p className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-white/80">
                      Tipo de telhado
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {ROOFS.map((r) => (
                        <Tile
                          key={r.label}
                          on={f.roof === r.id}
                          onClick={() => set("roof", r.id)}
                          icon={r.icon}
                          label={r.label}
                          sub={r.sub}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[14px] font-semibold text-white/80">
                        <span
                          className={cx(
                            "grid h-7 w-7 place-items-center rounded-[9px] text-[#0A0D0B]",
                            GRAD,
                          )}
                        >
                          <Ico n="bolt" className="h-4 w-4" w={2.2} />
                        </span>
                        Consumo médio
                      </span>
                      <div className="flex rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10">
                        {(
                          [
                            ["kwh", "kWh"],
                            ["brl", "R$ da conta"],
                          ] as const
                        ).map(([u, t]) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => set("unit", u)}
                            className={cx(
                              "h-8 rounded-full px-3 text-[13px] font-bold transition",
                              f.unit === u
                                ? "bg-[#fff] text-[#0A0D0B]"
                                : "text-white/60",
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        id="i-amount"
                        inputMode="decimal"
                        value={f.amount}
                        onChange={(e) =>
                          set(
                            "amount",
                            e.target.value.replace(/[^\d.,]/g, "").slice(0, 9),
                          )
                        }
                        placeholder={
                          f.unit === "kwh" ? "Ex.: 450" : "Ex.: 380,00"
                        }
                        className={cx(
                          INPUT,
                          f.unit === "kwh" ? "pr-28" : "pl-12",
                        )}
                      />
                      <span
                        className={cx(
                          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-[15px] font-semibold text-white/40",
                          f.unit === "kwh" ? "right-4" : "left-4",
                        )}
                      >
                        {f.unit === "kwh" ? "kWh por mês" : "R$"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px] text-white/40">
                      Se não souber, pode deixar em branco. Está na conta de
                      luz.
                    </p>
                  </div>

                  <div>
                    <p className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-white/80">
                      <span
                        className={cx(
                          "grid h-7 w-7 place-items-center rounded-[9px] text-[#0A0D0B]",
                          GRAD,
                        )}
                      >
                        <Ico n="pin" className="h-4 w-4" w={2.2} />
                      </span>
                      Local de instalação
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {PLACES.map((p) => (
                        <Tile
                          key={p.id}
                          on={f.place === p.id}
                          onClick={() => set("place", p.id)}
                          icon={p.icon}
                          label={p.id}
                        />
                      ))}
                    </div>
                    <input
                      id="i-city"
                      value={f.city}
                      onChange={(e) => set("city", e.target.value)}
                      placeholder="Cidade e bairro (ex.: Maceió, Ponta Verde)"
                      maxLength={80}
                      className={cx(INPUT, "mt-2")}
                    />
                  </div>

                  <Field label="Outras informações" icon="note" hint="opcional">
                    <textarea
                      id="i-notes"
                      value={f.notes}
                      onChange={(e) => set("notes", e.target.value)}
                      rows={3}
                      maxLength={800}
                      placeholder="Melhor horário para falar, se já pensa em energia solar, se tem carro elétrico…"
                      className={cx(
                        INPUT,
                        "h-auto resize-none py-3.5 leading-snug",
                      )}
                    />
                  </Field>
                </div>
              )}

              {err && (
                <p
                  role="alert"
                  className="rounded-[14px] bg-[#FF453A]/12 px-4 py-3 text-[14px] font-semibold text-[#FF8A80] ring-1 ring-[#FF453A]/30"
                >
                  {err}
                </p>
              )}

              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    type="button"
                    aria-label="Voltar"
                    onClick={() => setStep((s) => s - 1)}
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/[0.07] ring-1 ring-white/10"
                  >
                    <Ico n="back" className="h-5 w-5" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className={cx(
                    "inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full text-[17px] font-bold text-[#0A0D0B] transition active:scale-[0.98] disabled:opacity-60",
                    GRAD,
                    canNext
                      ? "shadow-[0_14px_40px_-12px_rgba(111,191,142,0.9)]"
                      : "opacity-70",
                  )}
                >
                  {busy
                    ? "Enviando…"
                    : step < 2
                      ? "Continuar"
                      : "Enviar indicação"}
                  {!busy && (
                    <Ico
                      n={step < 2 ? "arrow" : "heart"}
                      className="h-5 w-5"
                      w={2.4}
                    />
                  )}
                </button>
              </div>
              {step === 2 && (
                <p className="-mt-2 text-center text-[12px] text-white/40">
                  Usamos esses dados só para falar sobre energia solar com quem
                  você indicou.
                </p>
              )}
            </form>
          </>
        )}

        {company.whatsapp && (
          <p className="mt-8 text-center text-[13px] text-white/45">
            Dúvidas?{" "}
            <a
              className="font-semibold text-[#A9DE86]"
              href={`https://wa.me/${digits(company.whatsapp).length <= 11 ? `55${digits(company.whatsapp)}` : digits(company.whatsapp)}`}
              target="_blank"
              rel="noreferrer"
            >
              Fale com a {brand} no WhatsApp
            </a>
          </p>
        )}
      </main>
    </div>
  );
}
