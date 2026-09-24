import { addDias, enderecoVazio, hoje, uid } from "./format";
import { diasDaLocacao } from "./pricing";
import type { Cliente, Config, Equipamento, Lancamento, Locacao } from "./types";

export function novaLocacao(cfg: Config): Locacao {
  const agora = new Date().toISOString();
  const entrega = addDias(hoje(), 1);
  return {
    id: uid(),
    numero: 0,
    status: "orcamento",
    cliente_id: null,
    cliente_nome: "",
    cliente_telefone: "",
    cliente_documento: "",
    endereco: enderecoVazio(),
    recebedor_nome: "",
    recebedor_documento: "",
    itens: [],
    modalidade: "mensal",
    quantidade_periodos: 1,
    taxa_entrega: cfg.taxa_entrega_padrao,
    taxa_retirada: 0,
    desconto: 0,
    acrescimo: 0,
    valor_total: 0,
    data_entrega: entrega,
    data_coleta: addDias(entrega, diasDaLocacao("mensal", 1)),
    entregue_em: null,
    recolhido_em: null,
    observacoes: "",
    historico: [],
    criado_em: agora,
    atualizado_em: agora,
  };
}

export function novoCliente(): Cliente {
  return { id: uid(), nome: "", documento: "", telefone: "", email: "", endereco: enderecoVazio(), observacoes: "", criado_em: new Date().toISOString() };
}

export function novoEquipamento(): Equipamento {
  return {
    id: uid(),
    nome: "",
    categoria: "Andaimes",
    unidade: "peça",
    estoque_total: 0,
    em_manutencao: 0,
    preco_diaria: 0,
    preco_semanal: 0,
    preco_quinzenal: 0,
    preco_mensal: 0,
    valor_reposicao: 0,
    ativo: true,
    observacoes: "",
    criado_em: new Date().toISOString(),
  };
}

export function novoLancamento(tipo: Lancamento["tipo"]): Lancamento {
  return {
    id: uid(),
    tipo,
    categoria: tipo === "entrada" ? "Aluguel" : "Combustível",
    descricao: "",
    valor: 0,
    data: hoje(),
    pago: true,
    pago_em: hoje(),
    forma: "PIX",
    locacao_id: null,
    modalidade: null,
    criado_em: new Date().toISOString(),
  };
}
