import { ShieldCheck } from "lucide-react";
import { maskDoc } from "@/lib/br";
import { ROLE_LABEL, documentBlocks, signersFor, type DocData, type DocKind, type SignerInfo } from "@/lib/documents";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Maceio", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * O documento como uma folha de papel: texto jurídico, assinaturas e o registro
 * de auditoria (quem assinou, quando, de onde e o código de verificação).
 */
export function DocumentView({
  kind,
  data,
  signers,
  company,
  hash,
}: {
  kind: DocKind;
  data: DocData;
  /** Assinantes já cadastrados (com assinatura, se houver). Sem isso, usa as partes do documento. */
  signers?: SignerInfo[];
  company?: { company_name?: string | null; logo_url?: string | null } | null;
  hash?: string | null;
}) {
  const blocks = documentBlocks(kind, data);
  const list: SignerInfo[] = signers?.length ? signers : signersFor(kind, data).map((s) => ({ role: s.role, name: s.name }));
  const signed = list.filter((s) => s.signed_at);

  return (
    <article className="doc-paper relative mx-auto w-full max-w-[800px] bg-white px-6 py-10 text-[14.5px] leading-[1.75] text-ink-900 shadow-lift ring-1 ring-ink-200/70 sm:rounded-2xl sm:px-14 sm:py-14 print:max-w-none print:rounded-none print:px-0 print:py-0 print:shadow-none print:ring-0">
      {(company?.logo_url || company?.company_name) && (
        <header className="mb-8 flex items-center justify-between gap-4 border-b border-ink-100 pb-5">
          {company?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo_url} alt={company.company_name ?? ""} className="h-9 w-auto max-w-[160px] object-contain" />
          ) : (
            <span className="font-display text-lg font-bold">{company?.company_name}</span>
          )}
          <span className="hidden text-[11px] font-semibold tracking-[0.18em] text-ink-400 uppercase sm:inline print:inline">Documento eletrônico</span>
        </header>
      )}

      <div className="font-serif">
        {blocks.map((b, i) => {
          if (b.t === "title") return <h1 key={i} className="text-center font-display text-2xl font-bold tracking-[0.12em] uppercase sm:text-[28px]">{b.text}</h1>;
          if (b.t === "sub") return <p key={i} className="mb-8 text-center font-sans text-[12px] font-semibold tracking-[0.2em] text-ink-400 uppercase">{b.text}</p>;
          if (b.t === "h") return <h2 key={i} className="mt-6 mb-1.5 font-sans text-[12px] font-bold tracking-[0.14em] text-ink-500 uppercase">{b.text}</h2>;
          if (b.t === "li") return <p key={i} className="my-1 pl-4 sm:pl-6 sm:text-justify print:text-justify">{b.text}</p>;
          if (b.t === "place") return <p key={i} className="mt-8 text-right">{b.text}</p>;
          return <p key={i} className="my-2 hyphens-auto sm:text-justify print:text-justify">{b.text}</p>;
        })}
      </div>

      <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 print:grid-cols-2">
        {list.map((s) => (
          <div key={s.role} className="break-inside-avoid text-center">
            <div className="flex h-20 items-end justify-center">
              {s.signature ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.signature} alt={`Assinatura de ${s.signed_name ?? s.name}`} className="max-h-20 w-auto max-w-[260px] object-contain" />
              ) : (
                <span className="pb-2 text-xs text-ink-300 italic">aguardando assinatura</span>
              )}
            </div>
            <div className="border-t border-ink-400 pt-1.5">
              <p className="text-sm font-semibold">{s.signed_name ?? s.name}</p>
              <p className="text-xs text-ink-500">
                {ROLE_LABEL[s.role] ?? s.role}
                {s.signed_cpf ? ` · CPF ${maskDoc(s.signed_cpf)}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>

      {signed.length > 0 && (
        <section className="mt-12 break-inside-avoid rounded-xl bg-ink-50 p-4 font-sans text-[11.5px] leading-relaxed text-ink-600 ring-1 ring-ink-200/70 sm:p-5">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-ink-900">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Registro de assinaturas eletrônicas
          </p>
          <ul className="grid gap-2">
            {signed.map((s) => (
              <li key={s.role} className="border-b border-ink-200/70 pb-2 last:border-0 last:pb-0">
                <b className="text-ink-800">{s.signed_name}</b> ({ROLE_LABEL[s.role] ?? s.role}) · CPF {maskDoc(s.signed_cpf)} · assinou em {fmt(s.signed_at!)} (horário de Brasília)
                {s.ip ? ` · IP ${s.ip}` : ""}
                {s.content_hash && <span className="block font-mono text-[10.5px] break-all text-ink-400">Código de verificação: {s.content_hash}</span>}
              </li>
            ))}
          </ul>
          {hash && <p className="mt-2 font-mono text-[10.5px] break-all text-ink-400">Hash do documento (SHA-256): {hash}</p>}
        </section>
      )}
    </article>
  );
}
