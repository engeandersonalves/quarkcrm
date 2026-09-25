"use client";

import { ArrowRight, BarChart3, FileText, Zap } from "lucide-react";
import { BrandLogo } from "@/components/app/brand";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Button, Field, Input } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { CinematicBackdrop } from "@/components/app/cinematic";
import { DEFAULT_IMAGES, pickDaily } from "@/lib/inspiration";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">(params.get("cadastro") ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
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
    router.replace(params.get("next") || "/");
    router.refresh();
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink-950 p-14 text-white lg:flex lg:flex-col">
        <CinematicBackdrop src={pickDaily(DEFAULT_IMAGES, 2)} />
        <div className="relative flex items-center gap-3">
          <BrandLogo className="h-12" />
        </div>
        <div className="relative mt-auto max-w-lg">
          <p className="text-xs tracking-[0.4em] text-[#F3EA3B] uppercase">O mundo é seu</p>
          <h1 className="mt-4 font-serif text-6xl leading-[1.02] italic">
            Propostas que <span className="text-gold not-italic">fecham negócio.</span>
          </h1>
          <p className="mt-5 text-lg text-ink-400">Orçamento preciso em segundos, proposta digital impecável e todo o funil de vendas em um só lugar.</p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              { icon: Zap, t: "Cálculo instantâneo" },
              { icon: FileText, t: "Proposta premium" },
              { icon: BarChart3, t: "Funil em tempo real" },
            ].map(({ icon: I, t }) => (
              <div key={t} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.06]">
                <I className="h-5 w-5 text-sun-400" />
                <p className="mt-3 text-sm font-medium text-ink-200">{t}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="animate-fade-up w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandLogo variant="color" className="h-11" />
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">{mode === "login" ? "Bem-vindo de volta" : "Criar conta"}</h2>
          <p className="mt-2 text-sm text-ink-500">{mode === "login" ? "Entre para acessar seus leads e propostas." : "Cadastre-se para acessar o CRM da equipe."}</p>

          <form onSubmit={submit} className="mt-8 grid gap-4">
            {mode === "signup" && (
              <Field label="Seu nome">
                <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              </Field>
            )}
            <Field label="E-mail">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </Field>
            <Field label="Senha">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </Field>
            <Button type="submit" size="lg" loading={loading} className="mt-2">
              {mode === "login" ? "Entrar" : "Criar conta"} <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          {allowSignup && (
            <p className="mt-6 text-center text-sm text-ink-500">
              {mode === "login" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
              <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="font-semibold text-ink-900 hover:text-sun-600">
                {mode === "login" ? "Criar conta" : "Entrar"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
