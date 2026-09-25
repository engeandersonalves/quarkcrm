export type Periodo = "diaria" | "semanal" | "quinzenal" | "mensal";
/** "dias" = quantidade livre de dias; o sistema escolhe a combinação de planos mais barata. */
export type Modalidade = Periodo | "dias";

export type Precos = Record<Periodo, number>;

export interface Endereco {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  referencia: string;
  /** Link do Google Maps / localização do WhatsApp / GPS capturado no local. */
  maps_url: string;
}

export interface Equipamento {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  estoque_total: number;
  em_manutencao: number;
  preco_diaria: number;
  preco_semanal: number;
  preco_quinzenal: number;
  preco_mensal: number;
  valor_reposicao: number;
  ativo: boolean;
  observacoes: string;
  criado_em: string;
}

export interface Cliente {
  id: string;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  endereco: Endereco;
  observacoes: string;
  criado_em: string;
}

export interface ItemLocacao {
  equipamento_id: string;
  nome: string;
  unidade: string;
  quantidade: number;
  precos: Precos;
}

export type StatusLocacao = "orcamento" | "agendada" | "na_obra" | "finalizada" | "recusada";

export interface Evento {
  em: string;
  texto: string;
}

export interface Locacao {
  id: string;
  numero: number;
  status: StatusLocacao;
  cliente_id: string | null;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_documento: string;
  endereco: Endereco;
  recebedor_nome: string;
  recebedor_documento: string;
  itens: ItemLocacao[];
  modalidade: Modalidade;
  /** Nº de períodos (ex.: 2 semanas) ou nº de dias quando modalidade = "dias". */
  quantidade_periodos: number;
  taxa_entrega: number;
  taxa_retirada: number;
  desconto: number;
  acrescimo: number;
  valor_total: number;
  data_entrega: string;
  data_coleta: string;
  entregue_em: string | null;
  recolhido_em: string | null;
  observacoes: string;
  historico: Evento[];
  criado_em: string;
  atualizado_em: string;
  /** Preenchidos quando o cliente assina o termo (link ou no aparelho). */
  assinado_em?: string | null;
  assinado_por?: string | null;
}

/** O termo exatamente como foi enviado para assinar (não muda depois). */
export interface TermoCongelado {
  locacao: Omit<Locacao, "historico">;
  config: Config;
  /** Valor de reposição de cada equipamento na época. */
  reposicao: Record<string, number>;
  gerado_em: string;
}

export interface Assinatura {
  locacao_id: string;
  token: string;
  criado_em: string;
  termo: TermoCongelado;
  assinado_em: string | null;
  nome: string | null;
  documento: string | null;
  /** Assinatura desenhada (PNG em data URL). */
  imagem: string | null;
  /** Selfie (JPEG em data URL). */
  selfie: string | null;
  via: "link" | "presencial" | null;
  /** SHA-256 do termo assinado: prova de que o texto não mudou depois. */
  hash: string | null;
  ip: string | null;
  dispositivo: string | null;
  geo: string | null;
}

export type TipoLancamento = "entrada" | "saida";

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  categoria: string;
  descricao: string;
  valor: number;
  /** Vencimento / competência (AAAA-MM-DD). */
  data: string;
  pago: boolean;
  pago_em: string | null;
  forma: string;
  locacao_id: string | null;
  modalidade: Modalidade | null;
  criado_em: string;
}

export interface Config {
  empresa_nome: string;
  empresa_cnpj: string;
  empresa_telefone: string;
  empresa_pix: string;
  empresa_responsavel: string;
  empresa_endereco: string;
  /** Cidade do recebedor PIX (vai no QR Code). */
  empresa_cidade: string;
  /** Nome do titular da chave PIX (vai no QR Code). */
  pix_titular: string;
  /** Preço de cada plano como fração do mensal (mensal = 1). */
  fator_diaria: number;
  fator_semanal: number;
  fator_quinzenal: number;
  taxa_entrega_padrao: number;
  taxa_desmontagem_pct: number;
  validade_orcamento_dias: number;
  termo_compromisso: string;
  disposicoes: string;
}

export interface Dados {
  equipamentos: Equipamento[];
  clientes: Cliente[];
  locacoes: Locacao[];
  lancamentos: Lancamento[];
  config: Config;
}

export type Tabela = "equipamentos" | "clientes" | "locacoes" | "lancamentos";
