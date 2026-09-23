"use client";

import { Bell, Building2, Calculator, Check, Code2, Copy, ExternalLink, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Button, Card, CardHeader, Field, Input, MoneyInput, NumberInput, PageHeader, Segmented, Textarea } from "@/components/ui";
import { DEFAULT_INPUTS, type CompanySettings } from "@/lib/defaults";
import type { AmountMode, PriceComponent, ProposalInputs } from "@/lib/pricing";
import { supabase } from "@/lib/supabase/client";

export default function SettingsPage() {
  const { settings, settingsLoaded, profile, user } = useApp();
  const [form, setForm] = useState<CompanySettings | null>(null);
  const [me, setMe] = useState({ full_name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (settingsLoaded && !form) setForm(settings);
  }, [settingsLoaded, settings, form]);
  useEffect(() => {
    if (profile) setMe({ full_name: profile.full_name ?? "", phone: profile.phone ?? "" });
  }, [profile]);

  if (!form) return null;
  const d: ProposalInputs = { ...DEFAULT_INPUTS, ...form.defaults };
  const set = <K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) => setForm((f) => f && { ...f, [k]: v });
  const setDef = <K extends keyof ProposalInputs>(k: K, v: ProposalInputs[K]) => setForm((f) => f && { ...f, defaults: { ...f.defaults, [k]: v } });

  const save = async () => {
    setSaving(true);
    const sb = supabase();
    const [a, b] = await Promise.all([
      sb.from("settings").upsert({ id: 1, data: form }),
      sb.from("profiles").update({ full_name: me.full_name || null, phone: me.phone || null }).eq("id", user.id),
    ]);
    setSaving(false);
    if (a.error || b.error) return toast.error((a.error ?? b.error)!.message);
    toast.success("Configurações salvas");
  };

  const captureUrl = `${origin}/captura`;
  const embed = `<iframe src="${captureUrl}?embed=1" style="width:100%;max-width:520px;height:720px;border:0;border-radius:20px" loading="lazy"></iframe>`;

  return (
    <div className="animate-fade-up mx-auto max-w-4xl pb-24">
      <PageHeader title="Configurações" subtitle="Dados da empresa, padrões de orçamento e alertas por e-mail" actions={<Button onClick={save} loading={saving}><Check className="h-4 w-4" /> Salvar</Button>} />

      <div className="grid gap-5">
        <Card>
          <CardHeader icon={<Building2 className="h-[18px] w-[18px]" />} title="Empresa" subtitle="Aparece no cabeçalho e no rodapé das propostas" />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field label="Nome fantasia"><Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} /></Field>
            <Field label="CNPJ"><Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} /></Field>
            <Field label="WhatsApp comercial"><Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(00) 00000-0000" /></Field>
            <Field label="E-mail comercial"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Endereço" className="sm:col-span-2"><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
            <Field label="URL do logotipo" hint="PNG ou SVG com fundo transparente (é exibido em branco na capa)" className="sm:col-span-2">
              <Input value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://…/logo.png" />
            </Field>
            <Field label="Sobre a empresa (texto da proposta)" className="sm:col-span-2">
              <Textarea value={form.about} onChange={(e) => set("about", e.target.value)} className="min-h-[110px]" />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Calculator className="h-[18px] w-[18px]" />} title="Padrões do orçamento" subtitle="Valores que já vêm preenchidos em todo novo orçamento" />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
            <Field label="Mão de obra por placa"><MoneyInput value={d.laborPerModule} onChange={(v) => setDef("laborPerModule", v)} /></Field>
            <Field label="Material elétrico por kWp"><MoneyInput value={d.electricalPerKwp} onChange={(v) => setDef("electricalPerKwp", v)} /></Field>
            <Field label="Tarifa padrão"><NumberInput value={d.tariff} onChange={(v) => setDef("tariff", v)} prefix="R$" suffix="/kWh" digits={3} /></Field>
            <DefComp label="Comissão" value={d.commission} onChange={(v) => setDef("commission", v)} />
            <DefComp label="Impostos" value={d.tax} onChange={(v) => setDef("tax", v)} />
            <DefComp label="Lucro" value={d.profit} onChange={(v) => setDef("profit", v)} />
            <Field label="Irradiação (HSP)"><NumberInput value={d.sunHours} onChange={(v) => setDef("sunHours", v)} suffix="kWh/m²" /></Field>
            <Field label="Performance ratio"><NumberInput value={d.performanceRatio} onChange={(v) => setDef("performanceRatio", v)} /></Field>
            <Field label="Fio B da distribuidora" hint="TUSD Fio B com impostos"><NumberInput value={d.fioBTariff} onChange={(v) => setDef("fioBTariff", v)} prefix="R$" suffix="/kWh" digits={3} /></Field>
            <Field label="Iluminação pública padrão"><MoneyInput value={d.publicLighting} onChange={(v) => setDef("publicLighting", v)} /></Field>
            <Field label="Simultaneidade padrão" hint="% da geração consumida na hora"><NumberInput value={d.selfConsumption} onChange={(v) => setDef("selfConsumption", v)} suffix="%" digits={0} /></Field>
            <Field label="Taxa do financiamento"><NumberInput value={d.financingRate} onChange={(v) => setDef("financingRate", v)} suffix="% a.m." /></Field>
            <Field label="Cartão (parcelas)"><NumberInput value={d.cardInstallments} onChange={(v) => setDef("cardInstallments", v)} suffix="x" digits={0} /></Field>
            <Field label="Juros do cartão"><NumberInput value={d.cardRate} onChange={(v) => setDef("cardRate", v)} suffix="% a.m." /></Field>
            <Field label="Validade da proposta"><NumberInput value={d.validityDays} onChange={(v) => setDef("validityDays", v)} suffix="dias" digits={0} /></Field>
            <Field label="Pagamento → homologação"><NumberInput value={d.installationDays} onChange={(v) => setDef("installationDays", v)} suffix="dias" digits={0} /></Field>
            <Field label="Reajuste anual da tarifa"><NumberInput value={d.tariffIncrease} onChange={(v) => setDef("tariffIncrease", v)} suffix="% a.a." digits={1} /></Field>
            <Field label="Condições de pagamento padrão" className="sm:col-span-3">
              <Textarea value={d.paymentNotes} onChange={(e) => setDef("paymentNotes", e.target.value)} placeholder="Ex.: 50% na assinatura e 50% na instalação." />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<ShieldCheck className="h-[18px] w-[18px]" />} title="Garantias" subtitle="Exibidas na proposta" />
          <div className="grid grid-cols-2 gap-4 px-5 pb-5 sm:grid-cols-5">
            <Field label="Eficiência dos módulos"><NumberInput value={form.warranty_modules_performance_years} onChange={(v) => set("warranty_modules_performance_years", v)} suffix="anos" digits={0} /></Field>
            <Field label="Defeitos nos módulos"><NumberInput value={form.warranty_modules_years} onChange={(v) => set("warranty_modules_years", v)} suffix="anos" digits={0} /></Field>
            <Field label="Inversor"><NumberInput value={form.warranty_inverter_years} onChange={(v) => set("warranty_inverter_years", v)} suffix="anos" digits={0} /></Field>
            <Field label="Estrutura"><NumberInput value={form.warranty_structure_years} onChange={(v) => set("warranty_structure_years", v)} suffix="anos" digits={0} /></Field>
            <Field label="Instalação"><NumberInput value={form.warranty_installation_years} onChange={(v) => set("warranty_installation_years", v)} suffix="anos" digits={0} /></Field>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Bell className="h-[18px] w-[18px]" />} title="Alertas por e-mail" subtitle="Novo lead, nova tarefa, proposta aberta e proposta aceita" />
          <div className="grid gap-4 px-5 pb-5">
            <Field label="Enviar alertas para" hint="Separe vários e-mails por vírgula. O responsável por cada tarefa também é avisado automaticamente.">
              <Input value={form.notify_emails} onChange={(e) => set("notify_emails", e.target.value)} placeholder="voce@empresa.com, vendas@empresa.com" />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Code2 className="h-[18px] w-[18px]" />} title="Formulário de captura" subtitle="Leads que preencherem entram direto no funil e disparam alerta" />
          <div className="grid gap-3 px-5 pb-5">
            <div className="flex gap-2">
              <Input readOnly value={captureUrl} className="font-mono text-xs" />
              <Button variant="secondary" size="icon" onClick={() => { navigator.clipboard.writeText(captureUrl); toast.success("Link copiado"); }} aria-label="Copiar"><Copy className="h-4 w-4" /></Button>
              <a href="/captura" target="_blank"><Button variant="secondary" size="icon" aria-label="Abrir"><ExternalLink className="h-4 w-4" /></Button></a>
            </div>
            <Field label="Código para incorporar no site">
              <Textarea readOnly value={embed} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<UserRound className="h-[18px] w-[18px]" />} title="Meu perfil" subtitle="Seu nome aparece como consultor nas propostas" />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field label="Nome"><Input value={me.full_name} onChange={(e) => setMe({ ...me, full_name: e.target.value })} /></Field>
            <Field label="Telefone"><Input value={me.phone} onChange={(e) => setMe({ ...me, phone: e.target.value })} /></Field>
          </div>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-ink-200/70 bg-white/95 p-3 backdrop-blur lg:hidden">
        <Button onClick={save} loading={saving} className="w-full">Salvar configurações</Button>
      </div>
    </div>
  );
}

function DefComp({ label, value, onChange }: { label: string; value: PriceComponent; onChange: (v: PriceComponent) => void }) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        {value.mode === "percent" ? (
          <NumberInput className="flex-1" value={value.value} onChange={(v) => onChange({ ...value, value: v })} suffix="%" />
        ) : (
          <MoneyInput className="flex-1" value={value.value} onChange={(v) => onChange({ ...value, value: v })} />
        )}
        <Segmented<AmountMode> size="sm" className="items-center" value={value.mode} onChange={(mode) => onChange({ mode, value: 0 })} options={[{ value: "percent", label: "%" }, { value: "fixed", label: "R$" }]} />
      </div>
    </Field>
  );
}
