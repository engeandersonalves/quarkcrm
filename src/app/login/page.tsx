"use client";

import { ArrowRight, Eye, EyeOff, Flame, Loader2, Lock, Mail, Rocket, Sparkles, Trophy, User } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { CharacterArt } from "@/components/avatars";
import { BrandLogo } from "@/components/app/brand";
import { PosterWall } from "@/components/app/cinematic";
import { LEVELS } from "@/lib/gamification";
import { QUOTES, SALES_TIPS, pickDaily } from "@/lib/inspiration";
import { supabase } from "@/lib/supabase/client";
import { cx } from "@/components/ui";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

const FACES = ["lobo", "chefao", "implacavel", "rainha", "tubarao"];

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
  const [q, setQ] = useState(0);
  const [greet, setGreet] = useState("Olá");
  const allowSignup = process.env.NEXT_PUBLIC_ALLOW_SIGNUP !== "false";
  const quotes = QUOTES.filter((x) => x.text.length < 90);
  const tip = pickDaily(SALES_TIPS, 1);

  // Frases girando e saudação pelo horário do aparelho.
  useEffect(() => {
    const h = new Date().getHours();
    setGreet(h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite");
    setQ(new Date().getDate() % quotes.length);
    const t = setInterval(() => setQ((i) => (i + 1) % quotes.length), 6000);
    return () => clearInterval(t);
  }, [quotes.length]);

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
    // Pequena comemoração antes de entrar.
    setLaunch(true);
    setTimeout(() => {
      router.replace(params.get("next") || "/");
      router.refresh();
    }, 900);
  };

  const quote = quotes[q];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#07060F] text-white">
      <PosterWall />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(7,6,15,0.55)_0%,rgba(7,6,15,0.88)_65%,#07060F_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#07060F]/30 via-[#07060F]/55 to-[#07060F]" />
      <div className="ios-float pointer-events-none absolute -top-40 -left-32 h-[30rem] w-[30rem] rounded-full bg-[#5B34D6]/40 blur-[120px]" />
      <div className="ios-float pointer-events-none absolute -right-32 -bottom-40 h-[30rem] w-[30rem] rounded-full bg-[#9BD373]/20 blur-[120px] [animation-delay:-4s]" />

      <div className="relative mx-auto grid min-h-dvh max-w-7xl items-center gap-10 px-5 py-8 lg:grid-cols-[1.15fr_1fr] lg:px-10">
        {/* ---------- lado inspiracional ---------- */}
        <section className="flex flex-col">
          <BrandLogo className="h-10 lg:h-12" />

          <p className="mt-10 flex items-center gap-2 text-[11px] font-bold tracking-[0.3em] text-[#F3EA3B] uppercase lg:mt-16">
            <Flame className="h-4 w-4" /> {greet}, campeão
          </p>
          <h1 className="mt-3 font-display text-[40px] leading-[1.02] font-semibold tracking-tight sm:text-6xl">
            Hoje é dia de <span className="bg-gradient-to-r from-[#F3EA3B] via-[#C7E36B] to-[#6CC690] bg-clip-text text-transparent">fechar negócio.</span>
          </h1>

          <div className="relative mt-6 min-h-[88px] max-w-xl">
            {quote && (
              <figure key={q} className="animate-fade-up">
                <blockquote className="font-serif text-xl leading-snug text-white/85 italic sm:text-2xl">“{quote.text}”</blockquote>
                <figcaption className="mt-2 text-xs tracking-[0.2em] text-white/45 uppercase">{quote.author}</figcaption>
              </figure>
            )}
          </div>

          {/* Escada do sucesso: os níveis da Arena */}
          <div className="mt-8 hidden max-w-xl lg:block">
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-white/50 uppercase">
              <Trophy className="h-3.5 w-3.5 text-[#F3EA3B]" /> Sua escalada na Arena
            </p>
            <div className="flex items-end gap-1.5">
              {LEVELS.map((l, i) => (
                <div key={l.n} className="group flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-white/[0.06] to-white/[0.14] ring-1 ring-white/10 transition group-hover:from-[#9BD373]/30 group-hover:to-[#F3EA3B]/50"
                    style={{ height: 18 + i * 12 }}
                  />
                  <span className={cx("text-center text-[10px] leading-tight font-semibold", i === LEVELS.length - 1 ? "text-[#F3EA3B]" : "text-white/55")}>{l.title}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-white/55">Cada lead, follow-up e venda vira XP. Do Estagiário ao Dono do Mundo.</p>
          </div>
        </section>

        {/* ---------- cartão de acesso ---------- */}
        <section className="animate-fade-up w-full justify-self-center lg:max-w-md lg:justify-self-end">
          <div className="relative overflow-hidden rounded-[30px] bg-white/[0.07] p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/15 backdrop-blur-2xl sm:p-8">
            <div className="pointer-events-none absolute -top-20 -right-16 h-48 w-48 rounded-full bg-[#F3EA3B]/15 blur-3xl" />
            {/* rostos da equipe (personagens) */}
            <div className="relative flex items-center">
              <div className="flex -space-x-3">
                {FACES.map((f) => (
                  <span key={f} className="block h-10 w-10 overflow-hidden rounded-full ring-[3px] ring-[#15102A]">
                    <CharacterArt id={f} className="h-full w-full" />
                  </span>
                ))}
              </div>
              <span className="ml-3 text-xs leading-tight text-white/60">
                A equipe já está
                <br />
                <b className="text-white">no jogo hoje</b>
              </span>
            </div>

            <h2 className="relative mt-6 font-display text-[28px] leading-tight font-semibold">{mode === "login" ? "Entre no jogo" : "Crie sua conta"}</h2>
            <p className="relative mt-1 text-sm text-white/60">{mode === "login" ? "Seus leads, propostas e metas te esperam." : "Cadastre-se e comece a subir de nível."}</p>

            <form onSubmit={submit} className="relative mt-6 grid gap-3">
              {mode === "signup" && (
                <Glass icon={<User className="h-4 w-4" />}>
                  <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="Seu nome" className="h-full w-full bg-transparent outline-none placeholder:text-white/35" />
                </Glass>
              )}
              <Glass icon={<Mail className="h-4 w-4" />}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="Seu e-mail"
                  className="h-full w-full bg-transparent outline-none placeholder:text-white/35"
                  aria-label="E-mail"
                />
              </Glass>
              <Glass
                icon={<Lock className="h-4 w-4" />}
                trailing={
                  <button type="button" onClick={() => setShow((v) => !v)} className="grid h-9 w-9 place-items-center rounded-lg text-white/50 hover:text-white" aria-label={show ? "Ocultar senha" : "Mostrar senha"}>
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
                  placeholder="Sua senha"
                  className="h-full w-full bg-transparent outline-none placeholder:text-white/35"
                  aria-label="Senha"
                />
              </Glass>

              <button
                type="submit"
                disabled={loading || launch}
                className={cx(
                  "relative mt-2 flex h-14 items-center justify-center gap-2 overflow-hidden rounded-2xl text-[16px] font-bold transition active:scale-[0.98] disabled:cursor-default",
                  launch ? "bg-[#9BD373] text-[#1C1234]" : "anam-shine bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] text-[#1C1234] shadow-[0_18px_40px_-14px_rgba(243,234,59,0.8)]",
                )}
              >
                {launch ? (
                  <>
                    <Rocket className="h-5 w-5 animate-bounce" /> Bora vender!
                  </>
                ) : loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {mode === "login" ? "Entrar no jogo" : "Criar minha conta"} <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>

            {allowSignup && (
              <p className="relative mt-5 text-center text-sm text-white/55">
                {mode === "login" ? "Novo na equipe?" : "Já tem conta?"}{" "}
                <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="font-semibold text-[#F3EA3B] hover:underline">
                  {mode === "login" ? "Criar conta" : "Entrar"}
                </button>
              </p>
            )}
          </div>

          {tip && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10 backdrop-blur-md">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#F3EA3B]/15 text-[#F3EA3B]">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-[0.16em] text-white/45 uppercase">Dica do dia · {tip.title}</p>
                <p className="text-[13px] leading-snug text-white/75">{tip.text}</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Glass({ icon, trailing, children }: { icon: React.ReactNode; trailing?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex h-14 items-center gap-3 rounded-2xl bg-white/[0.07] pr-2 pl-4 text-[15px] text-white ring-1 ring-white/15 transition focus-within:bg-white/[0.1] focus-within:ring-2 focus-within:ring-[#F3EA3B]">
      <span className="shrink-0 text-white/50">{icon}</span>
      {children}
      {trailing}
    </label>
  );
}
