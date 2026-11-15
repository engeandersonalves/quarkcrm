"use client";

import {
  Ban,
  ChevronDown,
  CopyPlus,
  PencilLine,
  Settings2,
  ArrowLeftRight,
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Camera,
  CalendarCheck,
  Copy,
  FileSignature,
  FileText,
  IdCard,
  KeyRound,
  Loader2,
  MessageCircle,
  NotebookPen,
  Phone,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { STAGE, brl0, useSaleActions, useSales, wa, type SaleActions, type SaleDoc } from "@/components/mobilidade/sale-row";
import { Button, Empty, Field, Input, Skeleton, Textarea, cx } from "@/components/ui";
import { dateBr, digits, formatCep, formatDoc } from "@/lib/br";
import { formatPhone, relativeTime } from "@/lib/format";
import { buyerOf, closedAt, saleStage, todos, warrantyOf, type SaleStage } from "@/lib/moto-board";
import { groupClients, portalMessage, type MotoClient } from "@/lib/moto-clients";
import { fetchCustomerPhoto, saveCustomer, saveSaleInfo, toPortrait } from "@/lib/moto-customers-db";
import { portalPin } from "@/lib/moto-overrides";
import { contractValue, motoPhoto, vehicleName, type MotoData } from "@/lib/moto-sale";

type Tab = "resumo" | "dados" | "scooters" | "documentos" | "acesso" | "notas";
const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "resumo", label: "Resumo", icon: <Sparkles className="h-4 w-4" /> },
  { id: "dados", label: "Dados", icon: <UserRound className="h-4 w-4" /> },
  { id: "scooters", label: "Scooters", icon: <Wallet className="h-4 w-4" /> },
  { id: "documentos", label: "Documentos", icon: <FileText className="h-4 w-4" /> },
  { id: "acesso", label: "Acesso e senha", icon: <KeyRound className="h-4 w-4" /> },
  { id: "notas", label: "Anotações", icon: <NotebookPen className="h-4 w-4" /> },
];

const sale = (d: SaleDoc) => d.data as unknown as MotoData;
const model = (d: MotoData) => vehicleName(d).replace(/^Scooter elétrica\s*/, "") || "Scooter";
const BTN = "inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold whitespace-nowrap ring-1 ring-ink-200 transition hover:ring-ink-300 disabled:opacity-50 dark:ring-white/[0.12] dark:hover:ring-white/25";
const PANEL = "rounded-[26px] bg-white p-5 ring-1 ring-ink-200/80 sm:p-6 dark:bg-[#0f1311] dark:ring-white/[0.07]";

export default function ClienteMobilidadePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const k = decodeURIComponent(key);
  const sales = useSales();
  const actions = useSaleActions(sales);
  const all = useMemo(() => (sales.data ?? []) as SaleDoc[], [sales.data]);
  const client = useMemo(() => groupClients(all, (d) => contractValue(d)).find((c) => c.key === k), [all, k]);

  if (sales.loading && !sales.data) return <Skeleton className="mx-auto h-[70vh] max-w-6xl" />;
  if (!client)
    return (
      <div className="mx-auto max-w-3xl">
        <BackLink />
        <div className={PANEL}>
          <Empty icon={<UserRound className="h-6 w-6" />} title="Cliente não encontrado" text="Essa ficha pode ter sido apagada junto com os orçamentos do cliente." />
        </div>
      </div>
    );
  return <ClientView c={client} all={all} actions={actions} reload={sales.reload} />;
}

function BackLink() {
  return (
    <Link href="/mobilidade?aba=clientes" className="mb-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink-500 hover:text-ink-900 dark:hover:text-white">
      <ArrowLeft className="h-4 w-4" /> Clientes
    </Link>
  );
}

function ClientView({ c, all, actions, reload }: { c: MotoClient; all: SaleDoc[]; actions: SaleActions; reload: () => Promise<void> }) {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("aba"))?.id ?? "resumo") as Tab;
  const go = (t: Tab) => router.replace(`?aba=${t}`, { scroll: false });
  const rows = useMemo(() => c.sales.map((s) => all.find((x) => x.id === s.id)).filter((x): x is SaleDoc => !!x), [c.sales, all]);
  const sold = rows.filter((r) => saleStage(r) === "vendida");
  const latest = rows[0] ? sale(rows[0]) : null;
  const customer = rows.find((r) => r.customer)?.customer ?? null;
  const since = sold.length ? sold.map((r) => closedAt(r)).sort()[0] : rows.map((r) => r.created_at).sort()[0];
  const best = sold.map((r) => warrantyOf(sale(r))).filter((w) => w.state !== "encerrada").sort((a, b) => b.left - a.left)[0];
  const st = c.stage === "garantia" ? { label: "Cliente · em garantia", cls: STAGE.vendida.cls } : c.stage === "cliente" ? { label: "Cliente", cls: "bg-ink-100 text-ink-700 ring-ink-200 dark:bg-white/[0.06] dark:text-white/70 dark:ring-white/10" } : c.stage === "assinatura" ? { label: "Aguardando assinatura", cls: STAGE.aguardando.cls } : { label: "Em negociação", cls: STAGE.orcamento.cls };

  // foto 3/4: a da ficha ou a selfie da assinatura
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFromSelfie, setPhotoFromSelfie] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const ids = rows.map((r) => r.id).join(",");
  useEffect(() => {
    let alive = true;
    fetchCustomerPhoto(c.key, ids ? ids.split(",") : [])
      .then((r) => {
        if (!alive) return;
        setPhoto(r.photo);
        setPhotoFromSelfie(r.fromSelfie);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [c.key, ids]);
  const changePhoto = async (f?: File) => {
    if (!f) return;
    setPhotoBusy(true);
    try {
      const p = await toPortrait(f);
      await saveCustomer(c.key, { photo: p });
      setPhoto(p);
      setPhotoFromSelfie(false);
      toast.success("Foto salva na ficha. Ela aparece no cartão do proprietário.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a foto");
    } finally {
      setPhotoBusy(false);
    }
  };

  const portal = typeof window !== "undefined" ? `${window.location.origin}/cliente` : "/cliente";
  const chat = wa(c.phone);
  const access = wa(c.phone, portalMessage(c.name, portal));

  return (
    <div className="animate-fade-up mx-auto max-w-6xl">
      <BackLink />

      {/* ---------------------------------------------------------- cabeçalho */}
      <section className="relative mb-4 overflow-hidden rounded-[30px] bg-[#040605] p-5 text-white ring-1 ring-white/[0.06] sm:p-7">
        <div className="pointer-events-none absolute -top-40 -right-32 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(111,191,142,0.28),rgba(111,191,142,0))]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="shrink-0">
            <button type="button" onClick={() => fileRef.current?.click()} className="group relative block overflow-hidden rounded-[18px] ring-2 ring-white/15" style={{ width: 96, height: 128 }} title="Trocar a foto 3/4">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt={`Foto de ${c.name}`} className="h-full w-full object-cover" style={{ objectPosition: "50% 30%" }} />
              ) : (
                <span className="grid h-full w-full place-items-center bg-white/[0.06] text-white/40">
                  <UserRound className="h-10 w-10" strokeWidth={1.3} />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1.5 text-[11px] font-semibold opacity-90 transition group-hover:opacity-100">
                {photoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} {photo ? "Trocar" : "Foto 3/4"}
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => changePhoto(e.target.files?.[0])} />
            {photo && <p className="mt-1.5 w-24 text-center text-[10.5px] text-white/45">{photoFromSelfie ? "selfie da assinatura" : "foto da ficha"}</p>}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cx("rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1", st.cls)}>{st.label}</span>
              {since && <span className="text-[12.5px] text-white/45">desde {dateBr(since.slice(0, 10))}</span>}
            </div>
            <h1 className="mt-1.5 font-display text-[26px] leading-tight font-semibold tracking-tight sm:text-[32px]">{c.name}</h1>
            <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-white/65">
              {c.doc && <span>{digits(c.doc).length > 11 ? "CNPJ" : "CPF"} {formatDoc(c.doc)}</span>}
              {c.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {formatPhone(c.phone)}
                </span>
              )}
              {c.email && <span>{c.email}</span>}
              {c.city && <span>{c.city}</span>}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {chat && (
                <a href={chat} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#25D366] px-4 text-[13.5px] font-bold text-[#06210F]">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              )}
              {c.phone && (
                <a href={`tel:${digits(c.phone)}`} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-[13.5px] font-semibold ring-1 ring-white/15 hover:bg-white/[0.14]">
                  <Phone className="h-4 w-4" /> Ligar
                </a>
              )}
              {c.bought > 0 && access && (
                <a href={access} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-[13.5px] font-semibold ring-1 ring-white/15 hover:bg-white/[0.14]">
                  <Send className="h-4 w-4" /> Enviar área do cliente
                </a>
              )}
              <Link href={`/documentos/novo?tipo=moto${c.leadId ? `&lead=${c.leadId}` : ""}`} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[linear-gradient(95deg,#F3E93B_0%,#9FDB7C_45%,#4FC38A_100%)] px-4 text-[13.5px] font-bold text-[#0A0D0B]">
                <Plus className="h-4 w-4" /> Nova venda
              </Link>
            </div>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Total comprado", c.total ? brl0(c.total) : "—"],
            ["Scooters", String(c.bought)],
            ["Garantia", best ? (best.state === "ativa" ? `${best.left} dias` : "começa na entrega") : c.bought ? "encerrada" : "—"],
            ["Em aberto", String(rows.length - sold.length)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[16px] p-3 ring-1 ring-white/12" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))" }}>
              <p className="text-[11px] font-bold tracking-[0.08em] text-white/50 uppercase">{k}</p>
              <p className="mt-0.5 text-[18px] font-bold tabular-nums">{v}</p>
            </div>
          ))}
        </div>

        <nav className="relative mt-4 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" aria-label="Seções da ficha">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={cx("inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition", tab === t.id ? "bg-[#fff] text-[#0A0D0B]" : "text-white/65 hover:bg-white/[0.08] hover:text-white")}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
      </section>

      {tab === "resumo" && <Summary rows={rows} go={go} actions={actions} />}
      {tab === "dados" && <DataTab c={c} latest={latest} customerKey={c.key} reload={reload} hasNotes={!!customer?.notes} />}
      {tab === "scooters" && <ScootersTab rows={rows} reload={reload} actions={actions} />}
      {tab === "documentos" && <DocsTab rows={rows} actions={actions} photo={photo} />}
      {tab === "acesso" && <AccessTab c={c} rows={rows} portal={portal} />}
      {tab === "notas" && <NotesTab customerKey={c.key} initial={customer?.notes ?? ""} reload={reload} />}
    </div>
  );
}

/* ================================================================ Resumo */

function Summary({ rows, go, actions }: { rows: SaleDoc[]; go: (t: Tab) => void; actions: SaleActions }) {
  const pend = todos(rows);
  const events = rows
    .flatMap((r) => {
      const d = sale(r);
      const m = model(d);
      const b = buyerOf(r);
      const out: { at: string; icon: ReactNode; title: string; text: string; future?: boolean }[] = [{ at: r.created_at, icon: <FileText className="h-4 w-4" />, title: `Orçamento da ${m}`, text: `${brl0(contractValue(d))}${d.color ? ` · ${d.color}` : ""}` }];
      if (b?.signed_at) out.push({ at: b.signed_at, icon: <FileSignature className="h-4 w-4" />, title: "Contrato assinado", text: `${m}${b.selfie_at ? " · com selfie" : ""}` });
      if (d.transferredAt) out.push({ at: d.transferredAt, icon: <ArrowLeftRight className="h-4 w-4" />, title: "Recebeu por transferência", text: `${m} · antes de ${r.original?.client?.name?.trim() || "outro dono"}` });
      if (saleStage(r) === "vendida") {
        if (d.delivery?.date) out.push({ at: `${d.delivery.date}T12:00:00`, icon: <CalendarCheck className="h-4 w-4" />, title: d.delivery.mode === "entrega" ? "Entrega em casa" : "Retirada na loja", text: m, future: d.delivery.date > new Date().toISOString().slice(0, 10) });
        const w = warrantyOf(d);
        if (w.end) out.push({ at: `${w.end}T12:00:00`, icon: <ShieldCheck className="h-4 w-4" />, title: "Fim da garantia", text: `${m} · ${d.warrantyDays} dias`, future: w.state !== "encerrada" });
      }
      return out;
    })
    .sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <section className={PANEL}>
        <p className="text-[12.5px] font-bold tracking-[0.12em] text-ink-500 uppercase">Pendências</p>
        {pend.length ? (
          <ul className="mt-3 grid gap-2">
            {pend.map((t) => {
              const label = { assinatura: "Contrato aguardando a assinatura do cliente", entrega: "Definir a data de entrega", chassi: "Informar o chassi e os números da scooter", selfie: "Assinou sem enviar a selfie", vencendo: "Garantia terminando em breve", parado: "Orçamento parado há mais de 7 dias" }[t.kind];
              const target: Tab = t.kind === "entrega" || t.kind === "chassi" ? "scooters" : "documentos";
              return (
                <li key={`${t.kind}-${t.doc.id}`}>
                  <button type="button" onClick={() => go(target)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-left text-[14px] font-medium text-amber-900 ring-1 ring-amber-200 hover:ring-amber-300 dark:bg-amber-500/10 dark:ring-amber-500/30">
                    <span>
                      {label}
                      <span className="block text-[12.5px] font-normal opacity-75">{model(sale(t.doc as SaleDoc))}</span>
                    </span>
                    <span className="text-[13px] font-semibold">Resolver →</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-[14px] text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/30">
            <BadgeCheck className="h-5 w-5" /> Tudo em dia com este cliente.
          </p>
        )}
        {rows.some((r) => saleStage(r) === "vendida") && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            {(() => {
              const r = rows.find((x) => saleStage(x) === "vendida")!;
              return (
                <>
                  <button type="button" disabled={!!actions.busy} onClick={() => actions.pdf(r, "manual")} className={BTN}>
                    <BookOpen className="h-4 w-4" /> Manual + garantia
                  </button>
                  <button type="button" disabled={!!actions.busy} onClick={() => actions.pdf(r, "comprovante")} className={BTN}>
                    <BadgeCheck className="h-4 w-4" /> Comprovante
                  </button>
                </>
              );
            })()}
          </div>
        )}
      </section>

      <section className={PANEL}>
        <p className="text-[12.5px] font-bold tracking-[0.12em] text-ink-500 uppercase">Linha do tempo</p>
        <ol className="relative mt-4 ml-3 border-l border-ink-200 dark:border-white/10">
          {events.map((e, i) => (
            <li key={i} className="mb-5 ml-5 last:mb-0">
              <span className={cx("absolute -left-[13px] grid h-6 w-6 place-items-center rounded-full ring-4 ring-white dark:ring-[#0f1311]", e.future ? "bg-ink-100 text-ink-500 dark:bg-white/10 dark:text-white/60" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300")}>{e.icon}</span>
              <p className="text-[14.5px] font-semibold">{e.title}</p>
              <p className="text-[13px] text-ink-500">
                {dateBr(e.at.slice(0, 10))}
                {e.future ? " · previsto" : ` · ${relativeTime(e.at)}`} · {e.text}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/* ================================================================= Dados */

function DataTab({ c, latest, customerKey, reload }: { c: MotoClient; latest: MotoData | null; customerKey: string; reload: () => Promise<void>; hasNotes: boolean }) {
  const base = latest?.client;
  const [f, setF] = useState({ phone: base?.phone ?? "", email: base?.email ?? "", address: base?.address ?? "", city: base?.city ?? "", state: base?.state ?? "", cep: base?.cep ?? "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const pinBefore = portalPin(base?.phone);
  const pinAfter = portalPin(f.phone);
  const save = async () => {
    if (f.phone && digits(f.phone).length < 10) return toast.error("Digite o celular com DDD.");
    setBusy(true);
    try {
      await saveCustomer(customerKey, { phone: digits(f.phone) || null, email: f.email.trim() || null, address: f.address.trim() || null, city: f.city.trim() || null, state: f.state.trim().toUpperCase().slice(0, 2) || null, cep: digits(f.cep) || null });
      await reload();
      toast.success(pinBefore && pinAfter && pinBefore !== pinAfter ? `Dados salvos. A senha da área do cliente agora é ${pinAfter} (a antiga também continua valendo).` : "Dados salvos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={PANEL}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12.5px] font-bold tracking-[0.12em] text-ink-500 uppercase">Dados do cliente</p>
          <p className="mt-1 max-w-xl text-[13.5px] text-ink-500">O contrato assinado não muda. Os dados abaixo valem para a área do cliente, o cartão do proprietário, o comprovante e os próximos contatos.</p>
        </div>
        <Button onClick={save} loading={busy}>
          <Save className="h-4 w-4" /> Salvar dados
        </Button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nome (como no contrato)">
          <Input value={c.name} disabled />
        </Field>
        <Field label={digits(c.doc).length > 11 ? "CNPJ" : "CPF"} hint="É a chave da ficha e o login da área do cliente.">
          <Input value={formatDoc(c.doc)} disabled />
        </Field>
        <Field label="Celular / WhatsApp" hint={pinAfter ? `Senha da área do cliente: ${pinAfter}` : undefined} htmlFor="cf-phone">
          <Input id="cf-phone" inputMode="tel" value={formatPhone(f.phone) || f.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="E-mail" htmlFor="cf-email">
          <Input id="cf-email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Endereço" className="sm:col-span-2" htmlFor="cf-addr">
          <Input id="cf-addr" value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Rua, número, bairro" />
        </Field>
        <div className="grid grid-cols-[1fr_80px] gap-3">
          <Field label="Cidade" htmlFor="cf-city">
            <Input id="cf-city" value={f.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="UF" htmlFor="cf-uf">
            <Input id="cf-uf" value={f.state} maxLength={2} onChange={(e) => set("state", e.target.value)} />
          </Field>
        </div>
        <Field label="CEP" htmlFor="cf-cep">
          <Input id="cf-cep" inputMode="numeric" value={formatCep(f.cep) || f.cep} onChange={(e) => set("cep", e.target.value)} />
        </Field>
      </div>
    </section>
  );
}

/* ============================================================== Scooters */

function ScooterNumbers({ r, reload }: { r: SaleDoc; reload: () => Promise<void> }) {
  const d = sale(r);
  const [f, setF] = useState({ chassis: d.chassis ?? "", motor_no: d.motorNo ?? "", battery_no: d.batteryNo ?? "", charger_no: d.chargerNo ?? "", delivery_date: d.delivery?.date ?? "" });
  const [busy, setBusy] = useState(false);
  const dirty = f.chassis !== (d.chassis ?? "") || f.motor_no !== (d.motorNo ?? "") || f.battery_no !== (d.batteryNo ?? "") || f.charger_no !== (d.chargerNo ?? "") || f.delivery_date !== (d.delivery?.date ?? "");
  const save = async () => {
    setBusy(true);
    try {
      await saveSaleInfo(r.id, {
        chassis: f.chassis.trim().toUpperCase() || null,
        motor_no: f.motor_no.trim().toUpperCase() || null,
        battery_no: f.battery_no.trim().toUpperCase() || null,
        charger_no: f.charger_no.trim().toUpperCase() || null,
        delivery_date: f.delivery_date || null,
      });
      await reload();
      toast.success("Números da scooter salvos. Manual, comprovante, cartão e área do cliente já usam os novos dados.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  };
  const fields: [keyof typeof f, string, string?][] = [
    ["chassis", "Nº do chassi"],
    ["motor_no", "Nº do motor"],
    ["battery_no", "Nº da bateria"],
    ["charger_no", "Nº do carregador"],
    ["delivery_date", d.delivery?.mode === "entrega" ? "Data da entrega" : "Data da retirada", "date"],
  ];
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {fields.map(([k, label, type]) => (
        <Field key={k} label={label} htmlFor={`n-${r.id}-${k}`}>
          <Input id={`n-${r.id}-${k}`} type={type ?? "text"} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} className={type ? undefined : "font-mono uppercase"} />
        </Field>
      ))}
      <div className="flex items-end sm:col-span-2 lg:col-span-5">
        <Button onClick={save} loading={busy} disabled={!dirty} variant={dirty ? "primary" : "secondary"}>
          <Save className="h-4 w-4" /> {dirty ? "Salvar números" : "Números salvos"}
        </Button>
      </div>
    </div>
  );
}

function ScootersTab({ rows, reload, actions }: { rows: SaleDoc[]; reload: () => Promise<void>; actions: SaleActions }) {
  return (
    <div className="grid gap-3">
      {rows.map((r) => {
        const d = sale(r);
        const stage = saleStage(r);
        const w = stage === "vendida" ? warrantyOf(d) : null;
        return (
          <section key={r.id} className={PANEL}>
            <div className="flex flex-wrap items-center gap-4">
              <span className="grid h-20 w-24 shrink-0 place-items-center rounded-[18px] bg-[#050706]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={motoPhoto(d)} alt="" className="max-h-16 w-auto object-contain" />
              </span>
              <div className="min-w-0 flex-1 basis-[calc(100%-8rem)] sm:basis-auto">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[18px] font-semibold">
                    {model(d)}
                    {d.color ? <span className="font-normal text-ink-500"> · {d.color}</span> : null}
                  </p>
                  <span className={cx("rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1", STAGE[stage].cls)}>{STAGE[stage].label}</span>
                </div>
                <p className="text-[13.5px] text-ink-500">
                  {brl0(contractValue(d))} · {d.payment.method === "cartao" && d.payment.installmentValue > 0 ? `${d.payment.installments}x de ${brl0(d.payment.installmentValue)}` : d.payment.method === "pix" ? "PIX à vista" : "condição combinada"} · venda de {dateBr(d.date)}
                </p>
                {w && <p className="text-[13px] text-ink-500">{w.state === "ativa" ? `Garantia até ${dateBr(w.end)} · ${w.left} dias` : w.state === "entrega" ? "Garantia começa na entrega" : `Garantia encerrada em ${dateBr(w.end)}`}</p>}
              </div>
              <Link href={`/documentos/${r.id}`} className={BTN}>
                <FileSignature className="h-4 w-4" /> {stage === "orcamento" ? "Editar orçamento" : "Abrir contrato"}
              </Link>
            </div>
            <ScooterNumbers key={`${r.id}-${r.info?.updated_at ?? ""}`} r={r} reload={reload} />
            <Manage r={r} stage={stage} actions={actions} />
          </section>
        );
      })}
    </div>
  );
}

/** Corrigir, cancelar ou excluir a scooter/venda. Contrato assinado não é editado: corrige-se com uma nova versão. */
function Manage({ r, stage, actions }: { r: SaleDoc; stage: SaleStage; actions: SaleActions }) {
  const [open, setOpen] = useState(false);
  const spin = (k: string) => actions.busy === `${r.id}-${k}`;
  const ROW = "flex w-full items-start gap-3 rounded-2xl px-3.5 py-3 text-left ring-1 transition disabled:opacity-50";
  return (
    <div className="mt-4 border-t border-ink-100 pt-3 dark:border-white/[0.06]">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white">
        <Settings2 className="h-4 w-4" /> Corrigir, cancelar ou excluir
        <ChevronDown className={cx("h-4 w-4 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {stage === "orcamento" ? (
            <>
              <Link href={`/documentos/${r.id}`} className={cx(ROW, "ring-ink-200 hover:ring-ink-300 dark:ring-white/10")}>
                <PencilLine className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <span className="block text-[14px] font-semibold">Editar orçamento</span>
                  <span className="block text-[12.5px] text-ink-500">Modelo, cor, preço, pagamento</span>
                </span>
              </Link>
              <button type="button" disabled={!!actions.busy} onClick={() => actions.remove(r)} className={cx(ROW, "ring-rose-200 hover:ring-rose-300 dark:ring-rose-500/30")}>
                {spin("apagar") ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
                <span>
                  <span className="block text-[14px] font-semibold text-rose-700">Apagar orçamento</span>
                  <span className="block text-[12.5px] text-ink-500">Remove de vez</span>
                </span>
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={!!actions.busy} onClick={() => actions.revise(r)} className={cx(ROW, "ring-ink-200 hover:ring-ink-300 dark:ring-white/10")}>
                {spin("revisar") ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : <CopyPlus className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
                <span>
                  <span className="block text-[14px] font-semibold">Criar versão corrigida</span>
                  <span className="block text-[12.5px] text-ink-500">Copia como orçamento para mudar modelo, preço ou condição</span>
                </span>
              </button>
              <button type="button" disabled={!!actions.busy} onClick={() => actions.cancel(r)} className={cx(ROW, "ring-amber-200 hover:ring-amber-300 dark:ring-amber-500/30")}>
                {spin("cancelar") ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : <Ban className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
                <span>
                  <span className="block text-[14px] font-semibold">{stage === "vendida" ? "Cancelar venda" : "Cancelar contrato"}</span>
                  <span className="block text-[12.5px] text-ink-500">Tira das listas e do cliente. Dá para desfazer</span>
                </span>
              </button>
              <button type="button" disabled={!!actions.busy} onClick={() => actions.purge(r)} className={cx(ROW, "ring-rose-200 hover:ring-rose-300 dark:ring-rose-500/30")}>
                {spin("excluir") ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
                <span>
                  <span className="block text-[14px] font-semibold text-rose-700">Excluir definitivamente</span>
                  <span className="block text-[12.5px] text-ink-500">Apaga contrato e histórico. Sem volta</span>
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================ Documentos */

function DocsTab({ rows, actions, photo }: { rows: SaleDoc[]; actions: SaleActions; photo: string | null }) {
  const { settings } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const card = async (r: SaleDoc, kind: "pdf" | "image") => {
    setBusy(`${r.id}-${kind}`);
    try {
      const d = sale(r);
      const company = { name: d.contractor?.name || settings.legal_name || settings.company_name, cnpj: d.contractor?.doc || settings.cnpj };
      const [{ receiptQrText }, QR, cards, pdfs] = await Promise.all([import("@/lib/moto-receipt"), import("qrcode"), import("@/components/cliente/owner-card"), import("@/components/bf/download-pdf")]);
      const qr = await QR.toDataURL(receiptQrText(d, r.id, company, window.location.origin), { margin: 0, width: 360, errorCorrectionLevel: "M", color: { dark: "#0B1A12", light: "#FFFFFF" } });
      const contact = formatPhone(settings.whatsapp || settings.phone || "");
      const name = `Cartao-proprietario-${model(d).replace(/\W+/g, "")}-${(d.client.name.split(" ")[0] || "cliente").replace(/\W+/g, "")}`;
      if (kind === "pdf") await pdfs.downloadPagesPdf(<cards.OwnerCardPdfPage d={d} id={r.id} photo={photo} qr={qr} contact={contact} />, `${name}.pdf`, { background: "#F5F6F1" });
      else await pdfs.downloadArtPng(<cards.OwnerCardBoth d={d} id={r.id} photo={photo} qr={qr} contact={contact} />, `${name}.png`, cards.BOTH_SIZE);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o cartão");
    } finally {
      setBusy(null);
    }
  };
  const copy = (text: string, msg: string) => navigator.clipboard?.writeText(text).then(() => toast.success(msg), () => toast.message(text));

  return (
    <div className="grid gap-3">
      {rows.map((r) => {
        const d = sale(r);
        const stage = saleStage(r);
        const token = (buyerOf(r) as { token?: string } | null)?.token;
        const spin = (k: string) => actions.busy === `${r.id}-${k}` || busy === `${r.id}-${k}`;
        const item = (icon: ReactNode, title: string, text: string, action: ReactNode) => (
          <div className="flex flex-wrap items-center gap-3 rounded-[18px] bg-ink-50/70 p-3 sm:flex-nowrap dark:bg-white/[0.04]">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 ring-1 ring-ink-200/70 dark:bg-white/[0.06] dark:text-emerald-300 dark:ring-white/10">{icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold">{title}</span>
              <span className="block text-[12.5px] text-ink-500">{text}</span>
            </span>
            <div className="flex w-full gap-2 sm:w-auto">{action}</div>
          </div>
        );
        return (
          <section key={r.id} className={PANEL}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="text-[16px] font-semibold">
                {model(d)}
                {d.color ? ` · ${d.color}` : ""}
              </p>
              <span className={cx("rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1", STAGE[stage].cls)}>{STAGE[stage].label}</span>
            </div>
            <div className="grid gap-2">
              {item(
                <FileSignature className="h-5 w-5" />,
                "Contrato de compra e venda",
                stage === "vendida" ? `Assinado em ${dateBr(closedAt(r).slice(0, 10))}` : stage === "aguardando" ? "Enviado, aguardando a assinatura do cliente" : "Ainda é um orçamento",
                <>
                  <Link href={`/documentos/${r.id}`} className={cx(BTN, "flex-1 sm:flex-none")}>
                    Abrir
                  </Link>
                  {stage === "aguardando" && token && (
                    <button type="button" onClick={() => copy(`${window.location.origin}/assinar/${token}`, "Link de assinatura copiado")} className={cx(BTN, "flex-1 sm:flex-none")}>
                      <Copy className="h-4 w-4" /> Link
                    </button>
                  )}
                </>,
              )}
              {item(
                <FileText className="h-5 w-5" />,
                "Orçamento em PDF",
                `${brl0(contractValue(d))} · ${relativeTime(r.created_at)}`,
                <button type="button" disabled={!!actions.busy} onClick={() => actions.pdf(r, "orcamento")} className={cx(BTN, "flex-1 sm:flex-none")}>
                  {spin("orcamento") ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Baixar
                </button>,
              )}
              {item(
                <BookOpen className="h-5 w-5" />,
                "Manual + certificado de garantia",
                "Com os números da scooter e os dados do proprietário",
                <button type="button" disabled={!!actions.busy} onClick={() => actions.pdf(r, "manual")} className={cx(BTN, "flex-1 sm:flex-none")}>
                  {spin("manual") ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Baixar
                </button>,
              )}
              {stage === "vendida" &&
                item(
                  <BadgeCheck className="h-5 w-5" />,
                  "Comprovante de compra e propriedade",
                  "Documento não fiscal com o cartão de bolso",
                  <button type="button" disabled={!!actions.busy} onClick={() => actions.pdf(r, "comprovante")} className={cx(BTN, "flex-1 sm:flex-none")}>
                    {spin("comprovante") ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Baixar
                  </button>,
                )}
              {stage === "vendida" &&
                item(
                  <IdCard className="h-5 w-5" />,
                  "Cartão do proprietário",
                  photo ? "Frente e verso, com a foto 3/4" : "Frente e verso · adicione a foto 3/4 no topo da ficha",
                  <>
                    <button type="button" disabled={!!busy} onClick={() => card(r, "pdf")} className={cx(BTN, "flex-1 sm:flex-none")}>
                      {spin("pdf") ? <Loader2 className="h-4 w-4 animate-spin" /> : null} PDF
                    </button>
                    <button type="button" disabled={!!busy} onClick={() => card(r, "image")} className={cx(BTN, "flex-1 sm:flex-none")}>
                      {spin("image") ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Imagem
                    </button>
                  </>,
                )}
              {stage === "orcamento" && (
                <button type="button" disabled={!!actions.busy} onClick={() => actions.remove(r)} className="mt-1 inline-flex items-center gap-1.5 justify-self-start text-[13px] font-semibold text-rose-600 hover:underline disabled:opacity-50">
                  <Trash2 className="h-4 w-4" /> Apagar este orçamento
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ================================================================ Acesso */

function AccessTab({ c, rows, portal }: { c: MotoClient; rows: SaleDoc[]; portal: string }) {
  const pin = portalPin(c.phone);
  const enabled = rows.some((r) => saleStage(r) !== "orcamento");
  const msg = portalMessage(c.name, portal);
  const send = wa(c.phone, msg);
  const copy = (text: string, ok: string) => navigator.clipboard?.writeText(text).then(() => toast.success(ok), () => toast.message(text));
  return (
    <section className={PANEL}>
      <p className="text-[12.5px] font-bold tracking-[0.12em] text-ink-500 uppercase">Área do cliente</p>
      <p className="mt-1 max-w-2xl text-[13.5px] text-ink-500">
        {enabled ? "O cliente entra com o CPF e a senha abaixo e encontra o manual, a garantia, o comprovante, o contrato e o cartão do proprietário." : "A área do cliente libera assim que o contrato for enviado para assinatura."}
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-[20px] bg-ink-50/70 p-4 dark:bg-white/[0.04]">
          <p className="text-[12px] font-semibold text-ink-500">Endereço</p>
          <p className="mt-1 truncate font-mono text-[14px]">{portal.replace(/^https?:\/\//, "")}</p>
          <button type="button" onClick={() => copy(portal, "Link copiado")} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-300">
            <Copy className="h-4 w-4" /> Copiar link
          </button>
        </div>
        <div className="rounded-[20px] bg-ink-50/70 p-4 dark:bg-white/[0.04]">
          <p className="text-[12px] font-semibold text-ink-500">Login (CPF)</p>
          <p className="mt-1 font-mono text-[18px] font-semibold tabular-nums">{formatDoc(c.doc) || "—"}</p>
        </div>
        <div className="rounded-[20px] bg-[#0B1A12] p-4 text-white">
          <p className="text-[12px] font-semibold text-white/60">Senha · 4 últimos dígitos do celular</p>
          <div className="mt-2 flex gap-1.5">
            {(pin || "····").split("").map((ch, i) => (
              <span key={i} className="grid h-11 w-10 place-items-center rounded-xl bg-white/10 font-mono text-[22px] font-bold">
                {ch}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-[13px] text-ink-500">Para trocar a senha, atualize o celular na aba Dados. A senha do celular informado na venda continua valendo.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {send && (
          <a href={send} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#25D366] px-5 text-[14px] font-bold text-[#06210F]">
            <Send className="h-4 w-4" /> Enviar acesso pelo WhatsApp
          </a>
        )}
        <button type="button" onClick={() => copy(msg, "Mensagem copiada")} className={BTN}>
          <Copy className="h-4 w-4" /> Copiar mensagem
        </button>
      </div>
    </section>
  );
}

/* ============================================================= Anotações */

function NotesTab({ customerKey, initial, reload }: { customerKey: string; initial: string; reload: () => Promise<void> }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await saveCustomer(customerKey, { notes: text.trim() || null });
      await reload();
      toast.success("Anotações salvas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={PANEL}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] font-bold tracking-[0.12em] text-ink-500 uppercase">Anotações internas</p>
        <Button onClick={save} loading={busy} disabled={text === initial}>
          <Save className="h-4 w-4" /> Salvar
        </Button>
      </div>
      <p className="mt-1 text-[13.5px] text-ink-500">Só a equipe vê. Preferências, combinados, revisões feitas, indicações…</p>
      <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} className="mt-4" placeholder="Ex.: prefere contato à tarde · indicou o João (Cappuccino) em 12/11" />
    </section>
  );
}
