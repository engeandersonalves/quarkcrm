"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSignature, Loader2, Printer, ShieldCheck } from "lucide-react";
import { FluxoAssinatura, type DadosAssinatura } from "@/components/assinar";
import { Termo } from "@/components/termo";
import { Button } from "@/components/ui";
import { codigo, fmtDataHora } from "@/lib/format";
import { assinarPublico, termoPublico, type TermoPublico } from "@/lib/publico";
import type { Assinatura } from "@/lib/types";

/** Folha A4 reduzida para caber na largura do celular. */
function FolhaA4({ children }: { children: React.ReactNode }) {
  const [z, setZ] = useState(1);
  useEffect(() => {
    const f = () => setZ(Math.min(1, (Math.min(window.innerWidth, 860) - 32) / 794));
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return (
    <div className="folha mx-auto w-[210mm]" style={{ zoom: z }}>
      <div className="w-[210mm] bg-white px-[11mm] py-[10mm] shadow-lift print:shadow-none">{children}</div>
    </div>
  );
}

export default function AssinarTermo() {
  const { token } = useParams<{ token: string }>();
  const [estado, setEstado] = useState<"carregando" | "erro" | "pronto">("carregando");
  const [erro, setErro] = useState("");
  const [dados, setDados] = useState<TermoPublico | null>(null);
  const [concluida, setConcluida] = useState<Assinatura | null>(null);

  useEffect(() => {
    termoPublico(token)
      .then((d) => {
        if (!d) {
          setErro("Este link não existe ou foi substituído. Peça um novo link para a empresa.");
          setEstado("erro");
        } else {
          setDados(d);
          setEstado("pronto");
        }
      })
      .catch((e) => {
        setErro(/fetch|network/i.test(String(e)) ? "Sem conexão. Confira a internet e abra o link de novo." : String(e instanceof Error ? e.message : e));
        setEstado("erro");
      });
  }, [token]);

  async function assinar(d: DadosAssinatura) {
    const ok = await assinarPublico(token, { ...d, dispositivo: navigator.userAgent.slice(0, 300) });
    if (!ok) throw new Error("Este termo já foi assinado ou o link não vale mais.");
    setConcluida({
      locacao_id: "",
      token,
      criado_em: "",
      termo: dados!.termo,
      assinado_em: new Date().toISOString(),
      nome: d.nome,
      documento: d.documento,
      imagem: d.imagem,
      selfie: d.selfie,
      via: "link",
      hash: d.hash,
      ip: null,
      dispositivo: null,
      geo: d.geo || null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const t = dados?.termo;
  const empresa = t?.config.empresa_nome ?? "Quark Locações";

  return (
    <div className="min-h-dvh bg-ink-100 pb-16 print:bg-white print:pb-0">
      <title>{t ? `Assinar termo ${codigo(t.locacao.numero)} — ${empresa}` : "Assinar termo de locação"}</title>
      <header className="bg-navy-gradient px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-6 text-white print:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/quark-logo.png" alt={empresa} className="h-12 w-auto" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-brand-300 uppercase">{empresa}</p>
            <h1 className="font-display text-lg leading-tight font-semibold">{t ? `Termo de locação ${codigo(t.locacao.numero)}` : "Termo de locação"}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-5 grid max-w-3xl gap-5 px-4 print:mt-0 print:max-w-none print:px-0">
        {estado === "carregando" && (
          <div className="grid place-items-center rounded-3xl bg-white p-10 shadow-soft">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        )}

        {estado === "erro" && (
          <div className="rounded-3xl bg-white p-6 text-center shadow-soft">
            <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
            <p className="mt-3 font-display text-lg font-semibold">Não foi possível abrir o termo</p>
            <p className="mt-1 text-sm text-ink-600">{erro}</p>
          </div>
        )}

        {estado === "pronto" && t && (concluida || dados?.assinado_em) && (
          <div className="rounded-3xl bg-white p-6 text-center shadow-soft print:hidden">
            <CheckCircle2 className="mx-auto h-12 w-12 text-brand-500" />
            <p className="mt-3 font-display text-xl font-semibold">{concluida ? `Pronto, ${concluida.nome?.split(" ")[0]}!` : "Este termo já foi assinado"}</p>
            <p className="mt-1 text-sm text-ink-600">
              {concluida
                ? `Assinatura registrada em ${fmtDataHora(concluida.assinado_em)}. A ${empresa} já recebeu.`
                : `Assinado por ${dados?.nome} em ${fmtDataHora(dados?.assinado_em)}.`}
            </p>
            {concluida && (
              <Button variant="secondary" className="mt-5" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Guardar uma cópia (PDF)
              </Button>
            )}
          </div>
        )}

        {estado === "pronto" && t && (
          <section className="grid gap-3">
            <p className="flex items-center gap-2 px-1 text-sm font-semibold text-ink-700 print:hidden">
              <FileSignature className="h-4 w-4 text-brand-600" /> {concluida || dados?.assinado_em ? "Termo" : "1. Leia o termo"}
            </p>
            <div className="overflow-hidden rounded-2xl print:rounded-none">
              <FolhaA4>
                <Termo l={t.locacao} cfg={t.config} reposicao={t.reposicao} assinatura={concluida} />
              </FolhaA4>
            </div>
          </section>
        )}

        {estado === "pronto" && t && !concluida && !dados?.assinado_em && (
          <section className="rounded-3xl bg-white p-5 shadow-soft print:hidden">
            <p className="mb-1 font-display text-lg font-semibold">2. Assine</p>
            <p className="mb-5 text-[13.5px] text-ink-600">Leva menos de um minuto: assine com o dedo e tire uma selfie.</p>
            <FluxoAssinatura termo={t} nomeInicial={t.locacao.cliente_nome} documentoInicial={t.locacao.cliente_documento} onConcluir={assinar} />
            <p className="mt-4 flex items-start gap-2 text-[12px] text-ink-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              Sua assinatura, a selfie, a data e hora e um código único do documento ficam registrados como prova de que você aceitou este termo. Os dados são usados só para esta locação.
            </p>
          </section>
        )}
      </main>
      <style>{`@media print { @page { size: A4; margin: 7mm 0; } .folha { zoom: 1 !important; } }`}</style>
    </div>
  );
}
