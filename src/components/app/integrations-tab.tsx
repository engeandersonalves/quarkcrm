"use client";

import { CalendarPlus, Check, FileSpreadsheet, Loader2, MessageCircle, Send, Webhook } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { CompanySettings, IntegrationPrefs } from "@/lib/defaults";
import { Badge, Button, Card, CardHeader, Field, Input } from "../ui";

const SAMPLE = `{
  "event": "lead.created",
  "sent_at": "2026-09-27T14:03:00.000Z",
  "data": {
    "origin": "captura",
    "lead": {
      "name": "Maria Oliveira",
      "phone": "(82) 99999-0000",
      "email": "maria@email.com",
      "city": "Maceió",
      "segment": "solar",
      "avg_bill": 600,
      "roof_type": "Telhado cerâmico",
      "temperature": "quente"
    }
  }
}`;

export function IntegrationsTab({ form, onChange }: { form: CompanySettings; onChange: (v: IntegrationPrefs) => void }) {
  const it = form.integrations;
  const set = (k: keyof IntegrationPrefs, v: string) => onChange({ ...it, [k]: v.trim() });
  const [testing, setTesting] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const pixelOk = !it.metaPixelId || /^\d{5,20}$/.test(it.metaPixelId);
  const gaOk = !it.gaId || /^G-[A-Z0-9]{4,15}$/i.test(it.gaId);

  const test = async () => {
    setTesting(true);
    const res = await fetch("/api/integrations/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: it.webhookUrl }) }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    setTesting(false);
    if (json?.ok) toast.success(`Webhook respondeu (${json.status}). Integração funcionando!`);
    else toast.error(json?.message ?? `O endereço não respondeu corretamente${json?.status ? ` (${json.status})` : ""}.`);
  };

  return (
    <>
      <Card>
        <CardHeader
          icon={<Webhook className="h-[18px] w-[18px]" />}
          title="Webhook · Zapier, Make, n8n, RD Station"
          subtitle="Cada lead novo e cada proposta aceita são enviados para o endereço abaixo, em tempo real."
          action={it.webhookUrl ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/15">Ativo</Badge> : null}
        />
        <div className="grid gap-3 px-5 pb-5">
          <Field label="Endereço do webhook (https://…)" hint="No Zapier: gatilho “Webhooks by Zapier → Catch Hook”. No Make: módulo “Custom webhook”.">
            <div className="flex gap-2">
              <Input value={it.webhookUrl} onChange={(e) => set("webhookUrl", e.target.value)} placeholder="https://hooks.zapier.com/hooks/catch/…" className="font-mono text-xs" />
              <Button variant="secondary" onClick={test} disabled={!/^https:\/\//i.test(it.webhookUrl) || testing}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Testar
              </Button>
            </div>
          </Field>
          <div className="flex flex-wrap gap-2 text-xs text-ink-600">
            {["lead.created · lead novo (captura ou app)", "proposal.accepted · proposta aceita online"].map((e) => (
              <span key={e} className="rounded-lg bg-ink-50 px-2.5 py-1 font-mono ring-1 ring-ink-200/60">
                {e}
              </span>
            ))}
          </div>
          <button onClick={() => setShowSample((v) => !v)} className="justify-self-start text-xs font-semibold text-sun-700 hover:underline">
            {showSample ? "Ocultar exemplo" : "Ver exemplo do que é enviado"}
          </button>
          {showSample && <pre className="overflow-x-auto rounded-xl bg-ink-950 p-4 text-[11px] leading-relaxed text-emerald-200">{SAMPLE}</pre>}
          <p className="text-xs text-ink-500">Ideias: criar o contato no RD Station ou HubSpot, avisar no grupo do WhatsApp da equipe, lançar numa planilha do Google.</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Rastreamento de anúncios" subtitle="Medem quantos leads cada anúncio gera. Ficam só na página de captura." />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <Field label="Pixel da Meta (Instagram/Facebook)" hint={pixelOk ? "Gerenciador de Eventos → Fontes de dados → ID do pixel (só números)" : "O ID do pixel tem só números"}>
            <Input value={it.metaPixelId} onChange={(e) => set("metaPixelId", e.target.value)} placeholder="Ex.: 1234567890123456" inputMode="numeric" />
          </Field>
          <Field label="Google Analytics 4" hint={gaOk ? "Administrador → Fluxos de dados → ID da métrica" : "O formato é G-XXXXXXXXXX"}>
            <Input value={it.gaId} onChange={(e) => set("gaId", e.target.value)} placeholder="Ex.: G-ABC123XYZ9" />
          </Field>
          <p className="text-xs text-ink-500 sm:col-span-2">
            Cada simulação enviada vira o evento <b>Lead</b> (Meta) e <b>generate_lead</b> (Google), com o valor estimado — pronto para otimizar campanhas por conversão.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Já integrado" subtitle="Funciona sem configurar nada" />
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-3">
          {[
            { icon: <MessageCircle className="h-5 w-5" />, title: "WhatsApp", text: "Mensagens prontas na ficha do lead e envio da proposta em um toque." },
            { icon: <CalendarPlus className="h-5 w-5" />, title: "Google Agenda", text: "Botão em cada tarefa para adicionar o compromisso na sua agenda." },
            { icon: <FileSpreadsheet className="h-5 w-5" />, title: "Planilhas", text: "Importe leads de uma planilha e exporte leads, propostas e relatórios." },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-200/60">
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-ink-800 shadow-soft">{c.icon}</span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <Check className="h-3.5 w-3.5" /> Ativo
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold">{c.title}</p>
              <p className="mt-0.5 text-xs text-ink-500">{c.text}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
