"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Copy, FileSignature, MessageCircle, Smartphone } from "lucide-react";
import { useDados } from "@/lib/store";
import { fmtDataHora, fmtDocumento, linkWhatsApp } from "@/lib/format";
import { mensagemAssinatura } from "@/lib/mensagens";
import { linkAssinatura } from "@/lib/publico";
import type { Assinatura, Locacao } from "@/lib/types";
import { FluxoAssinatura } from "./assinar";
import { Termo } from "./termo";
import { Button, ButtonLink, Card, CardHeader, Modal } from "./ui";

/** Card da ficha da locação: enviar o termo para o cliente assinar (link) ou assinar ali mesmo. */
export function AssinaturaCard({ l }: { l: Locacao }) {
  const { backend, modo, dados, prepararAssinatura, assinarPresencial, termoCongelado } = useDados();
  const [a, setA] = useState<Assinatura | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [presencial, setPresencial] = useState(false);

  useEffect(() => {
    backend.assinatura(l.id).then(setA).catch(() => setA(null));
  }, [backend, l.id, l.assinado_em]);

  async function link(): Promise<string | null> {
    try {
      const nova = await prepararAssinatura(l);
      setA(nova);
      return linkAssinatura(nova.token);
    } catch (e) {
      toast.error("Não foi possível gerar o link", { description: e instanceof Error ? e.message : String(e) });
      return null;
    }
  }

  const assinado = a?.assinado_em ? a : null;

  return (
    <Card>
      <CardHeader title="Assinatura do termo" subtitle={assinado ? "Assinado digitalmente, com selfie" : "O cliente assina pelo celular, com selfie"} icon={<FileSignature className="h-[18px] w-[18px]" />} />
      <div className="px-5 pb-5">
        {a === undefined ? (
          <div className="h-16 animate-pulse rounded-2xl bg-ink-100" />
        ) : assinado ? (
          <div className="flex items-center gap-3 rounded-2xl bg-brand-50 p-3 ring-1 ring-brand-200">
            {assinado.selfie && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assinado.selfie} alt="Selfie" className="h-14 w-14 shrink-0 rounded-xl object-cover ring-2 ring-white" />
            )}
            <div className="min-w-0 text-[13px]">
              <p className="flex items-center gap-1.5 font-semibold text-brand-900">
                <CheckCircle2 className="h-4 w-4 text-brand-600" /> {assinado.nome}
              </p>
              <p className="text-brand-900/70">{assinado.documento && fmtDocumento(assinado.documento)}</p>
              <p className="text-[12px] text-brand-900/70">
                {fmtDataHora(assinado.assinado_em)} · {assinado.via === "link" ? "pelo link" : "no aparelho"}
              </p>
            </div>
          </div>
        ) : (
          <>
            {a && (
              <p className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900 ring-1 ring-amber-200">
                <Clock className="h-4 w-4 shrink-0" /> Link enviado — aguardando o cliente assinar.
              </p>
            )}
            <div className="grid gap-2">
              <Button
                variant="brand"
                loading={busy === "whats"}
                disabled={modo === "local"}
                onClick={async () => {
                  const aba = window.open("about:blank", "_blank");
                  setBusy("whats");
                  const url = await link();
                  setBusy(null);
                  if (!url) return aba?.close();
                  if (aba) aba.location.href = linkWhatsApp(l.cliente_telefone, mensagemAssinatura(l, url, dados.config));
                }}
              >
                <MessageCircle className="h-4 w-4" /> {a ? "Reenviar link no WhatsApp" : "Enviar link no WhatsApp"}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  loading={busy === "copiar"}
                  disabled={modo === "local"}
                  onClick={async () => {
                    setBusy("copiar");
                    const url = await link();
                    setBusy(null);
                    if (!url) return;
                    await navigator.clipboard.writeText(url).catch(() => {});
                    toast.success("Link copiado", { description: "Cole na conversa com o cliente." });
                  }}
                >
                  <Copy className="h-4 w-4" /> Copiar link
                </Button>
                <Button variant="secondary" onClick={() => setPresencial(true)}>
                  <Smartphone className="h-4 w-4" /> Assinar aqui
                </Button>
              </div>
              {modo === "local" && <p className="text-[12px] text-ink-500">O link para o cliente precisa da nuvem conectada. No modo demonstração, use “Assinar aqui”.</p>}
            </div>
          </>
        )}
        {assinado && (
          <ButtonLink href={`/documento/${l.id}?tipo=termo`} target="_blank" variant="secondary" className="mt-3 w-full">
            <FileSignature className="h-4 w-4" /> Ver termo assinado
          </ButtonLink>
        )}
      </div>

      <Modal open={presencial} onClose={() => setPresencial(false)} title="Assinar o termo neste aparelho" subtitle="Entregue o celular ao cliente para ler, assinar e tirar a selfie." size="lg">
        {presencial && (
          <div className="grid gap-5">
            <details className="rounded-2xl ring-1 ring-ink-200">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Ler o termo completo</summary>
              <div className="overflow-x-auto border-t border-ink-100 p-3">
                <div className="w-[210mm] origin-top-left scale-[0.55] sm:scale-75" style={{ marginBottom: "-40%" }}>
                  <Termo l={l} cfg={dados.config} reposicao={termoCongelado(l).reposicao} />
                </div>
              </div>
            </details>
            <FluxoAssinatura
              termo={termoCongelado(l)}
              nomeInicial={l.cliente_nome}
              documentoInicial={l.cliente_documento}
              onConcluir={async (d) => {
                await assinarPresencial(l, d);
                setPresencial(false);
              }}
            />
          </div>
        )}
      </Modal>
    </Card>
  );
}
