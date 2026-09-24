"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Building2, Cloud, Trash2, UserPlus, Users, Database, Download, FileSignature, HardDrive, Percent, Upload, Wand2 } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, MoneyInput, NumberInput, PageHeader, Textarea } from "@/components/ui";
import { useDados } from "@/lib/store";
import { CONFIG_PADRAO } from "@/lib/defaults";
import { hoje } from "@/lib/format";
import { brl, PERIODOS, sugerirPrecos } from "@/lib/pricing";
import type { Config, Dados } from "@/lib/types";

function Equipe() {
  const { backend, session } = useDados();
  const [lista, setLista] = useState<string[]>([]);
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
      toast.error("Não foi possível adicionar", { description: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader title="Equipe" subtitle="Só estes e-mails conseguem ver e alterar os dados" icon={<Users className="h-[18px] w-[18px]" />} />
      <div className="grid gap-4 px-5 pb-5 lg:grid-cols-2">
        <ul className="divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-200">
          {lista.map((email) => (
            <li key={email} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="truncate">
                {email}
                {email === eu && <span className="ml-2 text-xs text-ink-400">(você)</span>}
              </span>
              {email !== eu && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remover"
                  onClick={async () => {
                    if (!confirm(`Remover o acesso de ${email}?`)) return;
                    await backend.removerEquipe(email);
                    carregar();
                  }}
                >
                  <Trash2 className="h-4 w-4 text-rose-600" />
                </Button>
              )}
            </li>
          ))}
          {lista.length === 0 && <li className="px-4 py-3 text-sm text-ink-500">Carregando…</li>}
        </ul>
        <form onSubmit={adicionar} className="flex flex-col gap-2">
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

export default function Ajustes() {
  const { dados, modo, salvarConfig, salvarEquipamento, importar } = useDados();
  const [c, setC] = useState<Config>(dados.config);
  const [busy, setBusy] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  useEffect(() => setC(dados.config), [dados.config]);
  const set = (p: Partial<Config>) => setC((x) => ({ ...x, ...p }));
  const mudou = JSON.stringify(c) !== JSON.stringify(dados.config);

  async function salvar() {
    setBusy(true);
    try {
      await salvarConfig(c);
      toast.success("Ajustes salvos");
    } catch (e) {
      toast.error("Erro ao salvar", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function aplicarPrecos() {
    if (!confirm("Recalcular diária, semanal e quinzenal de TODOS os equipamentos a partir do preço mensal de cada um?")) return;
    await salvarConfig(c);
    for (const e of dados.equipamentos) {
      const p = sugerirPrecos(e.preco_mensal, c);
      await salvarEquipamento({ ...e, preco_diaria: p.diaria, preco_semanal: p.semanal, preco_quinzenal: p.quinzenal });
    }
    toast.success("Preços atualizados", { description: "Orçamentos já feitos mantêm os preços da época." });
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
    if (!f) return;
    try {
      const d = JSON.parse(await f.text()) as Dados;
      if (!Array.isArray(d.locacoes) || !Array.isArray(d.equipamentos)) throw new Error("Arquivo inválido");
      if (!confirm(`Importar ${d.equipamentos.length} equipamentos, ${d.clientes?.length ?? 0} clientes, ${d.locacoes.length} locações e ${d.lancamentos?.length ?? 0} lançamentos? Registros com o mesmo código serão substituídos.`)) return;
      await importar({ ...d, clientes: d.clientes ?? [], lancamentos: d.lancamentos ?? [] });
      toast.success("Backup importado");
    } catch (e) {
      toast.error("Não foi possível importar", { description: e instanceof Error ? e.message : String(e) });
    }
  }

  const exemplo = sugerirPrecos(100, c);

  return (
    <>
      <PageHeader
        title="Ajustes"
        subtitle="Dados da empresa, regras de preço e textos do termo."
        actions={
          <Button variant="brand" loading={busy} disabled={!mudou} onClick={salvar}>
            Salvar ajustes
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Empresa" subtitle="Aparece no orçamento e no termo de locação" icon={<Building2 className="h-[18px] w-[18px]" />} />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field label="Nome" className="sm:col-span-2">
              <Input value={c.empresa_nome} onChange={(e) => set({ empresa_nome: e.target.value })} />
            </Field>
            <Field label="CNPJ">
              <Input value={c.empresa_cnpj} onChange={(e) => set({ empresa_cnpj: e.target.value })} />
            </Field>
            <Field label="Telefone / WhatsApp">
              <Input value={c.empresa_telefone} onChange={(e) => set({ empresa_telefone: e.target.value })} />
            </Field>
            <Field label="Chave PIX" hint="Telefone com +55, ex.: +5582988156223">
              <Input value={c.empresa_pix} onChange={(e) => set({ empresa_pix: e.target.value })} />
            </Field>
            <Field label="Titular da chave PIX" hint="Vai no QR Code de pagamento do termo">
              <Input value={c.pix_titular} onChange={(e) => set({ pix_titular: e.target.value })} />
            </Field>
            <Field label="Cidade (PIX e assinatura)">
              <Input value={c.empresa_cidade} onChange={(e) => set({ empresa_cidade: e.target.value })} />
            </Field>
            <Field label="Responsável (assina o termo)">
              <Input value={c.empresa_responsavel} onChange={(e) => set({ empresa_responsavel: e.target.value })} />
            </Field>
            <Field label="Endereço / cidade" className="sm:col-span-2">
              <Input value={c.empresa_endereco} onChange={(e) => set({ empresa_endereco: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Regra de preços" subtitle="Quanto cada plano custa em relação ao mensal" icon={<Percent className="h-[18px] w-[18px]" />} />
          <div className="px-5 pb-5">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Diária (% do mês)">
                <NumberInput suffix="%" digits={1} value={c.fator_diaria * 100} onChange={(v) => set({ fator_diaria: v / 100 })} />
              </Field>
              <Field label="Semana (% do mês)">
                <NumberInput suffix="%" digits={1} value={c.fator_semanal * 100} onChange={(v) => set({ fator_semanal: v / 100 })} />
              </Field>
              <Field label="Quinzena (% do mês)">
                <NumberInput suffix="%" digits={1} value={c.fator_quinzenal * 100} onChange={(v) => set({ fator_quinzenal: v / 100 })} />
              </Field>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-ink-200">
              <p className="bg-ink-50 px-4 py-2 text-[12px] font-semibold text-ink-500">Exemplo: equipamento de {brl(100)}/mês</p>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-ink-100">
                  {PERIODOS.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2 font-medium">{p.nome}</td>
                      <td className="tnum px-4 py-2 text-right">{brl(exemplo[p.id])}</td>
                      <td className="tnum px-4 py-2 text-right text-ink-500">{brl(exemplo[p.id] / p.dias)}/dia</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="secondary" className="mt-4 w-full" onClick={aplicarPrecos}>
              <Wand2 className="h-4 w-4" /> Aplicar a todos os equipamentos
            </Button>
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-ink-100 pt-4">
              <Field label="Entrega padrão">
                <MoneyInput value={c.taxa_entrega_padrao} onChange={(v) => set({ taxa_entrega_padrao: v })} />
              </Field>
              <Field label="Taxa desmontagem">
                <NumberInput suffix="%" digits={1} value={c.taxa_desmontagem_pct} onChange={(v) => set({ taxa_desmontagem_pct: v })} />
              </Field>
              <Field label="Validade orçamento">
                <NumberInput suffix="dias" digits={0} value={c.validade_orcamento_dias} onChange={(v) => set({ validade_orcamento_dias: Math.round(v) })} />
              </Field>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Textos do termo de locação"
            subtitle="Uma cláusula por linha. Use {empresa} e {desmontagem} para preencher sozinho."
            icon={<FileSignature className="h-[18px] w-[18px]" />}
            action={
              <Button size="sm" variant="ghost" onClick={() => set({ termo_compromisso: CONFIG_PADRAO.termo_compromisso, disposicoes: CONFIG_PADRAO.disposicoes })}>
                Restaurar padrão
              </Button>
            }
          />
          <div className="grid gap-4 px-5 pb-5 lg:grid-cols-2">
            <Field label="Termo de compromisso">
              <Textarea className="min-h-[180px]" value={c.termo_compromisso} onChange={(e) => set({ termo_compromisso: e.target.value })} />
            </Field>
            <Field label="Disposições adicionais">
              <Textarea className="min-h-[180px]" value={c.disposicoes} onChange={(e) => set({ disposicoes: e.target.value })} />
            </Field>
          </div>
        </Card>

        {modo === "nuvem" && <Equipe />}

        <Card className="lg:col-span-2">
          <CardHeader title="Dados e backup" icon={<Database className="h-[18px] w-[18px]" />} />
          <div className="grid gap-4 px-5 pb-5 lg:grid-cols-2">
            <div className="rounded-2xl bg-ink-50 p-4 text-sm ring-1 ring-ink-200">
              <p className="flex items-center gap-2 font-semibold">
                {modo === "nuvem" ? <Cloud className="h-4 w-4 text-brand-600" /> : <HardDrive className="h-4 w-4 text-amber-600" />}
                {modo === "nuvem" ? "Nuvem (Supabase) ativa" : "Modo demonstração — dados só neste navegador"}
              </p>
              <p className="mt-2 text-ink-600">
                {modo === "nuvem"
                  ? "Tudo fica salvo no banco de dados e atualiza sozinho em todos os celulares e computadores da equipe."
                  : "Para usar no celular e no computador ao mesmo tempo (e não perder nada se limpar o navegador), configure o Supabase seguindo o README. Enquanto isso, faça backups."}
              </p>
            </div>
            <div className="flex flex-col justify-center gap-2 sm:flex-row lg:justify-end">
              <Button variant="secondary" onClick={exportar}>
                <Download className="h-4 w-4" /> Baixar backup
              </Button>
              <Button variant="secondary" onClick={() => arquivo.current?.click()}>
                <Upload className="h-4 w-4" /> Importar backup
              </Button>
              <input ref={arquivo} type="file" accept="application/json" className="hidden" onChange={(e) => importarArquivo(e.target.files?.[0])} />
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
