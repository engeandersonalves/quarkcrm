"use client";

import { Check, Copy, KeyRound, Link2, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { levelOf } from "@/lib/gamification";
import { must, useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { Avatar, Badge, Button, Card, CardHeader, Field, Input, Modal, Select, Switch, cx } from "../ui";
import { useApp } from "./app-context";

const randomPassword = () => {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(10)), (n) => chars[n % chars.length]).join("");
};

/** Equipe: cadastro de vendedores, aprovação de acesso e papéis. */
export function TeamTab() {
  const { user, profile } = useApp();
  const isAdmin = profile?.role === "admin";
  const [origin, setOrigin] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", password: randomPassword(), role: "vendedor" });
  const [saving, setSaving] = useState(false);
  const [noKey, setNoKey] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [reset, setReset] = useState<Profile | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const { data: people, reload } = useLive(
    async () => {
      const sb = supabase();
      const [p, lb] = await Promise.all([sb.from("profiles").select("*").order("created_at"), sb.rpc("leaderboard", { p_from: "-infinity" })]);
      const xp = new Map(((lb.data ?? []) as { user_id: string; total_xp: number }[]).map((r) => [r.user_id, Number(r.total_xp)]));
      return (must(p) as Profile[]).map((x) => ({ ...x, xp: xp.get(x.id) ?? 0 }));
    },
    [],
    ["profiles"],
  );

  const signupLink = `${origin}/login?cadastro=1`;
  const pending = (people ?? []).filter((p) => p.active === false);
  const team = (people ?? []).filter((p) => p.active !== false);

  const update = async (id: string, patch: Partial<Profile>, ok: string) => {
    const { error } = await supabase().from("profiles").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(ok);
    reload();
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    setSaving(false);
    if (json?.error === "no_service_key") return setNoKey(true);
    if (!json?.ok) return toast.error(json?.message ?? "Não foi possível cadastrar");
    setCreated({ email: form.email, password: form.password });
    setForm({ full_name: "", email: "", password: randomPassword(), role: "vendedor" });
    reload();
  };

  const copy = (text: string, msg: string) => navigator.clipboard.writeText(text).then(() => toast.success(msg));

  return (
    <>
      {isAdmin && (
        <Card>
          <CardHeader icon={<UserPlus className="h-[18px] w-[18px]" />} title="Cadastrar vendedor" subtitle="O acesso já sai liberado. Envie o e-mail e a senha para a pessoa entrar." />
          <form onSubmit={create} className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field label="Nome completo">
              <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="E-mail de acesso">
              <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Senha provisória" hint="A pessoa pode trocar depois">
              <div className="flex gap-2">
                <Input required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="font-mono" />
                <Button type="button" variant="secondary" size="icon" onClick={() => setForm({ ...form, password: randomPassword() })} aria-label="Gerar outra senha">
                  <KeyRound className="h-4 w-4" />
                </Button>
              </div>
            </Field>
            <Field label="Papel">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador (gerencia a equipe e as configurações)</option>
              </Select>
            </Field>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button type="submit" loading={saving}>
                <UserPlus className="h-4 w-4" /> Cadastrar
              </Button>
              <span className="text-xs text-ink-500">ou</span>
              <Button type="button" variant="secondary" onClick={() => copy(signupLink, "Link de cadastro copiado")}>
                <Link2 className="h-4 w-4" /> Copiar link de cadastro
              </Button>
              <span className="text-xs text-ink-500">quem se cadastra pelo link aparece abaixo para você aprovar</span>
            </div>
          </form>
        </Card>
      )}

      {pending.length > 0 && (
        <Card className="ring-2 ring-sun-300">
          <CardHeader title={`Aguardando aprovação (${pending.length})`} subtitle="Só liberam o acesso quem você reconhecer. Sem aprovação, a pessoa não vê nenhum dado." />
          <div className="grid gap-2 px-5 pb-5">
            {pending.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-ink-50 p-3 ring-1 ring-ink-200/60">
                <Avatar name={p.full_name ?? p.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.full_name}</p>
                  <p className="truncate text-xs text-ink-500">{p.email}</p>
                </div>
                {isAdmin ? (
                  <Button size="sm" onClick={() => update(p.id, { active: true }, `${p.full_name ?? "Usuário"} liberado`)}>
                    <Check className="h-4 w-4" /> Liberar acesso
                  </Button>
                ) : (
                  <Badge>Pendente</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader icon={<Users className="h-[18px] w-[18px]" />} title={`Equipe (${team.length})`} subtitle={isAdmin ? "Mude o papel ou bloqueie o acesso quando alguém sair da empresa" : "Apenas administradores alteram a equipe"} />
        <div className="grid gap-2 px-5 pb-5">
          {team.map((p) => {
            const lv = levelOf(p.xp);
            const me = p.id === user.id;
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl p-3 ring-1 ring-ink-200/70">
                <Avatar name={p.full_name ?? p.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {p.full_name} {me && <span className="text-xs font-medium text-ink-400">(você)</span>}
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    {p.email} · Nível {lv.level.n} {lv.level.title} · {p.xp.toLocaleString("pt-BR")} XP
                  </p>
                </div>
                {isAdmin ? (
                  <div className="flex items-center gap-3">
                    <Select value={p.role} onChange={(e) => update(p.id, { role: e.target.value }, "Papel atualizado")} className="h-9 w-40 text-sm">
                      <option value="vendedor">Vendedor</option>
                      <option value="admin">Administrador</option>
                    </Select>
                    <Button variant="ghost" size="icon" title="Definir nova senha" onClick={() => setReset(p)}>
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    {!me && (
                      <label className="flex items-center gap-2 text-xs text-ink-500" title="Desligue para bloquear o acesso">
                        <Switch checked onChange={() => confirm(`Bloquear o acesso de ${p.full_name}? O histórico e os pontos são mantidos.`) && update(p.id, { active: false }, "Acesso bloqueado")} />
                        Ativo
                      </label>
                    )}
                  </div>
                ) : (
                  <Badge className={cx(p.role === "admin" && "bg-ink-900 text-white")}>{p.role === "admin" ? "Administrador" : "Vendedor"}</Badge>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Modal open={!!created} onClose={() => setCreated(null)} title="Vendedor cadastrado 🎉" subtitle="Envie estes dados para a pessoa entrar no app.">
        {created && (
          <div className="grid gap-3">
            <div className="rounded-xl bg-ink-50 p-4 font-mono text-sm ring-1 ring-ink-200">
              <p>Endereço: {origin}</p>
              <p>E-mail: {created.email}</p>
              <p>Senha: {created.password}</p>
            </div>
            <Button onClick={() => copy(`Seu acesso ao app ${origin}\nE-mail: ${created.email}\nSenha: ${created.password}`, "Dados copiados")}>
              <Copy className="h-4 w-4" /> Copiar e enviar pelo WhatsApp
            </Button>
          </div>
        )}
      </Modal>

      <Modal open={noKey} onClose={() => setNoKey(false)} title="Falta uma configuração" subtitle="Para criar contas direto pelo app, o servidor precisa da chave de administrador do Supabase.">
        <ol className="grid list-decimal gap-2 pl-5 text-sm text-ink-700">
          <li>
            No Supabase: <b>Project Settings → API Keys</b> → copie a chave <b>service_role</b> (ou “secret”).
          </li>
          <li>
            Na Vercel: <b>Settings → Environment Variables</b> → nome <code className="rounded bg-ink-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code>, cole a chave e salve.
          </li>
          <li>Faça um novo deploy (Deployments → ⋯ → Redeploy).</li>
        </ol>
        <p className="mt-3 flex gap-2 rounded-xl bg-sun-50 p-3 text-xs text-ink-700">
          <ShieldCheck className="h-4 w-4 shrink-0 text-sun-700" /> Essa chave é secreta: cole só na Vercel, nunca em conversas ou mensagens.
        </p>
        <p className="mt-3 text-sm text-ink-600">
          Enquanto isso, use o <b>link de cadastro</b>: a pessoa cria a conta e você libera aqui com um clique.
        </p>
        <Button className="mt-3" variant="secondary" onClick={() => copy(signupLink, "Link de cadastro copiado")}>
          <Link2 className="h-4 w-4" /> Copiar link de cadastro
        </Button>
      </Modal>

      <ResetPassword person={reset} onClose={() => setReset(null)} onNoKey={() => setNoKey(true)} />
    </>
  );
}

function ResetPassword({ person, onClose, onNoKey }: { person: Profile | null; onClose: () => void; onNoKey: () => void }) {
  const [password, setPassword] = useState(randomPassword());
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!person) return;
    setSaving(true);
    const res = await fetch("/api/team", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: person.id, password }) }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    setSaving(false);
    if (json?.error === "no_service_key") {
      onClose();
      return onNoKey();
    }
    if (!json?.ok) return toast.error(json?.message ?? "Não foi possível alterar a senha");
    await navigator.clipboard.writeText(password).catch(() => {});
    toast.success("Nova senha definida e copiada");
    onClose();
  };
  return (
    <Modal
      open={!!person}
      onClose={onClose}
      title={`Nova senha para ${person?.full_name ?? ""}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving}>
            Definir senha
          </Button>
        </>
      }
    >
      <Field label="Nova senha">
        <Input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" />
      </Field>
    </Modal>
  );
}
