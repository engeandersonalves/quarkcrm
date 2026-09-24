import { sugerirPrecos } from "./pricing";
import { uid } from "./format";
import type { Config, Equipamento } from "./types";

export const CONFIG_PADRAO: Config = {
  empresa_nome: "Quark Locações",
  empresa_cnpj: "58.655.132/0001-31",
  empresa_telefone: "(82) 98815-6223",
  empresa_pix: "quarklocacoes@jim.com",
  empresa_responsavel: "Sandra Pereira da Silva",
  empresa_endereco: "Maceió/AL",
  empresa_cidade: "Maceió",
  pix_titular: "Quark Locações",
  fator_diaria: 0.15,
  fator_semanal: 0.45,
  fator_quinzenal: 0.7,
  taxa_entrega_padrao: 60,
  taxa_desmontagem_pct: 25,
  validade_orcamento_dias: 7,
  termo_compromisso: [
    "Recebi os equipamentos listados neste termo em perfeito estado de conservação e funcionamento, conferidos no ato da entrega.",
    "Os equipamentos serão usados somente no endereço da obra aqui indicado. Não é permitido sublocar, emprestar ou levar para outro local sem autorização da {empresa}.",
    "Sou responsável pela guarda, pelo uso correto e pela montagem segura dos equipamentos, seguindo as normas de segurança do trabalho.",
    "Devolverei todos os itens no mesmo estado em que foram entregues. Em caso de dano, perda, furto ou roubo, pagarei o conserto ou o valor de reposição indicado na tabela de itens.",
  ].join("\n"),
  disposicoes: [
    "Vencimento e renovação: no vencimento, a {empresa} entrará em contato para agendar a coleta ou renovar o contrato. Se o cliente não responder em tempo hábil, o contrato será renovado automaticamente pelo mesmo período, e os valores da renovação serão cobrados.",
    "Coleta: na coleta, andaimes e escoras devem estar desmontados, da mesma forma como foram entregues. Se não estiverem, será cobrada uma taxa adicional de {desmontagem}% do valor do contrato.",
    "Acesso: o locatário garante acesso livre e seguro ao local nos dias de entrega e de coleta.",
  ].join("\n"),
};

export function mesclarConfig(c: Partial<Config> | null | undefined): Config {
  return { ...CONFIG_PADRAO, ...(c ?? {}) };
}

/** Catálogo inicial com os itens e valores do termo de locação da empresa. */
export function catalogoInicial(cfg: Config): Equipamento[] {
  const base = [
    { nome: "Andaime tubular 1,5 m", categoria: "Andaimes", unidade: "peça", estoque_total: 200, mensal: 12, valor_reposicao: 250 },
    { nome: "Plataforma metálica 1,5 m", categoria: "Andaimes", unidade: "peça", estoque_total: 60, mensal: 30, valor_reposicao: 320 },
    { nome: "Betoneira Prime 400 L", categoria: "Máquinas", unidade: "un", estoque_total: 3, mensal: 450, valor_reposicao: 4500 },
  ];
  const agora = new Date().toISOString();
  return base.map((b) => {
    const p = sugerirPrecos(b.mensal, cfg);
    return {
      id: uid(),
      nome: b.nome,
      categoria: b.categoria,
      unidade: b.unidade,
      estoque_total: b.estoque_total,
      em_manutencao: 0,
      preco_diaria: p.diaria,
      preco_semanal: p.semanal,
      preco_quinzenal: p.quinzenal,
      preco_mensal: p.mensal,
      valor_reposicao: b.valor_reposicao,
      ativo: true,
      observacoes: "",
      criado_em: agora,
    };
  });
}

export const CATEGORIAS_ENTRADA = ["Aluguel", "Renovação", "Taxa de entrega", "Taxa de desmontagem", "Avaria / reposição", "Outros"];
export const CATEGORIAS_SAIDA = ["Combustível", "Manutenção", "Compra de equipamento", "Salários / diárias", "Aluguel do galpão", "Impostos", "Outros"];
export const FORMAS_PAGAMENTO = ["PIX", "Dinheiro", "Cartão", "Boleto", "Transferência"];
