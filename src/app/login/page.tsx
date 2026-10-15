"use client";

import { ArrowRight, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { cx } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

/** Capa do sistema: limpa, escura e futurista — só a marca e o acesso. */
function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">(params.get("cadastro") ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [launch, setLaunch] = useState(false);
  const allowSignup = process.env.NEXT_PUBLIC_ALLOW_SIGNUP !== "false";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const sb = supabase();
    const { error, data } =
      mode === "login"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password, options: { data: { full_name: name } } });
    setLoading(false);
    if (error) return toast.error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos" : error.message);
    if (mode === "signup" && !data.session) {
      toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail. Depois, um administrador libera o seu acesso.");
      setMode("login");
      return;
    }
    setLaunch(true);
    setTimeout(() => {
      router.replace(params.get("next") || "/");
      router.refresh();
    }, 700);
  };

  return (
    <div className="q-cover relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-[#04030A] px-5 py-10 text-white">
      {/* grade em perspectiva */}
      <div className="q-floor pointer-events-none absolute inset-x-[-50%] bottom-[-10%] h-[60%]" aria-hidden />
      {/* horizonte */}
      <div className="pointer-events-none absolute inset-x-0 top-[50%] h-px bg-gradient-to-r from-transparent via-[#9BD373]/40 to-transparent" aria-hidden />
      <div className="pointer-events-none absolute top-[50%] left-1/2 h-48 w-[70rem] max-w-[160vw] -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-[#6CC690]/[0.07] blur-3xl" aria-hidden />
      {/* poeira de luz */}
      <div className="q-stars pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      {/* vinheta */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_0%,transparent_45%,#04030A_100%)]" aria-hidden />

      <main className={cx("relative z-10 flex w-full max-w-[380px] flex-col items-center transition duration-700", launch && "scale-[1.03] opacity-0 blur-sm")}>
        {/* núcleo: símbolo em órbita */}
        <div className="relative grid h-44 w-44 place-items-center" aria-hidden>
          <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#F3EA3B,#9BD373,#6CC690,transparent_55%,transparent)] opacity-90 [mask:radial-gradient(farthest-side,transparent_calc(100%-1.5px),#000_calc(100%-1px))] q-spin" />
          <div className="absolute inset-4 rounded-full border border-white/[0.07]" />
          <div className="absolute inset-4 q-spin-rev">
            <span className="absolute -top-[3px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#F3EA3B] shadow-[0_0_12px_3px_rgba(243,234,59,0.7)]" />
          </div>
          <div className="absolute inset-9 rounded-full border border-dashed border-white/[0.08]" />
          <div className="absolute inset-12 rounded-full bg-[radial-gradient(circle_at_50%_35%,rgba(155,211,115,0.28),rgba(28,18,52,0.6)_60%,transparent_75%)] blur-[2px]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/symbol.png" alt="" className="q-breathe relative h-16 w-16 object-contain drop-shadow-[0_0_24px_rgba(155,211,115,0.45)]" draggable={false} />
        </div>

        <h1 className="mt-5 pl-[0.6em] font-display text-[13px] font-medium tracking-[0.6em] text-white/85 uppercase">
          Quark<span className="sr-only"> Energia</span>
        </h1>

        {/* acesso */}
        <form onSubmit={submit} className="mt-12 grid w-full gap-3">
          {mode === "signup" && (
            <Field>
              <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="Nome" aria-label="Nome" className={inputCls} />
            </Field>
          )}
          <Field>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="E-mail" aria-label="E-mail" className={inputCls} />
          </Field>
          <Field
            trailing={
              <button type="button" onClick={() => setShow((v) => !v)} className="grid h-10 w-10 place-items-center rounded-xl text-white/35 transition hover:text-white" aria-label={show ? "Ocultar senha" : "Mostrar senha"}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          >
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="Senha"
              aria-label="Senha"
              className={inputCls}
            />
          </Field>

          <button
            type="submit"
            disabled={loading || launch}
            aria-label={mode === "login" ? "Entrar" : "Criar conta"}
            className="group relative mt-3 flex h-14 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-white text-[15px] font-semibold tracking-wide text-[#0B0818] transition hover:shadow-[0_0_40px_-6px_rgba(155,211,115,0.65)] active:scale-[0.98] disabled:cursor-default"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-[#F3EA3B] via-[#C9E97A] to-[#6CC690] opacity-0 transition duration-500 group-hover:opacity-100" />
            <span className="relative flex items-center gap-2">
              {launch ? <Check className="h-5 w-5" /> : loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{mode === "login" ? "Entrar" : "Criar conta"} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></>}
            </span>
          </button>
        </form>

        {allowSignup && (
          <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="mt-6 text-[12px] font-medium tracking-[0.18em] text-white/30 uppercase transition hover:text-white/70">
            {mode === "login" ? "Criar conta" : "Entrar"}
          </button>
        )}
      </main>
    </div>
  );
}

const inputCls = "h-full w-full bg-transparent text-[15px] tracking-wide text-white outline-none placeholder:text-white/30";

function Field({ trailing, children }: { trailing?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="group relative flex h-14 items-center gap-2 rounded-2xl bg-white/[0.035] pr-2 pl-5 ring-1 ring-white/[0.09] backdrop-blur-xl transition focus-within:bg-white/[0.06] focus-within:ring-white/25">
      {children}
      {trailing}
      <span className="pointer-events-none absolute inset-x-5 -bottom-px h-px scale-x-0 bg-gradient-to-r from-transparent via-[#C9E97A] to-transparent transition duration-500 group-focus-within:scale-x-100" />
    </label>
  );
}
