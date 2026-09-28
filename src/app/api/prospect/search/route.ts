import { NextResponse } from "next/server";
import { geocodeRegion, googleToProspect, nicheOf, searchOsm, type Prospect } from "@/lib/prospect";
import { serverSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 45;

const UA = { "User-Agent": "QuarkCRM/1.0 (prospeccao; contato via app)", "Accept-Language": "pt-BR" };

async function searchGoogle(key: string, nicheId: string, region: string, lat: number, lon: number, radiusM: number) {
  const niche = nicheOf(nicheId)!;
  const fields = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.nationalPhoneNumber",
    "places.internationalPhoneNumber",
    "places.websiteUri",
    "places.rating",
    "places.userRatingCount",
    "places.googleMapsUri",
    "places.regularOpeningHours",
    "nextPageToken",
  ].join(",");
  const out: Prospect[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3; page++) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fields },
      body: JSON.stringify({
        textQuery: `${niche.google} em ${region || "região"}`,
        languageCode: "pt-BR",
        regionCode: "BR",
        pageSize: 20,
        pageToken,
        locationBias: { circle: { center: { latitude: lat, longitude: lon }, radius: Math.min(50000, radiusM) } },
      }),
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    if (!res?.ok) {
      if (page === 0) throw new Error(`Google Places recusou a busca (${res?.status ?? "sem resposta"}). Confira a chave GOOGLE_MAPS_API_KEY na Vercel.`);
      break;
    }
    const json = (await res.json()) as { places?: Parameters<typeof googleToProspect>[0][]; nextPageToken?: string };
    out.push(...(json.places ?? []).map((p) => googleToProspect(p, niche.id)).filter((p): p is Prospect => !!p));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

/** O app faz a busca no OpenStreetMap direto do aparelho; aqui só diz se o Google está ligado. */
export async function GET() {
  return NextResponse.json({ google: !!process.env.GOOGLE_MAPS_API_KEY?.trim() });
}

/** Busca comércios de um nicho numa região (OpenStreetMap grátis ou Google Places, se configurado). */
export async function POST(req: Request) {
  const sb = await serverSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login novamente" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { region?: string; lat?: number; lon?: number; radiusKm?: number; niche?: string };
  const niche = nicheOf(body.niche);
  if (!niche) return NextResponse.json({ error: "Escolha um nicho" }, { status: 400 });
  const radiusM = Math.min(15, Math.max(0.5, Number(body.radiusKm) || 3)) * 1000;
  const region = String(body.region ?? "").trim().slice(0, 120);

  let center = Number.isFinite(body.lat) && Number.isFinite(body.lon) ? { lat: Number(body.lat), lon: Number(body.lon), label: region || "Sua localização" } : null;
  if (!center) {
    if (!region) return NextResponse.json({ error: "Informe a cidade ou o bairro" }, { status: 400 });
    try {
      center = await geocodeRegion(region, { headers: UA });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao localizar a região" }, { status: 502 });
    }
    if (!center) return NextResponse.json({ error: `Não encontrei “${region}”. Tente “bairro, cidade”.` }, { status: 404 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  try {
    const results = key ? await searchGoogle(key, niche.id, region || center.label, center.lat, center.lon, radiusM) : await searchOsm(niche.id, center, radiusM, { headers: UA, timeoutMs: 20000 });
    return NextResponse.json({ ok: true, provider: key ? "google" : "osm", center, results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha na busca" }, { status: 502 });
  }
}
