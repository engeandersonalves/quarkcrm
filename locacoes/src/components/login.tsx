"use client";

import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/backend";
import { Logo } from "./logo";
import { Button, Field, Input } from "./ui";

const PODE_CRIAR = process.env.NEXT_PUBLIC_ALLOW_SIGNUP !== "false";

export function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [criar, setCriar] = useState(false);
  const [busy, setBusy] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const c = supabase();
      const r = criar ? await c.auth.signUp({ email, password: senha }) : await c.auth.signInWithPassword({ email, password: senha });
      if (r.error) throw r.error;
      if (criar && !r.data.session) toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível entrar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-navy-gradient relative grid min-h-dvh place-items-center overflow-hidden px-5">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="animate-fade-up relative w-full max-w-sm">
        <Logo className="mb-8 justify-center" />
        <form onSubmit={enviar} className="rounded-3xl bg-white p-6 shadow-lift">
          <h1 className="font-display text-xl font-semibold tracking-tight">{criar ? "Criar conta da equipe" : "Entrar"}</h1>
          <p className="mt-1 text-sm text-ink-500">Orçamentos, locações, estoque e financeiro.</p>
          <div className="mt-6 grid gap-4">
            <Field label="E-mail">
              <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Senha">
              <Input type="password" required minLength={6} autoComplete={criar ? "new-password" : "current-password"} value={senha} onChange={(e) => setSenha(e.target.value)} />
            </Field>
            <Button variant="brand" size="lg" loading={busy} type="submit">
              {criar ? "Criar conta" : "Entrar"}
            </Button>
          </div>
          {PODE_CRIAR && (
            <button type="button" onClick={() => setCriar((v) => !v)} className="mt-4 w-full text-center text-[13px] font-semibold text-ink-500 hover:text-ink-900">
              {criar ? "Já tenho conta" : "Criar conta"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
