"use client";

import { ArrowLeftRight, ArrowRight, Check, CircleAlert, Clock3, FileCheck2, Loader2, Lock, MessageCircle, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { digits } from "@/lib/br";
import { TRANSFER_FEE, firstName, maskDocInput, maskPhoneInput, validDoc, type PortalSale, type PortalTransfer } from "@/lib/client-portal";
import { vehicleName } from "@/lib/moto-sale";

/**
 * Pedido de transferência de propriedade na área do cliente. O dono preenche os
 * dados do novo dono; a Quark analisa, cobra a taxa se aprovar e conclui.
 */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const CARD = "rounded-[26px] bg-white ring-1 ring-[#0B1A12]/[0.06] shadow-[0_18px_40px_-28px_rgba(16,52,32,0.45),0_1px_2px_rgba(16,52,32,0.05)]";
const FIELD = "mt-1.5 h-13 w-full rounded-2xl bg-[#F4F7F1] px-4 text-[16px] ring-1 ring-[#0B1A12]/[0.08] outline-none transition placeholder:text-[#0B1A12]/35 focus:bg-white focus:ring-2 focus:ring-[#1F9D55]";
const LABEL = "mt-4 block text-[13px] font-semibold text-[#0B1A12]/70";
const fee = `R$ ${TRANSFER_FEE.toFixed(2).replace(".", ",")}`;
const REASONS = ["Vendi a scooter", "Dei de presente", "Passei para um familiar", "Outro motivo"];

const ERRORS: Record<string, string> = {
  acesso: "Sua sessão expirou. Saia e entre de novo na área do cliente.",
  venda: "Não encontramos esta scooter no seu cadastro.",
  nao_assinada: "A transferência só pode ser pedida depois que o contrato de compra é assinado.",
  dados: "Confira o nome completo, o CPF e o celular do novo dono.",
  mesmo_dono: "O CPF do novo dono é o mesmo do dono atual.",
  em_andamento: "Já existe um pedido de transferência em andamento para esta scooter.",
  limite: "Muitos pedidos em pouco tempo. Tente de novo amanhã ou fale com a Quark.",
  indisponivel: "A transferência ainda não está disponível. Fale com a Quark pelo WhatsApp.",
};

type Form = { name: string; doc: string; phone: string; email: string; cep: string; address: string; city: string; state: string; reason: string; notes: string; owner: boolean; feeOk: boolean };
const EMPTY: Form = { name: "", doc: "", phone: "", email: "", cep: "", address: "", city: "", state: "AL", reason: REASONS[0], notes: "", owner: false, feeOk: false };

export function TransferPanel({ sale, creds, whatsapp }: { sale: PortalSale; creds: { cpf: string; check: string }; whatsapp: string | null }) {
  const signed = Boolean(sale.signed_at) || sale.status === "assinado";
  const [transfer, setTransfer] = useState<PortalTransfer | null>(sale.transfer ?? null);
  const [f, setF] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const model = vehicleName(sale.data).replace(/^Scooter elétrica\s*/, "") || "scooter";
  const open = transfer && (transfer.status === "analise" || transfer.status === "aprovada");
  const wa = digits(whatsapp);
  const talk = (text: string) => (wa.length >= 10 ? `https://wa.me/${wa.length <= 11 ? `55${wa}` : wa}?text=${encodeURIComponent(text)}` : null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.name.trim().split(/\s+/).length < 2) return setErr("Digite o nome completo do novo dono.");
    if (!validDoc(f.doc)) return setErr("O CPF (ou CNPJ) do novo dono não parece válido. Confira os números.");
    if (digits(f.phone).length < 10) return setErr("Digite o celular do novo dono com DDD.");
    if (!f.city.trim()) return setErr("Digite a cidade do novo dono.");
    if (!f.owner || !f.feeOk) return setErr("Marque as duas confirmações no fim do formulário.");
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/public/cliente/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...creds, sale: sale.id, newOwner: { name: f.name, doc: f.doc, phone: f.phone, email: f.email, cep: f.cep, address: f.address, city: f.city, state: f.state }, reason: f.reason, notes: f.notes }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
      if (!j.ok) return setErr(ERRORS[j.error ?? ""] ?? "Não foi possível enviar agora. Tente de novo em instantes.");
      setTransfer({ id: j.id ?? "", status: "analise", created_at: new Date().toISOString(), new_owner: f.name.trim(), decision_note: null, fee: TRANSFER_FEE, paid: false });
      setF(EMPTY);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErr("Sem conexão. Tente de novo em instantes.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-5 grid max-w-xl grid-cols-[minmax(0,1fr)] gap-5">
      {/* apresentação */}
      <section className="qp-up relative overflow-hidden rounded-[30px] px-6 py-7 text-white" style={{ background: "linear-gradient(150deg,#123A26 0%,#0B1A12 70%)" }}>
        <div aria-hidden className="absolute -top-24 -right-16 h-64 w-64 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(216,232,60,0.25), transparent)" }} />
        <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#D8E83C] ring-1 ring-white/15">
          <ArrowLeftRight className="h-6 w-6" />
        </span>
        <h2 className="relative mt-4 text-[26px] leading-tight font-bold tracking-[-0.03em]">Transferir a propriedade</h2>
        <p className="relative mt-2 text-[15px] leading-relaxed text-white/75">
          Vai passar a sua {model} para outra pessoa? Peça aqui. Depois de aprovada, o cartão do proprietário, a garantia que resta e a área do cliente passam para o novo dono.
        </p>
        <p className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold ring-1 ring-white/15">
          <Wallet className="h-4 w-4 text-[#D8E83C]" /> Taxa de {fee} · só se aprovarmos
        </p>
      </section>

      {!signed ? (
        <section className={cx(CARD, "p-6 text-center")}>
          <Lock className="mx-auto h-8 w-8 text-[#0B1A12]/35" />
          <p className="mt-3 text-[16px] font-semibold">Disponível depois da assinatura</p>
          <p className="mt-1 text-[14px] text-[#0B1A12]/60">A transferência só pode ser pedida quando o contrato de compra estiver assinado.</p>
        </section>
      ) : open && transfer ? (
        <Tracker t={transfer} talk={talk(`Olá! Quero falar sobre a transferência da minha scooter ${model} para ${transfer.new_owner ?? "o novo dono"}.`)} />
      ) : (
        <>
          <Steps />
          {transfer?.status === "recusada" && (
            <p className="flex items-start gap-3 rounded-2xl bg-[#FDECEA] px-4 py-3.5 text-[14px] leading-relaxed text-[#8A2414]">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                <b>Seu pedido anterior não foi aprovado.</b>
                {transfer.decision_note ? ` Motivo: ${transfer.decision_note}` : ""} Você pode corrigir e pedir de novo.
              </span>
            </p>
          )}
          <form onSubmit={submit} noValidate className={cx(CARD, "qp-up p-5 sm:p-6")}>
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#1F9D55] uppercase">Dados do novo dono</p>
            <p className="mt-1 text-[14px] text-[#0B1A12]/60">Use os dados de quem vai ficar com a scooter. Ele vai entrar na área do cliente com o CPF e o celular informados aqui.</p>

            <label htmlFor="qt-name" className={LABEL}>Nome completo</label>
            <input id="qt-name" value={f.name} maxLength={120} autoComplete="off" onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nome e sobrenome" className={FIELD} />

            <div className="grid grid-cols-[minmax(0,1fr)] gap-x-3 sm:grid-cols-2">
              <div>
                <label htmlFor="qt-doc" className={LABEL}>CPF ou CNPJ</label>
                <input id="qt-doc" inputMode="numeric" value={f.doc} autoComplete="off" onChange={(e) => setF({ ...f, doc: maskDocInput(e.target.value) })} placeholder="000.000.000-00" className={cx(FIELD, "tabular-nums")} />
              </div>
              <div>
                <label htmlFor="qt-phone" className={LABEL}>Celular (WhatsApp)</label>
                <input id="qt-phone" inputMode="tel" value={f.phone} autoComplete="off" onChange={(e) => setF({ ...f, phone: maskPhoneInput(e.target.value) })} placeholder="(82) 9 0000-0000" className={cx(FIELD, "tabular-nums")} />
              </div>
            </div>

            <label htmlFor="qt-email" className={LABEL}>E-mail (opcional)</label>
            <input id="qt-email" type="email" inputMode="email" value={f.email} maxLength={120} autoComplete="off" onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="nome@email.com" className={FIELD} />

            <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-x-3">
              <div>
                <label htmlFor="qt-city" className={LABEL}>Cidade</label>
                <input id="qt-city" value={f.city} maxLength={80} autoComplete="off" onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="Maceió" className={FIELD} />
              </div>
              <div>
                <label htmlFor="qt-uf" className={LABEL}>UF</label>
                <input id="qt-uf" value={f.state} maxLength={2} autoComplete="off" onChange={(e) => setF({ ...f, state: e.target.value.replace(/[^a-z]/gi, "").toUpperCase() })} className={cx(FIELD, "text-center uppercase")} />
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-x-3 sm:grid-cols-[140px_minmax(0,1fr)]">
              <div>
                <label htmlFor="qt-cep" className={LABEL}>CEP (opcional)</label>
                <input id="qt-cep" inputMode="numeric" value={f.cep} autoComplete="off" onChange={(e) => setF({ ...f, cep: digits(e.target.value).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2") })} placeholder="57000-000" className={cx(FIELD, "tabular-nums")} />
              </div>
              <div>
                <label htmlFor="qt-address" className={LABEL}>Endereço (opcional)</label>
                <input id="qt-address" value={f.address} maxLength={200} autoComplete="off" onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Rua, número, bairro" className={FIELD} />
              </div>
            </div>

            <p className={LABEL}>Motivo</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {REASONS.map((r) => {
                const on = f.reason === r;
                return (
                  <button key={r} type="button" aria-pressed={on} onClick={() => setF({ ...f, reason: r })} className={cx("h-10 rounded-full px-4 text-[13.5px] font-semibold ring-1 transition", on ? "bg-[#0B1A12] text-white ring-[#0B1A12]" : "bg-white text-[#0B1A12]/70 ring-[#0B1A12]/12 hover:ring-[#0B1A12]/25")}>
                    {r}
                  </button>
                );
              })}
            </div>

            <label htmlFor="qt-notes" className={LABEL}>Observações (opcional)</label>
            <textarea id="qt-notes" rows={2} maxLength={600} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Algo que a Quark deva saber sobre a transferência" className={cx(FIELD, "h-auto resize-none py-3")} />

            <div className="mt-5 grid gap-2.5">
              <Check2 on={f.owner} onChange={(v) => setF({ ...f, owner: v })}>
                Declaro que sou o dono desta scooter e autorizo a transferência para a pessoa acima.
              </Check2>
              <Check2 on={f.feeOk} onChange={(v) => setF({ ...f, feeOk: v })}>
                Estou ciente da taxa de <b>{fee}</b>, paga só se a Quark aprovar o pedido.
              </Check2>
            </div>

            <div aria-live="polite">{err && <p className="qp-up mt-4 rounded-2xl bg-[#FDECEA] px-4 py-3 text-[13.5px] text-[#A12A17]">{err}</p>}</div>

            <button type="submit" disabled={busy} className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0B1A12] text-[16px] font-bold text-white hover:bg-[#13291c] disabled:opacity-70">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Enviar para análise <ArrowRight className="h-5 w-5" /></>}
            </button>
            <p className="mt-2.5 text-center text-[12px] text-[#0B1A12]/45">Nada muda até a Quark concluir. Você pode acompanhar o pedido aqui.</p>
          </form>
        </>
      )}
    </div>
  );
}

function Check2({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={() => onChange(!on)} className={cx("flex items-start gap-3 rounded-2xl px-4 py-3.5 text-left text-[14px] leading-relaxed ring-1 transition", on ? "bg-[#EAF6EC] ring-[#1F9D55]/40" : "bg-[#F4F7F1] ring-[#0B1A12]/[0.08]")}>
      <span className={cx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md ring-1", on ? "bg-[#1F9D55] text-white ring-[#1F9D55]" : "bg-white ring-[#0B1A12]/25")}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
      <span className="text-[#0B1A12]/80">{children}</span>
    </button>
  );
}

const STEPS = [
  { icon: UserRound, title: "Você envia os dados", text: "Nome, CPF e celular de quem vai ficar com a scooter." },
  { icon: ShieldCheck, title: "A Quark analisa", text: "Conferimos os dados e respondemos pelo WhatsApp." },
  { icon: Wallet, title: `Pagamento de ${fee}`, text: "Só se o pedido for aprovado. Enviamos a chave PIX." },
  { icon: FileCheck2, title: "Transferência concluída", text: "O novo dono entra na área do cliente com o CPF dele." },
];

function Steps() {
  return (
    <section className={cx(CARD, "qp-up p-5 sm:p-6")}>
      <p className="text-[11px] font-bold tracking-[0.2em] text-[#1F9D55] uppercase">Como funciona</p>
      <ol className="mt-3 grid gap-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F1F7EE] text-[#1F9D55]">
              <s.icon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-[15px] font-semibold">
                {i + 1}. {s.title}
              </span>
              <span className="block text-[13.5px] text-[#0B1A12]/60">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Tracker({ t, talk }: { t: PortalTransfer; talk: string | null }) {
  // 0 enviado · 1 em análise · 2 pagamento · 3 concluída
  const at = t.status === "analise" ? 1 : t.paid ? 3 : 2;
  const rows = [
    { title: "Pedido enviado", text: new Date(t.created_at).toLocaleDateString("pt-BR") },
    { title: "Análise da Quark", text: t.status === "analise" ? "Estamos conferindo os dados" : "Aprovado" },
    { title: `Pagamento de ${fee}`, text: t.status === "analise" ? "Depois da aprovação" : t.paid ? "Recebido" : "Aguardando o seu PIX" },
    { title: "Transferência concluída", text: t.paid ? "Finalizando" : "Última etapa" },
  ];
  return (
    <section className={cx(CARD, "qp-up p-5 sm:p-6")}>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#FFF6DA] text-[#9A6B00]">
          <Clock3 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[17px] font-bold">{t.status === "analise" ? "Pedido em análise" : "Pedido aprovado"}</p>
          <p className="truncate text-[13.5px] text-[#0B1A12]/60">Para {firstName(t.new_owner ?? "") || "o novo dono"} · {t.new_owner}</p>
        </div>
      </div>
      <ol className="mt-5 grid gap-0">
        {rows.map((r, i) => {
          const done = i < at;
          const now = i === at;
          return (
            <li key={r.title} className="relative flex gap-3 pb-5 last:pb-0">
              {i < rows.length - 1 && <span aria-hidden className={cx("absolute top-7 left-[13px] h-[calc(100%-20px)] w-[2px]", done ? "bg-[#1F9D55]" : "bg-[#0B1A12]/10")} />}
              <span className={cx("relative grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold", done ? "bg-[#1F9D55] text-white" : now ? "bg-[#0B1A12] text-white" : "bg-[#F1F3EF] text-[#0B1A12]/40")}>
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cx("pt-0.5", !done && !now && "opacity-50")}>
                <span className="block text-[15px] font-semibold">{r.title}</span>
                <span className="block text-[13px] text-[#0B1A12]/60">{r.text}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {t.decision_note && <p className="mt-4 rounded-2xl bg-[#F1F7EE] px-4 py-3 text-[14px] leading-relaxed text-[#0B1A12]/80">Recado da Quark: {t.decision_note}</p>}
      {talk && (
        <a href={talk} target="_blank" rel="noopener noreferrer" className="mt-4 flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-[15px] font-bold text-[#06210F]">
          <MessageCircle className="h-5 w-5" /> {t.status === "aprovada" && !t.paid ? "Pedir a chave PIX" : "Falar com a Quark"}
        </a>
      )}
    </section>
  );
}
