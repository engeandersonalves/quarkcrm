"use client";

import {
  Copy,
  ExternalLink,
  HeartHandshake,
  MessageCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { whatsappUrl } from "@/lib/format";
import { Button, Modal } from "../ui";
import { useApp } from "./app-context";

/** Link da tela de indicação com o vendedor embutido: cada indicação vira lead dele (origem "Indicação"). */
export function indicacaoUrl(seller?: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/indique${seller ? `?v=${seller}` : ""}`;
}

export function IndicacaoLinkButton() {
  const { user, settings, profile } = useApp();
  const [open, setOpen] = useState(false);
  const url = indicacaoUrl(user.id);
  const me = (profile?.full_name ?? "").split(" ")[0];
  const company = settings.company_name || "Quark Energia";
  const message = `Oi! ${me ? `Aqui é ${me}, da ${company}. ` : ""}Conhece alguém que paga caro na conta de luz? 🌞\n\nIndica pra gente por aqui, leva 1 minuto: ${url}\n\nFazemos o estudo de energia solar sem custo e cuidamos de tudo. Obrigado pela confiança! 💚`;
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        title="Link para amigos e clientes indicarem novos clientes"
      >
        <HeartHandshake className="h-4 w-4" />{" "}
        <span className="hidden sm:inline">Indicação</span>
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Indique um amigo"
        subtitle="Envie para amigos e clientes: eles informam o nome deles e os dados de quem estão indicando, e a indicação cai no funil como seu lead."
      >
        <div className="rounded-2xl bg-ink-950 p-4 text-white">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-brand-lime uppercase">
            Seu link de indicação
          </p>
          <p className="mt-1 font-mono text-[13px] break-all text-white/80">
            {url}
          </p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <a
            href={whatsappUrl("", message)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(url).catch(() => {});
              toast.success(
                "Link copiado: cole no status, no grupo ou no direct",
              );
            }}
          >
            <Copy className="h-4 w-4" /> Copiar link
          </Button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50"
          >
            <ExternalLink className="h-4 w-4" /> Ver como cliente
          </a>
        </div>
        <ul className="mt-4 grid gap-1.5 text-[13px] text-ink-600">
          <li>
            • A pessoa preenche: nome dela, nome e WhatsApp do indicado, tipo de
            telhado, consumo médio, local de instalação e informações
            adicionais.
          </li>
          <li>
            • O lead entra com origem “Indicação”, e quem indicou fica nas
            observações. Você recebe o aviso de novo lead.
          </li>
        </ul>
      </Modal>
    </>
  );
}
