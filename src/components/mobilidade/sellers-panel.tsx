"use client";

import { Camera, Check, ChevronDown, CircleDollarSign, Eye, EyeOff, KeyRound, Loader2, MessageCircle, PencilLine, Plus, Power, Trophy, UserRound, Users, Wallet } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cx } from "@/components/ui";
import { formatPhone, relativeTime } from "@/lib/format";
import { useLive } from "@/lib/live";
import { toPortrait } from "@/lib/moto-customers-db";
import { supabase } from "@/lib/supabase/client";
import { SectionTitle } from "./board-panels";
import { brl0, wa } from "./sale-row";

/**
 * Vendedores parceiros da Mobilidade: cadastro (com foto e código de acesso), envio do
 * acesso pelo WhatsApp e acompanhamento das indicações e comissões.
 */

export interface SellerRow {
  id: string;
  name: string;
  phone: string;
  pin: string;
  ref: string;
  photo: string | null;
  city: string | null;
  instagram: string | null;
  commission: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
}
type RefStatus = "nova" | "contato" | "negociacao" | "fechada" | "perdida";
export interface ReferralRow {
  id: string;
  seller_id: string;
  lead_id: string | null;
  name: string;
  phone: string;
  model: string | null;
  notes: string | null;
  status: RefStatus;
  commission: number | null;
  paid_at: string | null;
  created_at: string;
}

const PANEL = "rounded-[24px] bg-white p-4 ring-1 ring-ink-200/80 sm:p-5 dark:bg-[#0f1311] dark:ring-white/[0.07]";
const INPUT = "h-11 w-full rounded-xl bg-ink-50 px-3 text-[14.5px] ring-1 ring-ink-200 outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.04] dark:ring-white/10";
const STATUS: Record<RefStatus, string> = { nova: "Recebida", contato: "Em contato", negociacao: "Negociando", fechada: "Fechada", perdida: "Não fechou" };
const STATUS_CLS: Record<RefStatus, string> = {
  nova: "bg-sky-50 text-sky-800 ring-sky-200",
  contato: "bg-amber-50 text-amber-800 ring-amber-200",
  negociacao: "bg-amber-50 text-amber-800 ring-amber-200",
  fechada: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  perdida: "bg-ink-100 text-ink-600 ring-ink-200",
};
const missing = (m: string) => /moto_sellers|moto_referrals/.test(m);
const first = (n: string) => n.trim().split(/\s+/)[0] || "";

export function useSellers() {
  return useLive(
    async () => {
      const [s, r] = await Promise.all([
        supabase().from("moto_sellers").select("*").order("created_at", { ascending: false }).limit(500),
        supabase().from("moto_referrals").select("*").order("created_at", { ascending: false }).limit(2000),
      ]);
      // Antes de rodar o schema.sql as tabelas não existem: a aba mostra o aviso, sem erro.
      if (s.error || r.error) return { sellers: [] as SellerRow[], referrals: [] as ReferralRow[], missing: missing(s.error?.message ?? r.error?.message ?? "") };
      return { sellers: (s.data ?? []) as SellerRow[], referrals: (r.data ?? []) as ReferralRow[], missing: false };
    },
    [],
    ["moto_sellers", "moto_referrals"],
  );
}

export function SellersPanel({ data }: { data: ReturnType<typeof useSellers> }) {
  const sellers = data.data?.sellers ?? [];
  const referrals = data.data?.referrals ?? [];
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const month = new Date().toISOString().slice(0, 7);
  const stats = useMemo(
    () => ({
      active: sellers.filter((s) => s.active).length,
      month: referrals.filter((r) => r.created_at.slice(0, 7) === month).length,
      closed: referrals.filter((r) => r.status === "fechada").length,
      toPay: referrals.filter((r) => r.status === "fechada" && !r.paid_at).reduce((t, r) => t + (Number(r.commission) || 0), 0),
      fresh: referrals.filter((r) => r.status === "nova").length,
    }),
    [sellers, referrals, month],
  );

  if (data.loading && !data.data)
    return (
      <div className={cx(PANEL, "grid place-items-center py-14")}>
        <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
      </div>
    );
  if (data.data?.missing) return <p className={cx(PANEL, "text-[14px] text-ink-600")}>Rode o arquivo supabase/schema.sql no Supabase (SQL Editor) para ativar a área do vendedor.</p>;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <section className={cx(PANEL, "flex flex-wrap items-center gap-4")}>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold">Vendedores parceiros</p>
          <p className="text-[13.5px] text-ink-500">
            Eles entram em <b className="font-semibold text-ink-800 dark:text-white">{origin.replace(/^https?:\/\//, "")}/vendedor</b> com o telefone e o código de 4 números, divulgam o catálogo e indicam clientes.
          </p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="inline-flex h-11 items-center gap-2 rounded-full bg-[linear-gradient(95deg,#F3E93B_0%,#9FDB7C_45%,#4FC38A_100%)] px-5 text-[14px] font-bold text-[#0A0D0B]">
          <Plus className="h-4 w-4" /> Novo vendedor
        </button>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { k: "Vendedores ativos", v: String(stats.active), icon: Users },
          { k: "Indicações no mês", v: String(stats.month), icon: UserRound },
          { k: "Vendas fechadas", v: String(stats.closed), icon: Trophy },
          { k: "Comissão a pagar", v: brl0(stats.toPay), icon: Wallet },
        ].map((x) => (
          <div key={x.k} className={PANEL}>
            <x.icon className="h-5 w-5 text-emerald-600" />
            <p className="mt-2 text-[22px] leading-none font-bold tabular-nums">{x.v}</p>
            <p className="mt-1 text-[12.5px] text-ink-500">{x.k}</p>
          </div>
        ))}
      </div>

      {creating && <SellerForm onClose={() => setCreating(false)} onSaved={() => void data.reload()} />}

      <section>
        <SectionTitle title="Vendedores" count={sellers.length} />
        {sellers.length ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
            {sellers.map((s) => (
              <SellerCard key={s.id} s={s} refs={referrals.filter((r) => r.seller_id === s.id)} open={open === s.id} toggle={() => setOpen(open === s.id ? null : s.id)} reload={() => void data.reload()} origin={origin} />
            ))}
          </div>
        ) : (
          <p className={cx(PANEL, "text-[14px] text-ink-500")}>Nenhum vendedor ainda. Toque em “Novo vendedor” para cadastrar o primeiro.</p>
        )}
      </section>
    </div>
  );
}

function SellerForm({ s, onClose, onSaved }: { s?: SellerRow; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: s?.name ?? "", phone: s?.phone ?? "", city: s?.city ?? "", instagram: s?.instagram ?? "", commission: s?.commission ?? "R$ 300 por venda fechada", notes: s?.notes ?? "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (f.name.trim().length < 3) return toast.error("Digite o nome do vendedor.");
    if (f.phone.replace(/\D/g, "").length < 10) return toast.error("Digite o WhatsApp do vendedor com DDD.");
    setBusy(true);
    try {
      const row = { name: f.name.trim(), phone: f.phone.replace(/\D/g, ""), city: f.city.trim() || null, instagram: f.instagram.trim().replace(/^@/, "") || null, commission: f.commission.trim() || null, notes: f.notes.trim() || null, updated_at: new Date().toISOString() };
      const { error } = s ? await supabase().from("moto_sellers").update(row).eq("id", s.id) : await supabase().from("moto_sellers").insert(row);
      if (error) throw new Error(/duplicate|unique/i.test(error.message) ? "Já existe um vendedor com esse telefone." : missing(error.message) ? "Rode o schema.sql no Supabase para ativar os vendedores." : error.message);
      toast.success(s ? "Dados salvos" : "Vendedor cadastrado. Envie o acesso pelo WhatsApp.");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  };
  const field = (k: keyof typeof f, label: string, ph = "", wide = false) => (
    <label className={cx("block", wide && "sm:col-span-2")}>
      <span className="mb-1 block text-[12.5px] font-semibold text-ink-500">{label}</span>
      <input value={f[k]} onChange={(e) => setF({ ...f, [k]: k === "phone" ? formatPhone(e.target.value.replace(/\D/g, "").slice(0, 11)) : e.target.value })} placeholder={ph} className={INPUT} />
    </label>
  );
  return (
    <section className={PANEL}>
      <p className="text-[15px] font-semibold">{s ? "Editar vendedor" : "Novo vendedor"}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {field("name", "Nome completo", "Nome e sobrenome", true)}
        {field("phone", "WhatsApp (é o login dele)", "(82) 9 0000-0000")}
        {field("city", "Cidade", "Maceió/AL")}
        {field("instagram", "Instagram (opcional)", "@usuario")}
        {field("commission", "Comissão combinada", "R$ 300 por venda fechada")}
        {field("notes", "Observações internas", "Só a equipe vê", true)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={save} className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-600 px-5 text-[13.5px] font-semibold text-white disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
        </button>
        <button type="button" onClick={onClose} className="h-10 rounded-full px-4 text-[13.5px] font-semibold text-ink-500">
          Cancelar
        </button>
      </div>
    </section>
  );
}

function SellerCard({ s, refs, open, toggle, reload, origin }: { s: SellerRow; refs: ReferralRow[]; open: boolean; toggle: () => void; reload: () => void; origin: string }) {
  const [edit, setEdit] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const closed = refs.filter((r) => r.status === "fechada");
  const toPay = closed.filter((r) => !r.paid_at).reduce((t, r) => t + (Number(r.commission) || 0), 0);
  const fresh = refs.filter((r) => r.status === "nova").length;
  const access = wa(s.phone, `Olá, ${first(s.name)}! Seu acesso à área do vendedor Quark Mobilidade:\n\n🔗 ${origin}/vendedor\n📱 Login: este WhatsApp\n🔑 Código: ${s.pin}\n\nLá você encontra o catálogo com fotos e textos prontos para divulgar, indica clientes e acompanha suas comissões.`);

  const update = async (key: string, patch: Partial<SellerRow>, ok: string) => {
    setBusy(key);
    try {
      const { error } = await supabase().from("moto_sellers").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", s.id);
      if (error) throw new Error(error.message);
      toast.success(ok);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setBusy(null);
    }
  };
  const newPin = () => {
    if (!confirm(`Gerar um novo código para ${s.name}? O código atual deixa de funcionar.`)) return;
    void update("pin", { pin: String(Math.floor(Math.random() * 10000)).padStart(4, "0") }, "Novo código gerado. Envie pelo WhatsApp.");
    setShowPin(true);
  };
  const photo = async (file: File | undefined) => {
    if (!file) return;
    try {
      await update("foto", { photo: await toPortrait(file) }, "Foto salva");
    } catch {
      toast.error("Não foi possível usar essa foto");
    }
    if (photoInput.current) photoInput.current.value = "";
  };

  return (
    <article className={cx(PANEL, !s.active && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => photoInput.current?.click()} className="relative h-[72px] w-[54px] shrink-0 overflow-hidden rounded-xl bg-ink-100 ring-1 ring-ink-200 dark:bg-white/[0.06] dark:ring-white/10" title="Trocar foto">
          {s.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserRound className="mx-auto h-6 w-6 text-ink-400" />
          )}
          <span className="absolute inset-x-0 bottom-0 grid place-items-center bg-black/55 py-0.5 text-white">{busy === "foto" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}</span>
        </button>
        <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={(e) => photo(e.target.files?.[0])} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[16px] font-semibold">
            {s.name}
            {!s.active && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11.5px] font-semibold text-ink-600 ring-1 ring-ink-200">Inativo</span>}
            {fresh > 0 && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11.5px] font-semibold text-sky-800 ring-1 ring-sky-200">{fresh} nova{fresh > 1 ? "s" : ""}</span>}
          </p>
          <p className="text-[13px] text-ink-500 tabular-nums">
            {formatPhone(s.phone)}
            {s.city ? ` · ${s.city}` : ""} · código do link <b className="font-semibold">{s.ref}</b>
          </p>
          <p className="text-[13px] text-ink-500">
            {refs.length} indicaç{refs.length === 1 ? "ão" : "ões"} · {closed.length} fechada{closed.length === 1 ? "" : "s"}
            {toPay > 0 ? ` · ${brl0(toPay)} a pagar` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-ink-50 px-3 py-1.5 text-[13px] ring-1 ring-ink-200 dark:bg-white/[0.04] dark:ring-white/10">
          <KeyRound className="h-4 w-4 text-ink-400" />
          <span className="font-mono font-semibold tracking-[0.2em]">{showPin ? s.pin : "••••"}</span>
          <button type="button" onClick={() => setShowPin(!showPin)} aria-label={showPin ? "Esconder código" : "Mostrar código"} className="text-ink-400">
            {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {access && (
          <a href={access} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 text-[13px] font-semibold text-white">
            <MessageCircle className="h-4 w-4" /> Enviar acesso
          </a>
        )}
        <button type="button" onClick={toggle} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ring-1 ring-ink-200 dark:ring-white/10">
          Indicações ({refs.length}) <ChevronDown className={cx("h-4 w-4 transition", open && "rotate-180")} />
        </button>
        <button type="button" onClick={() => setEdit(!edit)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ring-1 ring-ink-200 dark:ring-white/10">
          <PencilLine className="h-4 w-4" /> Editar
        </button>
        <button type="button" disabled={!!busy} onClick={newPin} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ring-1 ring-ink-200 dark:ring-white/10">
          <KeyRound className="h-4 w-4" /> Novo código
        </button>
        <button type="button" disabled={!!busy} onClick={() => update("ativo", { active: !s.active }, s.active ? "Vendedor desativado: o acesso foi bloqueado." : "Vendedor reativado")} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-ink-500">
          <Power className="h-4 w-4" /> {s.active ? "Desativar" : "Reativar"}
        </button>
      </div>

      {edit && (
        <div className="mt-3">
          <SellerForm s={s} onClose={() => setEdit(false)} onSaved={reload} />
        </div>
      )}

      {open && (
        <div className="mt-4 grid gap-2">
          {refs.length ? refs.map((r) => <ReferralItem key={r.id} r={r} reload={reload} />) : <p className="text-[13.5px] text-ink-500">Nenhuma indicação ainda.</p>}
        </div>
      )}
    </article>
  );
}

function ReferralItem({ r, reload }: { r: ReferralRow; reload: () => void }) {
  const [commission, setCommission] = useState(r.commission != null ? String(r.commission) : "");
  const [busy, setBusy] = useState(false);
  const save = async (patch: Partial<ReferralRow>, ok?: string) => {
    setBusy(true);
    try {
      const { error } = await supabase().from("moto_referrals").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", r.id);
      if (error) throw new Error(error.message);
      if (ok) toast.success(ok);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  };
  const chat = wa(r.phone, `Olá, ${first(r.name)}! Aqui é da Quark Mobilidade. Recebemos sua indicação e queremos te mostrar as scooters elétricas.`);
  return (
    <div className="rounded-2xl bg-ink-50 p-3.5 dark:bg-white/[0.04]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold">{r.name}</p>
          <p className="text-[12.5px] text-ink-500 tabular-nums">
            {formatPhone(r.phone)}
            {r.model ? ` · ${r.model}` : ""} · {relativeTime(r.created_at)}
          </p>
          {r.notes && <p className="mt-1 text-[12.5px] text-ink-500">“{r.notes}”</p>}
        </div>
        {chat && (
          <a href={chat} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 ring-ink-200 dark:ring-white/10">
            <MessageCircle className="h-4 w-4 text-emerald-600" /> Conversar
          </a>
        )}
        <select value={r.status} disabled={busy} onChange={(e) => save({ status: e.target.value as RefStatus }, "Situação atualizada")} className={cx("h-9 rounded-full px-3 text-[13px] font-semibold ring-1 outline-none", STATUS_CLS[r.status])} aria-label="Situação da indicação">
          {(Object.keys(STATUS) as RefStatus[]).map((k) => (
            <option key={k} value={k}>
              {STATUS[k]}
            </option>
          ))}
        </select>
      </div>
      {r.status === "fechada" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[13px] text-ink-500">
            Comissão R$
            <input inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value.replace(/[^\d,.]/g, ""))} onBlur={() => commission !== String(r.commission ?? "") && save({ commission: commission ? Number(commission.replace(/\./g, "").replace(",", ".")) || 0 : null }, "Comissão salva")} placeholder="300" className="h-9 w-24 rounded-lg bg-white px-2 text-[14px] ring-1 ring-ink-200 outline-none dark:bg-[#0b0e0c] dark:ring-white/10" />
          </label>
          <button type="button" disabled={busy} onClick={() => save({ paid_at: r.paid_at ? null : new Date().toISOString() }, r.paid_at ? "Pagamento desfeito" : "Comissão marcada como paga")} className={cx("inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold", r.paid_at ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-[#0B1A12] text-white dark:bg-white dark:text-[#0B1A12]")}>
            <CircleDollarSign className="h-4 w-4" /> {r.paid_at ? "Comissão paga" : "Marcar comissão como paga"}
          </button>
        </div>
      )}
    </div>
  );
}
