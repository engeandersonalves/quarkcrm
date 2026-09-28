/**
 * Pôsteres do "Cinematic Archive" (artes originais inspiradas em filmes de crime, noir e finanças,
 * não são imagens oficiais). Ficam em /public/cinema: pôster 4:5 e versão redonda para o perfil.
 */
export interface Poster {
  id: string;
  title: string;
  tag: string;
}

export const POSTERS: Poster[] = [
  { id: "wall-street", title: "Wall Street", tag: "Dinheiro · excesso · risco" },
  { id: "scarface", title: "Scarface", tag: "Miami · poder · ambição" },
  { id: "the-godfather", title: "The Godfather", tag: "Família · honra · legado" },
  { id: "peaky-blinders", title: "Peaky Blinders", tag: "Ambição · estratégia · poder" },
  { id: "the-sopranos", title: "The Sopranos", tag: "Família · lealdade · poder" },
  { id: "goodfellas", title: "Goodfellas", tag: "Lealdade · crime · consequência" },
  { id: "american-psycho", title: "American Psycho", tag: "Status · obsessão · controle" },
  { id: "power-play", title: "Power Play", tag: "Negócios · estratégia · consequência" },
  { id: "casino", title: "Casino", tag: "Glamour · risco · controle" },
  { id: "heat", title: "Heat", tag: "Noite · tensão · profissionalismo" },
  { id: "boardwalk", title: "Boardwalk", tag: "Proibição · poder · política" },
  { id: "the-dark-knight", title: "The Dark Knight", tag: "Ordem · caos · escolha" },
  { id: "fight-club", title: "Fight Club", tag: "Identidade · caos · rebeldia" },
  { id: "the-departed", title: "The Departed", tag: "Segredos · lealdade · engano" },
  { id: "drive", title: "Drive", tag: "Noite · movimento · silêncio" },
  { id: "black-label", title: "Black Label", tag: "Whisky · ternos · sombras" },
  { id: "the-untouchables", title: "The Untouchables", tag: "Lei · crime · poder" },
  { id: "reservoir", title: "Reservoir", tag: "Lealdade · traição · crime" },
  { id: "taxi-driver", title: "Taxi Driver", tag: "Isolamento · cidade · noite" },
  { id: "no-country", title: "No Country", tag: "Destino · violência · silêncio" },
  { id: "memento", title: "Memento", tag: "Memória · verdade · identidade" },
  { id: "se7en", title: "Se7en", tag: "Cidade · pecado · investigação" },
  { id: "blade-runner", title: "Blade Runner", tag: "Neon · memória · futuro" },
  { id: "mulholland", title: "Mulholland", tag: "Sonhos · Hollywood · mistério" },
  { id: "casablanca", title: "Casablanca", tag: "Noite · romance · moral" },
  { id: "chinatown", title: "Chinatown", tag: "Poder · corrupção · mistério" },
  { id: "the-french-connection", title: "The French Connection", tag: "Perseguição · cidade · pressão" },
  { id: "dog-day", title: "Dog Day", tag: "Calor · tensão · caos" },
  { id: "once-upon-a-time", title: "Once Upon a Time", tag: "Memória · crime · América" },
  { id: "scarlet-night", title: "Scarlet Night", tag: "Fumaça · dinheiro · perigo" },
  { id: "midnight-club", title: "Midnight Club", tag: "Carros · cidade · neon" },
  { id: "the-last-table", title: "The Last Table", tag: "Cassino · risco · silêncio" },
];

export const posterUrl = (id: string) => `/cinema/${id}.webp`;
/** Valor salvo em profiles.avatar_url (é uma imagem comum, funciona em qualquer <Avatar>). */
export const posterAvatar = (id: string) => `/cinema/avatar/${id}.webp`;
export const posterOfAvatar = (url: string | null | undefined) => {
  const m = url?.match(/^\/cinema\/avatar\/([a-z0-9-]+)\.webp$/);
  return m ? (POSTERS.find((p) => p.id === m[1]) ?? null) : null;
};
