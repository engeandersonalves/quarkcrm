/**
 * Prospecção ativa: nichos de comércio, estimativa de consumo pelo tipo e horário
 * de funcionamento, leitura de horários (OSM/Google) e dos contatos de um site.
 */

export type Size = "P" | "M" | "G";

/** Comércio encontrado (OpenStreetMap ou Google Places). */
export interface Prospect {
  id: string;
  source: "osm" | "google";
  name: string;
  niche: string | null;
  lat: number;
  lon: number;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  hours: string | null;
  hoursWeek: number | null;
  rating: number | null;
  reviews: number | null;
  mapsUrl: string | null;
}

export interface Niche {
  id: string;
  label: string;
  emoji: string;
  /** Consumo típico de um comércio médio do nicho (kWh/mês, horário comercial). */
  kwh: number;
  /** Filtros do OpenStreetMap (chave=valor). */
  osm: string[];
  /** Termo de busca no Google. */
  google: string;
  /** Argumento de venda (o que pesa na conta desse negócio). */
  pitch: string;
}

export const NICHES: Niche[] = [
  { id: "supermercado", label: "Supermercados", emoji: "🛒", kwh: 7000, osm: ["shop=supermarket", "shop=convenience", "shop=greengrocer"], google: "supermercado", pitch: "câmaras frias e refrigeradores ligados 24h" },
  { id: "padaria", label: "Padarias", emoji: "🥖", kwh: 3500, osm: ["shop=bakery", "shop=pastry"], google: "padaria", pitch: "fornos elétricos e refrigeração o dia inteiro" },
  { id: "restaurante", label: "Restaurantes", emoji: "🍽️", kwh: 2800, osm: ["amenity=restaurant", "amenity=fast_food", "amenity=cafe", "amenity=bar"], google: "restaurante", pitch: "ar-condicionado, freezers e cozinha em horário de pico" },
  { id: "academia", label: "Academias", emoji: "🏋️", kwh: 3200, osm: ["leisure=fitness_centre", "leisure=sports_centre"], google: "academia", pitch: "ar-condicionado, esteiras e iluminação por muitas horas" },
  { id: "hotel", label: "Hotéis e pousadas", emoji: "🏨", kwh: 5000, osm: ["tourism=hotel", "tourism=guest_house", "tourism=hostel", "tourism=motel"], google: "hotel pousada", pitch: "ar-condicionado nos quartos e água quente 24h" },
  { id: "posto", label: "Postos de combustível", emoji: "⛽", kwh: 3800, osm: ["amenity=fuel"], google: "posto de combustível", pitch: "bombas, conveniência e iluminação a noite toda" },
  { id: "farmacia", label: "Farmácias", emoji: "💊", kwh: 1600, osm: ["amenity=pharmacy", "shop=chemist"], google: "farmácia", pitch: "ar-condicionado e refrigeração de medicamentos" },
  { id: "clinica", label: "Clínicas e consultórios", emoji: "🩺", kwh: 1800, osm: ["amenity=clinic", "amenity=dentist", "amenity=doctors", "healthcare=clinic"], google: "clínica", pitch: "equipamentos, esterilização e climatização" },
  { id: "escola", label: "Escolas", emoji: "🏫", kwh: 3000, osm: ["amenity=school", "amenity=kindergarten", "amenity=college"], google: "escola", pitch: "salas climatizadas e laboratórios de dia inteiro" },
  { id: "oficina", label: "Oficinas mecânicas", emoji: "🔧", kwh: 1300, osm: ["shop=car_repair", "shop=tyres", "craft=electrician"], google: "oficina mecânica", pitch: "compressores, elevadores e ferramentas elétricas" },
  { id: "acougue", label: "Açougues", emoji: "🥩", kwh: 3000, osm: ["shop=butcher", "shop=seafood"], google: "açougue", pitch: "câmara fria e balcões refrigerados 24h" },
  { id: "sorveteria", label: "Sorveterias e açaí", emoji: "🍨", kwh: 2600, osm: ["amenity=ice_cream"], google: "sorveteria açaí", pitch: "freezers e máquinas de sorvete sem parar" },
  { id: "lavanderia", label: "Lavanderias", emoji: "🧺", kwh: 3200, osm: ["shop=laundry", "shop=dry_cleaning"], google: "lavanderia", pitch: "lavadoras e secadoras industriais" },
  { id: "varejo", label: "Lojas e varejo", emoji: "🛍️", kwh: 1000, osm: ["shop=clothes", "shop=shoes", "shop=hardware", "shop=furniture", "shop=electronics", "shop=department_store"], google: "loja", pitch: "vitrines iluminadas e ar-condicionado" },
  { id: "industria", label: "Indústrias e galpões", emoji: "🏭", kwh: 15000, osm: ["building=industrial", "landuse=industrial", "man_made=works", "building=warehouse"], google: "indústria fábrica", pitch: "máquinas e motores em turnos longos" },
  { id: "igreja", label: "Igrejas", emoji: "⛪", kwh: 900, osm: ["amenity=place_of_worship"], google: "igreja", pitch: "som, iluminação e ar-condicionado nos cultos" },
];

export const nicheOf = (id: string | null | undefined) => NICHES.find((n) => n.id === id) ?? null;

/** Nicho a partir das tags do OpenStreetMap. */
export function nicheFromTags(tags: Record<string, string>): Niche | null {
  for (const n of NICHES) {
    for (const f of n.osm) {
      const [k, v] = f.split("=");
      if (tags[k] === v) return n;
    }
  }
  return null;
}

/* ------------------------------------------------------------ fontes de dados */

type OsmElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

/** Converte um elemento do Overpass (OpenStreetMap) em comércio. */
export function osmToProspect(el: OsmElement, fallbackNiche: string | null = null): Prospect | null {
  const t = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!t.name || lat == null || lon == null) return null;
  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
  const address = [street, t["addr:suburb"] ?? t["addr:neighbourhood"]].filter(Boolean).join(" · ") || null;
  const pick = (...keys: string[]) => keys.map((k) => t[k]).find((v) => v && v.trim())?.trim() ?? null;
  const phone = pick("phone", "contact:phone", "contact:mobile", "mobile")?.split(";")[0].trim() ?? null;
  const hours = pick("opening_hours");
  return {
    id: `osm-${el.type}-${el.id}`,
    source: "osm",
    name: t.name,
    niche: nicheFromTags(t)?.id ?? fallbackNiche,
    lat,
    lon,
    address,
    city: pick("addr:city"),
    phone,
    email: pick("email", "contact:email")?.split(";")[0].trim() ?? null,
    website: pick("website", "contact:website", "url"),
    instagram: instagramHandle(pick("contact:instagram", "instagram")),
    facebook: pick("contact:facebook", "facebook"),
    whatsapp: pick("contact:whatsapp", "whatsapp"),
    hours,
    hoursWeek: osmHoursPerWeek(hours),
    rating: null,
    reviews: null,
    mapsUrl: null,
  };
}

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[]; periods?: Parameters<typeof googleHoursPerWeek>[0] };
};

/** Converte um resultado do Google Places (API nova) em comércio. */
export function googleToProspect(p: GooglePlace, niche: string | null): Prospect | null {
  const lat = p.location?.latitude;
  const lon = p.location?.longitude;
  const name = p.displayName?.text;
  if (!name || lat == null || lon == null) return null;
  const parts = (p.formattedAddress ?? "").split(" - ");
  return {
    id: `g-${p.id ?? `${lat},${lon}`}`,
    source: "google",
    name,
    niche,
    lat,
    lon,
    address: p.formattedAddress ?? null,
    city: parts.length > 1 ? (parts[parts.length - 1].split(",")[0]?.trim() ?? null) : null,
    phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
    email: null,
    website: p.websiteUri ?? null,
    instagram: p.websiteUri?.includes("instagram.com") ? instagramHandle(p.websiteUri) : null,
    facebook: p.websiteUri?.includes("facebook.com") ? p.websiteUri : null,
    whatsapp: null,
    hours: p.regularOpeningHours?.weekdayDescriptions?.join(" · ") ?? null,
    hoursWeek: googleHoursPerWeek(p.regularOpeningHours?.periods),
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? null,
    mapsUrl: p.googleMapsUri ?? null,
  };
}

/** Consulta Overpass: comércios do nicho num raio (m) em volta do ponto. */
export function overpassQuery(niche: Niche, lat: number, lon: number, radiusM: number) {
  const parts = niche.osm.map((f) => {
    const [k, v] = f.split("=");
    return `nwr["${k}"="${v}"]["name"](around:${Math.round(radiusM)},${lat.toFixed(6)},${lon.toFixed(6)});`;
  });
  return `[out:json][timeout:25];(${parts.join("")});out center tags 250;`;
}

/* ------------------------------------------------------------------ horários */

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function minutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h)) return NaN;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

/** Horas de funcionamento por semana a partir do opening_hours do OSM (null se não der para ler). */
export function osmHoursPerWeek(spec: string | null | undefined): number | null {
  if (!spec) return null;
  const s = spec.trim();
  if (/^24\/7$/.test(s)) return 168;
  const perDay = new Array(7).fill(0);
  let understood = false;
  for (const raw of s.split(";")) {
    const rule = raw.trim();
    if (!rule) continue;
    const m = rule.match(/^((?:[A-Z][a-z](?:-[A-Z][a-z])?,?\s*)+)\s+(.+)$/);
    const dayPart = m ? m[1] : "Mo-Su";
    const timePart = m ? m[2] : rule;
    if (/off|closed/i.test(timePart)) continue;
    const days = new Set<number>();
    for (const chunk of dayPart.split(",").map((x) => x.trim()).filter(Boolean)) {
      const [a, b] = chunk.split("-");
      const ia = DAYS.indexOf(a);
      const ib = b ? DAYS.indexOf(b) : ia;
      if (ia < 0 || ib < 0) continue;
      for (let i = ia; ; i = (i + 1) % 7) {
        days.add(i);
        if (i === ib) break;
      }
    }
    let dayMinutes = 0;
    for (const range of timePart.split(",")) {
      const [start, end] = range.trim().split("-");
      if (!start || !end) continue;
      const a = minutes(start);
      let b = minutes(end.replace("+", ""));
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (b <= a) b += 24 * 60;
      dayMinutes += b - a;
    }
    if (!dayMinutes || !days.size) continue;
    understood = true;
    days.forEach((d) => (perDay[d] = dayMinutes / 60));
  }
  if (!understood) return null;
  return Math.round(perDay.reduce((x, y) => x + y, 0));
}

/** Horas por semana a partir dos períodos do Google Places. */
export function googleHoursPerWeek(periods: { open?: { day?: number; hour?: number; minute?: number }; close?: { day?: number; hour?: number; minute?: number } }[] | null | undefined) {
  if (!periods?.length) return null;
  // Aberto 24h: um período sem fechamento.
  if (periods.length === 1 && !periods[0].close) return 168;
  let total = 0;
  for (const p of periods) {
    if (!p.open || !p.close) continue;
    const a = (p.open.day ?? 0) * 1440 + (p.open.hour ?? 0) * 60 + (p.open.minute ?? 0);
    let b = (p.close.day ?? 0) * 1440 + (p.close.hour ?? 0) * 60 + (p.close.minute ?? 0);
    if (b <= a) b += 7 * 1440;
    total += b - a;
  }
  return total ? Math.round(total / 60) : null;
}

/* ------------------------------------------------------------------ consumo */

const SIZE_FACTOR: Record<Size, number> = { P: 0.55, M: 1, G: 1.9 };

/**
 * Consumo estimado (kWh/mês): base do nicho × fator de horário (60h/semana = 1) × porte.
 * Devolve uma faixa (−25% / +35%) porque é uma sugestão para a abordagem, não um laudo.
 */
export function estimateConsumption(niche: Niche, hoursWeek: number | null, size: Size = "M") {
  const hoursFactor = hoursWeek ? Math.min(2.4, Math.max(0.55, hoursWeek / 60)) : 1;
  const kwh = Math.round((niche.kwh * hoursFactor * SIZE_FACTOR[size]) / 10) * 10;
  return { kwh, min: Math.round((kwh * 0.75) / 10) * 10, max: Math.round((kwh * 1.35) / 10) * 10, hoursFactor };
}

/** Potencial da abordagem: consumo alto e contato fácil primeiro. */
export function prospectScore(kwh: number, contact: { phone?: string | null; email?: string | null; instagram?: string | null; website?: string | null }) {
  let s = Math.min(60, kwh / 150);
  if (contact.phone) s += 25;
  if (contact.email) s += 8;
  if (contact.instagram) s += 5;
  if (contact.website) s += 2;
  const score = Math.round(Math.min(100, s));
  return { score, tier: score >= 70 ? "quente" : score >= 45 ? "morno" : "frio" } as const;
}

/* ------------------------------------------------------------------ mapa */

/** Coordenadas de tile (Web Mercator) — usadas para a foto de satélite do telhado. */
export function tileOf(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { x, y };
}

export const googleEarthUrl = (lat: number, lon: number) => `https://earth.google.com/web/@${lat},${lon},30a,180d,35y,0h,0t,0r`;
export const googleMapsUrl = (lat: number, lon: number, name?: string) =>
  name ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}`)}%20${lat},${lon}` : `https://www.google.com/maps/@${lat},${lon},60m/data=!3m1!1e3`;

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ------------------------------------------------------------------ contatos */

export interface Contacts {
  emails: string[];
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  phones: string[];
}

/** Extrai e-mails, redes sociais e WhatsApp do HTML de um site. */
export function extractContacts(html: string): Contacts {
  const text = html.replace(/&#64;|&commat;/g, "@");
  const emails = [...new Set((text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []).map((e) => e.toLowerCase()))].filter(
    (e) => !/\.(png|jpe?g|gif|webp|svg)$/i.test(e) && !/(sentry|wixpress|example|domain|email\.com$|\.wix\.com)/i.test(e),
  );
  const ig = text.match(/instagram\.com\/(?!p\/|reel\/|explore\/|accounts\/)([a-z0-9._]{2,30})/i);
  const fb = text.match(/facebook\.com\/(?!sharer|share|plugins|tr\?|dialog)([a-z0-9.\-]{2,60})/i);
  const wa = text.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|whatsapp\.com\/send\?phone=)(\+?\d{10,14})/i);
  const phones = [...new Set((text.match(/tel:\+?[\d\s()-]{8,20}/gi) ?? []).map((t) => t.replace(/^tel:/i, "").trim()))];
  return {
    emails: emails.slice(0, 5),
    instagram: ig ? ig[1].replace(/\/$/, "") : null,
    facebook: fb ? fb[1].replace(/\/$/, "") : null,
    whatsapp: wa ? wa[1].replace(/\D/g, "") : null,
    phones: phones.slice(0, 3),
  };
}

/** Normaliza @perfil ou link do Instagram para o usuário. */
export function instagramHandle(v: string | null | undefined) {
  if (!v) return null;
  const m = v.match(/instagram\.com\/([a-z0-9._]+)/i);
  const h = (m ? m[1] : v).replace(/^@/, "").trim();
  return /^[a-z0-9._]{2,30}$/i.test(h) ? h : null;
}
