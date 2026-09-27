"use client";

import { ClipboardList, Copy, ExternalLink, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { whatsappUrl } from "@/lib/format";
import { Button, Modal } from "../ui";
import { useApp } from "./app-context";

/** Link da anamnese com o vendedor embutido: quem responder já cai no funil como lead dele. */
export function anamneseUrl(opts: { seller?: string; leadId?: string; name?: string | null } = {}) {
  const q = new URLSearchParams();
  if (opts.leadId) q.set("l", opts.leadId);
  if (opts.seller) q.set("v", opts.seller);
  const first = (opts.name ?? "").trim().split(/\s+/)[0];
  if (first) q.set("n", first);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qs = q.toString();
  return `${origin}/anamnese${qs ? `?${qs}` : ""}`;
}

export function AnamneseLinkButton() {
  const { user, settings, profile } = useApp();
  const [open, setOpen] = useState(false);
  const url = anamneseUrl({ seller: user.id });
  const me = (profile?.full_name ?? "").split(" ")[0];
  const message = `Olá! ${me ? `Aqui é ${me}, da ${settings.company_name || "Quark Energia"}. ` : ""}Preparei um diagnóstico rápido (2 minutos) para calcular quanto você pode economizar com energia solar ☀️\n\nÉ só responder aqui: ${url}`;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} title="Link do diagnóstico energético para enviar aos clientes">
        <ClipboardList className="h-4 w-4" /> <span className="hidden sm:inline">Anamnese</span>
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Diagnóstico energético (anamnese)" subtitle="Envie para o cliente: ele responde em 2 minutos, vê a economia e cai no funil como seu lead, com a cadência de follow-up.">
        <div className="rounded-2xl bg-ink-950 p-4 text-white">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-brand-lime uppercase">Seu link</p>
          <p className="mt-1 font-mono text-[13px] break-all text-white/80">{url}</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <a href={whatsappUrl("", message)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(url).catch(() => {});
              toast.success("Link copiado — cole na bio, no status ou no direct");
            }}
          >
            <Copy className="h-4 w-4" /> Copiar link
          </Button>
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50">
            <ExternalLink className="h-4 w-4" /> Ver como cliente
          </a>
        </div>
        <ul className="mt-4 grid gap-1.5 text-[13px] text-ink-600">
          <li>• Para um cliente que já está no CRM, use o WhatsApp da página do lead → “Enviar diagnóstico”: as respostas completam o cadastro dele.</li>
          <li>• As respostas ficam nas observações do lead e a temperatura (quente, morno, frio) é definida pelo prazo e pela forma de pagamento.</li>
        </ul>
      </Modal>
    </>
  );
}
