/** Conteúdo padrão (editável em Configurações → Proposta). */

export const DEFAULT_TIMELINE = [
  { day: 0, title: "Pagamento e contrato", text: "Você aprova a proposta e a gente já começa a trabalhar." },
  { day: 2, title: "Visita técnica", text: "Nosso técnico vai até a sua casa, mede o telhado e confere a parte elétrica." },
  { day: 5, title: "Projeto do engenheiro", text: "O engenheiro desenha o seu sistema, do jeitinho certo para o seu telhado." },
  { day: 8, title: "Pedido na concessionária", text: "Enviamos o projeto para a companhia de energia e cuidamos de toda a papelada." },
  { day: 18, title: "Chegada dos equipamentos", text: "Placas, inversor e estrutura chegam novinhos, direto da fábrica." },
  { day: 22, title: "Instalação", text: "Nossa equipe instala tudo em 1 a 3 dias, com segurança e sem sujeira." },
  { day: 29, title: "Vistoria e novo medidor", text: "A concessionária vistoria o sistema e troca o seu relógio de luz." },
  { day: 40, title: "Sistema ligado!", text: "Homologação concluída: agora é só aproveitar o sol e ver a conta cair." },
];

export const DEFAULT_FAQ = [
  { q: "Se faltar luz na rua, eu fico com energia?", a: "Não. Por segurança, o sistema desliga sozinho quando a rede cai e volta assim que a energia retorna." },
  { q: "Precisa de manutenção?", a: "Quase nada! Uma limpeza das placas por ano já basta. O app avisa se algo não estiver normal." },
  { q: "E se eu gastar mais energia no futuro?", a: "Dá para aumentar o sistema depois, adicionando mais placas." },
  { q: "Minha casa valoriza?", a: "Sim! Imóveis com energia solar são mais procurados e valorizam no mercado." },
];

export const SECTION_LABELS: Record<string, { label: string; hint: string }> = {
  howItWorks: { label: "Como funciona", hint: "4 passos ilustrados + créditos e noite" },
  bill: { label: "Conta antes e depois", hint: "Contas ilustradas e explicação do fio B" },
  payback: { label: "Cofrinho / retorno", hint: "Payback, economia em 25 anos e gráfico" },
  generation: { label: "Geração mês a mês", hint: "Gráfico de produção × consumo" },
  equipment: { label: "Equipamentos", hint: "Placas, inversor, estrutura e app" },
  warranties: { label: "Garantias", hint: "Cartões com anos de garantia" },
  timeline: { label: "Passo a passo da obra", hint: "Cronograma do pagamento à homologação" },
  planet: { label: "Planeta", hint: "Árvores, km de carro e CO₂" },
  faq: { label: "Perguntas frequentes", hint: "Dúvidas comuns respondidas" },
  about: { label: "Quem somos", hint: "Texto da empresa e contatos" },
};
