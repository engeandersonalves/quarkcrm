/** Frases, dicas e imagens que inspiram quem usa o app (nunca aparecem na proposta do cliente). */

export interface Quote {
  text: string;
  author: string;
  tag?: "filme" | "filosofia" | "negócios" | "esporte" | "solar";
}

export const QUOTES: Quote[] = [
  { text: "O mundo é seu.", author: "Scarface (1983)", tag: "filme" },
  { text: "Me venda esta caneta.", author: "O Lobo de Wall Street (2013)", tag: "filme" },
  { text: "A única coisa entre você e o seu objetivo é a história que você conta a si mesmo sobre por que não pode alcançá-lo.", author: "Jordan Belfort", tag: "negócios" },
  { text: "Não é sobre o quão forte você bate. É sobre o quanto aguenta apanhar e continuar seguindo em frente.", author: "Rocky Balboa (2006)", tag: "filme" },
  { text: "O impedimento à ação faz a ação avançar. O que está no caminho se torna o caminho.", author: "Marco Aurélio", tag: "filosofia" },
  { text: "Você tem poder sobre a sua mente, não sobre os acontecimentos. Perceba isso e encontrará força.", author: "Marco Aurélio", tag: "filosofia" },
  { text: "Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis.", author: "Sêneca", tag: "filosofia" },
  { text: "Enquanto adiamos, a vida passa.", author: "Sêneca", tag: "filosofia" },
  { text: "A sorte é o que acontece quando a preparação encontra a oportunidade.", author: "Sêneca", tag: "filosofia" },
  { text: "Não são as coisas que nos perturbam, mas a opinião que temos sobre elas.", author: "Epicteto", tag: "filosofia" },
  { text: "Toda batalha é ganha antes de ser travada.", author: "Sun Tzu", tag: "filosofia" },
  { text: "No meio do caos também há oportunidade.", author: "Sun Tzu", tag: "filosofia" },
  { text: "A fortuna favorece os audazes.", author: "Virgílio", tag: "filosofia" },
  { text: "Quem tem um porquê para viver suporta quase qualquer como.", author: "Friedrich Nietzsche", tag: "filosofia" },
  { text: "Somos o que fazemos repetidamente. A excelência, portanto, não é um ato, mas um hábito.", author: "Will Durant, sobre Aristóteles", tag: "filosofia" },
  { text: "O que a mente pode conceber e acreditar, ela pode alcançar.", author: "Napoleon Hill", tag: "negócios" },
  { text: "A melhor maneira de prever o futuro é criá-lo.", author: "Peter Drucker", tag: "negócios" },
  { text: "Continue faminto. Continue tolo.", author: "Steve Jobs", tag: "negócios" },
  { text: "Seja tão bom que não possam te ignorar.", author: "Steve Martin", tag: "negócios" },
  { text: "Disciplina é liberdade.", author: "Jocko Willink", tag: "negócios" },
  { text: "Feito é melhor que perfeito.", author: "Mantra do Vale do Silício", tag: "negócios" },
  { text: "Você erra 100% dos arremessos que não faz.", author: "Wayne Gretzky", tag: "esporte" },
  { text: "Não conte os dias. Faça os dias contarem.", author: "Muhammad Ali", tag: "esporte" },
  { text: "Quanto mais eu treino, mais sorte eu tenho.", author: "Gary Player", tag: "esporte" },
  { text: "Vencedores nunca desistem, e quem desiste nunca vence.", author: "Vince Lombardi", tag: "esporte" },
  { text: "O sol trabalha de graça o dia inteiro. A sua parte é fazer o cliente enxergar isso.", author: "Quark CRM", tag: "solar" },
  { text: "Você não vende placas. Vende liberdade da conta de luz pelos próximos 25 anos.", author: "Quark CRM", tag: "solar" },
  { text: "Cada telhado vazio é uma proposta esperando por você.", author: "Quark CRM", tag: "solar" },
  { text: "O sol nasce para todos. Mas o contrato é de quem liga primeiro.", author: "Quark CRM", tag: "solar" },
  { text: "Quem mostra a economia em reais fecha. Quem mostra kWp explica.", author: "Quark CRM", tag: "solar" },
];

export const SALES_TIPS: { title: string; text: string }[] = [
  { title: "Velocidade vence", text: "Responda um lead novo em até 5 minutos. Depois de 1 hora, a chance de conversa despenca." },
  { title: "12 meses de conta", text: "Peça as últimas 12 faturas: o consumo de verão e de inverno muda o dimensionamento." },
  { title: "Parcela × conta", text: "Mostre a parcela do financiamento ao lado da conta atual. Quando a parcela é menor, a decisão fica óbvia." },
  { title: "Ele abriu a proposta?", text: "O app te avisa por e-mail. Ligue em até 30 minutos, enquanto a proposta está fresca na cabeça do cliente." },
  { title: "Pergunta de fechamento", text: "Troque “o que achou?” por “o que falta para começarmos a sua obra?”." },
  { title: "Prova social", text: "Leve fotos de obras suas na visita técnica. Vizinho instalado vende mais que qualquer argumento." },
  { title: "Antecipe o fio B", text: "Explique o fio B antes do concorrente usar isso contra você. Transparência gera confiança." },
  { title: "Duas opções", text: "Apresente um sistema ideal e um econômico. Escolher entre A e B é mais fácil que dizer sim ou não." },
  { title: "Momento da indicação", text: "Peça indicações logo após a homologação, quando o cliente vê a primeira conta baixa." },
  { title: "Tudo no histórico", text: "Registre cada contato no lead. Memória organizada é a ferramenta de vendas mais barata que existe." },
  { title: "Meta de atividade", text: "Tenha meta diária de propostas enviadas, não só de vendas. Volume de propostas gera contratos." },
  { title: "Follow-up é venda", text: "A maioria das vendas acontece entre o 3º e o 5º contato. Agende a próxima tarefa antes de desligar." },
];

/**
 * Imagens padrão (Unsplash, uso livre). Se alguma não carregar, o app mostra uma arte
 * própria no lugar. Em Configurações → App você pode usar as suas próprias imagens.
 */
export const DEFAULT_IMAGES: string[] = [
  "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b",
  "https://images.unsplash.com/photo-1514565131-fce0801e5785",
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4",
  "https://images.unsplash.com/photo-1509391366360-2e959784a276",
  "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df",
  "https://images.unsplash.com/photo-1507679799987-c73779587ccf",
  "https://images.unsplash.com/photo-1497440001374-f26997328c1b",
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3",
];

export function imageUrl(src: string, width = 1920) {
  if (src.includes("images.unsplash.com") && !src.includes("?")) return `${src}?auto=format&fit=crop&w=${width}&q=75`;
  return src;
}

/** Índice estável por dia (muda à meia-noite). */
export function dayIndex(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000) + date.getFullYear() * 400;
}

export function pickDaily<T>(list: T[], offset = 0, date = new Date()): T | undefined {
  if (!list.length) return undefined;
  return list[(dayIndex(date) + offset) % list.length];
}

export function quotePool(custom: Quote[], useDefaults: boolean) {
  const mine = custom.filter((q) => q.text.trim());
  return useDefaults || !mine.length ? [...mine, ...QUOTES] : mine;
}

export function imagePool(custom: string[]) {
  const mine = custom.map((u) => u.trim()).filter((u) => /^https?:\/\//.test(u));
  return mine.length ? mine : DEFAULT_IMAGES;
}
