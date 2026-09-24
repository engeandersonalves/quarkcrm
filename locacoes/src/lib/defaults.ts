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
  fator_diaria: 0.15,
  fator_semanal: 0.45,
  fator_quinzenal: 0.7,
  taxa_entrega_padrao: 60,
  taxa_desmontagem_pct: 25,
  validade_orcamento_dias: 7,
  termo_compromisso: [
    "Declaro que estou alugando os itens descritos acima, de acordo com as condições estabelecidas pela {empresa}.",
    "Declaro que recebi os itens em perfeito estado de conservação e funcionamento, conforme inspeção realizada no momento da retirada/entrega.",
    "Comprometo-me a devolver todos os itens no mesmo estado em que foram entregues.",
    "Comprometo-me a assumir a responsabilidade por danos ou perdas dos itens e, em caso de devolução inadequada, arcar com os custos de reparo ou substituição.",
  ].join("\n"),
  disposicoes: [
    "Vencimento do contrato: no vencimento, nossa empresa entrará em contato com o cliente para agendar a coleta dos equipamentos ou realizar a renovação do contrato. Caso o cliente não responda em tempo hábil, o contrato será renovado automaticamente, e os valores referentes à renovação serão cobrados.",
    "Coleta dos equipamentos: na coleta, os andaimes e escoras deverão estar desmontados, da mesma forma como foram entregues. Caso os itens não estejam desmontados, será aplicada uma taxa adicional de {desmontagem}% do valor do contrato.",
  ].join("\n"),
};

export function mesclarConfig(c: Partial<Config> | null | undefined): Config {
  return { ...CONFIG_PADRAO, ...(c ?? {}) };
}

/** Catálogo inicial com os itens e valores do termo de aluguel da empresa. */
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
