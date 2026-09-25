"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Building2, CheckCircle2, Cloud, CloudOff, Copy, Database, Download, FileSignature, Link2, Percent, Trash2, Upload, UserPlus, Users, Wand2 } from "lucide-react";
import { confirmar } from "@/components/dialogo";
import { QR } from "@/components/qr";
import { Button, Card, CardHeader, cx, Field, Input, MoneyInput, NumberInput, PageHeader, Textarea } from "@/components/ui";
import { codificarConexao, conexaoAtual, salvarConexao, testarConexao } from "@/lib/backend";
import { useDados } from "@/lib/store";
import { CONFIG_PADRAO } from "@/lib/defaults";
import { hoje } from "@/lib/format";
import { brl, PERIODOS, sugerirPrecos } from "@/lib/pricing";
import type { Config, Dados } from "@/lib/types";
import { nomeDoUsuario } from "@/components/login";

/* ------------------------------------------------------------------ Nuvem */

function Nuvem() {
  const { modo, session, bancoDesatualizado } = useDados();
  const conexao = conexaoAtual();
  const [url, setUrl] = useState("");
  const [chave, setChave] = useState("");
  const [testando, setTestando] = useState(false);
  const [erro, setErro] = useState("");
  const link = conexao && typeof window !== "undefined" ? `${window.location.origin}/#conectar=${codificarConexao(conexao)}` : "";

  async function conectar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setTestando(true);
    const r = await testarConexao({ url, chave });
    setTestando(false);
    if (!r.ok) return setErro(r.erro);
    salvarConexao({ url, chave });
    toast.success("Nuvem conectada", { description: "Agora é só entrar com o seu e-mail." });
    setTimeout(() => window.location.assign("/"), 600);
  }

  if (modo === "nuvem" && conexao) {
    return (
      <Card>
        <CardHeader title="Nuvem" subtitle="Tudo salvo no banco de dados e sincronizado entre os aparelhos" icon={<Cloud className="h-[18px] w-[18px]" />} />
        <div className="grid gap-4 px-5 pb-5">
          <div className="flex items-start gap-3 rounded-2xl bg-brand-50 p-4 text-sm ring-1 ring-brand-200">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <div className="min-w-0">
              <p className="font-semibold text-brand-900">Conectado</p>
              <p className="truncate text-brand-800/80">{conexao.url.replace("https://", "")}</p>
              <p className="mt-0.5 text-brand-800/80">Você entrou como {nomeDoUsuario(session?.user)}{session?.user.user_metadata?.nome ? ` (${session.user.email})` : ""}</p>
            </div>
          </div>
          {bancoDesatualizado ? (
            <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-[13px] text-amber-900 ring-1 ring-amber-300">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <p>
                <b>Banco desatualizado.</b> No Supabase, abra <b>SQL Editor → New query</b>, cole todo o arquivo <code>supabase/schema.sql</code> do repositório e clique em <b>Run</b>. Não apaga nada. Depois recarregue o app.
              </p>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-[13px] text-ink-600">
              <CheckCircle2 className="h-4 w-4 text-brand-600" /> Banco de dados atualizado (assinatura por link, equipe e tempo real prontos)
            </p>
          )}
          {conexao.origem === "aparelho" && (
            <div className="grid gap-3 rounded-2xl p-4 ring-1 ring-ink-200 sm:grid-cols-[1fr_120px] sm:items-center">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Link2 className="h-4 w-4 text-brand-600" /> Conectar outro aparelho
                </p>
                <p className="mt-1 text-[13px] text-ink-500">Aponte a câmera do celular para o QR Code, ou mande o link. O aparelho já abre conectado; depois é só entrar com o e-mail liberado na Equipe.</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={async () => {
                    await navigator.clipboard.writeText(link).catch(() => {});
                    toast.success("Link copiado");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar link
                </Button>
              </div>
              <div className="justify-self-center rounded-xl bg-white p-2 ring-1 ring-ink-200">
                <QR texto={link} className="h-[104px] w-[104px]" />
              </div>
            </div>
          )}
          {conexao.origem === "aparelho" && (
            <Button
              variant="ghost"
              size="sm"
              className="justify-self-start text-ink-500"
              onClick={async () => {
                if (!(await confirmar({ titulo: "Desconectar este aparelho?", texto: "Os dados continuam salvos na nuvem. Este aparelho volta ao modo demonstração até conectar de novo.", ok: "Desconectar", perigo: true }))) return;
                salvarConexao(null);
                window.location.assign("/");
              }}
            >
              <CloudOff className="h-4 w-4" /> Desconectar este aparelho
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="ring-amber-300">
      <CardHeader title="Nuvem" subtitle="Hoje os dados estão só neste navegador" icon={<CloudOff className="h-[18px] w-[18px]" />} />
      <form onSubmit={conectar} className="grid gap-4 px-5 pb-5">
        <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-[13.5px] text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p>
            Conecte ao Supabase para usar em vários aparelhos e não perder nada. No Supabase, abra <b>Project Settings → API</b> e copie a <b>Project URL</b> e a chave pública (<b>anon</b> ou <b>publishable</b>).
          </p>
        </div>
        <Field label="Project URL">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://abcdxyz.supabase.co" autoComplete="off" />
        </Field>
        <Field label="Chave pública (anon / publishable)">
          <Input value={chave} onChange={(e) => setChave(e.target.value)} placeholder="eyJhbGciOi… ou sb_publishable_…" autoComplete="off" />
        </Field>
        {erro && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">{erro}</p>}
        <Button type="submit" variant="brand" loading={testando} disabled={!url || !chave}>
          <Cloud className="h-4 w-4" /> Testar e conectar
        </Button>
        <p className="text-[12px] text-ink-500">Os dados deste aparelho podem ser enviados para a nuvem logo depois de entrar.</p>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ Equipe */

function Equipe() {
  const { backend, session } = useDados();
  const [lista, setLista] = useState<string[] | null>(null);
  const [novo, setNovo] = useState("");
  const eu = session?.user.email?.toLowerCase() ?? "";
  const carregar = useCallback(() => backend.equipe().then(setLista).catch(() => setLista([])), [backend]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const email = novo.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error("E-mail inválido");
    try {
      await backend.adicionarEquipe(email);
      setNovo("");
      toast.success("Acesso liberado", { description: `${email} já pode criar a conta e entrar.` });
      carregar();
    } catch (err) {
      toast.error("Não foi possível liberar", { description: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <Card>
      <CardHeader title="Equipe" subtitle="Só estes e-mails veem e alteram os dados" icon={<Users className="h-[18px] w-[18px]" />} />
      <div className="grid gap-4 px-5 pb-5">
        <ul className="divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-200">
          {lista === null && <li className="px-4 py-3 text-sm text-ink-500">Carregando…</li>}
          {lista?.map((email) => (
            <li key={email} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="truncate">
                {email}
                {email === eu && <span className="ml-2 text-xs text-ink-400">(você)</span>}
              </span>
              {email !== eu && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remover ${email}`}
                  onClick={async () => {
                    if (!(await confirmar({ titulo: "Remover acesso?", texto: `${email} não vai mais conseguir ver nem alterar os dados.`, ok: "Remover", perigo: true }))) return;
                    await backend.removerEquipe(email);
                    carregar();
                  }}
                >
                  <Trash2 className="h-4 w-4 text-rose-600" />
                </Button>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={adicionar}>
          <Field label="Liberar acesso para" hint="Depois a pessoa abre o app, toca em “Criar conta” com este e-mail e entra.">
            <div className="flex gap-2">
              <Input type="email" value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="email@exemplo.com" />
              <Button type="submit" variant="brand">
                <UserPlus className="h-4 w-4" /> Liberar
              </Button>
            </div>
          </Field>
        </form>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ Página */

export default function Ajustes() {
  const { dados, modo, salvarConfig, salvarEquipamento, importar } = useDados();
  const [c, setC] = useState<Config>(dados.config);
  const arquivo = useRef<HTMLInputElement>(null);
  const mudou = JSON.stringify(c) !== JSON.stringify(dados.config);
  const mudouRef = useRef(mudou);
  mudouRef.current = mudou;
  // Chegou configuração nova (da nuvem ou de outro aparelho)? Só atualiza a tela se não houver edição em andamento.
  useEffect(() => {
    if (!mudouRef.current) setC(dados.config);
  }, [dados.config]);
  const set = (p: Partial<Config>) => setC((x) => ({ ...x, ...p }));

  const exemplo = sugerirPrecos(100, c);
  const porDia = PERIODOS.map((p) => exemplo[p.id] / p.dias);
  const regraOk = porDia.every((v, i) => i === 0 || v < porDia[i - 1]);

  async function salvar() {
    await salvarConfig(c);
    toast.success("Ajustes salvos");
  }

  async function aplicarPrecos() {
    if (!(await confirmar({ titulo: "Recalcular preços?", texto: `Diária, semanal e quinzenal de todos os ${dados.equipamentos.length} equipamentos serão recalculadas a partir do preço mensal de cada um. Orçamentos já feitos não mudam.`, ok: "Recalcular" }))) return;
    await salvarConfig(c);
    for (const e of dados.equipamentos) {
      const p = sugerirPrecos(e.preco_mensal, c);
      await salvarEquipamento({ ...e, preco_diaria: p.diaria, preco_semanal: p.semanal, preco_quinzenal: p.quinzenal });
    }
    toast.success("Preços atualizados");
  }

  function exportar() {
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `quark-locacoes-backup-${hoje()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importarArquivo(f?: File | null) {
    if (arquivo.current) arquivo.current.value = "";
    if (!f) return;
    try {
      const d = JSON.parse(await f.text()) as Dados;
      if (!Array.isArray(d.locacoes) || !Array.isArray(d.equipamentos)) throw new Error("Este arquivo não é um backup do Quark Locações.");
      const completo = { ...d, clientes: d.clientes ?? [], lancamentos: d.lancamentos ?? [] };
      if (
        !(await confirmar({
          titulo: "Importar backup?",
          texto: `O arquivo tem ${completo.locacoes.length} locações, ${completo.clientes.length} clientes, ${completo.equipamentos.length} equipamentos e ${completo.lancamentos.length} lançamentos.\n\nNada é apagado: o que já existe fica, e o que for repetido (mesmo cliente, mesmo equipamento) não duplica.`,
          ok: "Importar",
        }))
      )
        return;
      const r = await importar(completo);
      toast.success("Backup importado", { description: `${r.locacoes.length} locações, ${r.clientes.length} clientes, ${r.equipamentos.length} equipamentos e ${r.lancamentos.length} lançamentos novos.` });
    } catch (e) {
      toast.error("Não foi possível importar", { description: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <>
      <PageHeader title="Ajustes" subtitle="Empresa, preços, termo de locação, nuvem e equipe." />
      <div className="grid gap-5 pb-20 lg:grid-cols-2">
        <Card>
          <CardHeader title="Empresa e PIX" subtitle="Aparecem no orçamento, no termo e nas mensagens" icon={<Building2 className="h-[18px] w-[18px]" />} />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field label="Nome da empresa" className="sm:col-span-2">
              <Input value={c.empresa_nome} onChange={(e) => set({ empresa_nome: e.target.value })} />
            </Field>
            <Field label="CNPJ">
              <Input value={c.empresa_cnpj} onChange={(e) => set({ empresa_cnpj: e.target.value })} />
            </Field>
            <Field label="Telefone / WhatsApp">
              <Input value={c.empresa_telefone} onChange={(e) => set({ empresa_telefone: e.target.value })} />
            </Field>
            <Field label="Responsável (assina o termo)">
              <Input value={c.empresa_responsavel} onChange={(e) => set({ empresa_responsavel: e.target.value })} />
            </Field>
            <Field label="Cidade">
              <Input value={c.empresa_cidade} onChange={(e) => set({ empresa_cidade: e.target.value })} />
            </Field>
            <Field label="Endereço (sai no cabeçalho do termo)" className="sm:col-span-2">
              <Input value={c.empresa_endereco} onChange={(e) => set({ empresa_endereco: e.target.value })} />
            </Field>
            <Field label="Chave PIX" hint="Telefone: escreva com +55 (ex.: +5582988156223)">
              <Input value={c.empresa_pix} onChange={(e) => set({ empresa_pix: e.target.value })} />
            </Field>
            <Field label="Titular da chave PIX" hint="Nome que aparece para quem paga">
              <Input value={c.pix_titular} onChange={(e) => set({ pix_titular: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Preços e taxas" subtitle="Quanto cada plano custa em relação ao mensal" icon={<Percent className="h-[18px] w-[18px]" />} />
          <div className="px-5 pb-5">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Diária">
                <NumberInput suffix="%" digits={1} value={c.fator_diaria * 100} onChange={(v) => set({ fator_diaria: v / 100 })} />
              </Field>
              <Field label="Semana">
                <NumberInput suffix="%" digits={1} value={c.fator_semanal * 100} onChange={(v) => set({ fator_semanal: v / 100 })} />
              </Field>
              <Field label="Quinzena">
                <NumberInput suffix="%" digits={1} value={c.fator_quinzenal * 100} onChange={(v) => set({ fator_quinzenal: v / 100 })} />
              </Field>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-ink-200">
              <p className="bg-ink-50 px-4 py-2 text-[12px] font-semibold text-ink-500">Exemplo: equipamento de {brl(100)}/mês</p>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-ink-100">
                  {PERIODOS.map((p, i) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2 font-medium">{p.nome}</td>
                      <td className="tnum px-4 py-2 text-right">{brl(exemplo[p.id])}</td>
                      <td className={cx("tnum px-4 py-2 text-right", i > 0 && porDia[i] >= porDia[i - 1] ? "font-semibold text-rose-600" : "text-ink-500")}>{brl(porDia[i])}/dia</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!regraOk && <p className="mt-2 text-[12.5px] font-medium text-rose-600">Atenção: um plano mais longo está saindo mais caro por dia que um mais curto.</p>}
            <Button variant="secondary" className="mt-4 w-full" onClick={aplicarPrecos} disabled={dados.equipamentos.length === 0}>
              <Wand2 className="h-4 w-4" /> Aplicar a todos os equipamentos
            </Button>
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-ink-100 pt-4">
              <Field label="Entrega padrão">
                <MoneyInput value={c.taxa_entrega_padrao} onChange={(v) => set({ taxa_entrega_padrao: v })} />
              </Field>
              <Field label="Desmontagem">
                <NumberInput suffix="%" digits={1} value={c.taxa_desmontagem_pct} onChange={(v) => set({ taxa_desmontagem_pct: v })} />
              </Field>
              <Field label="Validade">
                <NumberInput suffix="dias" digits={0} value={c.validade_orcamento_dias} onChange={(v) => set({ validade_orcamento_dias: Math.max(1, Math.round(v)) })} />
              </Field>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Cláusulas do termo de locação"
            subtitle="Uma cláusula por linha. {empresa} e {desmontagem} são preenchidos sozinhos."
            icon={<FileSignature className="h-[18px] w-[18px]" />}
            action={
              <Button size="sm" variant="ghost" onClick={() => set({ termo_compromisso: CONFIG_PADRAO.termo_compromisso, disposicoes: CONFIG_PADRAO.disposicoes })}>
                Restaurar padrão
              </Button>
            }
          />
          <div className="grid gap-4 px-5 pb-5 lg:grid-cols-2">
            <Field label="Compromissos do locatário">
              <Textarea className="min-h-[180px]" value={c.termo_compromisso} onChange={(e) => set({ termo_compromisso: e.target.value })} />
            </Field>
            <Field label="Disposições (vencimento, coleta…)" hint="Comece com “Título: texto” para o título sair em negrito.">
              <Textarea className="min-h-[180px]" value={c.disposicoes} onChange={(e) => set({ disposicoes: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Nuvem />
        {modo === "nuvem" ? (
          <Equipe />
        ) : (
          <Card className="grid place-items-center p-6 text-center text-sm text-ink-500">
            <div>
              <Users className="mx-auto mb-2 h-6 w-6 text-ink-300" />
              A equipe (quem pode acessar) aparece aqui depois de conectar a nuvem.
            </div>
          </Card>
        )}

        <Card className="lg:col-span-2">
          <CardHeader title="Backup" subtitle="Uma cópia de tudo num arquivo, para guardar ou levar para outro lugar" icon={<Database className="h-[18px] w-[18px]" />} />
          <div className="flex flex-col gap-2 px-5 pb-5 sm:flex-row">
            <Button variant="secondary" onClick={exportar}>
              <Download className="h-4 w-4" /> Baixar backup
            </Button>
            <Button variant="secondary" onClick={() => arquivo.current?.click()}>
              <Upload className="h-4 w-4" /> Importar backup
            </Button>
            <input ref={arquivo} type="file" accept="application/json,.json" className="hidden" onChange={(e) => importarArquivo(e.target.files?.[0])} />
          </div>
        </Card>
      </div>

      {/* Barra de salvar: aparece só quando há alteração */}
      <div
        className={cx(
          "fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 transition-all duration-300 lg:bottom-6 lg:left-[calc(248px+2.5rem)] lg:right-10",
          mudou ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        )}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-ink-900 px-4 py-3 text-white shadow-lift">
          <span className="flex-1 text-sm">Alterações não salvas</span>
          <Button size="sm" variant="ghost" className="text-ink-300 hover:bg-white/10 hover:text-white" onClick={() => setC(dados.config)}>
            Descartar
          </Button>
          <Button size="sm" variant="brand" onClick={salvar}>
            Salvar ajustes
          </Button>
        </div>
      </div>
    </>
  );
}
