/** Conteúdo padrão (editável em Configurações → Proposta). */

export const DEFAULT_TIMELINE = [
  { day: 0, title: "Contrato e pagamento", text: "Assinatura do contrato e confirmação do pagamento ou do financiamento." },
  { day: 2, title: "Visita técnica", text: "Vistoria do telhado, medição e avaliação do padrão de entrada de energia." },
  { day: 5, title: "Projeto elétrico", text: "Engenheiro elabora o projeto e emite a ART de responsabilidade técnica." },
  { day: 8, title: "Solicitação de acesso", text: "Protocolo do projeto na distribuidora e acompanhamento do parecer." },
  { day: 18, title: "Entrega dos equipamentos", text: "Módulos, inversor e estrutura entregues com nota fiscal e garantia do fabricante." },
  { day: 22, title: "Instalação", text: "Montagem por equipe própria e certificada, normalmente em 1 a 3 dias." },
  { day: 29, title: "Vistoria da distribuidora", text: "Inspeção do sistema e substituição do medidor por um bidirecional." },
  { day: 40, title: "Sistema homologado", text: "Sistema em operação, monitoramento ativo e geração de créditos." },
];

export const DEFAULT_FAQ = [
  { q: "Se faltar energia na rua, o sistema continua funcionando?", a: "Não. Por norma de segurança, o inversor desliga automaticamente quando a rede cai e religa assim que ela é restabelecida." },
  { q: "Qual é a manutenção necessária?", a: "Mínima: uma limpeza dos módulos por ano e o acompanhamento da geração pelo aplicativo, que alerta sobre qualquer anomalia." },
  { q: "E se o meu consumo aumentar?", a: "O sistema pode ser ampliado com novos módulos, desde que o inversor e o telhado comportem, ou com um inversor adicional." },
  { q: "O imóvel se valoriza?", a: "Sim. Imóveis com energia solar têm custo de operação menor e são mais valorizados na venda e na locação." },
];

export const SECTION_LABELS: Record<string, { label: string; hint: string }> = {
  howItWorks: { label: "Como funciona", hint: "Diagrama do sistema e 4 etapas" },
  bill: { label: "Fatura detalhada", hint: "Tabela antes × depois, fio B e taxa mínima" },
  payback: { label: "Análise financeira", hint: "Retorno, rentabilidade e saldo em 25 anos" },
  generation: { label: "Desempenho", hint: "Geração mês a mês × consumo" },
  equipment: { label: "Equipamentos", hint: "Fotos e especificações de placas e inversor" },
  warranties: { label: "Garantias", hint: "Prazos de garantia por item" },
  timeline: { label: "Cronograma", hint: "Etapas do contrato à homologação" },
  planet: { label: "Sustentabilidade", hint: "CO₂ evitado, árvores e km" },
  faq: { label: "Dúvidas frequentes", hint: "Perguntas e respostas" },
  about: { label: "Sobre nós", hint: "Texto da empresa e contatos" },
};
