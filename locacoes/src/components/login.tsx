"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, MailCheck } from "lucide-react";
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
  if (/rate limit|too many|security purposes/i.test(m)) return "O servidor pediu uma pausa depois de várias tentativas. Espere alguns minutos e tente de novo.";
  if (/failed to fetch|network/i.test(m)) return "Sem conexão. Confira a internet.";
  if (/same.*password|different from the old/i.test(m)) return "A nova senha precisa ser diferente da anterior.";
  return m;
}

/** Nome para mostrar no app (o que a pessoa digitou ao criar a conta, ou o e-mail). */
export function nomeDoUsuario(u: { email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined): string {
  const nome = typeof u?.user_metadata?.nome === "string" ? u.user_metadata.nome.trim() : "";
  return nome || u?.email || "";
}

/** Campo de senha com botão de mostrar/ocultar (evita erro de digitação no celular). */
function CampoSenha(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={ver ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-400 hover:text-ink-700"
        aria-label={ver ? "Ocultar senha" : "Mostrar senha"}
      >
        {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

type Modo = "entrar" | "criar" | "esqueci";

export function Login() {
  const [modo, setModo] = useState<Modo>("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [tentou, setTentou] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const conexao = conexaoAtual();

  // Tudo é conferido aqui antes de ir ao servidor: nenhuma tentativa é gasta à toa.
  const erros = {
    nome: modo === "criar" && nome.trim().length < 2 ? "Digite seu nome." : "",
    email: !/^\S+@\S+\.\S+$/.test(email.trim()) ? "Digite um e-mail válido." : "",
    senha: modo !== "esqueci" && senha.length < 6 ? "A senha precisa ter pelo menos 6 caracteres." : "",
    senha2: modo === "criar" && senha2 !== senha ? "As senhas não são iguais." : "",
  };
  const valido = !erros.nome && !erros.email && !erros.senha && !erros.senha2;

  function trocar(m: Modo) {
    setModo(m);
    setTentou(false);
    setSenha2("");
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setTentou(true);
    if (!valido) return;
    setBusy(true);
    const mail = email.trim().toLowerCase();
    try {
      const c = supabase();
      if (modo === "esqueci") {
        const r = await c.auth.resetPasswordForEmail(mail, { redirectTo: window.location.origin });
        if (r.error) throw r.error;
        setEnviado("Enviamos um link para criar uma nova senha. Abra o e-mail neste aparelho.");
      } else if (modo === "criar") {
        const r = await c.auth.signUp({ email: mail, password: senha, options: { emailRedirectTo: window.location.origin, data: { nome: nome.trim() } } });
        if (r.data.session) {
          toast.success(`Bem-vindo(a), ${nome.trim().split(" ")[0]}!`);
          return;
        }
        // A conta pode já existir de uma tentativa anterior: tenta entrar com a mesma senha.
        const entrar = await c.auth.signInWithPassword({ email: mail, password: senha });
        if (!entrar.error) {
          if (!entrar.data.user?.user_metadata?.nome) await c.auth.updateUser({ data: { nome: nome.trim() } }).catch(() => {});
          return;
        }
        if (/Email not confirmed/i.test(entrar.error.message)) {
          setEnviado("Sua conta foi criada. Falta só confirmar: abra o link que enviamos para o seu e-mail (veja também o spam) e depois entre.");
          return;
        }
        throw r.error ?? entrar.error;
      } else {
        const r = await c.auth.signInWithPassword({ email: mail, password: senha });
        if (r.error) throw r.error;
      }
    } catch (err) {
      toast.error(traduzirErroAuth(err));
    } finally {
      setBusy(false);
    }
  }

  const titulo = { entrar: "Entrar", criar: "Criar conta", esqueci: "Esqueci a senha" }[modo];
  const erro = (k: keyof typeof erros) => (tentou && erros[k] ? <span className="text-rose-600">{erros[k]}</span> : undefined);

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
                trocar("entrar");
              }}
            >
              Voltar para entrar
            </Button>
          </div>
        ) : (
          <form onSubmit={enviar} noValidate className="rounded-3xl bg-white p-6 shadow-lift">
            {modo !== "entrar" && (
              <button type="button" onClick={() => trocar("entrar")} className="-mt-1 mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-500 hover:text-ink-900">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </button>
            )}
            <h1 className="font-display text-xl font-semibold tracking-tight">{titulo}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {modo === "esqueci" ? "Mandamos um link para você criar uma senha nova." : modo === "criar" ? "Leva menos de um minuto." : "Orçamentos, locações, estoque e financeiro."}
            </p>
            <div className="mt-6 grid gap-4">
              {modo === "criar" && (
                <Field label="Seu nome" hint={erro("nome")}>
                  <Input required autoComplete="name" autoCapitalize="words" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Anderson Alves" />
                </Field>
              )}
              <Field label="E-mail" hint={erro("email")}>
                <Input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" required autoComplete="email" autoFocus={modo !== "criar"} value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              {modo !== "esqueci" && (
                <Field
                  label={
                    <span className="flex w-full items-center justify-between">
                      Senha
                      {modo === "entrar" && (
                        <button type="button" onClick={() => trocar("esqueci")} className="text-[12.5px] font-semibold text-brand-700 hover:text-brand-800">
                          Esqueci a senha
                        </button>
                      )}
                    </span>
                  }
                  hint={erro("senha") ?? (modo === "criar" ? "Pelo menos 6 caracteres" : undefined)}
                >
                  <CampoSenha required minLength={6} autoComplete={modo === "criar" ? "new-password" : "current-password"} value={senha} onChange={(e) => setSenha(e.target.value)} />
                </Field>
              )}
              {modo === "criar" && (
                <Field label="Confirme a senha" hint={erro("senha2") ?? (senha2 && senha2 === senha ? <span className="text-brand-700">As senhas conferem ✓</span> : undefined)}>
                  <CampoSenha required autoComplete="new-password" value={senha2} onChange={(e) => setSenha2(e.target.value)} />
                </Field>
              )}
              <Button variant="brand" size="lg" loading={busy} type="submit">
                {modo === "esqueci" ? "Enviar link" : modo === "criar" ? "Criar conta" : "Entrar"}
              </Button>
            </div>
            {PODE_CRIAR && modo === "entrar" && (
              <p className="mt-5 text-center text-[13px] text-ink-500">
                Primeira vez?{" "}
                <button type="button" onClick={() => trocar("criar")} className="font-semibold text-ink-900 hover:underline">
                  Criar conta
                </button>
              </p>
            )}
            {modo === "criar" && <p className="mt-5 text-center text-[12.5px] text-ink-400">Já tem conta? <button type="button" onClick={() => trocar("entrar")} className="font-semibold text-ink-700 hover:underline">Entrar</button></p>}
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
  const [senha2, setSenha2] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={recuperandoSenha} onClose={() => {}} title="Crie sua nova senha" subtitle="Você entrou pelo link do e-mail.">
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (senha !== senha2) return void toast.error("As senhas não são iguais.");
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
          <CampoSenha required minLength={6} autoComplete="new-password" autoFocus value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Field>
        <Field label="Confirme a nova senha">
          <CampoSenha required autoComplete="new-password" value={senha2} onChange={(e) => setSenha2(e.target.value)} />
        </Field>
        <Button type="submit" variant="brand" size="lg" loading={busy}>
          Salvar senha
        </Button>
      </form>
    </Modal>
  );
}
