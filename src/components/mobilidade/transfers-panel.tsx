"use client";

import { ArrowRight, Ban, Check, CheckCircle2, CircleDollarSign, Loader2, MessageCircle, ShieldCheck, ShieldX, UserRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { cx } from "@/components/ui";
import { dateBr, digits, formatDoc, maskDoc } from "@/lib/br";
import { TRANSFER_FEE, validDoc, type TransferStatus } from "@/lib/client-portal";
import { formatPhone, relativeTime } from "@/lib/format";
import { useLive } from "@/lib/live";
import { clientHref } from "@/lib/moto-clients";
import { motoPhoto, vehicleName, type MotoData } from "@/lib/moto-sale";
import { supabase } from "@/lib/supabase/client";
import { SectionTitle } from "./board-panels";
import { wa, type SaleDoc, type Sales } from "./sale-row";

/**
 * Pedidos de transferência de propriedade vindos da área do cliente.
 * Fluxo: em análise → aprovada (cobra a taxa) → paga → concluída. Ou recusada.
 */

export interface TransferRow {
  id: string;
  document_id: string;
  status: TransferStatus;
  from_name: string | null;
  from_doc: string;
  new_owner: { name?: string; doc?: string; phone?: string; email?: string; cep?: string; address?: string; city?: string; state?: string };
  reason: string | null;
  notes: string | null;
  fee: number;
  paid_at: string | null;
  decision_note: string | null;
  decided_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const fee = `R$ ${TRANSFER_FEE.toFixed(2).replace(".", ",")}`;
const first = (n: string | null | undefined) => (n ?? "").trim().split(/\s+/)[0] || "";
const PANEL = "rounded-[24px] bg-white p-4 ring-1 ring-ink-200/80 sm:p-5 dark:bg-[#0f1311] dark:ring-white/[0.07]";

export function useTransfers() {
  return useLive(
    async () => {
      const { data, error } = await supabase().from("moto_transfers").select("*").order("created_at", { ascending: false }).limit(300);
      // Antes de rodar o schema.sql a tabela não existe: a aba fica vazia, sem erro.
      return error ? [] : ((data ?? []) as TransferRow[]);
    },
    [],
    ["moto_transfers"],
  );
}

export const STATUS: Record<TransferStatus, { label: string; cls: string }> = {
  analise: { label: "Em análise", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  aprovada: { label: "Aprovada", cls: "bg-sky-50 text-sky-800 ring-sky-200" },
  concluida: { label: "Concluída", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  recusada: { label: "Recusada", cls: "bg-rose-50 text-rose-800 ring-rose-200" },
  cancelada: { label: "Cancelada", cls: "bg-ink-100 text-ink-600 ring-ink-200" },
};

export function TransfersPanel({ sales, transfers }: { sales: Sales; transfers: ReturnType<typeof useTransfers> }) {
  const list = useMemo(() => transfers.data ?? [], [transfers.data]);
  const saleBy = useMemo(() => new Map(((sales.data ?? []) as SaleDoc[]).map((d) => [d.id, d])), [sales.data]);
  const review = list.filter((t) => t.status === "analise");
  const approved = list.filter((t) => t.status === "aprovada");
  const history = list.filter((t) => t.status !== "analise" && t.status !== "aprovada");

  if (transfers.loading && !transfers.data) {
    return (
      <div className={cx(PANEL, "grid place-items-center py-14")}>
        <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <section className={cx(PANEL, "flex flex-wrap items-center gap-4")}>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#0B1A12] text-[#D8E83C]">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold">Transferências de propriedade</p>
          <p className="text-[13.5px] text-ink-500">
            O dono pede pela área do cliente. Você analisa, cobra a taxa de {fee} e conclui: o novo dono passa a valer no cartão, na verificação do QR e na área do cliente.
          </p>
        </div>
      </section>

      <Group title="1 · Para analisar" hint="Confira os dados e aprove ou recuse" list={review} saleBy={saleBy} empty="Nenhum pedido esperando análise." />
      <Group title="2 · Aprovadas" hint={`Receba a taxa de ${fee} e conclua`} list={approved} saleBy={saleBy} empty="Nenhuma transferência aprovada em aberto." />
      {history.length > 0 && <Group title="Histórico" hint="Concluídas, recusadas e canceladas" list={history} saleBy={saleBy} empty="" compact />}
    </div>
  );
}

function Group({ title, hint, list, saleBy, empty, compact }: { title: string; hint: string; list: TransferRow[]; saleBy: Map<string, SaleDoc>; empty: string; compact?: boolean }) {
  return (
    <section>
      <SectionTitle title={title} count={list.length} />
      <p className="-mt-1.5 mb-3 text-[13px] text-ink-500">{hint}</p>
      {list.length ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {list.map((t) => (
            <TransferCard key={t.id} t={t} sale={saleBy.get(t.document_id) ?? null} compact={compact} />
          ))}
        </div>
      ) : (
        <p className={cx(PANEL, "text-[14px] text-ink-500")}>{empty}</p>
      )}
    </section>
  );
}

function Field({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  if (!v) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-[13.5px]">
      <span className="shrink-0 text-ink-500">{k}</span>
      <span className={cx("min-w-0 text-right font-medium break-words", mono && "tabular-nums")}>{v}</span>
    </div>
  );
}

function TransferCard({ t, sale, compact }: { t: TransferRow; sale: SaleDoc | null; compact?: boolean }) {
  const [mode, setMode] = useState<null | "aprovar" | "recusar">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const d = (sale?.original ?? sale?.data ?? null) as MotoData | null;
  const n = t.new_owner ?? {};
  const model = d ? vehicleName(d).replace(/^Scooter elétrica\s*/, "") : "Scooter";
  const fromPhone = d?.client?.phone ?? "";
  const docOk = validDoc(n.doc ?? "");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const act = async (action: "aprovar" | "recusar" | "pago" | "concluir" | "cancelar", text?: string) => {
    if (action === "concluir" && !window.confirm(`Concluir a transferência para ${n.name}? A scooter passa para o nome dele no cartão, na verificação e na área do cliente.`)) return;
    setBusy(action);
    try {
      const { data, error } = await supabase().rpc("decide_owner_transfer", { p_id: t.id, p_action: action, p_note: text ?? null });
      const r = data as { ok?: boolean; error?: string } | null;
      if (error || !r?.ok) {
        const msg: Record<string, string> = { motivo: "Escreva o motivo da recusa.", nao_pago: "Marque a taxa como paga antes de concluir.", permissao: "Sem permissão.", estado: "O pedido mudou de situação. Atualize a página." };
        toast.error(msg[r?.error ?? ""] ?? (error && /decide_owner_transfer/.test(error.message) ? "Rode o schema.sql no Supabase para ativar as transferências." : "Não foi possível salvar."));
        return;
      }
      setMode(null);
      setNote("");
      toast.success({ aprovar: "Transferência aprovada.", recusar: "Pedido recusado.", pago: "Taxa marcada como paga.", concluir: "Transferência concluída.", cancelar: "Pedido cancelado." }[action]);
    } finally {
      setBusy(null);
    }
  };

  const msgApproved = wa(fromPhone, `Olá, ${first(t.from_name)}! Sua transferência da scooter ${model} para ${n.name} foi aprovada. A taxa é de ${fee}. Segue a chave PIX para pagamento: `);
  const msgRefused = wa(fromPhone, `Olá, ${first(t.from_name)}! Analisamos o pedido de transferência da scooter ${model} e não conseguimos aprovar agora${note.trim() ? `: ${note.trim()}` : "."}`);
  const msgNewOwner = wa(n.phone ?? "", `Olá, ${first(n.name)}! A scooter ${model} agora está no seu nome na Quark Mobilidade. Acesse ${origin}/cliente com o seu CPF e os 4 últimos dígitos do seu celular para ver o cartão do proprietário, o manual e a garantia.`);

  return (
    <article className={PANEL}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-11 w-14 shrink-0 place-items-center rounded-xl bg-[#050706]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {d && <img src={motoPhoto(d)} alt="" className="max-h-9 w-auto object-contain" />}
        </span>
        <div className="min-w-[55%] flex-1">
          <p className="truncate text-[15px] font-semibold">
            {model}
            {d?.chassis ? <span className="ml-2 text-[12.5px] font-normal text-ink-500 tabular-nums">chassi {d.chassis.toUpperCase()}</span> : null}
          </p>
          <p className="text-[12.5px] text-ink-500">
            pedido {relativeTime(t.created_at)} · {t.reason || "sem motivo"}
          </p>
        </div>
        <span className={cx("rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1", STATUS[t.status].cls)}>
          {STATUS[t.status].label}
          {t.status === "aprovada" && (t.paid_at ? " · paga" : " · aguardando taxa")}
        </span>
      </div>

      <div className={cx("mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-3", !compact && "md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]")}>
        <div className="rounded-2xl bg-ink-50 p-3.5 dark:bg-white/[0.04]">
          <p className="text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">Dono atual</p>
          <Link href={clientHref(`doc:${digits(t.from_doc)}`)} className="mt-1 block text-[15px] font-semibold hover:underline">
            {t.from_name || "—"}
          </Link>
          <Field k="CPF/CNPJ" v={maskDoc(t.from_doc)} mono />
          <Field k="Celular" v={formatPhone(fromPhone) ?? ""} mono />
        </div>
        {!compact && <ArrowRight className="mx-auto hidden h-5 w-5 self-center text-ink-400 md:block" />}
        <div className="rounded-2xl bg-ink-50 p-3.5 ring-1 ring-emerald-500/20 dark:bg-white/[0.04]">
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] text-emerald-700 uppercase">
            <UserRound className="h-3.5 w-3.5" /> Novo dono
          </p>
          <p className="mt-1 text-[15px] font-semibold">{n.name || "—"}</p>
          <Field k={digits(n.doc).length > 11 ? "CNPJ" : "CPF"} v={n.doc ? `${formatDoc(n.doc)}${docOk ? "" : " · inválido"}` : ""} mono />
          <Field k="Celular" v={formatPhone(n.phone ?? "") ?? ""} mono />
          <Field k="E-mail" v={n.email ?? ""} />
          <Field k="Cidade" v={[n.city, n.state].filter(Boolean).join("/")} />
          <Field k="Endereço" v={[n.address, n.cep && `CEP ${n.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}`].filter(Boolean).join(" · ")} />
        </div>
      </div>

      {t.notes && <p className="mt-3 rounded-2xl bg-ink-50 px-3.5 py-2.5 text-[13.5px] dark:bg-white/[0.04]">“{t.notes}”</p>}
      {t.decision_note && (
        <p className="mt-3 text-[13px] text-ink-500">
          {t.status === "recusada" ? "Motivo da recusa" : "Recado ao cliente"}: <span className="text-ink-800 dark:text-white">{t.decision_note}</span>
        </p>
      )}
      {(t.completed_at || t.decided_at) && compact && (
        <p className="mt-2 text-[12.5px] text-ink-500">{t.completed_at ? `Concluída em ${dateBr(t.completed_at)}` : `Decidida em ${dateBr(t.decided_at)}`}</p>
      )}

      {mode && (
        <div className="mt-4 rounded-2xl bg-ink-50 p-3.5 dark:bg-white/[0.04]">
          <label htmlFor={`tn-${t.id}`} className="text-[13px] font-semibold">
            {mode === "aprovar" ? "Recado para o cliente (opcional)" : "Motivo da recusa (o cliente vê)"}
          </label>
          <textarea id={`tn-${t.id}`} rows={2} value={note} maxLength={400} onChange={(e) => setNote(e.target.value)} placeholder={mode === "aprovar" ? `Ex.: aprovado! Enviaremos a chave PIX de ${fee} pelo WhatsApp.` : "Ex.: o CPF informado não confere com o documento do novo dono."} className="mt-1.5 w-full resize-none rounded-xl bg-white px-3 py-2.5 text-[14px] ring-1 ring-ink-200 outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-[#0b0e0c] dark:ring-white/10" />
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" disabled={!!busy || (mode === "recusar" && note.trim().length < 3)} onClick={() => act(mode, note)} className={cx("inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold text-white disabled:opacity-50", mode === "aprovar" ? "bg-emerald-600" : "bg-rose-600")}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "aprovar" ? <Check className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
              {mode === "aprovar" ? "Confirmar aprovação" : "Confirmar recusa"}
            </button>
            {mode === "recusar" && msgRefused && note.trim().length >= 3 && (
              <a href={msgRefused} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold ring-1 ring-ink-200 dark:ring-white/10">
                <MessageCircle className="h-4 w-4 text-emerald-600" /> Avisar no WhatsApp
              </a>
            )}
            <button type="button" onClick={() => setMode(null)} className="h-10 rounded-full px-4 text-[13.5px] font-semibold text-ink-500">
              Voltar
            </button>
          </div>
        </div>
      )}

      {!mode && (t.status === "analise" || t.status === "aprovada") && (
        <div className="mt-4 flex flex-wrap gap-2">
          {t.status === "analise" && (
            <>
              <button type="button" onClick={() => setMode("aprovar")} className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-600 px-4 text-[13.5px] font-semibold text-white">
                <Check className="h-4 w-4" /> Aprovar
              </button>
              <button type="button" onClick={() => setMode("recusar")} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold text-rose-700 ring-1 ring-rose-200">
                <ShieldX className="h-4 w-4" /> Recusar
              </button>
            </>
          )}
          {t.status === "aprovada" && !t.paid_at && (
            <>
              {msgApproved && (
                <a href={msgApproved} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold ring-1 ring-ink-200 dark:ring-white/10">
                  <MessageCircle className="h-4 w-4 text-emerald-600" /> Cobrar {fee}
                </a>
              )}
              <button type="button" disabled={!!busy} onClick={() => act("pago")} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#0B1A12] px-4 text-[13.5px] font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-[#0B1A12]">
                {busy === "pago" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />} Marcar taxa como paga
              </button>
            </>
          )}
          {t.status === "aprovada" && t.paid_at && (
            <button type="button" disabled={!!busy} onClick={() => act("concluir")} className="inline-flex h-10 items-center gap-2 rounded-full bg-[linear-gradient(95deg,#F3E93B_0%,#9FDB7C_45%,#4FC38A_100%)] px-5 text-[13.5px] font-bold text-[#0A0D0B] disabled:opacity-60">
              {busy === "concluir" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Concluir transferência
            </button>
          )}
          {t.status === "aprovada" && (
            <button type="button" onClick={() => setMode("recusar")} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold text-ink-500">
              <Ban className="h-4 w-4" /> Recusar
            </button>
          )}
        </div>
      )}

      {t.status === "concluida" && msgNewOwner && (
        <a href={msgNewOwner} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold ring-1 ring-ink-200 dark:ring-white/10">
          <MessageCircle className="h-4 w-4 text-emerald-600" /> Enviar acesso ao novo dono
        </a>
      )}
    </article>
  );
}
