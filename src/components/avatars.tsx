/* Personagens ilustrados para a foto de perfil (vetores próprios, inspirados em arquétipos de filmes de negócios). */

export interface Character {
  id: string;
  name: string;
  line: string;
  bg: [string, string];
}

export const CHARACTERS: Character[] = [
  { id: "lobo", name: "O Lobo", line: "Me venda esta caneta.", bg: ["#5B34D6", "#1C1234"] },
  { id: "chefao", name: "O Chefão", line: "Uma oferta irrecusável.", bg: ["#8E1B2C", "#2A0A10"] },
  { id: "implacavel", name: "O Implacável", line: "O mundo é seu.", bg: ["#FF7A45", "#1FA3A0"] },
  { id: "tubarao", name: "O Tubarão", line: "Negócio fechado.", bg: ["#2F7BF6", "#0B1E4A"] },
  { id: "rainha", name: "A Rainha das Vendas", line: "Meta batida, sempre.", bg: ["#E0457B", "#3B0B2A"] },
  { id: "estrategista", name: "A Estrategista", line: "Cada detalhe conta.", bg: ["#1FA36A", "#0B2E22"] },
  { id: "visionario", name: "O Visionário", line: "Pense diferente.", bg: ["#3A3A48", "#0E0E14"] },
  { id: "solar", name: "Capitão Solar", line: "Energia sem limites.", bg: ["#F3EA3B", "#6CC690"] },
];

export const DEFAULT_CHARACTER = "lobo";
export const presetId = (url: string | null | undefined) => (url?.startsWith("preset:") ? url.slice(7) : null);
export const characterOf = (id: string | null | undefined) => CHARACTERS.find((c) => c.id === id) ?? null;

const SKIN = { a: "#F2C7A5", b: "#D9A27E", c: "#A8704E", d: "#7A4E34" };

/** Retrato vetorial do personagem (quadrado, recortado em círculo por quem usa). */
export function CharacterArt({ id, className }: { id: string; className?: string }) {
  const c = characterOf(id) ?? CHARACTERS[0];
  const g = `av-${c.id}`;
  const skin = { lobo: SKIN.a, chefao: SKIN.b, implacavel: SKIN.b, tubarao: SKIN.a, rainha: SKIN.c, estrategista: SKIN.a, visionario: SKIN.a, solar: SKIN.d }[c.id] ?? SKIN.a;

  // Roupa: cor do terno, camisa e o que vai no pescoço.
  const outfit = {
    lobo: { suit: "#1B2340", shirt: "#FFFFFF", tie: "#B8342F" },
    chefao: { suit: "#0E0E12", shirt: "#FFFFFF", tie: "bow" },
    implacavel: { suit: "#F4F1EA", shirt: "#1F2B3A", tie: "open" },
    tubarao: { suit: "#4A5566", shirt: "#DCE6F2", tie: "#1D3F8F" },
    rainha: { suit: "#C1273D", shirt: "#F6E7DA", tie: "none" },
    estrategista: { suit: "#15161C", shirt: "#FFFFFF", tie: "none" },
    visionario: { suit: "#111114", shirt: "#111114", tie: "turtle" },
    solar: { suit: "#FF8A1F", shirt: "#2A2F3A", tie: "vest" },
  }[c.id]!;

  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${g}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c.bg[0]} />
          <stop offset="1" stopColor={c.bg[1]} />
        </linearGradient>
        <radialGradient id={`${g}-glow`} cx="0.5" cy="0.35" r="0.6">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#${g}-bg)`} />
      <rect width="120" height="120" fill={`url(#${g}-glow)`} />

      {/* cabelo de trás (longo) */}
      {c.id === "rainha" && <path d="M32 50 Q30 92 40 104 L80 104 Q90 92 88 50 Q60 20 32 50Z" fill="#2B1810" />}

      {/* ombros e roupa */}
      <path d="M14 120 Q16 92 44 86 L76 86 Q104 92 106 120Z" fill={outfit.suit} />
      {outfit.tie === "turtle" ? (
        <path d="M46 84 L74 84 L76 96 Q60 102 44 96Z" fill="#1C1C22" />
      ) : outfit.tie === "vest" ? (
        <>
          <path d="M44 86 L60 112 L76 86Z" fill={outfit.shirt} />
          <rect x="30" y="98" width="60" height="5" fill="#E7F03C" opacity="0.9" />
        </>
      ) : (
        <path d="M46 86 L60 108 L74 86Z" fill={outfit.shirt} />
      )}
      {typeof outfit.tie === "string" && outfit.tie.startsWith("#") && <path d="M57 88 L63 88 L65 106 L60 112 L55 106Z" fill={outfit.tie} />}
      {outfit.tie === "bow" && <path d="M52 88 L60 92 L68 88 L68 96 L60 92 L52 96Z" fill="#0A0A0C" />}
      {outfit.tie === "open" && (
        <>
          <path d="M50 86 L60 100 L70 86Z" fill={skin} />
          <path d="M52 96 Q60 104 68 96" stroke="#E8C24A" strokeWidth="1.6" fill="none" />
        </>
      )}
      {/* lapelas */}
      {outfit.tie !== "turtle" && outfit.tie !== "vest" && (
        <>
          <path d="M44 86 L56 110 L48 112 L38 92Z" fill="#000" opacity="0.18" />
          <path d="M76 86 L64 110 L72 112 L82 92Z" fill="#000" opacity="0.18" />
        </>
      )}
      {c.id === "chefao" && <circle cx="42" cy="98" r="3.2" fill="#D6283A" />}

      {/* pescoço, orelhas e rosto */}
      <rect x="52" y="70" width="16" height="18" rx="6" fill={skin} />
      <ellipse cx="38" cy="56" rx="4" ry="6" fill={skin} />
      <ellipse cx="82" cy="56" rx="4" ry="6" fill={skin} />
      <ellipse cx="60" cy="54" rx="21" ry="25" fill={skin} />
      <path d="M44 68 Q60 84 76 68" fill="#000" opacity="0.06" />

      {/* olhos e boca */}
      {["implacavel", "tubarao"].includes(c.id) ? (
        <g>
          <rect x="44" y="49" width="14" height="9" rx="3.5" fill="#101218" />
          <rect x="62" y="49" width="14" height="9" rx="3.5" fill="#101218" />
          <path d="M58 52 L62 52" stroke="#101218" strokeWidth="2" />
          <path d="M46 51 L52 51" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="1.5" />
        </g>
      ) : (
        <g>
          <ellipse cx="52" cy="54" rx="2.4" ry="2.8" fill="#1B1B22" />
          <ellipse cx="68" cy="54" rx="2.4" ry="2.8" fill="#1B1B22" />
          <path d="M47 47 Q52 44.5 56 46.5" stroke="#2A1A12" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M64 46.5 Q68 44.5 73 47" stroke="#2A1A12" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      )}
      {["estrategista", "visionario"].includes(c.id) && (
        <g fill="none" stroke="#1B1B22" strokeWidth="1.6">
          <circle cx="52" cy="54" r="6" />
          <circle cx="68" cy="54" r="6" />
          <path d="M58 54 L62 54" />
        </g>
      )}
      <path d={c.id === "chefao" ? "M53 67 Q60 69 67 67" : "M52 66 Q60 72 68 66"} stroke="#7A3B2A" strokeWidth="2" fill="none" strokeLinecap="round" />
      {c.id === "implacavel" && <rect x="66" y="66" width="12" height="3" rx="1.5" fill="#8B5A2B" transform="rotate(-12 66 66)" />}
      {c.id === "chefao" && <path d="M50 62 Q60 60 70 62" stroke="#3A2A20" strokeWidth="2.2" fill="none" opacity="0.6" />}

      {/* cabelo / chapéu por personagem */}
      {c.id === "lobo" && <path d="M38 50 Q36 26 60 24 Q86 24 84 48 Q80 36 64 34 Q48 34 42 44Z" fill="#8A6A3C" />}
      {c.id === "chefao" && (
        <>
          <path d="M34 42 Q34 28 60 26 Q86 28 86 42Z" fill="#141418" />
          <rect x="30" y="40" width="60" height="6" rx="3" fill="#141418" />
          <rect x="37" y="37" width="46" height="4" fill="#5A1A24" />
        </>
      )}
      {c.id === "implacavel" && <path d="M38 50 Q36 26 60 26 Q84 26 82 50 Q80 36 60 36 Q44 36 38 50Z" fill="#141014" />}
      {c.id === "tubarao" && <path d="M39 46 Q40 28 60 27 Q80 28 81 46 Q72 38 60 38 Q48 38 39 46Z" fill="#6E747C" />}
      {c.id === "rainha" && (
        <>
          <path d="M38 52 Q38 28 60 28 Q82 28 82 52 Q76 38 60 36 Q46 38 38 52Z" fill="#2B1810" />
          <path d="M46 26 L50 16 L55 24 L60 13 L65 24 L70 16 L74 26Z" fill="#F3C94A" stroke="#C99A1E" strokeWidth="1" />
        </>
      )}
      {c.id === "estrategista" && (
        <>
          <path d="M38 50 Q38 28 60 28 Q82 28 82 50 Q78 36 60 35 Q44 36 38 50Z" fill="#3A2416" />
          <circle cx="60" cy="24" r="8" fill="#3A2416" />
        </>
      )}
      {c.id === "visionario" && <path d="M40 44 Q42 30 60 30 Q78 30 80 44 Q70 38 60 38 Q50 38 40 44Z" fill="#2A2A30" />}
      {c.id === "solar" && (
        <>
          <path d="M34 46 Q34 22 60 22 Q86 22 86 46Z" fill="#F7D21E" />
          <rect x="30" y="44" width="60" height="6" rx="3" fill="#E0B400" />
          <rect x="56" y="24" width="8" height="18" rx="3" fill="#FFE766" />
        </>
      )}
    </svg>
  );
}
