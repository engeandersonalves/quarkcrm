"use client";

import { useId, type ReactNode } from "react";

/**
 * Ícones premium no estilo dos Ajustes do iOS 27 escuro: símbolos preenchidos,
 * com degradê, reflexo e detalhes vazados, sobre um quadrado preto com borda de luz.
 * Sem azul: paleta quente + verdes, para combinar com a marca e telas OLED.
 */
export type GlyphId =
  | "painel"
  | "leads"
  | "propostas"
  | "tarefas"
  | "raio"
  | "documentos"
  | "contratos"
  | "recibos"
  | "marketing"
  | "sol"
  | "relatorios"
  | "engrenagem"
  | "aparencia"
  | "sair"
  | "novoLead"
  | "novaTarefa"
  | "chama"
  | "calculadora"
  | "plugue"
  | "chave"
  | "busca"
  | "sino"
  | "pacote"
  | "codigo"
  | "integracao"
  | "pessoa"
  | "equipe"
  | "estrela"
  | "alerta";

type Grad = [string, string];
const C = {
  amarelo: ["#FFE45C", "#FFB800"] as Grad,
  laranja: ["#FFC069", "#FF7A00"] as Grad,
  vermelho: ["#FF8A80", "#FF2D20"] as Grad,
  verde: ["#7CF29A", "#1FB04A"] as Grad,
  lima: ["#E4FA7A", "#8CC63F"] as Grad,
  rosa: ["#FF8FAB", "#FF2D55"] as Grad,
  roxo: ["#DDA6FF", "#9B4DFF"] as Grad,
  menta: ["#8CF5D2", "#14B886"] as Grad,
  cinza: ["#F2F2F7", "#8E8E93"] as Grad,
  branco: ["#FFFFFF", "#C7C7CC"] as Grad,
};

/** f = preenchimento principal; d = cor dos detalhes vazados */
const GLYPHS: Record<GlyphId, { g: Grad; draw: (f: string, d: string) => ReactNode }> = {
  painel: {
    g: C.amarelo,
    draw: (f) => (
      <>
        <rect x="3" y="3" width="8" height="8" rx="2.4" fill={f} />
        <rect x="13" y="3" width="8" height="8" rx="2.4" fill={f} opacity=".55" />
        <rect x="3" y="13" width="8" height="8" rx="2.4" fill={f} opacity=".55" />
        <rect x="13" y="13" width="8" height="8" rx="2.4" fill={f} />
      </>
    ),
  },
  leads: {
    g: C.verde,
    draw: (f) => (
      <>
        <circle cx="16.6" cy="8.2" r="2.9" fill={f} opacity=".55" />
        <path d="M14.8 13.4c.6-.1 1.2-.2 1.8-.2 3.1 0 5.4 2 5.4 5.1v.9h-4.6c-.3-2.4-1.1-4.3-2.6-5.8z" fill={f} opacity=".55" />
        <circle cx="9" cy="7.8" r="3.6" fill={f} />
        <path d="M2.2 19.4c0-3.8 3-6.4 6.8-6.4s6.8 2.6 6.8 6.4v.8H2.2z" fill={f} />
      </>
    ),
  },
  propostas: {
    g: C.laranja,
    draw: (f, d) => (
      <>
        <path d="M6.2 2h7.6L20 8.2v11.6A2.2 2.2 0 0 1 17.8 22H6.2A2.2 2.2 0 0 1 4 19.8V4.2A2.2 2.2 0 0 1 6.2 2z" fill={f} />
        <path d="M13.8 2v4.4c0 1 .8 1.8 1.8 1.8H20z" fill={d} opacity=".45" />
        <rect x="7.5" y="12" width="9" height="1.7" rx=".85" fill={d} />
        <rect x="7.5" y="15.6" width="6" height="1.7" rx=".85" fill={d} />
      </>
    ),
  },
  tarefas: {
    g: C.vermelho,
    draw: (f, d) => (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5.2" fill={f} />
        <path d="M7.8 12.4l2.9 2.9 5.6-6" fill="none" stroke={d} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  raio: { g: C.amarelo, draw: (f) => <path d="M13.6 1.8 4.4 13.4c-.4.5 0 1.1.6 1.1h5.4l-1 7.2c-.1.6.7.9 1 .4l9.2-11.6c.4-.5 0-1.1-.6-1.1h-5.4l1-7.2c.1-.6-.7-.9-1-.4z" fill={f} /> },
  documentos: {
    g: C.roxo,
    draw: (f, d) => (
      <>
        <rect x="4" y="2" width="16" height="20" rx="3" fill={f} />
        <path d="M7.4 15.6c1.2-2.6 2.3-3.4 2.8-2.6.6 1-1.2 3.3.1 3.4 1.1.1 1.6-1.6 2.6-1.6.8 0 .7 1.1 1.5 1.1.6 0 1.2-.5 2.2-.9" fill="none" stroke={d} strokeWidth="1.5" strokeLinecap="round" />
        <rect x="7.5" y="6" width="9" height="1.7" rx=".85" fill={d} />
        <rect x="7.5" y="9.2" width="6" height="1.7" rx=".85" fill={d} opacity=".7" />
      </>
    ),
  },
  contratos: {
    g: C.menta,
    draw: (f, d) => (
      <>
        <path d="M7 2.5h11.5A2.5 2.5 0 0 1 21 5v1.5h-3V19a2.5 2.5 0 0 1-2.5 2.5H6A3 3 0 0 1 3 18.5V17h11v1.5c0 .8.5 1.4 1 1.6V5c0-.9-.4-1.8-1-2.5z" fill={f} opacity=".55" />
        <path d="M5.5 2.5H15A2.5 2.5 0 0 1 17.5 5v14.5h-11A2 2 0 0 1 4.5 17.5V4a1.5 1.5 0 0 1 1-1.5z" fill={f} />
        <rect x="7.5" y="7" width="7" height="1.6" rx=".8" fill={d} />
        <rect x="7.5" y="10.2" width="7" height="1.6" rx=".8" fill={d} />
        <rect x="7.5" y="13.4" width="4.5" height="1.6" rx=".8" fill={d} />
      </>
    ),
  },
  recibos: {
    g: C.verde,
    draw: (f, d) => (
      <>
        <path d="M5 2.8C5 2.4 5.4 2 5.8 2h12.4c.4 0 .8.4.8.8V21c0 .6-.6.9-1.1.6l-1.9-1.3-2.2 1.5c-.3.2-.6.2-.9 0L12 20.3l-1.9 1.5c-.3.2-.6.2-.9 0L7 20.3l-.9.6c-.5.3-1.1 0-1.1-.6z" fill={f} />
        <rect x="8" y="6.5" width="8" height="1.7" rx=".85" fill={d} />
        <rect x="8" y="10" width="8" height="1.7" rx=".85" fill={d} opacity=".75" />
        <rect x="8" y="13.5" width="4.5" height="1.7" rx=".85" fill={d} />
      </>
    ),
  },
  marketing: {
    g: C.rosa,
    draw: (f, d) => (
      <>
        <path d="M3 10.2v3.6c0 .8.6 1.4 1.4 1.4h1.8l1.3 5c.2.7.8 1.1 1.4 1.1h.6c.8 0 1.4-.8 1.2-1.6l-1.1-4.4L17 19c.9.4 2-.3 2-1.3V6.3c0-1-1.1-1.7-2-1.3L9.6 8.8H4.4c-.8 0-1.4.6-1.4 1.4z" fill={f} />
        <path d="M21 9.5c.8.7.8 4.3 0 5" fill="none" stroke={f} strokeWidth="1.8" strokeLinecap="round" />
        <rect x="9.3" y="9" width="1.3" height="6" rx=".65" fill={d} opacity=".45" />
      </>
    ),
  },
  sol: {
    g: C.amarelo,
    draw: (f) => (
      <>
        <circle cx="12" cy="12" r="4.8" fill={f} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <rect key={a} x="11" y="1.6" width="2" height="3.6" rx="1" fill={f} transform={`rotate(${a} 12 12)`} />
        ))}
      </>
    ),
  },
  relatorios: {
    g: C.roxo,
    draw: (f) => (
      <>
        <rect x="3.5" y="12" width="4.4" height="9" rx="1.6" fill={f} opacity=".6" />
        <rect x="9.8" y="7" width="4.4" height="14" rx="1.6" fill={f} opacity=".8" />
        <rect x="16.1" y="3" width="4.4" height="18" rx="1.6" fill={f} />
      </>
    ),
  },
  engrenagem: {
    g: C.cinza,
    draw: (f, d) => (
      <>
        {[0, 45, 90, 135].map((a) => (
          <rect key={a} x="10.2" y="1.8" width="3.6" height="20.4" rx="1.4" fill={f} transform={`rotate(${a} 12 12)`} />
        ))}
        <circle cx="12" cy="12" r="7.4" fill={f} />
        <circle cx="12" cy="12" r="3" fill={d} />
      </>
    ),
  },
  aparencia: {
    g: C.branco,
    draw: (f) => (
      <>
        <circle cx="12" cy="12" r="8.6" fill="none" stroke={f} strokeWidth="2.2" />
        <path d="M12 5.4a6.6 6.6 0 0 1 0 13.2z" fill={f} />
      </>
    ),
  },
  sair: {
    g: C.vermelho,
    draw: (f, d) => (
      <>
        <path d="M5.5 3h7A2.5 2.5 0 0 1 15 5.5V8h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4v2.5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 3 18.5v-13A2.5 2.5 0 0 1 5.5 3z" fill={f} />
        <path d="M11 12h9.5m-3-3.2 3.2 3.2-3.2 3.2" fill="none" stroke={f} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6.5" cy="12" r="1" fill={d} opacity=".6" />
      </>
    ),
  },
  novoLead: {
    g: C.verde,
    draw: (f) => (
      <>
        <circle cx="9" cy="7.8" r="3.6" fill={f} />
        <path d="M2.2 19.4c0-3.8 3-6.4 6.8-6.4 1.6 0 3 .4 4.1 1.2a5 5 0 0 0 1.4 6H2.2z" fill={f} />
        <circle cx="18" cy="17" r="4.5" fill={f} opacity=".55" />
        <path d="M18 14.6v4.8M15.6 17h4.8" stroke={f} strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
  novaTarefa: {
    g: C.lima,
    draw: (f, d) => (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5.2" fill={f} />
        <rect x="7" y="8" width="1.9" height="1.9" rx=".95" fill={d} />
        <rect x="10.6" y="8.1" width="6.4" height="1.7" rx=".85" fill={d} />
        <rect x="7" y="13.8" width="1.9" height="1.9" rx=".95" fill={d} />
        <rect x="10.6" y="13.9" width="6.4" height="1.7" rx=".85" fill={d} />
      </>
    ),
  },
  chama: {
    g: C.laranja,
    draw: (f, d) => (
      <>
        <path d="M12.4 1.8c.7 3.6 5.6 5.7 5.6 11.3A6 6 0 0 1 12 19.1a6 6 0 0 1-6-6c0-2.7 1.5-4.2 2.6-5.4.2 1.6.9 2.8 2 3-.9-3.2.5-6.4 1.8-8.9z" fill={f} transform="translate(0 2.4)" />
        <path d="M12 21.5a2.8 2.8 0 0 1-2.8-2.8c0-1.6 1.4-2.4 2-3.6.9 1.5 3.6 2 3.6 3.6a2.8 2.8 0 0 1-2.8 2.8z" fill={d} opacity=".55" />
      </>
    ),
  },
  calculadora: {
    g: C.amarelo,
    draw: (f, d) => (
      <>
        <rect x="4" y="2" width="16" height="20" rx="3.6" fill={f} />
        <rect x="7" y="5" width="10" height="4" rx="1.2" fill={d} opacity=".55" />
        {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <circle key={`${r}${c}`} cx={8.2 + c * 3.8} cy={12.6 + r * 3.1} r="1.15" fill={d} />))}
      </>
    ),
  },
  plugue: {
    g: C.verde,
    draw: (f, d) => (
      <>
        <rect x="8" y="2" width="2.2" height="5" rx="1.1" fill={f} />
        <rect x="13.8" y="2" width="2.2" height="5" rx="1.1" fill={f} />
        <path d="M5.5 7h13c.6 0 1 .4 1 1v2.5a7.5 7.5 0 0 1-6 7.3V22h-3v-4.2a7.5 7.5 0 0 1-6-7.3V8c0-.6.4-1 1-1z" fill={f} />
        <path d="M12.6 9.5 10.4 13h2.4l-1.2 3" fill="none" stroke={d} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  chave: { g: C.cinza, draw: (f) => <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" fill={f} /> },
  busca: {
    g: C.cinza,
    draw: (f) => (
      <>
        <circle cx="10.5" cy="10.5" r="6.4" fill="none" stroke={f} strokeWidth="2.6" />
        <path d="M15.4 15.4 20.5 20.5" stroke={f} strokeWidth="3" strokeLinecap="round" />
      </>
    ),
  },
  sino: {
    g: C.vermelho,
    draw: (f) => (
      <>
        <path d="M12 2.5a6.2 6.2 0 0 0-6.2 6.2v3.6L4 15.8c-.4.7.1 1.5.9 1.5h14.2c.8 0 1.3-.8.9-1.5l-1.8-3.5V8.7A6.2 6.2 0 0 0 12 2.5z" fill={f} />
        <path d="M9.4 18.6a2.6 2.6 0 0 0 5.2 0z" fill={f} />
      </>
    ),
  },
  pacote: {
    g: C.laranja,
    draw: (f, d) => (
      <>
        <path d="M12 2 3 6.6v10.8L12 22l9-4.6V6.6z" fill={f} />
        <path d="M3 6.6 12 11l9-4.4M12 11v11" fill="none" stroke={d} strokeWidth="1.4" opacity=".5" />
      </>
    ),
  },
  codigo: {
    g: C.menta,
    draw: (f, d) => (
      <>
        <rect x="2.5" y="4" width="19" height="16" rx="4" fill={f} />
        <path d="M9.5 9 6.5 12l3 3M14.5 9l3 3-3 3" fill="none" stroke={d} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  integracao: {
    g: C.roxo,
    draw: (f) => (
      <>
        <circle cx="6" cy="18" r="3.4" fill={f} />
        <circle cx="18" cy="18" r="3.4" fill={f} opacity=".7" />
        <circle cx="12" cy="6" r="3.4" fill={f} opacity=".85" />
        <path d="M10.4 9 7.6 15M13.6 9l2.8 6M9.4 18h5.2" stroke={f} strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
  pessoa: {
    g: C.cinza,
    draw: (f) => (
      <>
        <circle cx="12" cy="7.6" r="4" fill={f} />
        <path d="M4.5 20c0-4 3.4-7 7.5-7s7.5 3 7.5 7v.6h-15z" fill={f} />
      </>
    ),
  },
  equipe: {
    g: C.laranja,
    draw: (f) => (
      <>
        <circle cx="5.8" cy="9" r="2.5" fill={f} opacity=".55" />
        <circle cx="18.2" cy="9" r="2.5" fill={f} opacity=".55" />
        <path d="M1.5 18.5c0-2.6 1.9-4.4 4.3-4.4 1 0 1.9.3 2.6.8-1 1.1-1.6 2.6-1.6 4.4v.4H1.5zM22.5 18.5c0-2.6-1.9-4.4-4.3-4.4-1 0-1.9.3-2.6.8 1 1.1 1.6 2.6 1.6 4.4v.4h5.3z" fill={f} opacity=".55" />
        <circle cx="12" cy="8" r="3.4" fill={f} />
        <path d="M6.6 19.8c0-3.4 2.4-5.8 5.4-5.8s5.4 2.4 5.4 5.8v.5H6.6z" fill={f} />
      </>
    ),
  },
  estrela: { g: C.amarelo, draw: (f) => <path d="m12 2.4 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.3l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" fill={f} strokeLinejoin="round" /> },
  alerta: {
    g: C.laranja,
    draw: (f, d) => (
      <>
        <path d="M10.3 3.3 2.2 17.8A2 2 0 0 0 4 20.8h16a2 2 0 0 0 1.8-3L13.7 3.3a2 2 0 0 0-3.4 0z" fill={f} />
        <rect x="11" y="8.4" width="2" height="6.4" rx="1" fill={d} />
        <circle cx="12" cy="17.3" r="1.2" fill={d} />
      </>
    ),
  },
};

/** Só o símbolo (sem o quadrado). `mono` = cor única (para abas inativas). */
export function Glyph({ id, className, mono }: { id: GlyphId; className?: string; mono?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const def = GLYPHS[id];
  const gid = `g${uid}`;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {!mono && (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={def.g[0]} />
            <stop offset="1" stopColor={def.g[1]} />
          </linearGradient>
        </defs>
      )}
      {def.draw(mono ? "currentColor" : `url(#${gid})`, mono ? "#000" : "#141416")}
    </svg>
  );
}

const SIZE = {
  xs: ["h-[26px] w-[26px] rounded-[7.5px]", "h-[16px] w-[16px]"],
  sm: ["h-[30px] w-[30px] rounded-[8.5px]", "h-[19px] w-[19px]"],
  md: ["h-9 w-9 rounded-[10px]", "h-[22px] w-[22px]"],
  lg: ["h-12 w-12 rounded-[13px]", "h-[28px] w-[28px]"],
  xl: ["h-16 w-16 rounded-[18px]", "h-[38px] w-[38px]"],
} as const;

/** Ícone completo: quadrado preto com borda de luz + símbolo colorido. */
export function GlyphTile({ id, size = "sm", className }: { id: GlyphId; size?: keyof typeof SIZE; className?: string }) {
  const [box, glyph] = SIZE[size];
  return (
    <span className={`ios-tile ${box} ${className ?? ""}`} aria-hidden>
      <Glyph id={id} className={`relative ${glyph} drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.6)]`} />
    </span>
  );
}

/** Ícone da página atual pela rota (cabeçalhos das telas). */
const BY_PATH: [string, GlyphId][] = [
  ["/monitoramento/alarmes", "alerta"],
  ["/monitoramento", "sol"],
  ["/leads", "leads"],
  ["/propostas", "propostas"],
  ["/tarefas", "tarefas"],
  ["/orcamento-rapido", "raio"],
  ["/documentos", "documentos"],
  ["/contratos", "contratos"],
  ["/recibos", "recibos"],
  ["/marketing", "marketing"],
  ["/relatorios", "relatorios"],
  ["/configuracoes", "engrenagem"],
  ["/perfil", "pessoa"],
  ["/ranking", "estrela"],
  ["/funil", "relatorios"],
];
export const glyphForPath = (p: string): GlyphId | null => BY_PATH.find(([k]) => p.startsWith(k))?.[1] ?? null;
