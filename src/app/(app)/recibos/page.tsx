"use client";

/* eslint-disable @next/next/no-img-element */
import { Copy, Download, FileDown, ImageDown, Loader2, MessageCircle, Plus, Printer, Receipt, RotateCcw, Search, UserRound } from "lucide-react";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Button, Field, Input, MoneyInput, PageHeader, Segmented, Switch, Textarea, cx } from "@/components/ui";
import { DEFAULT_SIGNATURE } from "@/lib/defaults";
import { formatPhone, whatsappUrl } from "@/lib/format";
import { useLive } from "@/lib/live";
import { dataUrlToBytes, jpegToPdf } from "@/lib/pdf-image";
import { brl } from "@/lib/pricing";
import { RECEIPT_METHODS, RECEIPT_REASONS, docLabel, formatDoc, longDate, moneyToWords, receiptStatement, type ReceiptData } from "@/lib/receipt";
import { supabase } from "@/lib/supabase/client";

const PAGE_W = 794; // A4 a 96 dpi
const PAGE_H = 1123;

interface Row {
  id: string;
  number: number;
  lead_id: string | null;
  payer_name: string;
  payer_doc: string | null;
  amount: number;
  description: string;
  method: string | null;
  installment: string | null;
  paid_at: string;
  city: string | null;
  created_at: string;
}
type LeadLite = { id: string; name: string; phone: string | null; document: string | null; city: string | null };

const today = () => new Date().toLocaleDateString("en-CA");
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "cliente";

export default function ReceiptsPage() {
  const { user, settings } = useApp();
  const city = settings.city ? (settings.city.includes("/") ? settings.city : `${settings.city}/AL`) : "Maceió/AL";
  const blank = (): ReceiptData => ({ number: null, payerName: "", payerDoc: "", amount: 0, description: "", method: "PIX", installment: "", paidAt: today(), city });
  const [r, setR] = useState<ReceiptData>(blank);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(true);
  const [copies, setCopies] = useState<"2" | "1">("2");
  const [withSignature, setWithSignature] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [suggest, setSuggest] = useState(false);
  const paperRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);

  const set = <K extends keyof ReceiptData>(k: K, v: ReceiptData[K]) => {
    setR((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };

  const { data } = useLive(
    async () => {
      const sb = supabase();
      const [leads, recs] = await Promise.all([
        sb.from("leads").select("id,name,phone,document,city").order("updated_at", { ascending: false }).limit(1500),
        sb.from("receipts").select("*").order("created_at", { ascending: false }).limit(60),
      ]);
      return { leads: (leads.data ?? []) as LeadLite[], receipts: (recs.data ?? []) as Row[], missing: !!recs.error };
    },
    [],
    ["receipts", "leads"],
  );
  const leads = useMemo(() => data?.leads ?? [], [data]);
  const lead = leads.find((l) => l.id === leadId) ?? null;

  // ?lead=… (vindo da página do cliente) já preenche o pagador.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("lead");
    if (!id || !leads.length || leadId) return;
    const l = leads.find((x) => x.id === id);
    if (l) pickLead(l);
  }, [leads]); // eslint-disable-line react-hooks/exhaustive-deps

  // A folha A4 é encolhida para caber na coluna; a exportação usa o tamanho real.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const cs = getComputedStyle(el);
      const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      setScale(Math.min(1, inner / PAGE_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pickLead = (l: LeadLite) => {
    setLeadId(l.id);
    setR((x) => ({ ...x, payerName: l.name, payerDoc: l.document ?? x.payerDoc }));
    setDirty(true);
    setSuggest(false);
  };
  const matches = useMemo(() => {
    const q = r.payerName.trim().toLowerCase();
    if (q.length < 2) return [];
    return leads.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 6);
  }, [leads, r.payerName]);

  const company = settings.legal_name || settings.company_name;
  const signature = withSignature ? settings.signature_url || DEFAULT_SIGNATURE : null;
  const ready = r.payerName.trim().length > 1 && r.amount > 0 && r.description.trim().length > 2;

  /* -------- salvar / numerar -------- */
  const ensureSaved = async (): Promise<ReceiptData | null> => {
    if (!ready) {
      toast.error("Preencha o pagador, o valor e o motivo do pagamento");
      return null;
    }
    if (savedId && !dirty) return r;
    const sb = supabase();
    const payload = {
      lead_id: leadId,
      payer_name: r.payerName.trim(),
      payer_doc: r.payerDoc.trim() || null,
      amount: r.amount,
      description: r.description.trim(),
      method: r.method || null,
      installment: r.installment.trim() || null,
      paid_at: r.paidAt,
      city: r.city.trim() || null,
    };
    const res = savedId ? await sb.from("receipts").update(payload).eq("id", savedId).select("id,number").single() : await sb.from("receipts").insert(payload).select("id,number").single();
    if (res.error || !res.data) {
      // Sem a tabela ainda: gera o recibo mesmo assim, só não numera nem guarda.
      toast.warning("Recibo gerado sem numeração", { description: !res.error || /receipts/.test(res.error.message) ? "Rode o supabase/schema.sql para numerar e guardar o histórico." : res.error.message });
      return r;
    }
    const next = { ...r, number: res.data.number };
    setR(next);
    setSavedId(res.data.id);
    setDirty(false);
    if (!savedId && leadId) {
      await sb.from("activities").insert({ lead_id: leadId, type: "nota", content: `Recibo nº ${String(res.data.number).padStart(4, "0")} emitido: ${brl(r.amount)} — ${r.description.trim()}`, created_by: user.id });
    }
    return next;
  };

  /* -------- exportar -------- */
  const render = async (kind: "png" | "jpeg") => {
    // Espera o React aplicar o número recém-gerado.
    await new Promise((ok) => setTimeout(ok, 60));
    const { toJpeg, toPng } = await import("html-to-image");
    const node = paperRef.current!;
    const opts = { pixelRatio: 2, cacheBust: true, width: PAGE_W, height: PAGE_H, backgroundColor: "#ffffff" };
    await toPng(node, opts).catch(() => null);
    return kind === "png" ? toPng(node, opts) : toJpeg(node, { ...opts, quality: 0.95 });
  };
  const fileName = (d: ReceiptData) => `recibo-${d.number ? String(d.number).padStart(4, "0") + "-" : ""}${slug(d.payerName)}`;
  const pdfBlob = async () => new Blob([jpegToPdf(dataUrlToBytes(await render("jpeg")), PAGE_W * 2, PAGE_H * 2).buffer as ArrayBuffer], { type: "application/pdf" });
  const download = (href: string, name: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
  };

  const run = async (key: string, fn: (d: ReceiptData) => Promise<void>) => {
    setBusy(key);
    try {
      const d = await ensureSaved();
      if (d) await fn(d);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o arquivo");
    }
    setBusy(null);
  };
  const savePdf = () =>
    run("pdf", async (d) => {
      const url = URL.createObjectURL(await pdfBlob());
      download(url, `${fileName(d)}.pdf`);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Recibo salvo em PDF");
    });
  const savePng = () =>
    run("png", async (d) => {
      download(await render("png"), `${fileName(d)}.png`);
      toast.success("Recibo salvo em imagem");
    });
  const print = () =>
    run("print", async () => {
      const img = await render("jpeg");
      const w = window.open("", "_blank");
      if (!w) {
        toast.error("Libere as janelas pop-up para imprimir");
        return;
      }
      w.document.write(`<html><head><title>Recibo</title><style>@page{size:A4;margin:0}body{margin:0}img{width:100%;display:block}</style></head><body><img src="${img}" onload="setTimeout(()=>{window.print()},200)"></body></html>`);
      w.document.close();
    });
  const share = () =>
    run("share", async (d) => {
      const file = new File([await pdfBlob()], `${fileName(d)}.pdf`, { type: "application/pdf" });
      const text = `Olá, ${d.payerName.split(" ")[0]}! Segue o seu recibo de ${brl(d.amount)} referente a ${d.description.trim()}. Obrigado pela confiança! ☀️`;
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text }).catch(() => {});
        return;
      }
      const url = URL.createObjectURL(file);
      download(url, file.name);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      window.open(whatsappUrl(lead?.phone ?? "", `${text}\n\n(o PDF foi baixado: é só anexar aqui)`), "_blank", "noopener");
    });

  const load = (row: Row, duplicate = false) => {
    setR({ number: duplicate ? null : row.number, payerName: row.payer_name, payerDoc: row.payer_doc ?? "", amount: Number(row.amount), description: row.description, method: row.method ?? "", installment: row.installment ?? "", paidAt: duplicate ? today() : row.paid_at, city: row.city ?? city });
    setLeadId(row.lead_id);
    setSavedId(duplicate ? null : row.id);
    setDirty(duplicate);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast(duplicate ? "Recibo duplicado: confira e emita" : `Recibo nº ${String(row.number).padStart(4, "0")} aberto`);
  };
  const reset = () => {
    setR(blank());
    setLeadId(null);
    setSavedId(null);
    setDirty(true);
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        icon={<Receipt />}
        eyebrow="Ferramentas"
        title="Recibos"
        subtitle="Preencha, confira ao lado e envie em PDF ou imagem com a assinatura da Quark"
        actions={
          <Button variant="secondary" onClick={reset}>
            <Plus className="h-4 w-4" /> Novo recibo
          </Button>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* ------------------------------------------------ formulário */}
        <div className="glass space-y-5 rounded-3xl p-5 sm:p-6">
          <div className="relative">
            <Field label="Recebido de (pagador)">
              <div className="relative">
                <UserRound className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  value={r.payerName}
                  onChange={(e) => {
                    set("payerName", e.target.value);
                    setLeadId(null);
                    setSuggest(true);
                  }}
                  onFocus={() => setSuggest(true)}
                  onBlur={() => setTimeout(() => setSuggest(false), 150)}
                  placeholder="Nome do cliente ou empresa"
                  className="pl-10"
                />
              </div>
            </Field>
            {suggest && matches.length > 0 && (
              <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-2xl bg-white/95 p-1 shadow-lift ring-1 ring-ink-900/10 backdrop-blur-xl">
                {matches.map((l) => (
                  <button key={l.id} onMouseDown={() => pickLead(l)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-sun-50">
                    <Search className="h-3.5 w-3.5 text-ink-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{l.name}</span>
                      <span className="block truncate text-xs text-ink-500">{[l.phone && formatPhone(l.phone), l.city].filter(Boolean).join(" · ") || "Lead"}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {lead && <p className="mt-1.5 text-xs font-semibold text-sun-700">✓ Vinculado ao lead {lead.name}: o recibo fica registrado no histórico dele</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CPF ou CNPJ do pagador" hint={r.payerDoc ? `${docLabel(r.payerDoc)}: ${formatDoc(r.payerDoc)}` : "Opcional, mas recomendado"}>
              <Input value={r.payerDoc} onChange={(e) => set("payerDoc", e.target.value)} placeholder="000.000.000-00" inputMode="numeric" />
            </Field>
            <Field label="Valor recebido">
              <MoneyInput value={r.amount} onChange={(v) => set("amount", v)} />
            </Field>
          </div>
          {r.amount > 0 && (
            <p className="-mt-2 rounded-xl bg-gradient-to-r from-sun-50 to-white/40 px-3 py-2 text-[13px] text-ink-700 ring-1 ring-sun-200/70">
              <b className="text-ink-900">Por extenso:</b> {moneyToWords(r.amount)}
            </p>
          )}

          <Field label="Referente a">
            <Textarea value={r.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex.: sinal de entrada do sistema de energia solar fotovoltaica de 7,26 kWp" className="min-h-[80px]" />
          </Field>
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {RECEIPT_REASONS.map((t) => (
              <button key={t} onClick={() => set("description", t.charAt(0).toLowerCase() + t.slice(1))} className="rounded-full bg-ink-900/[0.05] px-2.5 py-1 text-[11px] font-semibold text-ink-600 transition hover:bg-ink-900/10">
                {t}
              </button>
            ))}
          </div>

          <Field label="Forma de pagamento">
            <div className="flex flex-wrap gap-1.5">
              {RECEIPT_METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => set("method", m)}
                  className={cx("h-9 rounded-xl px-3 text-[13px] font-semibold ring-1 transition", r.method === m ? "bg-ink-900 text-white ring-ink-900" : "bg-white/70 text-ink-700 ring-ink-900/10 hover:bg-white")}
                >
                  {m}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Parcela" hint="Vazio = pagamento único">
              <Input value={r.installment} onChange={(e) => set("installment", e.target.value)} placeholder="Ex.: 2 de 6" />
            </Field>
            <Field label="Data do pagamento">
              <Input type="date" value={r.paidAt} onChange={(e) => set("paidAt", e.target.value)} />
            </Field>
            <Field label="Cidade">
              <Input value={r.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-3 rounded-2xl bg-ink-900/[0.03] p-4 ring-1 ring-ink-900/5 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink-600">Formato</p>
              <Segmented<"2" | "1">
                size="sm"
                value={copies}
                onChange={setCopies}
                options={[
                  { value: "2", label: "2 vias na folha" },
                  { value: "1", label: "1 via" },
                ]}
              />
            </div>
            <div className="flex items-end">
              <Switch checked={withSignature} onChange={setWithSignature} label="Assinatura da Quark" />
            </div>
          </div>
        </div>

        {/* ------------------------------------------------ prévia */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div ref={boxRef} className="glass overflow-hidden rounded-3xl p-3 sm:p-4">
            <div className="mx-auto overflow-hidden rounded-xl shadow-[0_20px_50px_-20px_rgba(28,18,52,0.45)] ring-1 ring-ink-900/10" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: PAGE_W, height: PAGE_H }}>
                <Paper ref={paperRef} r={r} copies={copies === "2" ? 2 : 1} company={company} cnpj={settings.cnpj} address={settings.address} phone={settings.whatsapp || settings.phone} email={settings.email} instagram={settings.instagram} signature={signature} />
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button variant="sun" className="col-span-2" onClick={savePdf} loading={busy === "pdf"} disabled={!!busy}>
              <FileDown className="h-4 w-4" /> {savedId && !dirty ? "Baixar PDF" : "Emitir e baixar PDF"}
            </Button>
            <Button variant="secondary" onClick={share} loading={busy === "share"} disabled={!!busy}>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
            <Button variant="secondary" onClick={print} loading={busy === "print"} disabled={!!busy}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 px-1 text-xs text-ink-500">
            <span>{savedId ? (dirty ? "Alterações ainda não salvas no recibo emitido" : `Recibo nº ${String(r.number).padStart(4, "0")} emitido`) : "O número sai ao emitir"}</span>
            <button onClick={savePng} disabled={!!busy} className="inline-flex items-center gap-1 font-semibold text-ink-700 hover:underline">
              {busy === "png" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageDown className="h-3.5 w-3.5" />} Salvar como imagem
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ histórico */}
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-lg font-semibold">Recibos emitidos</h2>
          {data?.missing && <span className="text-xs text-amber-700">Rode o supabase/schema.sql para guardar o histórico</span>}
        </div>
        {data?.receipts.length ? (
          <div className="glass divide-y divide-ink-900/[0.05] overflow-hidden rounded-3xl">
            {data.receipts.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                <span className="grid h-10 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#1C1234] to-[#3a2a6b] font-mono text-xs font-bold text-[#F3EA3B]">{String(row.number).padStart(4, "0")}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{row.payer_name}</p>
                  <p className="truncate text-xs text-ink-500">
                    {row.description} · {row.method ?? "—"} · {new Date(`${row.paid_at}T12:00`).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <p className="font-display text-sm font-semibold tabular-nums">{brl(Number(row.amount))}</p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => load(row)} title="Abrir">
                    <Download className="h-3.5 w-3.5" /> Abrir
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => load(row, true)} title="Duplicar">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass flex items-center gap-3 rounded-3xl p-5 text-sm text-ink-500">
            <RotateCcw className="h-4 w-4" /> Os recibos que você emitir aparecem aqui para abrir de novo ou duplicar.
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ folha */

type PaperProps = {
  r: ReceiptData;
  copies: 1 | 2;
  company: string;
  cnpj: string;
  address: string;
  phone: string;
  email: string;
  instagram: string;
  signature: string | null;
};

const Paper = forwardRef<HTMLDivElement, PaperProps>(function Paper(props, ref) {
  return (
    <div ref={ref} className="flex flex-col bg-white text-[#1C1234]" style={{ width: PAGE_W, height: PAGE_H, fontFamily: "var(--font-jakarta), sans-serif" }}>
      {props.copies === 2 ? (
        <>
          <Via {...props} label="Via do cliente" half />
          <div className="relative mx-10 border-t-2 border-dashed border-[#cfccdc]">
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-white px-3 text-[10px] font-semibold tracking-[0.3em] text-[#9a97ae] uppercase">✂ recortar aqui</span>
          </div>
          <Via {...props} label="Via da empresa" half />
        </>
      ) : (
        <Via {...props} label="" />
      )}
    </div>
  );
});

function Via({ r, company, cnpj, address, phone, email, instagram, signature, label, half }: PaperProps & { label: string; half?: boolean }) {
  const statement = receiptStatement(r, company, (v) => brl(v));
  const num = r.number ? String(r.number).padStart(4, "0") : "----";
  return (
    <div className={cx("relative flex flex-col", half ? "h-[555px] px-12 pt-8 pb-6" : "flex-1 px-16 pt-14 pb-12")}>
      <div className="absolute inset-x-0 top-0 h-[6px] bg-gradient-to-r from-[#F3EA3B] via-[#9BD373] to-[#6CC690]" style={{ display: half && label === "Via da empresa" ? "none" : undefined }} />
      <div className="flex items-start justify-between gap-6">
        <div>
          <img src="/brand/logo-h-color.png" alt={company} className={half ? "h-10 w-auto" : "h-14 w-auto"} />
          <p className="mt-2 text-[10.5px] leading-snug text-[#6d6985]">
            {company}
            {cnpj ? ` · CNPJ ${cnpj}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className={cx("font-bold tracking-[0.35em] text-[#1C1234]", half ? "text-[22px]" : "text-[30px]")}>RECIBO</p>
          <p className="mt-0.5 font-mono text-[13px] font-semibold text-[#6d6985]">Nº {num}</p>
          {label && <p className="mt-1.5 inline-block rounded-full bg-[#f0eff5] px-2.5 py-0.5 text-[9.5px] font-bold tracking-[0.18em] text-[#4b4766] uppercase">{label}</p>}
        </div>
      </div>

      <div className={cx("mt-5 flex items-stretch gap-4", !half && "mt-10")}>
        <div className="flex-1 rounded-2xl bg-[#f7f6fa] px-5 py-4 ring-1 ring-[#e5e3ee]">
          <p className="text-[10px] font-bold tracking-[0.22em] text-[#9a97ae] uppercase">Valor por extenso</p>
          <p className={cx("mt-1 leading-snug font-semibold", half ? "text-[13px]" : "text-[16px]")}>{r.amount > 0 ? moneyToWords(r.amount).replace(/^./, (c) => c.toUpperCase()) : "—"}</p>
        </div>
        <div className="flex min-w-[210px] flex-col justify-center rounded-2xl bg-gradient-to-br from-[#2a1d4d] to-[#1C1234] px-6 py-4 text-right">
          <p className="text-[10px] font-bold tracking-[0.22em] text-white/50 uppercase">Valor</p>
          <p className={cx("font-bold text-[#F3EA3B] tabular-nums", half ? "text-[26px]" : "text-[34px]")}>{brl(r.amount || 0)}</p>
        </div>
      </div>

      <p className={cx("mt-5 text-justify leading-relaxed text-[#2a2046]", half ? "text-[13.5px]" : "mt-10 text-[15.5px] leading-loose")}>{statement}</p>

      <div className={cx("grid grid-cols-4 overflow-hidden rounded-xl ring-1 ring-[#e5e3ee]", half ? "mt-4" : "mt-10")}>
        {[
          ["Pagador", r.payerName || "—"],
          [r.payerDoc ? docLabel(r.payerDoc) : "CPF / CNPJ", r.payerDoc ? formatDoc(r.payerDoc) : "—"],
          ["Pagamento", [r.method, r.installment && `parcela ${r.installment}`].filter(Boolean).join(" · ") || "—"],
          ["Data", r.paidAt ? new Date(`${r.paidAt}T12:00`).toLocaleDateString("pt-BR") : "—"],
        ].map(([k, v], i) => (
          <div key={k} className={cx("px-3.5 py-2.5", i > 0 && "border-l border-[#e5e3ee]")}>
            <p className="text-[9px] font-bold tracking-[0.2em] text-[#9a97ae] uppercase">{k}</p>
            <p className="mt-0.5 truncate text-[12px] font-semibold">{v}</p>
          </div>
        ))}
      </div>

      <div className={cx("mt-auto flex items-end justify-between gap-8", half ? "pt-3" : "pt-10")}>
        <div className="pb-2 text-[12px] text-[#4b4766]">
          <p className="font-semibold">{longDate(r.paidAt, r.city)}</p>
          <p className="mt-1 text-[10px] text-[#9a97ae]">
            {[address, phone && formatPhone(phone), email, instagram && `@${instagram.replace(/^@/, "")}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="w-[280px] shrink-0 text-center">
          <div className={cx("mb-2 flex items-end justify-center", half ? "h-[84px]" : "h-[120px]")}>{signature && <img src={signature} alt="Assinatura" className="max-h-full w-auto max-w-full object-contain" />}</div>
          <div className="border-t border-[#1C1234]/70 pt-1.5">
            <p className="text-[11.5px] font-bold">{company}</p>
            {cnpj && <p className="text-[10px] text-[#6d6985]">CNPJ {cnpj}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
