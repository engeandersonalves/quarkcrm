"use client";

import { ChevronDown, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { renderCopy } from "@/lib/cadence";
import { anamneseUrl } from "./anamnese-link";
import { stageOf } from "@/lib/constants";
import { whatsappUrl } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import type { Lead } from "@/lib/types";
import { Button } from "../ui";
import { useApp } from "./app-context";
import { useReward } from "./rewards";

interface Template {
  id: string;
  label: string;
  text: string;
}

/** Botão de WhatsApp com mensagens prontas; cada envio fica registrado no histórico do lead. */
export function WhatsAppMenu({ lead, proposalUrl }: { lead: Lead; proposalUrl?: string | null }) {
  const { user, profile, settings } = useApp();
  const { reward } = useReward();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const first = lead.name.split(" ")[0];
  const me = (profile?.full_name ?? "").split(" ")[0];
  const company = settings.company_name || "Quark Energia";
  const interest =
    lead.segment === "save"
      ? "carregador para veículo elétrico"
      : lead.segment === "ambos"
        ? "energia solar e carregador veicular"
        : lead.segment === "eletroposto"
          ? "investir em um eletroposto"
          : lead.segment === "manutencao"
            ? "limpeza e manutenção da sua usina solar"
            : lead.segment === "gestao"
              ? "gestão energética"
              : "energia solar";
  const hi = `Olá, ${first}! ${me ? `Aqui é ${me}, da ${company}.` : `Aqui é da ${company}.`}`;

  const templates: Template[] = [
    { id: "contato", label: "Primeiro contato", text: `${hi} Recebi seu interesse em ${interest}. Posso te fazer algumas perguntas rápidas para preparar o seu orçamento?` },
    ...(!["save", "eletroposto"].includes(lead.segment ?? "solar")
      ? [{ id: "conta", label: "Pedir a conta de luz", text: `${hi} Para eu dimensionar o sistema ideal, você pode me enviar uma foto da sua última conta de luz (frente e verso)?` }]
      : [{ id: "local", label: "Pedir fotos do local", text: `${hi} Para eu orçar o carregador, pode me enviar uma foto do quadro de energia e do local onde o carro fica estacionado?` }]),
    ...(!["save", "eletroposto"].includes(lead.segment ?? "solar")
      ? [
          {
            id: "anamnese",
            label: "Enviar diagnóstico (anamnese)",
            text: `${hi} Preparei um diagnóstico rápido para calcular a sua economia com energia solar ☀️ São 2 minutinhos:\n${anamneseUrl({ seller: user.id, leadId: lead.id, name: lead.name })}`,
          },
        ]
      : []),
    { id: "visita", label: "Agendar visita técnica", text: `${hi} Gostaria de agendar a visita técnica, sem custo. Qual o melhor dia e horário para você?` },
    {
      id: "proposta",
      label: "Acompanhar a proposta",
      text: `${hi} Conseguiu ver a proposta que preparei para você?${proposalUrl ? `\n${proposalUrl}\n` : " "}Fico à disposição para tirar qualquer dúvida.`,
    },
    { id: "posvenda", label: "Pós-venda e indicação", text: `${hi} Obrigado pela confiança! Se conhecer alguém que também queira economizar, vou ficar muito feliz com a indicação.` },
    { id: "livre", label: "Mensagem em branco", text: `Olá, ${first}! Tudo bem?` },
  ];

  // Copys da cadência para a etapa atual do lead.
  const stageCopies: Template[] = (settings.cadence.stages[lead.status] ?? [])
    .filter((s) => s.type === "whatsapp" && s.copy.trim())
    .map((s) => ({ id: `cad-${s.id}`, label: s.title, text: renderCopy(s.copy, { name: lead.name, seller: profile?.full_name, company, segment: lead.segment, city: lead.city }) }));

  const send = (t: Template) => {
    setOpen(false);
    window.open(whatsappUrl(lead.phone, t.text), "_blank", "noopener");
    if (t.id !== "livre")
      supabase()
        .from("activities")
        .insert({ lead_id: lead.id, type: "whatsapp", content: `Mensagem enviada: ${t.label}`, created_by: user.id })
        .select("id")
        .single()
        .then(({ data }: { data: { id: string } | null }) => reward("followup", data?.id));
  };

  return (
    <div ref={ref} className="relative">
      <Button variant="secondary" className="text-emerald-700" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <MessageCircle className="h-4 w-4" /> WhatsApp <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div className="animate-fade-up absolute top-full left-0 z-30 mt-2 max-h-[70vh] w-72 overflow-y-auto rounded-2xl bg-white p-1.5 shadow-lift ring-1 ring-ink-200 sm:right-0 sm:left-auto">
          {stageCopies.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-sun-700 uppercase">⚡ Cadência · {stageOf(lead.status).label}</p>
              {stageCopies.map((t) => (
                <button key={t.id} onClick={() => send(t)} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-ink-50">
                  <span className="block text-sm font-medium text-ink-900">{t.label}</span>
                  <span className="line-clamp-1 text-xs text-ink-500">{t.text}</span>
                </button>
              ))}
              <div className="mx-3 my-1 h-px bg-ink-100" />
            </>
          )}
          <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-ink-400 uppercase">Mensagens prontas</p>
          {templates.map((t) => (
            <button key={t.id} onClick={() => send(t)} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-ink-50">
              <span className="block text-sm font-medium text-ink-900">{t.label}</span>
              <span className="line-clamp-1 text-xs text-ink-500">{t.text.replace(hi, "").trim()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
