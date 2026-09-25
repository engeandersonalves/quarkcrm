"use client";

import {
  Bell,
  Building2,
  Calculator,
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  GripVertical,
  ImageIcon,
  Package,
  PlugZap,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { CinematicBackdrop } from "@/components/app/cinematic";
import { TeamTab } from "@/components/app/team-tab";
import { Button, Card, CardHeader, Field, ImageField, Input, MoneyInput, NumberInput, PageHeader, Segmented, Select, Switch, Textarea, cx } from "@/components/ui";
import { ROOF_TYPES } from "@/lib/constants";
import { mergeSave, type SaveInputs } from "@/lib/save";
import { DEFAULT_INPUTS, toStoredSettings, type CompanySettings, type KitPreset, type ProposalSections, type SplashMode } from "@/lib/defaults";
import { imagePool, pickDaily, quotePool } from "@/lib/inspiration";
import { brl, fmtNum, type AmountMode, type PriceComponent, type ProposalInputs } from "@/lib/pricing";
import { DEFAULT_FAQ, DEFAULT_TIMELINE, SECTION_LABELS } from "@/lib/proposal-content";
import { supabase } from "@/lib/supabase/client";

type Tab = "empresa" | "orcamento" | "kits" | "save" | "proposta" | "app" | "alertas" | "captura" | "equipe" | "perfil";

const TABS: { id: Tab; label: string; icon: typeof Building2 }[] = [
  { id: "empresa", label: "Empresa", icon: Building2 },
  { id: "orcamento", label: "Orçamento", icon: Calculator },
  { id: "kits", label: "Kits salvos", icon: Package },
  { id: "save", label: "S.A.V.E", icon: PlugZap },
  { id: "proposta", label: "Proposta", icon: FileText },
  { id: "app", label: "App & inspiração", icon: Sparkles },
  { id: "alertas", label: "Alertas", icon: Bell },
  { id: "captura", label: "Captura", icon: Code2 },
  { id: "equipe", label: "Equipe", icon: UsersRound },
  { id: "perfil", label: "Meu perfil", icon: UserRound },
];

export default function SettingsPage() {
  const { settings, settingsLoaded, profile, user } = useApp();
  const [form, setForm] = useState<CompanySettings | null>(null);
  const [me, setMe] = useState({ full_name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<Tab>("empresa");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    const t = new URLSearchParams(window.location.search).get("aba") as Tab | null;
    if (t && TABS.some((x) => x.id === t)) setTab(t);
  }, []);
  useEffect(() => {
    if (settingsLoaded && !form) setForm(settings);
  }, [settingsLoaded, settings, form]);
  useEffect(() => {
    if (profile) setMe({ full_name: profile.full_name ?? "", phone: profile.phone ?? "" });
  }, [profile]);

  if (!form) return null;
  const d: ProposalInputs = { ...DEFAULT_INPUTS, ...form.defaults };
  const update = (fn: (f: CompanySettings) => CompanySettings) => {
    setForm((f) => (f ? fn(f) : f));
    setDirty(true);
  };
  const set = <K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) => update((f) => ({ ...f, [k]: v }));
  const setDef = <K extends keyof ProposalInputs>(k: K, v: ProposalInputs[K]) => update((f) => ({ ...f, defaults: { ...f.defaults, [k]: v } }));
  const setApp = <K extends keyof CompanySettings["app"]>(k: K, v: CompanySettings["app"][K]) => update((f) => ({ ...f, app: { ...f.app, [k]: v } }));
  const setProp = <K extends keyof CompanySettings["proposal"]>(k: K, v: CompanySettings["proposal"][K]) => update((f) => ({ ...f, proposal: { ...f.proposal, [k]: v } }));

  const save = async () => {
    setSaving(true);
    const sb = supabase();
    const [a, b] = await Promise.all([
      sb.from("settings").upsert({ id: 1, data: toStoredSettings(form) }),
      sb.from("profiles").update({ full_name: me.full_name || null, phone: me.phone || null }).eq("id", user.id),
    ]);
    setSaving(false);
    if (a.error || b.error) return toast.error((a.error ?? b.error)!.message);
    setDirty(false);
    toast.success("Configurações salvas");
  };

  const captureUrl = `${origin}/captura`;
  const embed = `<iframe src="${captureUrl}?embed=1" style="width:100%;max-width:520px;height:720px;border:0;border-radius:20px" loading="lazy"></iframe>`;
  const timeline = form.proposal.timeline.length ? form.proposal.timeline : DEFAULT_TIMELINE;
  const faq = form.proposal.faq.length ? form.proposal.faq : DEFAULT_FAQ;

  return (
    <div className="animate-fade-up mx-auto max-w-5xl pb-28">
      <PageHeader
        title="Configurações"
        subtitle="Deixe o app e a proposta do seu jeito"
        actions={
          <Button onClick={save} loading={saving} disabled={!dirty}>
            <Check className="h-4 w-4" /> {dirty ? "Salvar alterações" : "Tudo salvo"}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:sticky lg:top-8 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                "flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-3.5 text-sm font-semibold transition",
                tab === t.id ? "bg-ink-900 text-white shadow-soft" : "text-ink-500 hover:bg-white hover:text-ink-900",
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </nav>

        <div className="grid min-w-0 content-start gap-5">
          {tab === "empresa" && (
            <Card>
              <CardHeader icon={<Building2 className="h-[18px] w-[18px]" />} title="Empresa" subtitle="Aparece no cabeçalho e no rodapé das propostas" />
              <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
                <Field label="Nome fantasia"><Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} /></Field>
                <Field label="CNPJ"><Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} /></Field>
                <Field label="WhatsApp comercial"><Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(00) 00000-0000" /></Field>
                <Field label="E-mail comercial"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
                <Field label="Instagram"><Input value={form.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@suaempresa" /></Field>
                <Field label="Cidade"><Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Maceió – AL" /></Field>
                <Field label="Endereço" className="sm:col-span-2"><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
                <Field label="Responsável técnico" hint="Assina as propostas S.A.V.E"><Input value={form.tech_name} onChange={(e) => set("tech_name", e.target.value)} placeholder="Eng. / Eletrotécnico Nome Sobrenome" /></Field>
                <Field label="Registro profissional"><Input value={form.tech_registry} onChange={(e) => set("tech_registry", e.target.value)} placeholder="CFT / CREA nº" /></Field>
                <Field label="URL do logotipo" hint="PNG ou SVG com fundo transparente" className="sm:col-span-2">
                  <Input value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://…/logo.png" />
                </Field>
                <Field label="Sobre a empresa (texto da proposta)" className="sm:col-span-2">
                  <Textarea value={form.about} onChange={(e) => set("about", e.target.value)} className="min-h-[110px]" />
                </Field>
              </div>
            </Card>
          )}

          {tab === "orcamento" && (
            <>
              <Card>
                <CardHeader icon={<Calculator className="h-[18px] w-[18px]" />} title="Custos e preço" subtitle="Já vêm preenchidos em todo novo orçamento" />
                <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
                  <Field label="Mão de obra por placa"><MoneyInput value={d.laborPerModule} onChange={(v) => setDef("laborPerModule", v)} /></Field>
                  <Field label="Material elétrico por kWp"><MoneyInput value={d.electricalPerKwp} onChange={(v) => setDef("electricalPerKwp", v)} /></Field>
                  <Field label="Arredondar preço">
                    <Select value={String(d.roundTo)} onChange={(e) => setDef("roundTo", Number(e.target.value))}>
                      <option value="0">Não arredondar</option>
                      <option value="10">R$ 10</option>
                      <option value="50">R$ 50</option>
                      <option value="100">R$ 100</option>
                    </Select>
                  </Field>
                  <DefComp label="Comissão" value={d.commission} onChange={(v) => setDef("commission", v)} />
                  <DefComp label="Impostos" value={d.tax} onChange={(v) => setDef("tax", v)} />
                  <DefComp label="Lucro" value={d.profit} onChange={(v) => setDef("profit", v)} />
                </div>
              </Card>
              <Card>
                <CardHeader title="Conta de luz e energia" subtitle="Valores da sua distribuidora e região" />
                <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
                  <Field label="Tarifa cheia"><NumberInput value={d.tariff} onChange={(v) => setDef("tariff", v)} prefix="R$" suffix="/kWh" digits={3} /></Field>
                  <Field label="Fio B" hint="TUSD Fio B com impostos"><NumberInput value={d.fioBTariff} onChange={(v) => setDef("fioBTariff", v)} prefix="R$" suffix="/kWh" digits={3} /></Field>
                  <Field label="Iluminação pública"><MoneyInput value={d.publicLighting} onChange={(v) => setDef("publicLighting", v)} /></Field>
                  <Field label="Simultaneidade" hint="% consumida na hora"><NumberInput value={d.selfConsumption} onChange={(v) => setDef("selfConsumption", v)} suffix="%" digits={0} /></Field>
                  <Field label="Irradiação (HSP)"><NumberInput value={d.sunHours} onChange={(v) => setDef("sunHours", v)} suffix="kWh/m²" /></Field>
                  <Field label="Performance ratio"><NumberInput value={d.performanceRatio} onChange={(v) => setDef("performanceRatio", v)} /></Field>
                  <Field label="Reajuste anual da tarifa"><NumberInput value={d.tariffIncrease} onChange={(v) => setDef("tariffIncrease", v)} suffix="% a.a." digits={1} /></Field>
                  <Field label="Degradação das placas"><NumberInput value={d.degradation} onChange={(v) => setDef("degradation", v)} suffix="% a.a." digits={1} /></Field>
                </div>
              </Card>
              <Card>
                <CardHeader title="Condições comerciais" />
                <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
                  <Field label="Taxa do financiamento"><NumberInput value={d.financingRate} onChange={(v) => setDef("financingRate", v)} suffix="% a.m." /></Field>
                  <Field label="Cartão (parcelas)"><NumberInput value={d.cardInstallments} onChange={(v) => setDef("cardInstallments", v)} suffix="x" digits={0} /></Field>
                  <Field label="Juros do cartão"><NumberInput value={d.cardRate} onChange={(v) => setDef("cardRate", v)} suffix="% a.m." /></Field>
                  <Field label="Validade da proposta"><NumberInput value={d.validityDays} onChange={(v) => setDef("validityDays", v)} suffix="dias" digits={0} /></Field>
                  <Field label="Pagamento → homologação"><NumberInput value={d.installationDays} onChange={(v) => setDef("installationDays", v)} suffix="dias" digits={0} /></Field>
                  <Field label="Condições de pagamento padrão" className="sm:col-span-3">
                    <Textarea value={d.paymentNotes} onChange={(e) => setDef("paymentNotes", e.target.value)} placeholder="Ex.: 50% na assinatura e 50% na instalação." />
                  </Field>
                </div>
              </Card>
            </>
          )}

          {tab === "kits" && <KitsTab kits={form.kits} onChange={(k) => set("kits", k)} />}

          {tab === "save" && <SaveTab form={form} onChange={(v) => set("saveDefaults", v)} setProp={setProp} />}

          {tab === "proposta" && (
            <>
              <Card>
                <CardHeader icon={<ImageIcon className="h-[18px] w-[18px]" />} title="Fotos da proposta" subtitle="Fotos reais deixam a proposta muito mais profissional" />
                <div className="grid gap-5 px-5 pb-5">
                  <Field label="Foto da capa" hint="Ideal: foto horizontal de uma obra sua, em alta resolução">
                    <ImageField value={form.proposal.coverImage} onChange={(v) => setProp("coverImage", v)} folder="capa" aspect="aspect-[21/9]" label="Enviar foto da capa" />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Foto padrão das placas" hint="Usada quando o orçamento/kit não tem foto própria">
                      <ImageField value={form.proposal.moduleImage} onChange={(v) => setProp("moduleImage", v)} folder="equipamentos" aspect="aspect-[16/10]" />
                    </Field>
                    <Field label="Foto padrão do inversor">
                      <ImageField value={form.proposal.inverterImage} onChange={(v) => setProp("inverterImage", v)} folder="equipamentos" aspect="aspect-[16/10]" />
                    </Field>
                  </div>
                  <Field label="Obras realizadas (até 6 fotos)" hint="Aparecem na seção “Portfólio” da proposta">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {[...form.proposal.gallery, ""].slice(0, 6).map((src, i) => (
                        <ImageField
                          key={`${i}-${src}`}
                          value={src}
                          folder="obras"
                          label="Adicionar obra"
                          onChange={(v) => {
                            const g = [...form.proposal.gallery];
                            if (v) g[i] = v;
                            else g.splice(i, 1);
                            setProp("gallery", g.filter(Boolean));
                          }}
                        />
                      ))}
                    </div>
                  </Field>
                </div>
              </Card>
              <Card>
                <CardHeader title="Capa" subtitle="Título grande no topo da proposta" />
                <div className="px-5 pb-5">
                  <Field label="Título da capa" hint="Use {nome} para o primeiro nome do cliente. Em branco: “Energia solar para Nome do Cliente”.">
                    <Input value={form.proposal.headline} onChange={(e) => setProp("headline", e.target.value)} placeholder="Ex.: {nome}, chegou a hora de parar de pagar caro na luz" />
                  </Field>
                </div>
              </Card>
              <Card>
                <CardHeader title="Seções da proposta" subtitle="Ligue e desligue o que o cliente vê" />
                <div className="grid gap-2 px-5 pb-5 sm:grid-cols-2">
                  {(Object.keys(SECTION_LABELS) as (keyof ProposalSections)[]).map((k) => (
                    <label key={k} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3 ring-1 ring-ink-200/60">
                      <div>
                        <p className="text-sm font-semibold">{SECTION_LABELS[k].label}</p>
                        <p className="text-xs text-ink-500">{SECTION_LABELS[k].hint}</p>
                      </div>
                      <Switch checked={form.proposal.sections[k]} onChange={(v) => setProp("sections", { ...form.proposal.sections, [k]: v })} />
                    </label>
                  ))}
                </div>
              </Card>
              <Card>
                <CardHeader title="Garantias" subtitle="Anos exibidos na proposta" />
                <div className="grid grid-cols-2 gap-4 px-5 pb-5 sm:grid-cols-5">
                  <Field label="Eficiência placas"><NumberInput value={form.warranty_modules_performance_years} onChange={(v) => set("warranty_modules_performance_years", v)} suffix="anos" digits={0} /></Field>
                  <Field label="Placas"><NumberInput value={form.warranty_modules_years} onChange={(v) => set("warranty_modules_years", v)} suffix="anos" digits={0} /></Field>
                  <Field label="Inversor"><NumberInput value={form.warranty_inverter_years} onChange={(v) => set("warranty_inverter_years", v)} suffix="anos" digits={0} /></Field>
                  <Field label="Estrutura"><NumberInput value={form.warranty_structure_years} onChange={(v) => set("warranty_structure_years", v)} suffix="anos" digits={0} /></Field>
                  <Field label="Instalação"><NumberInput value={form.warranty_installation_years} onChange={(v) => set("warranty_installation_years", v)} suffix="anos" digits={0} /></Field>
                </div>
              </Card>
              <Card>
                <CardHeader
                  title="Passo a passo da obra"
                  subtitle="Etapas e dias que aparecem no cronograma"
                  action={
                    <Button size="sm" variant="ghost" onClick={() => setProp("timeline", [])}>
                      <RotateCcw className="h-3.5 w-3.5" /> Padrão
                    </Button>
                  }
                />
                <ListEditor
                  items={timeline}
                  onChange={(v) => setProp("timeline", v)}
                  blank={{ day: timeline[timeline.length - 1]?.day ?? 0, title: "", text: "" }}
                  addLabel="Adicionar etapa"
                  render={(item, upd) => (
                    <div className="grid flex-1 gap-2 sm:grid-cols-[90px_1fr]">
                      <NumberInput value={item.day} onChange={(v) => upd({ ...item, day: v })} prefix="Dia" digits={0} className="[&_input]:pl-12" />
                      <Input value={item.title} onChange={(e) => upd({ ...item, title: e.target.value })} placeholder="Título da etapa" />
                      <Textarea value={item.text} onChange={(e) => upd({ ...item, text: e.target.value })} placeholder="Explicação simples" className="min-h-[60px] sm:col-span-2" />
                    </div>
                  )}
                />
              </Card>
              <Card>
                <CardHeader
                  title="Perguntas frequentes"
                  action={
                    <Button size="sm" variant="ghost" onClick={() => setProp("faq", [])}>
                      <RotateCcw className="h-3.5 w-3.5" /> Padrão
                    </Button>
                  }
                />
                <ListEditor
                  items={faq}
                  onChange={(v) => setProp("faq", v)}
                  blank={{ q: "", a: "" }}
                  addLabel="Adicionar pergunta"
                  render={(item, upd) => (
                    <div className="grid flex-1 gap-2">
                      <Input value={item.q} onChange={(e) => upd({ ...item, q: e.target.value })} placeholder="Pergunta" />
                      <Textarea value={item.a} onChange={(e) => upd({ ...item, a: e.target.value })} placeholder="Resposta" className="min-h-[60px]" />
                    </div>
                  )}
                />
              </Card>
            </>
          )}

          {tab === "app" && <AppTab form={form} setApp={setApp} />}

          {tab === "alertas" && (
            <Card>
              <CardHeader icon={<Bell className="h-[18px] w-[18px]" />} title="Alertas por e-mail" subtitle="Novo lead, nova tarefa, proposta aberta e proposta aceita" />
              <div className="grid gap-4 px-5 pb-5">
                <Field label="Enviar alertas para" hint="Separe vários e-mails por vírgula. O responsável por cada tarefa também é avisado.">
                  <Input value={form.notify_emails} onChange={(e) => set("notify_emails", e.target.value)} placeholder="voce@empresa.com, vendas@empresa.com" />
                </Field>
              </div>
            </Card>
          )}

          {tab === "captura" && (
            <Card>
              <CardHeader icon={<Code2 className="h-[18px] w-[18px]" />} title="Formulário de captura" subtitle="Leads que preencherem entram no funil e disparam alerta" />
              <div className="grid gap-3 px-5 pb-5">
                <div className="flex gap-2">
                  <Input readOnly value={captureUrl} className="font-mono text-xs" />
                  <Button variant="secondary" size="icon" onClick={() => { navigator.clipboard.writeText(captureUrl); toast.success("Link copiado"); }} aria-label="Copiar"><Copy className="h-4 w-4" /></Button>
                  <a href="/captura" target="_blank"><Button variant="secondary" size="icon" aria-label="Abrir"><ExternalLink className="h-4 w-4" /></Button></a>
                </div>
                <p className="text-xs text-ink-500">Dica: use <code className="rounded bg-ink-100 px-1">{captureUrl}?origem=Instagram</code> para registrar de onde veio o lead.</p>
                <Field label="Código para incorporar no site">
                  <Textarea readOnly value={embed} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
                </Field>
              </div>
            </Card>
          )}

          {tab === "equipe" && <TeamTab />}

          {tab === "perfil" && (
            <Card>
              <CardHeader icon={<UserRound className="h-[18px] w-[18px]" />} title="Meu perfil" subtitle="Seu nome aparece como consultor nas propostas" />
              <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
                <Field label="Nome"><Input value={me.full_name} onChange={(e) => { setMe({ ...me, full_name: e.target.value }); setDirty(true); }} /></Field>
                <Field label="Telefone"><Input value={me.phone} onChange={(e) => { setMe({ ...me, phone: e.target.value }); setDirty(true); }} /></Field>
              </div>
            </Card>
          )}
        </div>
      </div>

      {dirty && (
        <div className="animate-fade-up fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-4 lg:bottom-6 lg:left-[264px]">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl bg-ink-950 px-4 py-3 text-white shadow-lift">
            <span className="text-sm">Você tem alterações não salvas</span>
            <Button onClick={save} loading={saving} className="bg-gradient-to-r from-[#F3EA3B] to-[#9BD373] text-black">
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Kits */

const blankKit = (): KitPreset => ({
  id: crypto.randomUUID(),
  name: "",
  kitPrice: 0,
  moduleBrand: "",
  moduleModel: "",
  modulePowerW: 610,
  moduleQty: 10,
  inverterBrand: "",
  inverterModel: "",
  inverterPowerKw: 5,
  inverterQty: 1,
  structureType: "Telhado cerâmico",
});

function KitsTab({ kits, onChange }: { kits: KitPreset[]; onChange: (k: KitPreset[]) => void }) {
  const upd = (id: string, patch: Partial<KitPreset>) => onChange(kits.map((k) => (k.id === id ? { ...k, ...patch } : k)));
  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl bg-sky-50 p-4 text-sm text-sky-900 ring-1 ring-sky-600/15 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Salve os kits que você mais vende. No orçamento, é só escolher o kit e <b>todos os equipamentos e o preço são preenchidos</b> na hora. Os preços dos kits nunca aparecem para o cliente.
        </p>
        <Button onClick={() => onChange([blankKit(), ...kits])} className="shrink-0">
          <Plus className="h-4 w-4" /> Novo kit
        </Button>
      </div>
      {!kits.length && <p className="py-10 text-center text-sm text-ink-400">Nenhum kit salvo ainda. Você também pode salvar direto do orçamento, em “Salvar como kit”.</p>}
      {kits.map((k) => (
        <Card key={k.id}>
          <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-3">
            <Package className="h-4 w-4 text-sun-600" />
            <Input value={k.name} onChange={(e) => upd(k.id, { name: e.target.value })} placeholder="Nome do kit (ex.: 5,5 kWp Growatt)" className="h-9 flex-1 font-semibold ring-0 focus:ring-2" />
            <span className="tnum hidden text-sm text-ink-500 sm:block">{fmtNum((k.modulePowerW * k.moduleQty) / 1000, 2)} kWp</span>
            <Button variant="ghost" size="icon" onClick={() => onChange(kits.filter((x) => x.id !== k.id))} aria-label="Excluir kit">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-4">
            <Field label="Preço do kit" className="sm:col-span-2"><MoneyInput value={k.kitPrice} onChange={(v) => upd(k.id, { kitPrice: v })} /></Field>
            <Field label="Estrutura" className="sm:col-span-2">
              <Select value={k.structureType} onChange={(e) => upd(k.id, { structureType: e.target.value })}>
                {ROOF_TYPES.map((r) => <option key={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="Marca das placas"><Input value={k.moduleBrand} onChange={(e) => upd(k.id, { moduleBrand: e.target.value })} /></Field>
            <Field label="Modelo"><Input value={k.moduleModel} onChange={(e) => upd(k.id, { moduleModel: e.target.value })} /></Field>
            <Field label="Potência"><NumberInput value={k.modulePowerW} onChange={(v) => upd(k.id, { modulePowerW: v })} suffix="W" digits={0} /></Field>
            <Field label="Quantidade"><NumberInput value={k.moduleQty} onChange={(v) => upd(k.id, { moduleQty: v })} suffix="un" digits={0} /></Field>
            <Field label="Marca do inversor"><Input value={k.inverterBrand} onChange={(e) => upd(k.id, { inverterBrand: e.target.value })} /></Field>
            <Field label="Modelo"><Input value={k.inverterModel} onChange={(e) => upd(k.id, { inverterModel: e.target.value })} /></Field>
            <Field label="Potência"><NumberInput value={k.inverterPowerKw} onChange={(v) => upd(k.id, { inverterPowerKw: v })} suffix="kW" digits={1} /></Field>
            <Field label="Quantidade"><NumberInput value={k.inverterQty} onChange={(v) => upd(k.id, { inverterQty: v })} suffix="un" digits={0} /></Field>
            <Field label="Foto das placas" className="sm:col-span-2">
              <ImageField value={k.moduleImage ?? ""} onChange={(v) => upd(k.id, { moduleImage: v })} folder="equipamentos" aspect="aspect-[16/9]" />
            </Field>
            <Field label="Foto do inversor" className="sm:col-span-2">
              <ImageField value={k.inverterImage ?? ""} onChange={(v) => upd(k.id, { inverterImage: v })} folder="equipamentos" aspect="aspect-[16/9]" />
            </Field>
          </div>
        </Card>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------- App */

function AppTab({ form, setApp }: { form: CompanySettings; setApp: <K extends keyof CompanySettings["app"]>(k: K, v: CompanySettings["app"][K]) => void }) {
  const app = form.app;
  const [shift, setShift] = useState(0);
  const quote = pickDaily(quotePool(app.customQuotes, app.useDefaultQuotes), shift)!;
  const image = pickDaily(imagePool(app.images), shift);

  const previewSplash = () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("splash-"))
        .forEach((k) => localStorage.removeItem(k));
      sessionStorage.removeItem("splash-shown");
    } catch {}
    toast.success("Salve e recarregue a página para ver a abertura");
  };

  return (
    <>
      <div className="relative h-64 overflow-hidden rounded-[28px] text-white shadow-lift">
        <CinematicBackdrop src={image} />
        <div className="relative flex h-full flex-col justify-end p-6">
          <p className="text-[11px] tracking-[0.35em] text-[#F3EA3B] uppercase">Prévia da abertura</p>
          <p className="mt-2 max-w-xl font-serif text-2xl leading-snug italic">“{quote.text}”</p>
          <p className="mt-2 text-[11px] tracking-[0.2em] text-white/60 uppercase">— {quote.author}</p>
          <button onClick={() => setShift((s) => s + 1)} className="absolute top-4 right-4 rounded-full bg-white/10 px-3 py-1.5 text-xs backdrop-blur hover:bg-white/20">
            Próxima →
          </button>
        </div>
      </div>

      <Card>
        <CardHeader icon={<Sparkles className="h-[18px] w-[18px]" />} title="Tela de abertura" subtitle="Frase, imagem e o placar do mês ao abrir o app" />
        <div className="grid gap-4 px-5 pb-5">
          <Segmented<SplashMode>
            className="w-full [&>button]:flex-1"
            value={app.splash}
            onChange={(v) => setApp("splash", v)}
            options={[
              { value: "always", label: "Sempre ao abrir" },
              { value: "daily", label: "1× por dia" },
              { value: "off", label: "Desligada" },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Toggle label="Dicas de venda no painel" checked={app.showTips} onChange={(v) => setApp("showTips", v)} />
            <Toggle label="Comemorar vendas fechadas" checked={app.celebrate} onChange={(v) => setApp("celebrate", v)} />
            <Toggle label="Usar frases do app" checked={app.useDefaultQuotes} onChange={(v) => setApp("useDefaultQuotes", v)} />
          </div>
          <Button variant="secondary" onClick={previewSplash} className="justify-self-start">
            Ver a abertura de novo
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Meta do mês" subtitle="Aparece na abertura e no painel" />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <Field label="Faturamento" hint={app.monthlyGoal ? `${brl(app.monthlyGoal / 22, 0)} por dia útil` : undefined}>
            <MoneyInput value={app.monthlyGoal} onChange={(v) => setApp("monthlyGoal", v)} digits={0} />
          </Field>
          <Field label="Contratos"><NumberInput value={app.monthlyGoalDeals} onChange={(v) => setApp("monthlyGoalDeals", v)} suffix="contratos" digits={0} /></Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Suas frases" subtitle="Misture com as frases do app ou use só as suas" />
        <ListEditor
          items={app.customQuotes}
          onChange={(v) => setApp("customQuotes", v)}
          blank={{ text: "", author: "" }}
          addLabel="Adicionar frase"
          render={(item, upd) => (
            <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_200px]">
              <Input value={item.text} onChange={(e) => upd({ ...item, text: e.target.value })} placeholder="A frase que te move" />
              <Input value={item.author} onChange={(e) => upd({ ...item, author: e.target.value })} placeholder="Autor" />
            </div>
          )}
        />
      </Card>

      <Card>
        <CardHeader icon={<ImageIcon className="h-[18px] w-[18px]" />} title="Suas imagens" subtitle="Cole links de imagens (JPG/PNG). Se não houver nenhuma, o app usa a galeria padrão." />
        <ListEditor
          items={app.images}
          onChange={(v) => setApp("images", v)}
          blank=""
          addLabel="Adicionar imagem"
          render={(item, upd) => (
            <div className="flex flex-1 items-center gap-3">
              <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                {/^https?:\/\//.test(item) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item} alt="" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                )}
              </div>
              <Input value={item} onChange={(e) => upd(e.target.value)} placeholder="https://…/imagem.jpg" />
            </div>
          )}
        />
      </Card>
    </>
  );
}

function SaveTab({
  form,
  onChange,
  setProp,
}: {
  form: CompanySettings;
  onChange: (v: Partial<SaveInputs>) => void;
  setProp: <K extends keyof CompanySettings["proposal"]>(k: K, v: CompanySettings["proposal"][K]) => void;
}) {
  const v = mergeSave(form.saveDefaults);
  const set = <K extends keyof SaveInputs>(k: K, val: SaveInputs[K]) => onChange({ ...form.saveDefaults, [k]: val });
  return (
    <>
      <Card>
        <CardHeader icon={<PlugZap className="h-[18px] w-[18px]" />} title="Custos padrão do S.A.V.E" subtitle="Valores unitários que já vêm em todo orçamento de carregador veicular" />
        <div className="grid gap-3 px-5 pb-5">
          {v.extraCosts.map((it) => (
            <div key={it.id} className="grid items-end gap-3 rounded-xl bg-ink-50 p-3 ring-1 ring-ink-200/60 sm:grid-cols-[1fr_180px]">
              <Field label="Item">
                <Input
                  value={it.label}
                  onChange={(e) => set("extraCosts", v.extraCosts.map((x) => (x.id === it.id ? { ...x, label: e.target.value } : x)))}
                />
              </Field>
              <Field label={it.key === "infra" ? "Valor por metro" : "Valor unitário"}>
                <MoneyInput value={it.unit} onChange={(unit) => set("extraCosts", v.extraCosts.map((x) => (x.id === it.id ? { ...x, unit, value: unit * x.qty } : x)))} />
              </Field>
            </div>
          ))}
        </div>
        <div className="grid gap-4 border-t border-ink-100 px-5 py-5 sm:grid-cols-3">
          <DefComp label="Comissão" value={v.commission} onChange={(c) => set("commission", c)} />
          <DefComp label="Impostos" value={v.tax} onChange={(c) => set("tax", c)} />
          <DefComp label="Lucro" value={v.profit} onChange={(c) => set("profit", c)} />
          <Field label="Arredondar preço">
            <Select value={String(v.roundTo)} onChange={(e) => set("roundTo", Number(e.target.value))}>
              <option value="0">Não arredondar</option>
              <option value="10">R$ 10</option>
              <option value="50">R$ 50</option>
              <option value="100">R$ 100</option>
            </Select>
          </Field>
          <Field label="Distância padrão"><NumberInput value={v.distanceM} onChange={(x) => set("distanceM", x)} suffix="m" digits={0} /></Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Carregador" subtitle="Especificação que aparece na proposta" />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
          <Field label="Potência"><NumberInput value={v.chargerPowerKw} onChange={(x) => set("chargerPowerKw", x)} suffix="kW" digits={1} /></Field>
          <Field label="Corrente"><NumberInput value={v.currentA} onChange={(x) => set("currentA", x)} suffix="A" digits={0} /></Field>
          <Field label="Conector"><Input value={v.connector} onChange={(e) => set("connector", e.target.value)} /></Field>
          <Field label="Marcas homologadas" className="sm:col-span-3"><Input value={v.chargerBrands} onChange={(e) => set("chargerBrands", e.target.value)} /></Field>
        </div>
      </Card>

      <Card>
        <CardHeader icon={<ImageIcon className="h-[18px] w-[18px]" />} title="Fotos da proposta S.A.V.E" />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <Field label="Foto da capa" hint="Ex.: um carregador instalado por você">
            <ImageField value={form.proposal.saveCoverImage} onChange={(x) => setProp("saveCoverImage", x)} folder="capa" aspect="aspect-[16/10]" label="Enviar foto da capa" />
          </Field>
          <Field label="Foto padrão do carregador">
            <ImageField value={form.proposal.chargerImage} onChange={(x) => setProp("chargerImage", x)} folder="equipamentos" aspect="aspect-[16/10]" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Condições e garantias" />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
          <Field label="Execução" hint="após a entrega do equipamento"><NumberInput value={v.executionDays} onChange={(x) => set("executionDays", x)} suffix="dias" digits={0} /></Field>
          <Field label="Validade da proposta"><NumberInput value={v.validityDays} onChange={(x) => set("validityDays", x)} suffix="dias" digits={0} /></Field>
          <Field label="Cartão (parcelas)"><NumberInput value={v.cardInstallments} onChange={(x) => set("cardInstallments", x)} suffix="x" digits={0} /></Field>
          <Field label="Garantia da instalação"><NumberInput value={v.installWarrantyMonths} onChange={(x) => set("installWarrantyMonths", x)} suffix="meses" digits={0} /></Field>
          <Field label="Garantia de fábrica"><NumberInput value={v.factoryWarrantyYears} onChange={(x) => set("factoryWarrantyYears", x)} suffix="anos" digits={0} /></Field>
          <Field label="Juros do cartão"><NumberInput value={v.cardRate} onChange={(x) => set("cardRate", x)} suffix="% a.m." /></Field>
          <Field label="Pagamento" className="sm:col-span-3">
            <Textarea value={v.paymentNotes} onChange={(e) => set("paymentNotes", e.target.value)} />
          </Field>
          <Field label="Condições gerais" hint="Uma por linha · use {distancia} e {potencia}" className="sm:col-span-3">
            <Textarea value={v.conditions.join("\n")} onChange={(e) => set("conditions", e.target.value.split("\n"))} className="min-h-[160px]" />
          </Field>
        </div>
      </Card>

    </>
  );
}

/* --------------------------------------------------------------- Helpers */

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3 ring-1 ring-ink-200/60">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={checked} onChange={onChange} />
    </label>
  );
}

function ListEditor<T>({ items, onChange, blank, render, addLabel }: { items: T[]; onChange: (v: T[]) => void; blank: T; render: (item: T, update: (v: T) => void) => ReactNode; addLabel: string }) {
  return (
    <div className="grid gap-2 px-5 pb-5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 rounded-xl bg-ink-50 p-3 ring-1 ring-ink-200/60">
          <GripVertical className="mt-3 h-4 w-4 shrink-0 text-ink-300" />
          {render(item, (v) => onChange(items.map((x, j) => (j === i ? v : x))))}
          <Button variant="ghost" size="icon" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remover">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="justify-self-start" onClick={() => onChange([...items, structuredClone(blank)])}>
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </Button>
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
