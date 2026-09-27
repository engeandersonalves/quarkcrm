"use client";

import { CheckCircle2, Download, FileSignature, Loader2, Lock, MessageCircle, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatDoc, isValidDoc } from "@/lib/br";
import { ROLE_LABEL, type DocData, type DocKind, type SignerInfo } from "@/lib/documents";
import { whatsappUrl } from "@/lib/format";
import { DocumentView } from "./document-view";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";

export interface PublicDocument {
  cancelled?: boolean;
  document?: { id: string; kind: DocKind; title: string; data: DocData; status: string; created_at: string; completed_at: string | null; hash: string };
  signer?: { role: string; name: string; cpf: string | null; signed_at: string | null; signed_name: string | null };
  signers?: SignerInfo[];
  company?: { company_name?: string | null; logo_url?: string | null; whatsapp?: string | null; phone?: string | null; email?: string | null } | null;
  seller?: { name?: string | null; phone?: string | null; email?: string | null } | null;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });

export function SignFlow({ data, token, scriptFont }: { data: PublicDocument; token: string; scriptFont: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [read, setRead] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/public/document/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "view" }) }).catch(() => {});
  }, [token]);

  // Considera "lido" quando o cliente chega ao fim do documento.
  useEffect(() => {
    const el = endRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setRead(true);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const company = data.company?.company_name || "Quark Energia";
  const contact = data.seller?.phone || data.company?.whatsapp || data.company?.phone;

  if (data.cancelled || !data.document || !data.signer) {
    return (
      <Shell company={data.company}>
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
            <X className="h-7 w-7" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-semibold">Este documento foi cancelado</h1>
          <p className="mt-2 text-ink-500">Fale com a {company} para receber a versão atualizada.</p>
        </div>
      </Shell>
    );
  }

  const doc = data.document;
  const me = data.signer;
  const signers = data.signers ?? [];
  const signedCount = signers.filter((s) => s.signed_at).length;
  const first = me.name.split(/[\s(]/)[0];
  const iSigned = !!me.signed_at || done;

  return (
    <Shell company={data.company}>
      {/* Cabeçalho */}
      <section className="relative overflow-hidden bg-ink-950 px-5 pt-10 pb-24 text-white print:hidden">
        <div className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-sun-500/25 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-brand-purple/60 blur-[100px]" />
        <div className="relative mx-auto max-w-[800px]">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-brand-lime uppercase">Assinatura eletrônica</p>
          <h1 className="mt-2 font-display text-[28px] leading-tight font-semibold sm:text-4xl">
            {iSigned ? `Tudo certo, ${first}!` : `Olá, ${first}!`}
            <span className="block text-white/60">{iSigned ? "Sua assinatura foi registrada." : `A ${company} enviou um documento para você assinar.`}</span>
          </h1>
          <div className="mt-6 flex flex-wrap gap-2">
            {signers.map((s) => (
              <span key={s.role} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${s.signed_at || (s.role === me.role && done) ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30" : "bg-white/5 text-white/70 ring-white/10"}`}>
                {s.signed_at || (s.role === me.role && done) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileSignature className="h-3.5 w-3.5" />}
                {ROLE_LABEL[s.role] ?? s.role}: {s.name.split(" ")[0]}
              </span>
            ))}
          </div>
          <ol className="mt-6 grid grid-cols-3 gap-2 text-[11px] font-semibold sm:text-xs">
            {["Ler o documento", "Confirmar seus dados", "Assinar"].map((t, i) => {
              const active = iSigned || (i === 0 ? true : i === 1 ? read || open : open);
              return (
                <li key={t} className={`rounded-xl px-3 py-2 ring-1 transition ${active ? "bg-white/10 text-white ring-white/20" : "text-white/40 ring-white/10"}`}>
                  <span className="mr-1 text-brand-yellow">{i + 1}</span> {t}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <main className="relative -mt-16 px-0 pb-40 sm:px-5 print:mt-0 print:p-0">
        {iSigned && (
          <div className="animate-fade-up mx-auto mb-4 flex max-w-[800px] items-start gap-3 bg-emerald-50 p-4 text-emerald-900 ring-1 ring-emerald-200 sm:rounded-2xl print:hidden">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">Assinado {me.signed_at ? `em ${fmt(me.signed_at)}` : "agora"}</p>
              <p className="text-emerald-800/80">
                {signedCount === signers.length || (done && signedCount + 1 >= signers.length) ? "Todas as partes assinaram. Guarde uma cópia do documento." : "Assim que as outras partes assinarem, o documento estará completo."}
              </p>
            </div>
            <button onClick={() => window.print()} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
              <Download className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        )}
        <DocumentView kind={doc.kind} data={doc.data} signers={signers} company={data.company} hash={signedCount ? doc.hash : null} />
        <div ref={endRef} className="h-px" />
        <p className="mx-auto mt-6 flex max-w-[800px] items-center justify-center gap-1.5 px-5 text-center text-xs text-ink-400 print:hidden">
          <Lock className="h-3.5 w-3.5" /> Assinatura com validade jurídica (MP 2.200-2/2001 e Lei 14.063/2020). Registramos data, hora, IP e código de verificação.
        </p>
      </main>

      {/* Barra de ação */}
      {!iSigned && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200/70 bg-white/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl print:hidden">
          <div className="mx-auto flex max-w-[800px] items-center gap-3">
            <div className="hidden min-w-0 flex-1 sm:block">
              <p className="truncate text-sm font-semibold">{doc.title}</p>
              <p className="text-xs text-ink-500">{read ? "Você chegou ao fim do documento ✓" : "Leia até o fim e assine com o dedo"}</p>
            </div>
            {contact && (
              <a
                href={whatsappUrl(contact, `Olá! Tenho uma dúvida sobre o documento "${doc.title}".`)}
                target="_blank"
                rel="noreferrer"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-emerald-700 ring-1 ring-ink-200"
                aria-label="Tirar dúvida no WhatsApp"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
            )}
            <button
              onClick={() => setOpen(true)}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-ink-950 px-6 text-[15px] font-semibold text-white shadow-lift transition active:scale-[0.98] sm:flex-none"
            >
              <FileSignature className="h-5 w-5 text-brand-yellow" /> Assinar documento
            </button>
          </div>
        </div>
      )}

      {open && (
        <SignSheet
          token={token}
          signer={me}
          scriptFont={scriptFont}
          onClose={() => setOpen(false)}
          onSigned={() => {
            setOpen(false);
            setDone(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
            router.refresh();
          }}
        />
      )}
    </Shell>
  );
}

function SignSheet({
  token,
  signer,
  scriptFont,
  onClose,
  onSigned,
}: {
  token: string;
  signer: NonNullable<PublicDocument["signer"]>;
  scriptFont: string;
  onClose: () => void;
  onSigned: () => void;
}) {
  const pad = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState(signer.name.replace(/\s*\(.*\)$/, ""));
  const [cpf, setCpf] = useState(formatDoc(signer.cpf));
  const [agree, setAgree] = useState(false);
  const [empty, setEmpty] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const cpfOk = isValidDoc(cpf);
  const nameOk = name.trim().split(/\s+/).length >= 2;
  const ready = cpfOk && nameOk && agree && !empty;

  const submit = async () => {
    setError("");
    const signature = pad.current?.toDataUrl();
    if (!signature) return setError("Faça a sua assinatura no quadro.");
    setBusy(true);
    const res = await fetch(`/api/public/document/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sign", name: name.trim(), cpf, signature }),
    }).catch(() => null);
    setBusy(false);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !json.ok) {
      setError(json.error === "assinado" ? "Este documento já foi assinado por você." : "Não foi possível registrar a assinatura. Confira os dados e tente novamente.");
      return;
    }
    onSigned();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6 print:hidden" role="dialog" aria-modal="true" aria-label="Assinar documento">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="animate-sheet-up relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lift sm:rounded-[28px] sm:p-7">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink-200 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Assinar documento</h2>
            <p className="text-sm text-ink-500">Confirme seus dados e faça sua assinatura.</p>
          </div>
          <button onClick={onClose} disabled={busy} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-500" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <label className="grid gap-1">
            <span className="text-[13px] font-semibold text-ink-700">Nome completo</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="h-12 rounded-xl border border-ink-200 px-3 text-[15px] outline-none focus:border-ink-500" />
          </label>
          <label className="grid gap-1">
            <span className="text-[13px] font-semibold text-ink-700">CPF</span>
            <input
              value={cpf}
              onChange={(e) => setCpf(formatDoc(e.target.value))}
              inputMode="numeric"
              placeholder="000.000.000-00"
              className={`h-12 rounded-xl border px-3 text-[15px] tabular-nums outline-none ${cpf && !cpfOk && cpf.replace(/\D/g, "").length >= 11 ? "border-rose-400" : "border-ink-200 focus:border-ink-500"}`}
            />
            {cpf.replace(/\D/g, "").length >= 11 && !cpfOk && <span className="text-xs text-rose-600">CPF inválido. Confira os números.</span>}
          </label>
          <div>
            <span className="mb-1 block text-[13px] font-semibold text-ink-700">Sua assinatura</span>
            <SignaturePad ref={pad} name={name} scriptFont={scriptFont} onChange={setEmpty} />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-ink-50 p-3 text-[13px] leading-snug text-ink-700">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#1C1234]" />
            Li o documento, concordo com o seu conteúdo e reconheço esta assinatura eletrônica como válida, com o mesmo efeito da assinatura em papel.
          </label>
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <button
            onClick={submit}
            disabled={!ready || busy}
            className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-ink-950 py-3.5 text-[15px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSignature className="h-5 w-5 text-brand-yellow" />}
            {busy ? "Registrando…" : "Assinar agora"}
          </button>
          <p className="text-center text-[11px] text-ink-400">Ao assinar, registramos data, hora, endereço IP e o código de verificação do documento.</p>
        </div>
      </div>
    </div>
  );
}

function Shell({ company, children }: { company: PublicDocument["company"]; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink-50 print:bg-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-ink-950/90 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex h-14 max-w-[800px] items-center justify-between px-5">
          {company?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo_url} alt={company.company_name ?? ""} className="h-7 w-auto max-w-[140px] object-contain brightness-0 invert" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/brand/logo-h-white.png" alt={company?.company_name ?? "Quark Energia"} className="h-7 w-auto" />
          )}
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/60">
            <Lock className="h-3.5 w-3.5 text-brand-lime" /> Ambiente seguro
          </span>
        </div>
      </header>
      {children}
    </div>
  );
}
