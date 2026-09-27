"use client";

import { FileDown, ImageDown, Loader2, RotateCcw, Share2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { CARD_H, CARD_W, QuoteCard } from "@/components/quick-quote/quote-card";
import { OfferCard, STORY_H, STORY_W, type Highlight, type OfferData } from "@/components/quick-quote/offer-card";
import { Button, Card, Field, Input, MoneyInput, NumberInput, PageHeader, Segmented, Select, Textarea, cx } from "@/components/ui";
import { mergeInputs } from "@/lib/defaults";
import { formatPhone, whatsappUrl } from "@/lib/format";
import { must, useLive } from "@/lib/live";
import { dataUrlToBytes, jpegToPdf } from "@/lib/pdf-image";
import { brl, fmtNum } from "@/lib/pricing";
import { DEFAULT_QUICK, inverterFor, modulesFor, quickQuote, type QuickQuoteInput } from "@/lib/quick-quote";
import { supabase } from "@/lib/supabase/client";
import { FIXED_INVERTER_BRAND, FIXED_INVERTER_IMAGE, FIXED_MODULE_IMAGE, inverterImageOf, moduleImageOf, productImg } from "@/lib/product-images";
import type { Lead } from "@/lib/types";

type LeadLite = Pick<Lead, "id" | "name" | "phone" | "city" | "consumption_kwh" | "avg_bill" | "roof_type" | "connection_type">;
const PREFS_KEY = "quark.quickquote";
const OFFER_KEY = "quark.quickquote.offer";

type OfferPrefs = Pick<OfferData, "headline1" | "headline2" | "campaign" | "moduleType" | "efficiency" | "moduleWarranty" | "inverterWarranty" | "footer1" | "footer2" | "highlight"> & { included: string };
const DEFAULT_OFFER: OfferPrefs = {
  headline1: "Oportunidade",
  headline2: "Imperdível",
  campaign: "",
  moduleType: "bifacial",
  efficiency: 22.5,
  moduleWarranty: 12,
  inverterWarranty: 10,
  footer1: "Parcelado em até 18x no cartão (mais de um cartão permitido)",
  footer2: "Financiamento em até 72x sem entrada, 1ª parcela em até 120 dias",
  highlight: "cartao",
  included: ["Kit fotovoltaico completo", "Projeto de engenharia e homologação", "Instalação profissional em até 30 dias", "Equipamentos premium com certificação", "Monitoramento remoto pelo app"].join("\n"),
};
const HEADLINES = [
  ["Oportunidade", "Imperdível"],
  ["Sua energia", "Solar"],
  ["Adeus", "Conta alta"],
  ["Economia", "Garantida"],
  ["Oferta", "Especial"],
];
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "cliente";

export default function QuickQuotePage() {
  const params = useSearchParams();
  const { user, profile, settings, settingsLoaded } = useApp();
  const defaults = useMemo(() => mergeInputs(settings.defaults), [settings.defaults]);
  const [leadId, setLeadId] = useState(params.get("lead") ?? "");
  const [client, setClient] = useState({ name: "", city: "", roof: "", phone: "" });
  const [q, setQ] = useState<QuickQuoteInput>(DEFAULT_QUICK);
  const [brands, setBrands] = useState({ module: "", inverter: "" });
  const [validityDays, setValidityDays] = useState(7);
  const [template, setTemplate] = useState<"story" | "post">("story");
  const [offer, setOffer] = useState<OfferPrefs>(DEFAULT_OFFER);
  const [images, setImages] = useState<{ module: string; inverter: string }>({ module: "", inverter: "" });
  const setO = (patch: Partial<OfferPrefs>) => setOffer((o) => ({ ...o, ...patch }));
  const [busy, setBusy] = useState<"png" | "pdf" | "share" | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // Número e datas dependem do relógio do aparelho: só desenha o cartão no navegador.
  const [number, setNumber] = useState("");
  useEffect(() => setNumber(`${new Date().getFullYear()}${String(Date.now()).slice(-5)}`), []);

  const { data: leads } = useLive(
    async () => must(await supabase().from("leads").select("id,name,phone,city,consumption_kwh,avg_bill,roof_type,connection_type").order("created_at", { ascending: false }).limit(2000)) as LeadLite[],
    [],
    [],
  );

  // Padrões da empresa + últimos valores usados (preço por Wp, desconto…).
  useEffect(() => {
    if (!settingsLoaded) return;
    let saved: Partial<QuickQuoteInput> = {};
    try {
      saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    } catch {
      /* navegação privada */
    }
    setQ((x) => ({
      ...x,
      moduleW: defaults.modulePowerW || x.moduleW,
      tariff: defaults.tariff,
      sunHours: defaults.sunHours,
      fioBTariff: defaults.fioBTariff,
      publicLighting: defaults.publicLighting,
      financingRate: defaults.financingRate,
      financingMonths: Math.max(...(defaults.financingTerms?.length ? defaults.financingTerms : [72])),
      cardInstallments: defaults.cardInstallments,
      cardRate: defaults.cardRate,
      ...saved,
      modules: 0,
      inverterKw: 0,
    }));
    if (defaults.moduleBrand || defaults.inverterBrand) setBrands({ module: defaults.moduleBrand ?? "", inverter: defaults.inverterBrand ?? "" });
    setImages({ module: settings.proposal.moduleImage || "", inverter: settings.proposal.inverterImage || "" });
    let savedOffer: Partial<OfferPrefs> = {};
    try {
      savedOffer = JSON.parse(localStorage.getItem(OFFER_KEY) ?? "{}");
    } catch {
      /* navegação privada */
    }
    setOffer({ ...DEFAULT_OFFER, moduleWarranty: settings.warranty_modules_years || 12, inverterWarranty: settings.warranty_inverter_years || 10, ...savedOffer });
  }, [settingsLoaded, defaults]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dados do lead (vindos da anamnese): nome, cidade, telhado e consumo final.
  useEffect(() => {
    const l = leads?.find((x) => x.id === leadId);
    if (!l) return;
    const kwh = Number(l.consumption_kwh) || (Number(l.avg_bill) ? Math.round((Number(l.avg_bill) - defaults.publicLighting) / defaults.tariff) : 0);
    setClient({ name: l.name, city: l.city ?? "", roof: l.roof_type ?? "", phone: l.phone ?? "" });
    setQ((x) => ({ ...x, consumptionKwh: kwh > 0 ? kwh : x.consumptionKwh, connectionType: l.connection_type ?? x.connectionType, modules: 0, inverterKw: 0 }));
  }, [leadId, leads, defaults.publicLighting, defaults.tariff]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ priceMode: q.priceMode, price: q.price, cashDiscountPct: q.cashDiscountPct, moduleW: q.moduleW }));
    } catch {
      /* navegação privada */
    }
  }, [q.priceMode, q.price, q.cashDiscountPct, q.moduleW]);

  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      localStorage.setItem(OFFER_KEY, JSON.stringify(offer));
    } catch {
      /* navegação privada */
    }
  }, [offer, settingsLoaded]);

  const W = template === "story" ? STORY_W : CARD_W;
  const H = template === "story" ? STORY_H : CARD_H;

  // A prévia encolhe para caber na tela; a exportação usa o tamanho real.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);

  const result = useMemo(() => quickQuote(q), [q]);
  const set = (patch: Partial<QuickQuoteInput>) => setQ((x) => ({ ...x, ...patch }));
  const autoModules = modulesFor(q.consumptionKwh, q.moduleW, q.sunHours);

  const cardData = {
    client: client.name,
    city: client.city,
    roof: client.roof,
    moduleBrand: brands.module,
    inverterBrand: brands.inverter,
    moduleW: q.moduleW,
    financingMonths: q.financingMonths,
    cardInstallments: q.cardInstallments,
    cashDiscountPct: q.cashDiscountPct,
    validityDays,
    company: settings.company_name || "Quark Energia",
    logoUrl: settings.logo_url || null,
    seller: profile?.full_name?.split(" ")[0] ?? null,
    sellerPhone: formatPhone(profile?.phone || settings.whatsapp) || null,
    number,
  };

  const offerData: OfferData = {
    client: client.name,
    city: client.city,
    headline1: offer.headline1,
    headline2: offer.headline2,
    campaign: offer.campaign,
    moduleW: q.moduleW,
    moduleBrand: brands.module,
    moduleType: offer.moduleType,
    efficiency: offer.efficiency,
    moduleWarranty: offer.moduleWarranty,
    inverterBrand: brands.inverter || (FIXED_INVERTER_IMAGE ? FIXED_INVERTER_BRAND : ""),
    inverterKw: result.inverterKw,
    inverterWarranty: offer.inverterWarranty,
    moduleImage: productImg(moduleImageOf(images.module)) || null,
    inverterImage: productImg(inverterImageOf(images.inverter)) || null,
    included: offer.included.split("\n"),
    footer1: offer.footer1,
    footer2: offer.footer2,
    highlight: offer.highlight,
    financingMonths: q.financingMonths,
    cardInstallments: q.cardInstallments,
    validityDays,
    company: cardData.company,
    logoUrl: cardData.logoUrl,
    seller: cardData.seller,
    sellerPhone: cardData.sellerPhone,
    number,
  };

  const render = async (kind: "png" | "jpeg") => {
    const { toJpeg, toPng } = await import("html-to-image");
    const node = cardRef.current!;
    const opts = { pixelRatio: 2, cacheBust: true, width: W, height: H, backgroundColor: "#07060F", style: { transform: "none" } };
    // Primeira passada carrega fontes e imagens (evita imagem incompleta no Safari).
    await toPng(node, opts).catch(() => null);
    return kind === "png" ? toPng(node, opts) : toJpeg(node, { ...opts, quality: 0.92 });
  };

  const registerSent = async (how: string) => {
    if (!leadId) return;
    const sb = supabase();
    await sb.from("activities").insert({
      lead_id: leadId,
      type: "nota",
      content: `Orçamento rápido (${how}): ${fmtNum(result.kwp, 2)} kWp · ${result.modules} placas${result.price > 0 ? ` · ${brl(result.cashPrice, 0)} à vista` : ""} · economia ${brl(result.monthlySavings, 0)}/mês`,
      created_by: user.id,
    });
    if (result.price > 0) await sb.from("leads").update({ estimated_value: Math.round(result.price) }).eq("id", leadId);
  };

  const filename = `orcamento-${slug(client.name)}`;
  const download = (href: string, name: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
  };

  const savePng = async () => {
    setBusy("png");
    try {
      download(await render("png"), `${filename}.png`);
      await registerSent("imagem");
      toast.success("Imagem salva");
    } catch {
      toast.error("Não foi possível gerar a imagem");
    }
    setBusy(null);
  };

  const savePdf = async () => {
    setBusy("pdf");
    try {
      const jpeg = dataUrlToBytes(await render("jpeg"));
      const pdf = jpegToPdf(jpeg, W * 2, H * 2);
      const url = URL.createObjectURL(new Blob([pdf.buffer as ArrayBuffer], { type: "application/pdf" }));
      download(url, `${filename}.pdf`);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      await registerSent("PDF");
      toast.success("PDF salvo");
    } catch {
      toast.error("Não foi possível gerar o PDF");
    }
    setBusy(null);
  };

  const share = async () => {
    setBusy("share");
    const text = `Olá, ${client.name.split(" ")[0] || "tudo bem"}! Segue o seu orçamento de energia solar ☀️ Economia estimada de ${brl(result.monthlySavings, 0)} por mês. Qualquer dúvida, estou à disposição!`;
    try {
      const png = await render("png");
      const blob = await (await fetch(png)).blob();
      const file = new File([blob], `${filename}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text }).catch(() => {});
      } else {
        // No computador: salva a imagem e abre a conversa para anexar.
        download(png, `${filename}.png`);
        window.open(whatsappUrl(client.phone, text), "_blank", "noopener");
        toast.success("Imagem salva — anexe na conversa do WhatsApp");
      }
      await registerSent("WhatsApp");
    } catch {
      toast.error("Não foi possível compartilhar");
    }
    setBusy(null);
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Orçamento rápido"
        subtitle="Consumo da anamnese → sistema dimensionado → imagem pronta para o WhatsApp em segundos"
        actions={
          <Link href="/propostas/nova">
            <Button variant="secondary">Proposta completa</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        {/* Valores */}
        <div className="grid min-w-0 content-start gap-4">
          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 font-display text-[15px] font-semibold">Cliente</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lead" className="col-span-2" hint="Puxa nome, cidade, telhado e o consumo final da anamnese">
                <Select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                  <option value="">Sem lead (digite abaixo)</option>
                  {(leads ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.consumption_kwh ? ` — ${fmtNum(Number(l.consumption_kwh))} kWh` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Nome no orçamento" className="col-span-2">
                <Input value={client.name} onChange={(e) => setClient((c) => ({ ...c, name: e.target.value }))} placeholder="Maria Silva" />
              </Field>
              <Field label="Cidade">
                <Input value={client.city} onChange={(e) => setClient((c) => ({ ...c, city: e.target.value }))} />
              </Field>
              <Field label="Telhado">
                <Input value={client.roof} onChange={(e) => setClient((c) => ({ ...c, roof: e.target.value }))} />
              </Field>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-display text-[15px] font-semibold">Sistema</h2>
              {settings.kits.length > 0 && (
                <Select
                  className="h-9 w-auto max-w-[200px] text-[13px]"
                  value=""
                  onChange={(e) => {
                    const k = settings.kits.find((x) => x.id === e.target.value);
                    if (!k) return;
                    set({ moduleW: k.modulePowerW || q.moduleW, modules: k.moduleQty || 0, inverterKw: k.inverterPowerKw * (k.inverterQty || 1) || 0 });
                    setBrands({ module: k.moduleBrand, inverter: k.inverterBrand });
                    setImages((im) => ({ module: k.moduleImage || im.module, inverter: k.inverterImage || im.inverter }));
                  }}
                >
                  <option value="">Usar kit salvo…</option>
                  {settings.kits.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Consumo final" className="col-span-2" hint="Já inclui o aumento previsto na anamnese">
                <NumberInput value={q.consumptionKwh} onChange={(v) => set({ consumptionKwh: v, modules: 0, inverterKw: 0 })} suffix="kWh/mês" digits={0} />
              </Field>
              <Field label="Placa">
                <NumberInput value={q.moduleW} onChange={(v) => set({ moduleW: v, modules: 0, inverterKw: 0 })} suffix="W" digits={0} />
              </Field>
              <Field label="Quantidade" hint={q.modules ? <button className="font-semibold text-sun-700" onClick={() => set({ modules: 0, inverterKw: 0 })}>voltar ao automático ({autoModules})</button> : "automático"}>
                <NumberInput value={result.modules} onChange={(v) => set({ modules: Math.round(v), inverterKw: 0 })} suffix="placas" digits={0} />
              </Field>
              <Field label="Inversor" hint={q.inverterKw ? <button className="font-semibold text-sun-700" onClick={() => set({ inverterKw: 0 })}>automático ({fmtNum(inverterFor(result.kwp), 1)} kW)</button> : "automático"}>
                <NumberInput value={result.inverterKw} onChange={(v) => set({ inverterKw: v })} suffix="kW" digits={1} />
              </Field>
              <Field label="Geração média mensal">
                <div className="flex h-11 items-center rounded-xl bg-ink-50 px-3.5 text-sm font-semibold tabular-nums ring-1 ring-ink-200 sm:h-10">
                  {fmtNum(result.generation)} kWh/mês
                </div>
              </Field>
              <Field label="Marca da placa">
                <Input value={brands.module} onChange={(e) => setBrands((b) => ({ ...b, module: e.target.value }))} placeholder="Ex.: JA Solar" />
              </Field>
              <Field label="Marca do inversor">
                <Input value={brands.inverter} onChange={(e) => setBrands((b) => ({ ...b, inverter: e.target.value }))} placeholder={FIXED_INVERTER_IMAGE ? FIXED_INVERTER_BRAND : "Opcional"} />
              </Field>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-display text-[15px] font-semibold">Preço</h2>
              <Segmented
                size="sm"
                value={q.priceMode}
                onChange={(priceMode) => set({ priceMode, price: priceMode === "wp" ? (result.pricePerWp ? Math.round(result.pricePerWp * 100) / 100 : 0) : Math.round(result.price) })}
                options={[
                  { value: "wp", label: "R$/Wp" },
                  { value: "total", label: "Valor total" },
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {q.priceMode === "wp" ? (
                <Field label="Preço por Wp" hint={result.price > 0 ? `Total: ${brl(result.price, 0)}` : "Ex.: 2,90"}>
                  <MoneyInput value={q.price} onChange={(price) => set({ price })} />
                </Field>
              ) : (
                <Field label="Valor total" hint={result.price > 0 ? `${brl(result.pricePerWp)} por Wp` : undefined}>
                  <MoneyInput value={q.price} onChange={(price) => set({ price })} digits={0} />
                </Field>
              )}
              <Field label="Desconto à vista">
                <NumberInput value={q.cashDiscountPct} onChange={(cashDiscountPct) => set({ cashDiscountPct })} suffix="%" digits={0} />
              </Field>
              <Field label="Financiamento">
                <Select value={String(q.financingMonths)} onChange={(e) => set({ financingMonths: Number(e.target.value) })}>
                  {[0, 12, 24, 36, 48, 60, 72, 84, 96, 120].map((m) => (
                    <option key={m} value={m}>
                      {m ? `${m}x` : "Não mostrar"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Taxa do financiamento">
                <NumberInput value={q.financingRate} onChange={(financingRate) => set({ financingRate })} suffix="% a.m." digits={2} />
              </Field>
              <Field label="Cartão">
                <Select value={String(q.cardInstallments)} onChange={(e) => set({ cardInstallments: Number(e.target.value) })}>
                  {[0, 6, 10, 12, 18, 21].map((m) => (
                    <option key={m} value={m}>
                      {m ? `${m}x` : "Não mostrar"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Validade">
                <Select value={String(validityDays)} onChange={(e) => setValidityDays(Number(e.target.value))}>
                  {[3, 5, 7, 10, 15, 30].map((d) => (
                    <option key={d} value={d}>
                      {d} dias
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>
          {template === "story" && (
            <Card className="p-4 sm:p-5">
              <h2 className="mb-3 font-display text-[15px] font-semibold">Arte da oferta</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex flex-wrap gap-1.5">
                  {HEADLINES.map(([a, b]) => (
                    <button
                      key={b}
                      onClick={() => setO({ headline1: a, headline2: b })}
                      className={cx(
                        "rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 transition",
                        offer.headline2 === b ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-600 ring-ink-200 hover:ring-ink-300",
                      )}
                    >
                      {a} {b}
                    </button>
                  ))}
                </div>
                <Field label="Título (linha 1)">
                  <Input value={offer.headline1} onChange={(e) => setO({ headline1: e.target.value })} />
                </Field>
                <Field label="Título (destaque)">
                  <Input value={offer.headline2} onChange={(e) => setO({ headline2: e.target.value })} />
                </Field>
                <Field label="Selo da campanha" className="col-span-2" hint="Ex.: Oferta de Natal, Black Friday, Semana do Sol (deixe vazio para não mostrar)">
                  <Input value={offer.campaign} onChange={(e) => setO({ campaign: e.target.value })} placeholder="Opcional" />
                </Field>
                <Field label="Tipo da placa">
                  <Select value={offer.moduleType} onChange={(e) => setO({ moduleType: e.target.value })}>
                    {["bifacial", "monocristalina", "N-type", "TOPCon", "half-cell", ""].map((t) => (
                      <option key={t} value={t}>
                        {t || "Não mostrar"}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Eficiência da placa">
                  <NumberInput value={offer.efficiency} onChange={(efficiency) => setO({ efficiency })} suffix="%" digits={2} />
                </Field>
                <Field label="Garantia das placas">
                  <NumberInput value={offer.moduleWarranty} onChange={(v) => setO({ moduleWarranty: Math.round(v) })} suffix="anos" digits={0} />
                </Field>
                <Field label="Garantia do inversor">
                  <NumberInput value={offer.inverterWarranty} onChange={(v) => setO({ inverterWarranty: Math.round(v) })} suffix="anos" digits={0} />
                </Field>
                <Field label="Preço em destaque" className="col-span-2">
                  <Segmented
                    className="w-full [&>button]:flex-1"
                    value={offer.highlight}
                    onChange={(highlight: Highlight) => setO({ highlight })}
                    options={[
                      { value: "cartao", label: "Cartão" },
                      { value: "financiamento", label: "Financiamento" },
                      { value: "avista", label: "À vista" },
                    ]}
                  />
                </Field>
                <Field label="O que está incluso (um por linha, até 5)" className="col-span-2">
                  <Textarea value={offer.included} onChange={(e) => setO({ included: e.target.value })} className="min-h-[120px]" />
                </Field>
                <Field label="Faixa 1 (cartão)" className="col-span-2">
                  <Input value={offer.footer1} onChange={(e) => setO({ footer1: e.target.value })} />
                </Field>
                <Field label="Faixa 2 (financiamento)" className="col-span-2">
                  <Input value={offer.footer2} onChange={(e) => setO({ footer2: e.target.value })} />
                </Field>
                {!FIXED_MODULE_IMAGE && (
                  <Field label="Foto da placa (URL)" hint="Vazio = ilustração">
                    <Input value={images.module} onChange={(e) => setImages((im) => ({ ...im, module: e.target.value.trim() }))} placeholder="https://…" />
                  </Field>
                )}
                {!FIXED_INVERTER_IMAGE && (
                  <Field label="Foto do inversor (URL)" hint="Use PNG sem fundo">
                    <Input value={images.inverter} onChange={(e) => setImages((im) => ({ ...im, inverter: e.target.value.trim() }))} placeholder="https://…" />
                  </Field>
                )}
              </div>
              <button onClick={() => setOffer({ ...DEFAULT_OFFER, moduleWarranty: settings.warranty_modules_years || 12, inverterWarranty: settings.warranty_inverter_years || 10 })} className="mt-3 flex items-center gap-1 text-xs font-semibold text-ink-400 hover:text-ink-700">
                <RotateCcw className="h-3 w-3" /> Restaurar textos padrão
              </button>
            </Card>
          )}
        </div>

        {/* Prévia + ações */}
        <div className="min-w-0">
          <div className="lg:sticky lg:top-6">
            <div className="mb-3 grid grid-cols-3 gap-2">
              <Button variant="sun" onClick={share} disabled={!!busy} className="h-11">
                {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} WhatsApp
              </Button>
              <Button onClick={savePng} disabled={!!busy} className="h-11">
                {busy === "png" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />} PNG
              </Button>
              <Button variant="secondary" onClick={savePdf} disabled={!!busy} className="h-11">
                {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF
              </Button>
            </div>
            <Segmented
              className="mb-3 flex w-full [&>button]:flex-1"
              value={template}
              onChange={setTemplate}
              options={[
                { value: "story", label: "Story · oferta (9:16)" },
                { value: "post", label: "Post · resumo (4:5)" },
              ]}
            />
            <div ref={boxRef} className={cx("mx-auto w-full", template === "story" ? "max-w-[430px]" : "max-w-[540px]")}>
              <div className="overflow-hidden rounded-[22px] shadow-lift" style={{ height: H * scale }}>
                <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: W }}>
                  {!number ? (
                    <div style={{ width: W, height: H }} className="bg-[#07060F]" />
                  ) : template === "story" ? (
                    <OfferCard ref={cardRef} q={result} d={offerData} />
                  ) : (
                    <QuoteCard ref={cardRef} q={result} d={cardData} />
                  )}
                </div>
              </div>
            </div>
            <p className={cx("mx-auto mt-3 flex max-w-[540px] items-center gap-1.5 text-xs text-ink-500")}>
              <Sparkles className="h-3.5 w-3.5 text-sun-600" />
              {leadId ? "Ao salvar ou enviar, fica registrado no histórico do lead e o valor vai para o funil." : "Escolha um lead para registrar o envio no histórico."}
              {result.price <= 0 && " Sem preço, a imagem mostra só a economia."}
            </p>
            <button onClick={() => setQ((x) => ({ ...x, modules: 0, inverterKw: 0 }))} className="mx-auto mt-2 flex items-center gap-1 text-xs font-semibold text-ink-400 hover:text-ink-700">
              <RotateCcw className="h-3 w-3" /> Redimensionar pelo consumo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
