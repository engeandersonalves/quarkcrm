import type { LeadStatus, Priority, Segment, TaskType } from "./types.ts";

/**
 * Cadência de follow-up: quando um lead é criado ou muda de etapa no funil, o banco
 * (gatilho `apply_cadence`) cria as tarefas da etapa com a mensagem pronta (copy).
 * As tarefas ainda abertas da etapa anterior são removidas: o próximo passo é sempre atual.
 */
export interface CadenceStep {
  id: string;
  /** Dias depois de entrar na etapa (0 = no mesmo dia). */
  day: number;
  /** Hora do dia (fuso de Maceió). `null` no dia 0 = agora (em 10 minutos). */
  hour: number | null;
  type: TaskType;
  priority: Priority;
  title: string;
  /** Mensagem sugerida. Variáveis: {nome}, {vendedor}, {empresa}, {interesse}, {cidade}. */
  copy: string;
  /** Atalho exibido na tarefa (ex.: gerar a procuração). */
  action?: CadenceAction | null;
}

export type CadenceAction = "procuracao" | "aluguel" | "proposta";

export interface CadencePrefs {
  enabled: boolean;
  stages: Partial<Record<LeadStatus, CadenceStep[]>>;
  /** Material gráfico (catálogo, apresentação, vídeos) para anexar às mensagens. */
  materials: { title: string; url: string }[];
}

export const CADENCE_VARS = [
  { key: "{nome}", label: "Primeiro nome do cliente" },
  { key: "{vendedor}", label: "Seu primeiro nome" },
  { key: "{empresa}", label: "Nome da empresa" },
  { key: "{interesse}", label: "Serviço de interesse" },
  { key: "{cidade}", label: "Cidade do cliente" },
];

export const INTEREST: Record<Segment, string> = {
  solar: "energia solar",
  save: "carregador para veículo elétrico",
  ambos: "energia solar e carregador veicular",
  eletroposto: "investir em um eletroposto",
  manutencao: "limpeza e manutenção da sua usina solar",
  gestao: "gestão energética",
};

/** Preenche as variáveis da mensagem com os dados do lead. */
export function renderCopy(
  text: string,
  ctx: { name?: string | null; seller?: string | null; company?: string | null; segment?: Segment | null; city?: string | null },
) {
  const first = (ctx.name ?? "").trim().split(/\s+/)[0] || "tudo bem";
  const seller = (ctx.seller ?? "").trim().split(/\s+/)[0] || "a equipe";
  return text
    .replaceAll("{nome}", first)
    .replaceAll("{vendedor}", seller)
    .replaceAll("{empresa}", ctx.company || "Quark Energia")
    .replaceAll("{interesse}", INTEREST[ctx.segment ?? "solar"] ?? INTEREST.solar)
    .replaceAll("{cidade}", ctx.city || "sua cidade");
}

/** Descrição curta do momento da tarefa ("Na hora", "Dia 2 · 10h"). */
export function whenLabel(s: Pick<CadenceStep, "day" | "hour">) {
  if (s.day === 0 && s.hour == null) return "Na hora";
  const d = s.day === 0 ? "Mesmo dia" : s.day === 1 ? "Dia seguinte" : `Dia ${s.day}`;
  return `${d} · ${s.hour ?? 9}h`;
}

export const CADENCE_STAGES: { id: LeadStatus; label: string; hint: string }[] = [
  { id: "novo", label: "Novo lead", hint: "Velocidade vende: o primeiro a responder leva o cliente." },
  { id: "contato", label: "Em contato", hint: "Qualificar e marcar a visita técnica." },
  { id: "visita", label: "Visita técnica", hint: "Confirmar, visitar e transformar em proposta." },
  { id: "proposta", label: "Proposta enviada", hint: "Follow-ups que tiram dúvidas e criam urgência." },
  { id: "negociacao", label: "Negociação", hint: "Quebrar objeções e levar ao contrato." },
  { id: "ganho", label: "Fechado", hint: "Encantar, documentar e pedir indicações." },
  { id: "perdido", label: "Perdido", hint: "Reativar no momento certo." },
];

// Copys padrão. O mesmo conteúdo fica gravado no supabase/schema.sql (teste garante que batem).
export const DEFAULT_CADENCE: CadencePrefs = {
  enabled: true,
  materials: [],
  stages: {
    novo: [
      {
        id: "novo-1",
        day: 0,
        hour: null,
        type: "whatsapp",
        priority: "alta",
        title: "Primeiro contato (responda em até 5 minutos)",
        copy: "Olá, {nome}! Aqui é {vendedor}, da {empresa} ☀️ Recebi seu interesse em {interesse} e já estou preparando seu estudo. Posso te fazer 3 perguntinhas rápidas para calcular a sua economia?",
      },
      {
        id: "novo-2",
        day: 1,
        hour: 10,
        type: "ligacao",
        priority: "alta",
        title: "Ligar para qualificar o cliente",
        copy: "Roteiro da ligação:\n1. Quanto vem, em média, a sua conta de luz?\n2. O imóvel é próprio? Qual o tipo de telhado?\n3. Em quanto tempo pensa em instalar?\n4. Mais alguém participa da decisão?\n5. Fechar: \"Vou montar seu estudo. Posso agendar a visita técnica gratuita?\"",
      },
      {
        id: "novo-3",
        day: 2,
        hour: 15,
        type: "whatsapp",
        priority: "media",
        title: "Pedir a conta de luz",
        copy: "{nome}, para eu calcular exatamente quanto você vai economizar, me manda uma foto da sua última conta de luz (frente e verso)? Com ela eu te entrego o projeto certinho, sem chute 📄",
      },
      {
        id: "novo-4",
        day: 4,
        hour: 10,
        type: "whatsapp",
        priority: "media",
        title: "Enviar material gráfico: obras e depoimentos",
        copy: "{nome}, olha só algumas obras que entregamos aqui na região 👇 Tem cliente que pagava mais de R$ 600 e hoje paga só a taxa mínima. Quer que eu faça essa simulação para você?",
      },
      {
        id: "novo-5",
        day: 7,
        hour: 10,
        type: "whatsapp",
        priority: "baixa",
        title: "Última tentativa (mensagem de despedida)",
        copy: "{nome}, tentei falar com você algumas vezes e não quero ser inconveniente 🙂 Ainda faz sentido conversarmos sobre {interesse}? Se não for o momento, me avisa que eu te chamo mais para frente.",
      },
    ],
    contato: [
      {
        id: "contato-1",
        day: 0,
        hour: null,
        type: "whatsapp",
        priority: "alta",
        title: "Agendar a visita técnica",
        copy: "{nome}, para deixar o projeto perfeito, nosso técnico faz uma visita rápida (uns 30 minutos), sem custo nenhum. Qual dia e horário ficam melhores para você esta semana?",
      },
      {
        id: "contato-2",
        day: 1,
        hour: 10,
        type: "email",
        priority: "media",
        title: "Enviar apresentação da empresa e garantias",
        copy: "Assunto: Sua energia solar com a {empresa}\n\nOlá, {nome}!\n\nConforme conversamos, segue nossa apresentação: como funciona o sistema, as garantias dos equipamentos e algumas obras que entregamos em {cidade}.\n\nQualquer dúvida, é só responder este e-mail ou me chamar no WhatsApp.\n\nAbraço,\n{vendedor} — {empresa}",
      },
      {
        id: "contato-3",
        day: 3,
        hour: 16,
        type: "ligacao",
        priority: "media",
        title: "Ligar para tirar dúvidas e confirmar a visita",
        copy: "Pergunte: \"{nome}, ficou alguma dúvida sobre o material que te enviei?\" Reforce que a visita é gratuita e sem compromisso e já sugira dois horários.",
      },
    ],
    visita: [
      {
        id: "visita-1",
        day: 0,
        hour: null,
        type: "whatsapp",
        priority: "alta",
        title: "Confirmar a visita técnica",
        copy: "Oi, {nome}! Passando para confirmar a nossa visita técnica. Nosso técnico vai avaliar o telhado e o padrão de energia — leva uns 30 minutinhos. Se puder, deixe separada a última conta de luz 😉",
      },
      {
        id: "visita-2",
        day: 1,
        hour: 9,
        type: "tarefa",
        priority: "alta",
        title: "Montar o projeto e a proposta",
        copy: "Checklist: fotos do telhado, orientação e inclinação, padrão de entrada, distância até o quadro, consumo dos últimos 12 meses. Gere a proposta no app e envie no mesmo dia.",
        action: "proposta",
      },
      {
        id: "visita-3",
        day: 1,
        hour: 17,
        type: "whatsapp",
        priority: "media",
        title: "Agradecer a visita",
        copy: "{nome}, obrigado por receber a gente! Já estou finalizando o seu projeto e em breve te mando a proposta com a economia detalhada ☀️",
      },
    ],
    proposta: [
      {
        id: "proposta-1",
        day: 0,
        hour: null,
        type: "whatsapp",
        priority: "alta",
        title: "Apresentar a proposta",
        copy: "{nome}, sua proposta está pronta! 🎉 Preparei tudo a partir da sua conta de luz: quanto você vai economizar, em quanto tempo o sistema se paga e as formas de pagamento. Consegue 10 minutinhos hoje para eu te explicar por chamada de vídeo?",
      },
      {
        id: "proposta-2",
        day: 1,
        hour: 10,
        type: "ligacao",
        priority: "alta",
        title: "Ligar para explicar a proposta",
        copy: "Roteiro: 1) Relembre a dor (valor da conta hoje). 2) Mostre a economia em 25 anos. 3) Compare a parcela do financiamento com a conta atual. 4) Pergunte: \"O que falta para seguirmos?\"",
      },
      {
        id: "proposta-3",
        day: 3,
        hour: 10,
        type: "whatsapp",
        priority: "media",
        title: "Follow-up: tirar dúvidas do financiamento",
        copy: "{nome}, conseguiu dar uma olhada na proposta? Uma dúvida comum é o financiamento: a parcela costuma ficar menor que a conta de luz de hoje. Ou seja, você troca a conta pela parcela e, depois de quitado, fica só com a economia 💡 Quer que eu simule em quantas vezes fica melhor para você?",
      },
      {
        id: "proposta-4",
        day: 5,
        hour: 10,
        type: "whatsapp",
        priority: "media",
        title: "Enviar material gráfico: depoimento em vídeo",
        copy: "{nome}, separei o depoimento de um cliente que estava na mesma situação que você 🎥 Vale a pena assistir! Depois me conta o que achou.",
      },
      {
        id: "proposta-5",
        day: 7,
        hour: 10,
        type: "whatsapp",
        priority: "alta",
        title: "Gatilho da validade da proposta",
        copy: "{nome}, a condição da sua proposta vale só até o fim desta semana — os preços dos equipamentos estão em alta. Quer que eu reserve o seu kit com esse valor?",
      },
      {
        id: "proposta-6",
        day: 12,
        hour: 10,
        type: "ligacao",
        priority: "media",
        title: "Última tentativa antes de arquivar",
        copy: "Pergunte com sinceridade: \"{nome}, o que te impede de seguir hoje?\" Ouça a objeção (preço, confiança, momento) e ofereça uma saída: nova simulação, outra forma de pagamento ou visita de um cliente atendido.",
      },
    ],
    negociacao: [
      {
        id: "negociacao-1",
        day: 0,
        hour: null,
        type: "ligacao",
        priority: "alta",
        title: "Entender a objeção e negociar",
        copy: "Descubra a objeção real: \"Se resolvermos isso, você fecha hoje?\" Preço → mostre a economia mensal. Confiança → envie obras e avaliações. Momento → mostre quanto ele perde por mês esperando.",
      },
      {
        id: "negociacao-2",
        day: 1,
        hour: 10,
        type: "whatsapp",
        priority: "alta",
        title: "Enviar condição especial",
        copy: "{nome}, conversei com a diretoria e consegui uma condição especial para você fechar esta semana 🙌 Posso te mandar o contrato para assinar pelo celular?",
      },
      {
        id: "negociacao-3",
        day: 2,
        hour: 10,
        type: "whatsapp",
        priority: "alta",
        title: "Enviar contrato e procuração para assinatura digital",
        copy: "{nome}, segue o link para assinar a procuração que nos permite cuidar de todo o processo com a Equatorial para você. É só abrir e assinar pelo celular, leva 1 minuto ✍️",
        action: "procuracao",
      },
      {
        id: "negociacao-4",
        day: 4,
        hour: 10,
        type: "whatsapp",
        priority: "media",
        title: "Follow-up de fechamento",
        copy: "{nome}, conseguiu ver o contrato? Assim que você assinar, eu já reservo o seu kit e agendo a instalação 📅",
      },
    ],
    ganho: [
      {
        id: "ganho-1",
        day: 0,
        hour: null,
        type: "whatsapp",
        priority: "alta",
        title: "Boas-vindas ao cliente",
        copy: "{nome}, seja muito bem-vindo(a) à {empresa}! 🎉 A partir de agora eu acompanho cada etapa: projeto, aprovação na Equatorial, instalação e ligação do sistema. Qualquer dúvida, é só me chamar.",
      },
      {
        id: "ganho-2",
        day: 0,
        hour: null,
        type: "tarefa",
        priority: "alta",
        title: "Gerar a procuração e enviar para assinatura",
        copy: "{nome}, para darmos entrada no seu projeto na Equatorial, preciso que você assine a procuração pelo link abaixo. É rapidinho, direto pelo celular ✍️",
        action: "procuracao",
      },
      {
        id: "ganho-3",
        day: 1,
        hour: 10,
        type: "tarefa",
        priority: "media",
        title: "Enviar kit de boas-vindas (material gráfico e cronograma)",
        copy: "{nome}, preparei um material para você acompanhar tudo: o cronograma da sua instalação e as próximas etapas. Qualquer dúvida, me chama! 📘",
      },
      {
        id: "ganho-4",
        day: 15,
        hour: 10,
        type: "whatsapp",
        priority: "media",
        title: "Atualizar o cliente sobre a homologação",
        copy: "Oi, {nome}! Passando para te atualizar: o seu projeto está em análise na Equatorial e está tudo correndo bem. Assim que tivermos a aprovação, eu te aviso para agendarmos a instalação ⚡",
      },
      {
        id: "ganho-5",
        day: 45,
        hour: 10,
        type: "whatsapp",
        priority: "media",
        title: "Pedir avaliação no Google",
        copy: "{nome}, que alegria ver seu sistema funcionando! ☀️ Você poderia deixar uma avaliação sobre a {empresa} no Google? Leva 30 segundos e ajuda muito o nosso trabalho 🙏",
      },
      {
        id: "ganho-6",
        day: 60,
        hour: 10,
        type: "whatsapp",
        priority: "media",
        title: "Pedir indicações",
        copy: "{nome}, e aí, já está curtindo a conta de luz menor? ☀️ Se tiver amigos ou familiares que também querem economizar, me passa o contato — quem indica ganha um presente especial da {empresa} 🎁",
      },
      {
        id: "ganho-7",
        day: 180,
        hour: 10,
        type: "ligacao",
        priority: "baixa",
        title: "Oferecer limpeza e manutenção preventiva",
        copy: "{nome}, seu sistema completa 6 meses! Poeira e fuligem nas placas podem reduzir a geração em até 25%. Posso agendar uma limpeza com inspeção completa?",
      },
    ],
    perdido: [
      {
        id: "perdido-1",
        day: 30,
        hour: 10,
        type: "whatsapp",
        priority: "baixa",
        title: "Reativação: novas condições",
        copy: "Oi, {nome}! Tudo bem? Faz um tempinho que conversamos sobre {interesse}. Saíram novas condições de pagamento este mês — quer que eu atualize a sua simulação, sem compromisso?",
      },
      {
        id: "perdido-2",
        day: 90,
        hour: 10,
        type: "whatsapp",
        priority: "baixa",
        title: "Reativação: aumento da tarifa",
        copy: "{nome}, a tarifa de energia subiu de novo 📈 Cada mês sem energia solar é dinheiro que não volta. Posso refazer os cálculos com a sua conta mais recente?",
      },
    ],
  },
};

/** Garante que uma cadência salva no banco tenha o formato esperado. */
export function mergeCadence(c: Partial<CadencePrefs> | null | undefined): CadencePrefs {
  if (!c || typeof c !== "object") return DEFAULT_CADENCE;
  return {
    enabled: c.enabled !== false,
    stages: c.stages && typeof c.stages === "object" ? c.stages : DEFAULT_CADENCE.stages,
    materials: Array.isArray(c.materials) ? c.materials : [],
  };
}
