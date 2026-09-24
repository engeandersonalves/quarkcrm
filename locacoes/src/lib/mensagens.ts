import { enderecoCompleto, fmtData, fmtTelefone, linkMaps } from "./format";
import { brl, comparativo, descreverModalidade, descreverPartes, valorAluguel } from "./pricing";
import { pixCopiaECola } from "./pix";
import type { Config, Locacao } from "./types";

const itensTexto = (l: Locacao) => l.itens.map((i) => `• ${i.quantidade} ${i.unidade} — ${i.nome}`).join("\n");

/** Orçamento para mandar ao cliente no WhatsApp, com os 4 planos comparados. */
export function mensagemOrcamento(l: Locacao, cfg: Config): string {
  const comp = comparativo(l.itens);
  const aluguel = valorAluguel(l.itens, l.modalidade, l.quantidade_periodos);
  const taxas = (l.taxa_entrega || 0) + (l.taxa_retirada || 0);
  const linhas = [
    `*${cfg.empresa_nome}* — Orçamento nº ${l.numero}`,
    `Olá${l.cliente_nome ? `, ${l.cliente_nome.split(" ")[0]}` : ""}! Segue o orçamento da locação:`,
    "",
    itensTexto(l),
    "",
    "*Valores por plano:*",
    ...comp.map((c) => `▫️ ${c.nome}: ${brl(c.valor)}${c.economia > 0.01 ? `  _(${Math.round(c.economia * 100)}% mais barato por dia)_` : ""}`),
    "",
    `*Plano escolhido:* ${descreverModalidade(l.modalidade, l.quantidade_periodos)}${l.modalidade === "dias" ? ` (${descreverPartes(aluguel.partes)})` : ""}`,
    `Aluguel: ${brl(aluguel.total)}`,
  ];
  if (taxas > 0) linhas.push(`Entrega/retirada: ${brl(taxas)}`);
  if (l.desconto > 0) linhas.push(`Desconto: −${brl(l.desconto)}`);
  linhas.push(`*Total: ${brl(l.valor_total)}*`, "");
  if (l.data_entrega) linhas.push(`📅 Entrega: ${fmtData(l.data_entrega)} · Coleta: ${fmtData(l.data_coleta)}`);
  if (l.endereco.logradouro || l.endereco.bairro) linhas.push(`📍 ${enderecoCompleto(l.endereco)}`);
  linhas.push("", `Validade: ${cfg.validade_orcamento_dias} dias.`);
  if (cfg.empresa_pix) linhas.push(`PIX: ${cfg.empresa_pix}`);
  linhas.push("Posso confirmar? 😊");
  return linhas.join("\n");
}

/** Ordem de serviço para o entregador: tudo o que ele precisa para achar a obra. */
export function mensagemEntregador(l: Locacao, acao: "entrega" | "coleta"): string {
  const e = l.endereco;
  return [
    `🚚 *${acao === "entrega" ? "ENTREGA" : "COLETA"} — Locação #${l.numero}*`,
    `📅 ${fmtData(acao === "entrega" ? l.data_entrega : l.data_coleta)}`,
    "",
    `👤 ${l.cliente_nome}${l.cliente_telefone ? ` — ${fmtTelefone(l.cliente_telefone)}` : ""}`,
    l.recebedor_nome ? `🤝 Recebe: ${l.recebedor_nome}` : "",
    "",
    `📍 ${[e.logradouro, e.numero && `nº ${e.numero}`].filter(Boolean).join(", ")}`,
    e.complemento ? `   ${e.complemento}` : "",
    `   ${[e.bairro, [e.cidade, e.uf].filter(Boolean).join("/")].filter(Boolean).join(" — ")}${e.cep ? ` — CEP ${e.cep}` : ""}`,
    e.referencia ? `🧭 Referência: ${e.referencia}` : "",
    `🗺️ ${linkMaps(e)}`,
    "",
    "*Itens:*",
    itensTexto(l),
    acao === "coleta" ? "\n⚠️ Conferir quantidades e estado das peças na coleta." : "\n✍️ Levar o termo de locação para assinatura.",
  ]
    .filter((x) => x !== "")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function mensagemCobranca(l: Locacao, valor: number, cfg: Config): string {
  const copiaECola = cfg.empresa_pix
    ? pixCopiaECola({ chave: cfg.empresa_pix, nome: cfg.pix_titular || cfg.empresa_nome, cidade: cfg.empresa_cidade, valor, identificador: `LOC${String(l.numero).padStart(4, "0")}` })
    : "";
  return [
    `Olá, ${l.cliente_nome.split(" ")[0]}! Aqui é da *${cfg.empresa_nome}*.`,
    `Referente à locação nº ${l.numero}, o valor em aberto é *${brl(valor)}*.`,
    cfg.empresa_pix ? `Chave PIX: ${cfg.empresa_pix}` : "",
    copiaECola ? `\nPIX copia e cola (o valor já vem preenchido):\n${copiaECola}\n` : "",
    "Obrigado pela preferência! 🙏",
  ]
    .filter(Boolean)
    .join("\n");
}

export function mensagemVencimento(l: Locacao, cfg: Config): string {
  return [
    `Olá, ${l.cliente_nome.split(" ")[0]}! Aqui é da *${cfg.empresa_nome}*.`,
    `A locação nº ${l.numero} vence em *${fmtData(l.data_coleta)}*.`,
    "Deseja *renovar* ou podemos *agendar a coleta*?",
    `Lembrando: andaimes e escoras precisam estar desmontados na coleta (senão há taxa de ${cfg.taxa_desmontagem_pct}%).`,
  ].join("\n");
}
