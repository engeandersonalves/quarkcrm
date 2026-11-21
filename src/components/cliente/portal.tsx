"use client";

import {
  ArrowLeftRight,
  ArrowRight,
  Bike,
  FolderOpen,
  IdCard,
  BatteryCharging,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  Droplets,
  FileSignature,
  Gift,
  HardHat,
  Loader2,
  Lock,
  LogOut,
  MessageCircle,
  Plug,
  Share2,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { dateBr, digits } from "@/lib/br";
import { REFERRAL_BONUS, firstName, maskDocInput, maskPhoneInput, referralNotes, validDoc, warrantyStatus, type PortalCompany, type PortalResult, type PortalSale } from "@/lib/client-portal";
import { motoPhoto, vehicleName } from "@/lib/moto-sale";
import { TransferPanel } from "./transfer-panel";
import { PRINT_CSS, WalletLocked, WalletSection } from "./wallet-card";

/* ------------------------------------------------------------------ visual */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const GRAD = "linear-gradient(95deg,#1FA06A 0%,#4FC38A 40%,#9FDB7C 70%,#D8E83C 100%)";
const SESSION = "quark-portal";
const CARD = "rounded-[26px] bg-white ring-1 ring-[#0B1A12]/[0.06] shadow-[0_18px_40px_-28px_rgba(16,52,32,0.45),0_1px_2px_rgba(16,52,32,0.05)]";

const KEYFRAMES = `
@keyframes qp-up { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
@keyframes qp-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
@keyframes qp-ride { from { opacity: 0; transform: translateX(-60px) scale(.96) } to { opacity: 1; transform: none } }
@keyframes qp-ring { from { stroke-dashoffset: var(--qp-full) } }
@keyframes qp-pop { 0% { transform: scale(.6); opacity: 0 } 70% { transform: scale(1.08) } 100% { transform: scale(1); opacity: 1 } }
html, body { background: #F7F9F4 }
.qp-up { animation: qp-up .6s cubic-bezier(.2,.8,.2,1) both }
.qp-float { animation: qp-float 5s ease-in-out infinite }
.qp-ride { animation: qp-ride .9s cubic-bezier(.2,.8,.2,1) both }
.qp-pop { animation: qp-pop .5s cubic-bezier(.2,.8,.2,1) both }
@media (prefers-reduced-motion: reduce) { .qp-up,.qp-float,.qp-ride,.qp-pop { animation: none !important } }
`;

const waLink = (phone: string | null | undefined, text: string) => {
  const n = digits(phone);
  if (!n) return null;
  return `https://wa.me/${n.length <= 11 ? `55${n}` : n}?text=${encodeURIComponent(text)}`;
};

function Logo({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/mob/ic/logo.png" alt="Quark Mobilidade" className={cx("h-9 w-auto", className)} />;
}

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#F7F9F4]">
      <div className="absolute -top-56 -left-48 h-[560px] w-[560px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(126,214,150,0.32), rgba(126,214,150,0))" }} />
      <div className="absolute top-[40%] -right-56 h-[560px] w-[560px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(236,240,120,0.26), rgba(236,240,120,0))" }} />
      <div className="absolute inset-x-0 top-0 h-[5px]" style={{ background: GRAD }} />
    </div>
  );
}

/* ------------------------------------------------------------------ raiz */

type Company = { company_name: string | null; whatsapp: string | null; instagram: string | null };
type Session = { sales: PortalSale[]; company: PortalCompany | null; creds: { cpf: string; check: string } };
type WalletFlags = { google: boolean };

export function ClientPortal({ company, models, wallet }: { company: Company; models: string[]; wallet: WalletFlags }) {
  const [phase, setPhase] = useState<"restoring" | "login" | "welcome" | "home">("restoring");
  const [session, setSession] = useState<Session | null>(null);

  const login = useCallback(async (cpf: string, check: string, silent = false): Promise<string | null> => {
    try {
      const res = await fetch("/api/public/cliente", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cpf, check }) });
      const j = (await res.json().catch(() => ({ ok: false, error: "erro" }))) as PortalResult;
      if (!j.ok) return j.error;
      if (!j.sales.length) return "nao_encontrado";
      setSession({ sales: j.sales, company: j.company, creds: { cpf, check } });
      try {
        sessionStorage.setItem(SESSION, JSON.stringify({ cpf, check }));
      } catch {
        /* navegação privada: só não lembra ao recarregar */
      }
      setPhase(silent ? "home" : "welcome");
      return null;
    } catch {
      return "erro";
    }
  }, []);

  // Recarregou a página na mesma aba: entra de novo sem pedir os dados.
  useEffect(() => {
    let saved: { cpf?: string; check?: string } | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(SESSION) || "null");
    } catch {
      saved = null;
    }
    if (saved?.cpf && saved.check) login(saved.cpf, saved.check, true).then((e) => e && setPhase("login"));
    else setPhase("login");
  }, [login]);

  const logout = () => {
    try {
      sessionStorage.removeItem(SESSION);
    } catch {
      /* ignora */
    }
    setSession(null);
    setPhase("login");
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="relative min-h-dvh font-[family-name:var(--font-outfit)] text-[#0B1A12] antialiased">
      <style>{KEYFRAMES + PRINT_CSS}</style>
      <Backdrop />
      {phase === "restoring" && (
        <div className="grid min-h-dvh place-items-center">
          <Loader2 className="h-7 w-7 animate-spin text-[#1F9D55]" aria-label="Carregando" />
        </div>
      )}
      {phase === "login" && <Login company={company} onLogin={login} />}
      {phase === "welcome" && session && <Welcome sale={session.sales[0]} onDone={() => setPhase("home")} />}
      {phase === "home" && session && <Home session={session} fallback={company} models={models} wallet={wallet} onLogout={logout} />}
    </main>
  );
}

/* ------------------------------------------------------------------ login */

const ERRORS: Record<string, string> = {
  dados: "Confira o CPF e os 4 dígitos do celular.",
  nao_encontrado: "Não encontramos uma compra com esses dados. Confira o CPF e os 4 últimos dígitos do celular que você informou na compra.",
  bloqueado: "Muitas tentativas seguidas. Por segurança, aguarde 15 minutos ou fale com a gente no WhatsApp.",
  indisponivel: "A área do cliente está passando por manutenção. Tente de novo em instantes.",
  erro: "Não foi possível entrar agora. Verifique sua internet e tente de novo.",
};

function Login({ company, onLogin }: { company: Company; onLogin: (cpf: string, check: string) => Promise<string | null> }) {
  const [cpf, setCpf] = useState("");
  const [check, setCheck] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [focusPin, setFocusPin] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);
  const help = waLink(company.whatsapp, "Olá! Preciso de ajuda para acessar a área do cliente da minha scooter.");
  const docOk = validDoc(cpf);
  const ready = docOk && check.length === 4;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docOk) return setErr(digits(cpf).length < 11 ? "Digite o CPF completo." : "Esse CPF não parece válido. Confira os números.");
    if (check.length !== 4) {
      pinRef.current?.focus();
      return setErr("Digite os 4 últimos dígitos do seu celular.");
    }
    setErr(null);
    setBusy(true);
    const e2 = await onLogin(cpf, check);
    setBusy(false);
    if (e2) setErr(ERRORS[e2] ?? ERRORS.erro);
  };

  return (
    <div className="mx-auto grid min-h-dvh max-w-6xl items-center gap-6 px-5 pt-6 pb-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:px-10">
      {/* apresentação */}
      <section className="qp-up text-center lg:text-left">
        <div className="flex items-center justify-center gap-3 lg:justify-start">
          <Logo />
          <span className="rounded-full bg-[#0B1A12] px-3 py-1 text-[10.5px] font-bold tracking-[0.16em] text-white uppercase">Área do cliente</span>
        </div>
        <h1 className="mt-7 text-[40px] leading-[0.95] font-bold tracking-[-0.045em] sm:text-[54px]">
          Sua Quark,
          <br />
          na palma da mão<span className="text-[#3FBF6A]">.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-[440px] text-[16px] leading-relaxed text-[#0B1A12]/65 lg:mx-0">Contrato, manual completo e o cartão do proprietário da sua scooter. Tudo organizado, a qualquer hora.</p>
        <div className="relative mx-auto mt-4 h-[210px] max-w-[440px] sm:h-[280px] lg:mx-0">
          <div className="absolute inset-x-8 bottom-4 h-6 rounded-[50%] bg-[#0B1A12]/15 blur-xl" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mob/cappuccino-estudio.png" alt="" className="qp-float absolute inset-0 h-full w-full object-contain drop-shadow-[0_24px_24px_rgba(16,52,32,0.22)]" />
        </div>
      </section>

      {/* formulário */}
      <section className="qp-up [animation-delay:.12s]">
        <form onSubmit={submit} noValidate className={cx(CARD, "mx-auto w-full max-w-[440px] p-6 sm:p-8")}>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#EAF6EC] text-[#1F9D55]">
              <Lock className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-[19px] leading-tight font-bold tracking-[-0.02em]">Entrar</p>
              <p className="text-[13px] text-[#0B1A12]/55">Use os dados informados na compra</p>
            </div>
          </div>

          <label htmlFor="qp-cpf" className="mt-6 block text-[13px] font-semibold text-[#0B1A12]/70">
            CPF
          </label>
          <input
            id="qp-cpf"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => {
              const v = maskDocInput(e.target.value);
              setCpf(v);
              setErr(null);
              if (digits(v).length === 11 && validDoc(v)) pinRef.current?.focus();
            }}
            className={cx(
              "mt-1.5 h-14 w-full rounded-2xl bg-[#F4F7F1] px-4 text-[19px] font-semibold tracking-[0.04em] tabular-nums ring-1 transition outline-none placeholder:text-[#0B1A12]/25 focus:bg-white focus:ring-2 focus:ring-[#1F9D55]",
              cpf && !docOk && digits(cpf).length >= 11 ? "ring-[#E8432A]/50" : "ring-[#0B1A12]/[0.08]",
            )}
          />

          <label htmlFor="qp-pin" className="mt-5 block text-[13px] font-semibold text-[#0B1A12]/70">
            4 últimos dígitos do seu celular
          </label>
          <div className="relative mt-1.5" onClick={() => pinRef.current?.focus()}>
            <input
              id="qp-pin"
              ref={pinRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={check}
              onFocus={() => setFocusPin(true)}
              onBlur={() => setFocusPin(false)}
              onChange={(e) => {
                setCheck(digits(e.target.value).slice(0, 4));
                setErr(null);
              }}
              className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
              aria-describedby="qp-pin-hint"
            />
            <div className="grid grid-cols-4 gap-2.5" aria-hidden>
              {[0, 1, 2, 3].map((i) => {
                const active = focusPin && (check.length === i || (i === 3 && check.length === 4));
                return (
                  <div key={i} className={cx("grid h-14 place-items-center rounded-2xl text-[22px] font-bold tabular-nums ring-1 transition", active ? "bg-white ring-2 ring-[#1F9D55]" : check[i] ? "bg-white ring-[#0B1A12]/15" : "bg-[#F4F7F1] ring-[#0B1A12]/[0.08]")}>
                    {check[i] ?? (active ? <span className="h-6 w-[2px] animate-pulse rounded bg-[#1F9D55]" /> : "")}
                  </div>
                );
              })}
            </div>
          </div>
          <p id="qp-pin-hint" className="mt-2 text-[12px] text-[#0B1A12]/45">
            Do número de WhatsApp que você deu na compra. Ex.: (82) 9 9988-<b>7766</b>
          </p>

          <div aria-live="polite" className="min-h-[8px]">
            {err && <p className="qp-up mt-4 rounded-2xl bg-[#FDECEA] px-4 py-3 text-[13.5px] leading-snug text-[#A12A17]">{err}</p>}
          </div>

          <button
            type="submit"
            disabled={busy}
            className={cx(
              "mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-bold transition active:scale-[0.99] disabled:opacity-70",
              ready ? "bg-[#0B1A12] text-white shadow-[0_14px_30px_-14px_rgba(11,26,18,0.8)] hover:bg-[#13291c]" : "bg-[#0B1A12]/85 text-white/90",
            )}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Acessar meus documentos <ArrowRight className="h-5 w-5" /></>}
          </button>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#0B1A12]/[0.07] pt-4 text-[12.5px] text-[#0B1A12]/50">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#1F9D55]" /> Dados protegidos
            </span>
            {help && (
              <a href={help} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-semibold text-[#1F9D55] hover:underline">
                <MessageCircle className="h-4 w-4" /> Precisa de ajuda?
              </a>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ boas-vindas */

function Welcome({ sale, onDone }: { sale: PortalSale; onDone: () => void }) {
  const d = sale.data;
  const name = firstName(d.client.name);
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 py-10 text-center">
      <Logo className="qp-up" />
      <p className="qp-up mt-8 text-[13px] font-bold tracking-[0.24em] text-[#1F9D55] uppercase [animation-delay:.15s]">Bem-vindo(a) à família Quark</p>
      <h1 className="qp-up mt-2 text-[44px] leading-[0.95] font-bold tracking-[-0.045em] [animation-delay:.25s] sm:text-[56px]">
        Olá{name ? `, ${name}` : ""}<span className="text-[#3FBF6A]">!</span>
      </h1>
      <p className="qp-up mt-3 max-w-[380px] text-[16px] leading-relaxed text-[#0B1A12]/65 [animation-delay:.35s]">
        Sua <b className="text-[#0B1A12]">{vehicleName(d).replace(/^Scooter elétrica\s*/, "") || "scooter"}</b> e todos os documentos dela estão aqui.
      </p>
      <div className="relative mt-6 h-[230px] w-full max-w-[460px]">
        <div className="absolute inset-x-10 bottom-3 h-6 rounded-[50%] bg-[#0B1A12]/15 blur-xl" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={motoPhoto(d)} alt="" className="qp-ride absolute inset-0 h-full w-full object-contain drop-shadow-[0_24px_24px_rgba(16,52,32,0.22)] [animation-delay:.4s]" />
      </div>
      <button type="button" onClick={onDone} className="qp-up mt-8 flex h-14 items-center gap-2 rounded-2xl bg-[#0B1A12] px-7 text-[16px] font-bold text-white [animation-delay:.6s] hover:bg-[#13291c]">
        Ver meus documentos <ArrowRight className="h-5 w-5" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ início */

type PTab = "documento" | "scooter" | "arquivos" | "transferir" | "indique";
const PTABS: { id: PTab; label: string; icon: LucideIcon }[] = [
  { id: "documento", label: "Meu documento", icon: IdCard },
  { id: "scooter", label: "Minha scooter", icon: Bike },
  { id: "arquivos", label: "Arquivos", icon: FolderOpen },
  { id: "transferir", label: "Transferir", icon: ArrowLeftRight },
  { id: "indique", label: "Indique e ganhe", icon: Gift },
];

type DocKey = "manual" | "comprovante";
type DocState = "idle" | "busy" | "done";

function brandSettings(c: PortalCompany | null, f: Company) {
  return {
    company_name: c?.company_name || f.company_name || "Quark",
    legal_name: c?.legal_name || "",
    cnpj: c?.cnpj || "",
    whatsapp: c?.whatsapp || f.whatsapp || "",
    phone: c?.phone || "",
    instagram: c?.instagram || f.instagram || "",
    city: c?.city || "",
    address: c?.address || "",
    email: c?.email || "",
    logo_url: c?.logo_url || "",
  };
}

function Home({ session, fallback, models, wallet, onLogout }: { session: Session; fallback: Company; models: string[]; wallet: WalletFlags; onLogout: () => void }) {
  const { sales, company } = session;
  const [idx, setIdx] = useState(0);
  const sale = sales[Math.min(idx, sales.length - 1)];
  const d = sale.data;
  const brand = useMemo(() => brandSettings(company, fallback), [company, fallback]);
  const [docs, setDocs] = useState<Record<string, DocState>>({});
  const [docErr, setDocErr] = useState<string | null>(null);
  const [refer, setRefer] = useState(false);
  const [ptab, setPtab] = useState<PTab>(sales.some((x) => x.signed_at || x.status === "assinado") ? "documento" : "scooter");
  const signed = !!sale.signed_at || sale.status === "assinado";
  const w = warrantyStatus(d, new Date(), signed);
  const model = vehicleName(d).replace(/^Scooter elétrica\s*/, "") || "Scooter";
  const whats = brand.whatsapp;
  const support = waLink(whats, `Olá! Sou ${d.client.name.trim()}, cliente da scooter ${model}${d.chassis ? ` (chassi ${d.chassis})` : ""}. Preciso de ajuda.`);
  const claim = waLink(whats, `Olá! Sou ${d.client.name.trim()} e quero acionar a garantia da minha scooter ${model}${d.chassis ? `, chassi ${d.chassis}` : ""}. O problema é: `);

  const download = async (k: DocKey) => {
    const key = `${sale.id}-${k}`;
    if (docs[key] === "busy") return;
    setDocErr(null);
    setDocs((s) => ({ ...s, [key]: "busy" }));
    try {
      if (k === "manual") {
        const { downloadSaleManual } = await import("@/components/mobilidade/moto-manual");
        await downloadSaleManual(d, sale.id, brand, sale.signed_at);
      } else {
        const [{ downloadPurchaseReceipt }, { saleCompany }] = await Promise.all([import("@/components/mobilidade/purchase-receipt"), import("@/components/mobilidade/sale-docs")]);
        await downloadPurchaseReceipt(d, saleCompany(brand, null), sale.id);
      }
      setDocs((s) => ({ ...s, [key]: "done" }));
    } catch {
      setDocs((s) => ({ ...s, [key]: "idle" }));
      setDocErr("Não foi possível gerar o PDF agora. Tente de novo em instantes.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 pb-16 sm:px-6 lg:px-10">
      {/* topo */}
      <header className="flex items-center justify-between">
        <Logo className="h-8 sm:h-9" />
        <button type="button" onClick={onLogout} className="flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-[#0B1A12]/70 ring-1 ring-[#0B1A12]/[0.08] hover:text-[#0B1A12]">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </header>

      <div className="qp-up mt-7">
        <p className="text-[13px] font-semibold text-[#0B1A12]/50">Área do cliente</p>
        <h1 className="text-[32px] leading-tight font-bold tracking-[-0.04em] sm:text-[40px]">
          Olá, {firstName(d.client.name) || "cliente"}<span className="text-[#3FBF6A]">.</span>
        </h1>
      </div>

      {sales.length > 1 && (
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Suas scooters">
          {sales.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === idx}
              onClick={() => setIdx(i)}
              className={cx("h-10 shrink-0 rounded-full px-4 text-[13px] font-semibold ring-1 transition", i === idx ? "bg-[#0B1A12] text-white ring-[#0B1A12]" : "bg-white text-[#0B1A12]/70 ring-[#0B1A12]/10")}
            >
              {vehicleName(s.data).replace(/^Scooter elétrica\s*/, "") || "Scooter"} · {dateBr(s.data.date)}
            </button>
          ))}
        </div>
      )}

      {/* abas: o documento do proprietário fica em destaque */}
      <nav className="qp-up sticky top-2 z-20 mt-5 -mx-1 flex gap-1 overflow-x-auto rounded-full bg-white/80 p-1 shadow-[0_10px_30px_-20px_rgba(16,52,32,0.5)] ring-1 ring-[#0B1A12]/[0.06] backdrop-blur [scrollbar-width:none] sm:mx-0 sm:inline-flex" aria-label="Seções">
        {PTABS.map((t) => {
          const on = ptab === t.id;
          const star = t.id === "documento";
          return (
            <button
              key={t.id}
              type="button"
              onClick={(e) => {
                setPtab(t.id);
                e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              aria-current={on ? "page" : undefined}
              className={cx(
                "relative inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition",
                on ? (star ? "bg-[#0B1A12] text-[#E8D48A]" : "bg-[#0B1A12] text-white") : star ? "text-[#0B1A12]" : "text-[#0B1A12]/60 hover:text-[#0B1A12]",
              )}
              style={!on && star ? { background: "linear-gradient(95deg,#F6EFC9,#E9F6C9)" } : undefined}
            >
              <t.icon className="h-4 w-4" /> {t.label}
              {star && !on && <span className="h-1.5 w-1.5 rounded-full bg-[#C9A84A]" />}
            </button>
          );
        })}
      </nav>

      {ptab === "documento" && <div className="mx-auto mt-5 max-w-xl">{signed ? <WalletSection d={d} id={sale.id} signed={signed} company={{ name: d.contractor?.name || brand.legal_name || brand.company_name, cnpj: d.contractor?.doc || brand.cnpj }} creds={session.creds} wallet={wallet} selfie={sale.selfie ?? null} contact={brand.whatsapp ? brand.whatsapp.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3") : ""} /> : <WalletLocked token={sale.token} />}</div>}

      {ptab === "scooter" && (
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <section className="qp-up relative overflow-hidden rounded-[32px] bg-[#0B1A12] p-6 text-white [animation-delay:.05s] sm:p-7">
            <div className="absolute -top-24 -right-20 h-72 w-72 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(79,195,138,0.45), rgba(79,195,138,0))" }} />
            <div className="absolute -bottom-28 -left-16 h-72 w-72 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(228,240,74,0.18), rgba(228,240,74,0))" }} />
            <div className="relative">
              <p className="text-[11px] font-bold tracking-[0.22em] text-[#E4F04A] uppercase">Minha scooter</p>
              <h2 className="mt-1 text-[30px] leading-none font-bold tracking-[-0.04em] sm:text-[36px]">{model}</h2>
              <p className="mt-1.5 text-[13.5px] text-white/60">{[d.color, d.year].filter(Boolean).join(" · ")}</p>
              <div className="relative mt-2 h-[200px] sm:h-[240px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={motoPhoto(d)} alt={model} className="qp-ride absolute inset-0 h-full w-full object-contain drop-shadow-[0_24px_30px_rgba(0,0,0,0.5)]" />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2.5">
                {[
                  ["Chassi", d.chassis],
                  ["Motor", d.motorNo],
                  ["Compra", d.date ? dateBr(d.date) : ""],
                  ["Entrega", d.delivery.date ? dateBr(d.delivery.date) : ""],
                ].map(([k, v]) => (
                  <div key={k} className={cx("min-w-0 rounded-2xl bg-white/[0.07] px-3.5 py-2.5 ring-1 ring-white/[0.06]", k === "Chassi" && "col-span-2 sm:col-span-1")}>
                    <p className="text-[10.5px] font-semibold tracking-[0.12em] text-white/45 uppercase">{k}</p>
                    {v ? <p className="truncate text-[14px] font-semibold tracking-[0.02em] uppercase">{v}</p> : <p className="truncate text-[13px] text-white/40">informado na entrega</p>}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <WarrantyCard w={w} days={d.warrantyDays} claim={claim} />
          </div>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <section className={cx(CARD, "qp-up p-5 [animation-delay:.2s] sm:p-6")}>
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#1F9D55] uppercase">Dicas rápidas</p>
            <h2 className="text-[22px] font-bold tracking-[-0.03em]">Para a sua scooter durar mais</h2>
            <div className="-mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0">
              {TIPS.map(([I, t, s]) => (
                <div key={t as string} className="w-[200px] shrink-0 snap-start rounded-[20px] bg-[#F4F7F1] p-4 lg:w-auto">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#1F9D55] ring-1 ring-[#0B1A12]/[0.06]">
                    {(() => {
                      const Icon = I as LucideIcon;
                      return <Icon className="h-5 w-5" strokeWidth={2.2} />;
                    })()}
                  </span>
                  <p className="mt-3 text-[14px] leading-tight font-bold">{t as string}</p>
                  <p className="mt-1 text-[12.5px] leading-snug text-[#0B1A12]/60">{s as string}</p>
                </div>
              ))}
            </div>
          </section>

          {support && (
            <a href={support} target="_blank" rel="noopener noreferrer" className={cx(CARD, "qp-up group flex items-center gap-4 p-5 [animation-delay:.25s] hover:ring-[#1F9D55]/30")}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#1F9D55] text-white">
                <MessageCircle className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold">Falar com a Quark</span>
                <span className="block text-[13px] text-[#0B1A12]/55">Dúvidas, peças e assistência pelo WhatsApp</span>
              </span>
              <ChevronRight className="h-5 w-5 text-[#0B1A12]/30 transition group-hover:translate-x-0.5" />
            </a>
          )}
          </div>
        </div>
      )}

      {ptab === "arquivos" && <div className="mx-auto mt-5 grid max-w-2xl gap-5">
          <section className={cx(CARD, "qp-up p-5 [animation-delay:.1s] sm:p-6")}>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px] font-bold tracking-[0.2em] text-[#1F9D55] uppercase">Documentação</p>
                <h2 className="text-[22px] font-bold tracking-[-0.03em]">Seus documentos</h2>
              </div>
              <span className="text-[12px] text-[#0B1A12]/45">PDF · gerado na hora</span>
            </div>
            <div className="mt-4 grid gap-2.5">
              {sale.token &&
                (signed ? (
                  <DocRow icon={FileSignature} title="Contrato assinado" text={`Assinado em ${dateBr((sale.signed_at ?? sale.completed_at ?? "").slice(0, 10))}, com validade jurídica`} href={`/assinar/${sale.token}`} />
                ) : (
                  <DocRow icon={FileSignature} title="Assinar contrato" text="Falta só a sua assinatura. Leva 1 minuto, pelo celular." href={`/assinar/${sale.token}`} highlight />
                ))}
              <DocRow icon={BookOpen} title="Manual do proprietário completo" text="Uso, recarga, cuidados com a bateria, manutenção e garantia, com os números da sua scooter" state={docs[`${sale.id}-manual`]} onClick={() => download("manual")} />
            </div>
            <div aria-live="polite">{docErr && <p className="qp-up mt-3 rounded-2xl bg-[#FDECEA] px-4 py-3 text-[13px] text-[#A12A17]">{docErr}</p>}</div>
          </section>

      </div>}

      {ptab === "transferir" && <TransferPanel key={sale.id} sale={sale} creds={session.creds} whatsapp={brand.whatsapp || null} />}

      {ptab === "indique" && <div className="mx-auto mt-5 max-w-xl">
          <ReferralCard onOpen={() => setRefer(true)} />
      </div>}

      <footer className="mt-12 text-center text-[12px] leading-relaxed text-[#0B1A12]/40">
        {brand.legal_name || brand.company_name}
        {brand.cnpj ? ` · CNPJ ${brand.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}` : ""}
        <br />
        Seus documentos são gerados na hora, direto no seu aparelho.
      </footer>

      <ReferralSheet open={refer} onClose={() => setRefer(false)} sale={sale} models={models} whatsapp={whats} />
    </div>
  );
}

const TIPS: [LucideIcon, string, string][] = [
  [BatteryCharging, "Recarregue aos 20%", "Não espere a bateria zerar nem deixe descarregada por dias."],
  [Plug, "Só o carregador original", "Tomada de 3 pinos, sem extensão, em local ventilado."],
  [Thermometer, "Longe do sol forte", "Guarde em local fresco e coberto, perto de 25 °C."],
  [Droplets, "Nada de jato d'água", "Limpe com pano úmido e evite alagamentos."],
  [HardHat, "Capacete sempre", "E farol aceso à noite e em dias de chuva."],
  [Wrench, "Revise quando precisar", "Reaperto aos 300 km e revisão a cada 6 meses, onde preferir."],
];

function DocRow({ icon: I, title, text, state, onClick, href, locked, highlight }: { icon: LucideIcon; title: string; text: string; state?: DocState; onClick?: () => void; href?: string; locked?: boolean; highlight?: boolean }) {
  const inner = (
    <>
      <span className={cx("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", highlight ? "bg-[#0B1A12] text-[#E4F04A]" : locked ? "bg-[#0B1A12]/[0.05] text-[#0B1A12]/35" : "bg-[#EAF6EC] text-[#1F9D55]")}>
        <I className="h-[22px] w-[22px]" strokeWidth={2.1} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className={cx("block text-[15.5px] leading-tight font-bold", locked && "text-[#0B1A12]/45")}>{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-[#0B1A12]/55">{text}</span>
      </span>
      <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full", state === "done" ? "bg-[#1F9D55] text-white" : highlight ? "bg-[#0B1A12] text-white" : "bg-[#F4F7F1] text-[#0B1A12]/70")}>
        {locked ? (
          <Lock className="h-4 w-4 text-[#0B1A12]/35" />
        ) : state === "busy" ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin" />
        ) : state === "done" ? (
          <Check className="qp-pop h-[18px] w-[18px]" strokeWidth={3} />
        ) : href ? (
          <ArrowRight className="h-[18px] w-[18px]" />
        ) : (
          <Download className="h-[18px] w-[18px]" />
        )}
      </span>
    </>
  );
  const cls = cx(
    "flex w-full items-center gap-3.5 rounded-[20px] p-3 pr-3.5 ring-1 transition",
    highlight ? "bg-[#F1F8E8] ring-[#1F9D55]/30" : "bg-white ring-[#0B1A12]/[0.07]",
    locked ? "cursor-not-allowed" : "hover:ring-[#1F9D55]/35 active:scale-[0.995]",
  );
  if (href)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    );
  return (
    <button type="button" onClick={locked ? undefined : onClick} disabled={locked} aria-busy={state === "busy"} className={cls}>
      {inner}
    </button>
  );
}

/* ------------------------------------------------------------------ garantia */

function WarrantyCard({ w, days, claim }: { w: ReturnType<typeof warrantyStatus>; days: number; claim: string | null }) {
  const R = 46;
  const full = 2 * Math.PI * R;
  const label =
    w.state === "ativa" ? "Garantia ativa" : w.state === "aguardando" ? "Começa na entrega" : w.state === "pendente" ? "Começa na entrega" : "Garantia encerrada";
  const tone = w.state === "encerrada" ? "#9AA59E" : "#1F9D55";
  return (
    <section className={cx(CARD, "qp-up p-5 [animation-delay:.1s] sm:p-6")}>
      <div className="flex items-center gap-5">
        <div className="relative h-[116px] w-[116px] shrink-0">
          <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90" aria-hidden>
            <defs>
              <linearGradient id="qp-g" x1="0" x2="1">
                <stop offset="0" stopColor="#1FA06A" />
                <stop offset="1" stopColor="#C9E23C" />
              </linearGradient>
            </defs>
            <circle cx="55" cy="55" r={R} fill="none" stroke="#EEF2EC" strokeWidth="10" />
            <circle
              cx="55"
              cy="55"
              r={R}
              fill="none"
              stroke={w.state === "encerrada" ? tone : "url(#qp-g)"}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={full}
              strokeDashoffset={full * (1 - w.progress)}
              style={{ animation: "qp-ring 1.4s cubic-bezier(.2,.8,.2,1) both", ["--qp-full" as string]: full }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-[30px] leading-none font-bold tracking-[-0.04em] tabular-nums">{w.left}</p>
              <p className="text-[10.5px] font-semibold text-[#0B1A12]/50">{w.left === 1 ? "dia" : "dias"}</p>
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[12px] font-bold tracking-[0.14em] uppercase" style={{ color: tone }}>
            <ShieldCheck className="h-4 w-4" /> {label}
          </p>
          <p className="mt-1 text-[19px] leading-tight font-bold tracking-[-0.02em]">{days} dias contra defeitos de fabricação</p>
          <p className="mt-1 text-[13px] text-[#0B1A12]/55">{w.end ? (w.state === "encerrada" ? `Encerrou em ${dateBr(w.end)}` : `Válida até ${dateBr(w.end)}`) : "O prazo conta a partir da entrega"}</p>
        </div>
      </div>
      {claim && w.state === "ativa" && (
        <a href={claim} target="_blank" rel="noopener noreferrer" className="mt-4 flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#F4F7F1] text-[14px] font-semibold ring-1 ring-[#0B1A12]/[0.06] hover:bg-[#EAF6EC]">
          <Wrench className="h-4 w-4 text-[#1F9D55]" /> Acionar a garantia
        </a>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ indicação */

function ReferralCard({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="qp-up relative overflow-hidden rounded-[30px] p-6 text-[#0B1A12] [animation-delay:.15s] sm:p-7" style={{ background: "linear-gradient(135deg,#C9F0B2 0%,#E9F6A0 55%,#F6F3B4 100%)" }}>
      <div className="absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/40 blur-2xl" />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0B1A12] px-3 py-1 text-[11px] font-bold tracking-[0.12em] text-[#E4F04A] uppercase">
          <Gift className="h-3.5 w-3.5" /> Indique e ganhe
        </span>
        <h2 className="mt-3 text-[28px] leading-[1.02] font-bold tracking-[-0.04em] sm:text-[32px]">
          Ganhe até <span className="whitespace-nowrap">R$ {REFERRAL_BONUS}</span> por amigo indicado<span className="text-[#1F9D55]">.</span>
        </h2>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            [Share2, "Você indica"],
            [Sparkles, "Ele compra"],
            [Wallet, "Você recebe no PIX"],
          ].map(([I, t], i) => {
            const Icon = I as LucideIcon;
            return (
              <div key={t as string} className="rounded-2xl bg-white/60 px-2.5 py-3 text-center backdrop-blur-sm">
                <span className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-[#0B1A12] text-[#E4F04A]">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <p className="mt-2 text-[11px] font-bold text-[#0B1A12]/45">{i + 1}</p>
                <p className="text-[12.5px] leading-tight font-bold">{t as string}</p>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={onOpen} className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0B1A12] text-[16px] font-bold text-white shadow-[0_14px_30px_-14px_rgba(11,26,18,0.8)] hover:bg-[#13291c] active:scale-[0.99]">
          Indicar um amigo <ArrowRight className="h-5 w-5" />
        </button>
        <p className="mt-3 text-center text-[11.5px] leading-snug text-[#0B1A12]/55">O bônus é pago via PIX depois que a compra do seu amigo for concluída. Valor de até R$ {REFERRAL_BONUS}, conforme o modelo.</p>
      </div>
    </section>
  );
}

function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", esc);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-[#0B1A12]/45 backdrop-blur-[3px]" />
      <div className="qp-up relative max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[30px] bg-white px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[30px] sm:px-7 sm:pt-6">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[#0B1A12]/15 sm:hidden" />
        <button type="button" onClick={onClose} aria-label="Fechar" className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full text-[#0B1A12]/50 hover:bg-[#0B1A12]/[0.05] sm:top-4 sm:right-4">
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

const fieldCls = "mt-1.5 h-13 w-full rounded-2xl bg-[#F4F7F1] px-4 py-3.5 text-[16px] ring-1 ring-[#0B1A12]/[0.08] outline-none transition placeholder:text-[#0B1A12]/30 focus:bg-white focus:ring-2 focus:ring-[#1F9D55]";

function ReferralSheet({ open, onClose, sale, models, whatsapp }: { open: boolean; onClose: () => void; sale: PortalSale; models: string[]; whatsapp: string }) {
  const [f, setF] = useState({ name: "", phone: "", model: "", notes: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const started = useRef(Date.now());
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      started.current = Date.now();
      setTimeout(() => nameRef.current?.focus(), 80);
    }
  }, [open]);

  const reset = () => {
    setF({ name: "", phone: "", model: "", notes: "", website: "" });
    setDone(null);
    setErr(null);
  };
  const close = () => {
    onClose();
    if (done) reset();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.name.trim().length < 2) return setErr("Digite o nome do seu amigo.");
    if (digits(f.phone).length < 10) return setErr("Digite o WhatsApp com DDD.");
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name.trim(),
          phone: f.phone,
          segment: "mobilidade",
          source: "Indicação",
          temperature: "quente",
          notes: referralNotes({ referrer: sale.data.client.name, referrerPhone: sale.data.client.phone, model: f.model, notes: f.notes, saleId: sale.id }),
          website: f.website,
          elapsed: Date.now() - started.current,
        }),
      });
      if (!res.ok) throw new Error();
      setDone(firstName(f.name) || "seu amigo");
    } catch {
      setErr("Não foi possível enviar agora. Tente de novo em instantes.");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/catalogo/mobilidade`;
    const text = `Olha as scooters elétricas da Quark: comprei a minha e recomendo! ${url}`;
    try {
      if (navigator.share) return await navigator.share({ title: "Quark Mobilidade", text, url });
    } catch {
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  return (
    <Sheet open={open} onClose={close} label="Indicar um amigo">
      {done ? (
        <div className="py-6 text-center">
          <span className="qp-pop mx-auto grid h-20 w-20 place-items-center rounded-full text-[#0B1A12]" style={{ background: GRAD }}>
            <Check className="h-10 w-10" strokeWidth={3} />
          </span>
          <h3 className="mt-5 text-[26px] leading-tight font-bold tracking-[-0.03em]">Indicação enviada!</h3>
          <p className="mx-auto mt-2 max-w-[320px] text-[15px] leading-relaxed text-[#0B1A12]/60">
            Vamos falar com <b className="text-[#0B1A12]">{done}</b> com todo o cuidado. Quando a compra for concluída, você recebe até R$ {REFERRAL_BONUS} no PIX.
          </p>
          <div className="mt-6 grid gap-2.5">
            <button type="button" onClick={reset} className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#0B1A12] py-3.5 text-[15px] font-bold text-white hover:bg-[#13291c]">
              Indicar outro amigo
            </button>
            <button type="button" onClick={close} className="h-12 rounded-2xl text-[14px] font-semibold text-[#0B1A12]/60 hover:bg-[#0B1A12]/[0.04]">
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF6EC] px-3 py-1 text-[11px] font-bold tracking-[0.12em] text-[#1F9D55] uppercase">
            <Gift className="h-3.5 w-3.5" /> Até R$ {REFERRAL_BONUS} para você
          </span>
          <h3 className="mt-3 pr-8 text-[25px] leading-tight font-bold tracking-[-0.03em]">Quem você quer indicar?</h3>
          <p className="mt-1 text-[14px] text-[#0B1A12]/55">A gente entra em contato com carinho e sem insistência.</p>

          <label htmlFor="qr-name" className="mt-5 block text-[13px] font-semibold text-[#0B1A12]/70">
            Nome do amigo
          </label>
          <input id="qr-name" ref={nameRef} value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nome e sobrenome" autoComplete="off" className={fieldCls} />

          <label htmlFor="qr-phone" className="mt-4 block text-[13px] font-semibold text-[#0B1A12]/70">
            WhatsApp do amigo
          </label>
          <input id="qr-phone" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: maskPhoneInput(e.target.value) })} placeholder="(82) 9 0000-0000" autoComplete="off" className={cx(fieldCls, "tabular-nums")} />

          <p className="mt-4 text-[13px] font-semibold text-[#0B1A12]/70">Modelo que combina com ele (opcional)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...models.slice(0, 6), "Ainda não sabe"].map((m) => {
              const on = f.model === m;
              return (
                <button key={m} type="button" aria-pressed={on} onClick={() => setF({ ...f, model: on ? "" : m })} className={cx("h-10 rounded-full px-4 text-[13.5px] font-semibold ring-1 transition", on ? "bg-[#0B1A12] text-white ring-[#0B1A12]" : "bg-white text-[#0B1A12]/70 ring-[#0B1A12]/12 hover:ring-[#0B1A12]/25")}>
                  {m}
                </button>
              );
            })}
          </div>

          <label htmlFor="qr-notes" className="mt-4 block text-[13px] font-semibold text-[#0B1A12]/70">
            Algo que a gente deva saber? (opcional)
          </label>
          <textarea id="qr-notes" rows={2} maxLength={600} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Ex.: usa para ir ao trabalho, prefere falar à noite" className={cx(fieldCls, "h-auto resize-none")} />
          <input tabIndex={-1} aria-hidden autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} className="absolute -left-[9999px] h-0 w-0 opacity-0" />

          <div aria-live="polite">{err && <p className="qp-up mt-4 rounded-2xl bg-[#FDECEA] px-4 py-3 text-[13.5px] text-[#A12A17]">{err}</p>}</div>

          <button type="submit" disabled={busy} className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0B1A12] text-[16px] font-bold text-white hover:bg-[#13291c] disabled:opacity-70">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Enviar indicação <ArrowRight className="h-5 w-5" /></>}
          </button>
          <button type="button" onClick={share} className="mt-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-[#0B1A12]/65 hover:bg-[#0B1A12]/[0.04]">
            <Share2 className="h-4 w-4" /> Ou envie o catálogo para ele
          </button>
          {whatsapp && <p className="mt-1 text-center text-[11.5px] text-[#0B1A12]/40">O bônus é pago via PIX após a compra do seu amigo ser concluída.</p>}
        </form>
      )}
    </Sheet>
  );
}
