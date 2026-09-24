"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, MailCheck } from "lucide-react";
import { conexaoAtual, salvarConexao, supabase } from "@/lib/backend";
import { useDados } from "@/lib/store";
import { Logo } from "./logo";
import { Button, Field, Input, Modal } from "./ui";

const PODE_CRIAR = process.env.NEXT_PUBLIC_ALLOW_SIGNUP !== "false";

/** Mensagens do Supabase em português, do jeito que a pessoa entende. */
export function traduzirErroAuth(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
  if (/Email not confirmed/i.test(m)) return "Confirme seu e-mail pelo link que enviamos (veja também o spam).";
  if (/already registered|already been registered/i.test(m)) return "Este e-mail já tem conta. Use “Entrar” ou “Esqueci a senha”.";
  if (/Password should be at least/i.test(m)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/Signups not allowed|signup is disabled/i.test(m)) return "Novos cadastros estão fechados. Peça ao administrador para criar sua conta.";
  if (/rate limit|too many/i.test(m)) return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  if (/failed to fetch|network/i.test(m)) return "Sem conexão. Confira a internet.";
  if (/same.*password|different from the old/i.test(m)) return "A nova senha precisa ser diferente da anterior.";
  return m;
}

type Modo = "entrar" | "criar" | "esqueci";

export function Login() {
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const conexao = conexaoAtual();

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const c = supabase();
      if (modo === "esqueci") {
        const r = await c.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (r.error) throw r.error;
        setEnviado("Enviamos um link para criar uma nova senha. Abra o e-mail neste aparelho.");
      } else if (modo === "criar") {
        const r = await c.auth.signUp({ email: email.trim(), password: senha, options: { emailRedirectTo: window.location.origin } });
        if (r.error) throw r.error;
        if (!r.data.session) setEnviado("Conta criada! Confirme pelo link que enviamos para o seu e-mail e depois entre.");
      } else {
        const r = await c.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (r.error) throw r.error;
      }
    } catch (err) {
      toast.error(traduzirErroAuth(err));
    } finally {
      setBusy(false);
    }
  }

  const titulo = { entrar: "Entrar", criar: "Criar conta da equipe", esqueci: "Esqueci a senha" }[modo];

  return (
    <div className="bg-navy-gradient relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="animate-fade-up relative w-full max-w-sm">
        <Logo className="mb-8 justify-center" />
        {enviado ? (
          <div className="rounded-3xl bg-white p-6 text-center shadow-lift">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700">
              <MailCheck className="h-6 w-6" />
            </div>
            <p className="mt-4 font-display text-lg font-semibold">Confira seu e-mail</p>
            <p className="mt-1 text-sm text-ink-600">{enviado}</p>
            <Button
              variant="secondary"
              className="mt-5 w-full"
              onClick={() => {
                setEnviado(null);
                setModo("entrar");
              }}
            >
              Voltar para entrar
            </Button>
          </div>
        ) : (
          <form onSubmit={enviar} className="rounded-3xl bg-white p-6 shadow-lift">
            {modo !== "entrar" && (
              <button type="button" onClick={() => setModo("entrar")} className="-mt-1 mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-500 hover:text-ink-900">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </button>
            )}
            <h1 className="font-display text-xl font-semibold tracking-tight">{titulo}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {modo === "esqueci" ? "Mandamos um link para você criar uma senha nova." : modo === "criar" ? "Use o e-mail que o administrador liberou em Ajustes → Equipe." : "Orçamentos, locações, estoque e financeiro."}
            </p>
            <div className="mt-6 grid gap-4">
              <Field label="E-mail">
                <Input type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              {modo !== "esqueci" && (
                <Field
                  label={
                    <span className="flex w-full items-center justify-between">
                      Senha
                      {modo === "entrar" && (
                        <button type="button" onClick={() => setModo("esqueci")} className="text-[12.5px] font-semibold text-brand-700 hover:text-brand-800">
                          Esqueci a senha
                        </button>
                      )}
                    </span>
                  }
                >
                  <Input type="password" required minLength={6} autoComplete={modo === "criar" ? "new-password" : "current-password"} value={senha} onChange={(e) => setSenha(e.target.value)} />
                </Field>
              )}
              <Button variant="brand" size="lg" loading={busy} type="submit">
                {modo === "esqueci" ? "Enviar link" : modo === "criar" ? "Criar conta" : "Entrar"}
              </Button>
            </div>
            {PODE_CRIAR && modo === "entrar" && (
              <p className="mt-5 text-center text-[13px] text-ink-500">
                Primeira vez?{" "}
                <button type="button" onClick={() => setModo("criar")} className="font-semibold text-ink-900 hover:underline">
                  Criar conta
                </button>
              </p>
            )}
          </form>
        )}
        {conexao?.origem === "aparelho" && (
          <button
            onClick={() => {
              salvarConexao(null);
              window.location.assign("/");
            }}
            className="mx-auto mt-6 block text-[12px] text-ink-400 hover:text-ink-200"
          >
            Conectado a {conexao.url.replace("https://", "")} · desconectar este aparelho
          </button>
        )}
      </div>
    </div>
  );
}

/** Abriu pelo link de "esqueci a senha": define a senha nova. */
export function NovaSenha() {
  const { recuperandoSenha, definirSenha } = useDados();
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={recuperandoSenha} onClose={() => {}} title="Crie sua nova senha" subtitle="Você entrou pelo link do e-mail.">
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await definirSenha(senha);
            toast.success("Senha alterada");
          } catch (err) {
            toast.error(traduzirErroAuth(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Nova senha" hint="Pelo menos 6 caracteres">
          <Input type="password" required minLength={6} autoComplete="new-password" autoFocus value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Field>
        <Button type="submit" variant="brand" size="lg" loading={busy}>
          Salvar senha
        </Button>
      </form>
    </Modal>
  );
}
