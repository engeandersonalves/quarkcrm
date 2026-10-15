"use client";

import { BadgeCheck, Building2, Calculator, Clock, CreditCard, Factory, Plus, Scale, ShieldCheck, Sun, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { digits, formatCep, formatDoc, moneyInWords } from "@/lib/br";
import { ROOF_TYPES, UFS } from "@/lib/constants";
import { toStoredSettings } from "@/lib/defaults";
import {
  EQUIP_KINDS,
  contractKwp,
  equipmentPhrase,
  newEquipment,
  paymentText,
  type ContractDefaults,
  type ContratoData,
  type Equipment,
  type EquipKind,
  type PaymentMethod,
} from "@/lib/documents";
import { must, useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";
import type { Proposal } from "@/lib/types";
import { useApp } from "../app/app-context";
import { Button, Field, Input, MoneyInput, NumberInput, Select, Switch, Textarea, cx } from "../ui";
import { LeadPicker, PlaceDate, Section, type LeadLite } from "./form-bits";
import { PartyFields } from "./party-fields";

type ProposalLite = Pick<Proposal, "id" | "number" | "title" | "status" | "inputs" | "final_price" | "power_kwp" | "created_at">;

const STRUCTURES = ["Telhado colonial", ...ROOF_TYPES];

/** Equipamentos, estrutura e valor a partir de uma proposta solar do lead. */
export function contractFromProposal(p: ProposalLite): Partial<ContratoData> | null {
  const i = p.inputs ?? {};
  if (!Number(i.moduleQty)) return null;
  const equipment: Equipment[] = [
    newEquipment({ kind: "modulo", qty: Number(i.moduleQty) || 0, power: Number(i.modulePowerW) || 0, brand: String(i.moduleBrand ?? ""), model: String(i.moduleModel ?? "") }),
  ];
  if (Number(i.inverterQty))
    equipment.push(newEquipment({ kind: "inversor", qty: Number(i.inverterQty) || 1, power: Number(i.inverterPowerKw) || 0, brand: String(i.inverterBrand ?? ""), model: String(i.inverterModel ?? "") }));
  return { equipment, structure: String(i.structureType || "Telhado colonial"), price: Number(p.final_price) || 0 };
}

export function ContratoForm({
  data,
  update,
  leads,
  leadId,
  onLead,
}: {
  data: ContratoData;
  update: (p: Partial<ContratoData>) => void;
  leads: LeadLite[];
  leadId: string | null;
  onLead: (id: string) => void;
}) {
  const { settings, profile } = useApp();
  const isAdmin = profile?.role === "admin";
  const [savingDefaults, setSavingDefaults] = useState(false);
  const kwp = contractKwp(data);

  const { data: proposals } = useLive(
    async () =>
      leadId
        ? (must(
            await supabase().from("proposals").select("id,number,title,status,inputs,final_price,power_kwp,created_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(20),
          ) as ProposalLite[])
        : [],
    [leadId],
    [],
  );
  const solar = (proposals ?? []).filter((p) => Number(p.inputs?.moduleQty) > 0);

  const setEq = (id: string, patch: Partial<Equipment>) => update({ equipment: data.equipment.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const setPay = (patch: Partial<ContratoData["payment"]>) => update({ payment: { ...data.payment, ...patch } });
  const setC = (patch: Partial<ContratoData["contractor"]>) => update({ contractor: { ...data.contractor, ...patch } });
  const setW = (patch: Partial<ContratoData["warranty"]>) => update({ warranty: { ...data.warranty, ...patch } });
  const setD = (patch: Partial<ContratoData["deadlines"]>) => update({ deadlines: { ...data.deadlines, ...patch } });

  const fromProposal = (id: string) => {
    const p = solar.find((x) => x.id === id);
    const patch = p && contractFromProposal(p);
    if (!patch) return;
    update({ ...patch, payment: { ...data.payment, installments: Number(p.inputs?.cardInstallments) || data.payment.installments } });
    toast.success(`Equipamentos e valor da proposta nº ${p.number} aplicados`);
  };

  const saveDefaults = async () => {
    setSavingDefaults(true);
    const contract_defaults: ContractDefaults = {
      contractor: data.contractor,
      supplier: data.supplier,
      deadlines: data.deadlines,
      warranty: data.warranty,
      lateFee: data.lateFee,
      interest: data.interest,
      breachFee: data.breachFee,
      attorneyFee: data.attorneyFee,
      forum: data.forum,
      forumState: data.forumState,
      copies: data.copies,
      utility: data.utility,
    };
    const { error } = await supabase().from("settings").upsert({ id: 1, data: toStoredSettings({ ...settings, contract_defaults }) });
    setSavingDefaults(false);
    if (error) toast.error(error.message);
    else toast.success("Padrão salvo: os próximos contratos já começam com esses dados");
  };

  return (
    <>
      {/* ------------------------------------------------------- cliente */}
      <Section icon={<Users className="h-4 w-4" />} title="Contratante (cliente)" subtitle="Quem contrata o sistema">
        <div className="mb-4">
          <LeadPicker leads={leads} value={leadId} onChange={onLead} label="Buscar no CRM" />
        </div>
        <PartyFields value={data.client} onChange={(client) => update({ client })} />
        <Field label="Endereço da instalação" hint="Deixe em branco se for o mesmo endereço do cliente" className="mt-3">
          <Input value={data.installAddress} onChange={(e) => update({ installAddress: e.target.value })} placeholder="Rua, número, bairro, cidade/UF" />
        </Field>
      </Section>

      {/* -------------------------------------------------- equipamentos */}
      <Section icon={<Sun className="h-4 w-4" />} title="Equipamentos" subtitle="Entram na Cláusula 1ª, na lista de serviços e no Anexo I">
        {solar.length > 0 && (
          <Field label="Puxar de uma proposta" hint="Preenche módulos, inversor, estrutura e valor" className="mb-4">
            <Select value="" onChange={(e) => fromProposal(e.target.value)}>
              <option value="">Escolher proposta do cliente…</option>
              {solar.map((p) => (
                <option key={p.id} value={p.id}>
                  Nº {p.number} · {Number(p.power_kwp).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWp · {Number(p.final_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  {p.status === "aceita" ? " · aceita" : ""}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid gap-3">
          {data.equipment.map((e) => {
            const k = EQUIP_KINDS[e.kind];
            return (
              <div key={e.id} className="rounded-2xl bg-ink-50/70 p-3 ring-1 ring-ink-200/70">
                <div className="grid grid-cols-[minmax(0,1fr)_76px_minmax(0,1fr)_auto] items-end gap-2">
                  <Field label="Item">
                    <Select value={e.kind} onChange={(ev) => setEq(e.id, { kind: ev.target.value as EquipKind })}>
                      {(Object.keys(EQUIP_KINDS) as EquipKind[]).map((key) => (
                        <option key={key} value={key}>
                          {EQUIP_KINDS[key].label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Qtd.">
                    <NumberInput value={e.qty} onChange={(qty) => setEq(e.id, { qty: Math.max(0, Math.round(qty)) })} digits={0} />
                  </Field>
                  {e.kind === "outro" ? (
                    <Field label="Descrição">
                      <Input value={e.description} onChange={(ev) => setEq(e.id, { description: ev.target.value })} placeholder="Ex.: string box" />
                    </Field>
                  ) : (
                    <Field label="Potência">
                      <NumberInput value={e.power} onChange={(power) => setEq(e.id, { power })} suffix={k.unit} digits={e.kind === "modulo" ? 0 : 2} />
                    </Field>
                  )}
                  <button
                    type="button"
                    onClick={() => update({ equipment: data.equipment.filter((x) => x.id !== e.id) })}
                    className="mb-1 grid h-9 w-9 place-items-center rounded-xl text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input value={e.brand} onChange={(ev) => setEq(e.id, { brand: ev.target.value })} placeholder="Marca (opcional)" />
                  <Input value={e.model} onChange={(ev) => setEq(e.id, { model: ev.target.value })} placeholder="Modelo (opcional)" />
                </div>
                {e.qty > 0 && <p className="mt-2 text-xs text-ink-500">No contrato: “{equipmentPhrase(e)}”</p>}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => update({ equipment: [...data.equipment, newEquipment({ kind: data.equipment.some((x) => x.kind === "modulo") ? "outro" : "modulo" })] })}>
            <Plus className="h-4 w-4" /> Adicionar item
          </Button>
          <span className={cx("rounded-full px-3 py-1 text-xs font-bold ring-1", kwp > 0 ? "bg-sun-50 text-sun-800 ring-sun-300" : "bg-ink-50 text-ink-500 ring-ink-200")}>
            Potência instalada: {kwp > 0 ? `${kwp.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWp` : "—"}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Estrutura de fixação para">
            <Input list="contract-structures" value={data.structure} onChange={(e) => update({ structure: e.target.value })} />
            <datalist id="contract-structures">
              {STRUCTURES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Concessionária">
            <Input value={data.utility} onChange={(e) => update({ utility: e.target.value })} />
          </Field>
        </div>
      </Section>

      {/* -------------------------------------------------------- valor */}
      <Section icon={<CreditCard className="h-4 w-4" />} title="Valor e pagamento" subtitle="Cláusula 3ª">
        <Field label="Valor total" hint={data.price > 0 ? <span className="italic">{moneyInWords(data.price)}</span> : undefined}>
          <MoneyInput value={data.price} onChange={(price) => update({ price })} />
        </Field>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(
            [
              ["cartao", "Cartão"],
              ["pix", "À vista"],
              ["entrada", "Entrada + saldo"],
              ["financiamento", "Financiamento"],
              ["personalizado", "Outro"],
            ] as [PaymentMethod, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPay({ method: value })}
              className={cx(
                "h-8 rounded-full px-3 text-[13px] font-semibold ring-1 transition",
                data.payment.method === value ? "bg-ink-900 text-brand-yellow ring-ink-900" : "bg-white text-ink-600 ring-ink-200 hover:ring-ink-300",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {data.payment.method === "cartao" && (
            <>
              <Field label="Parcelas">
                <Select value={String(data.payment.installments)} onChange={(e) => setPay({ installments: Number(e.target.value) })}>
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}×
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="col-span-2 grid gap-2">
                <Switch checked={data.payment.withInterest} onChange={(withInterest) => setPay({ withInterest })} label="Com juros da maquininha" />
                <Switch checked={data.payment.multipleCards} onChange={(multipleCards) => setPay({ multipleCards })} label="Pode usar mais de um cartão" />
              </div>
            </>
          )}
          {data.payment.method === "entrada" && (
            <>
              <Field label="Entrada">
                <MoneyInput value={data.payment.entry} onChange={(entry) => setPay({ entry })} />
              </Field>
              <Field label="Saldo pago">
                <Input value={data.payment.balanceWhen} onChange={(e) => setPay({ balanceWhen: e.target.value })} placeholder="na conclusão da instalação" />
              </Field>
            </>
          )}
          {data.payment.method === "financiamento" && (
            <Field label="Banco / financeira" className="col-span-2">
              <Input value={data.payment.bank} onChange={(e) => setPay({ bank: e.target.value })} placeholder="Ex.: BV Financeira, Santander, Sicredi" />
            </Field>
          )}
          {data.payment.method === "personalizado" && (
            <Field label="Como será pago" className="col-span-2">
              <Textarea value={data.payment.custom} onChange={(e) => setPay({ custom: e.target.value })} placeholder="Descreva a forma de pagamento como deve sair no contrato" />
            </Field>
          )}
        </div>
        <p className="mt-3 rounded-xl bg-ink-50 p-3 text-xs leading-relaxed text-ink-600 ring-1 ring-ink-200/60">
          <b>§1º:</b> {paymentText(data)}
        </p>
      </Section>

      {/* -------------------------------------------------- fornecedora */}
      <Section icon={<Factory className="h-4 w-4" />} title="Empresa fornecedora e garantias" subtitle="Distribuidora dos equipamentos (Cláusula 5ª)">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fornecedora" className="col-span-2">
            <Input value={data.supplier.name} onChange={(e) => update({ supplier: { ...data.supplier, name: e.target.value } })} placeholder="Ex.: FORTLEV SOLAR" />
          </Field>
          <Field label="CNPJ (opcional)" className="col-span-2">
            <Input value={formatDoc(data.supplier.doc)} onChange={(e) => update({ supplier: { ...data.supplier, doc: digits(e.target.value) } })} inputMode="numeric" placeholder="00.000.000/0000-00" />
          </Field>
          <Field label="Módulos (defeitos)">
            <NumberInput value={data.warranty.modules} onChange={(modules) => setW({ modules })} suffix="anos" digits={0} />
          </Field>
          <Field label="Inversor">
            <NumberInput value={data.warranty.inverter} onChange={(inverter) => setW({ inverter })} suffix="anos" digits={0} />
          </Field>
          <Field label="Garantia linear">
            <NumberInput value={data.warranty.linearYears} onChange={(linearYears) => setW({ linearYears })} suffix="anos" digits={0} />
          </Field>
          <Field label="Entrega mínima">
            <NumberInput value={data.warranty.linearPct} onChange={(linearPct) => setW({ linearPct })} suffix="%" digits={0} />
          </Field>
          <Field label="Estrutura">
            <NumberInput value={data.warranty.structure} onChange={(structure) => setW({ structure })} suffix="anos" digits={0} />
          </Field>
          <Field label="Cabos e conectores">
            <NumberInput value={data.warranty.cables} onChange={(cables) => setW({ cables })} suffix="anos" digits={0} />
          </Field>
          <Field label="Caixa de proteção">
            <NumberInput value={data.warranty.box} onChange={(box) => setW({ box })} suffix="anos" digits={0} />
          </Field>
          <Field label="Instalação (Quark)">
            <NumberInput value={data.warranty.service} onChange={(service) => setW({ service })} suffix="anos" digits={0} />
          </Field>
        </div>
      </Section>

      {/* -------------------------------------------------------- prazos */}
      <Section icon={<Clock className="h-4 w-4" />} title="Prazos" subtitle="Cláusula 4ª">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Compra do kit">
            <NumberInput value={data.deadlines.purchase} onChange={(purchase) => setD({ purchase })} suffix="dias úteis" digits={0} />
          </Field>
          <Field label="Entrega do kit">
            <NumberInput value={data.deadlines.delivery} onChange={(delivery) => setD({ delivery })} suffix="dias úteis" digits={0} />
          </Field>
          <Field label="Projeto">
            <NumberInput value={data.deadlines.project} onChange={(project) => setD({ project })} suffix="dias úteis" digits={0} />
          </Field>
          <Field label="Solicitação de acesso">
            <NumberInput value={data.deadlines.request} onChange={(request) => setD({ request })} suffix="dias úteis" digits={0} />
          </Field>
          <Field label="Instalação">
            <NumberInput value={data.deadlines.install} onChange={(install) => setD({ install })} suffix="dias" digits={0} />
          </Field>
          <Field label="Vistoria">
            <NumberInput value={data.deadlines.inspection} onChange={(inspection) => setD({ inspection })} suffix="dias" digits={0} />
          </Field>
          <Field label="Documentação final">
            <NumberInput value={data.deadlines.docs} onChange={(docs) => setD({ docs })} suffix="dias úteis" digits={0} />
          </Field>
        </div>
      </Section>

      {/* ---------------------------------------------------- contratada */}
      <Section icon={<Building2 className="h-4 w-4" />} title="Contratada (sua empresa)" subtitle="Quem fornece e instala, e quem assina por ela">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Razão social / nome" className="col-span-2">
            <Input value={data.contractor.name} onChange={(e) => setC({ name: e.target.value })} placeholder="QUARK ENERGIA" />
          </Field>
          <Field label="CNPJ" className="col-span-2">
            <Input value={formatDoc(data.contractor.doc)} onChange={(e) => setC({ doc: digits(e.target.value) })} inputMode="numeric" placeholder="00.000.000/0000-00" />
          </Field>
          <Field label="Endereço" className="col-span-2">
            <Input value={data.contractor.address} onChange={(e) => setC({ address: e.target.value })} placeholder="Rua, número e bairro" />
          </Field>
          <Field label="Cidade">
            <Input value={data.contractor.city} onChange={(e) => setC({ city: e.target.value })} />
          </Field>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <Field label="UF">
              <Select value={data.contractor.state} onChange={(e) => setC({ state: e.target.value })}>
                {UFS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </Select>
            </Field>
            <Field label="CEP">
              <Input value={formatCep(data.contractor.cep)} onChange={(e) => setC({ cep: digits(e.target.value) })} inputMode="numeric" placeholder="00000-000" />
            </Field>
          </div>
          <Field label="Representante (quem assina)" className="col-span-2">
            <Input value={data.contractor.repName} onChange={(e) => setC({ repName: e.target.value })} placeholder="Nome completo" />
          </Field>
          <Field label="CPF do representante">
            <Input value={formatDoc(data.contractor.repDoc)} onChange={(e) => setC({ repDoc: digits(e.target.value).slice(0, 11) })} inputMode="numeric" placeholder="000.000.000-00" />
          </Field>
          <Field label="Cargo">
            <Input value={data.contractor.repRole} onChange={(e) => setC({ repRole: e.target.value })} placeholder="Diretor Técnico" />
          </Field>
          <Field label="Nacionalidade">
            <Input value={data.contractor.repNationality} onChange={(e) => setC({ repNationality: e.target.value })} />
          </Field>
          <Field label="Estado civil">
            <Input value={data.contractor.repMarital} onChange={(e) => setC({ repMarital: e.target.value })} placeholder="Opcional" />
          </Field>
        </div>
        {data.contractorSignature && (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-ink-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.contractorSignature} alt="Assinatura da contratada" className="h-12 w-auto max-w-[160px] object-contain" />
            <p className="text-xs text-ink-500">
              <BadgeCheck className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />
              Sua assinatura padrão já vai no contrato. Para trocar: Configurações → Empresa.
            </p>
          </div>
        )}
        {isAdmin && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Button type="button" size="sm" variant="secondary" onClick={saveDefaults} loading={savingDefaults}>
              <ShieldCheck className="h-4 w-4" /> Salvar como padrão
            </Button>
            <p className="min-w-0 flex-1 text-xs text-ink-500">Empresa, fornecedora, garantias, prazos e multas já vêm preenchidos nos próximos contratos.</p>
          </div>
        )}
      </Section>

      {/* --------------------------------------------------- multas/foro */}
      <Section icon={<Scale className="h-4 w-4" />} title="Multas e foro" subtitle="Cláusulas de extinção e do foro">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Multa por atraso">
            <NumberInput value={data.lateFee} onChange={(lateFee) => update({ lateFee })} suffix="%" digits={1} />
          </Field>
          <Field label="Juros de mora">
            <NumberInput value={data.interest} onChange={(interest) => update({ interest })} suffix="% a.m." digits={1} />
          </Field>
          <Field label="Multa por descumprimento">
            <NumberInput value={data.breachFee} onChange={(breachFee) => update({ breachFee })} suffix="%" digits={0} />
          </Field>
          <Field label="Honorários">
            <NumberInput value={data.attorneyFee} onChange={(attorneyFee) => update({ attorneyFee })} suffix="%" digits={0} />
          </Field>
          <Field label="Comarca">
            <Input value={data.forum} onChange={(e) => update({ forum: e.target.value })} />
          </Field>
          <Field label="Estado">
            <Input value={data.forumState} onChange={(e) => update({ forumState: e.target.value })} />
          </Field>
          <Field label="Vias">
            <NumberInput value={data.copies} onChange={(copies) => update({ copies: Math.max(1, Math.round(copies)) })} digits={0} />
          </Field>
        </div>
      </Section>

      {/* ------------------------------------------- testemunhas / extras */}
      <Section icon={<Calculator className="h-4 w-4" />} title="Testemunhas e cláusulas extras" subtitle="Testemunhas também assinam pelo link (opcional)">
        <div className="grid grid-cols-2 gap-3">
          {data.witnesses.map((w, i) => (
            <div key={i} className="col-span-2 grid grid-cols-2 gap-3 sm:col-span-1 sm:grid-cols-1">
              <Field label={`Testemunha ${i + 1}`}>
                <Input value={w.name} onChange={(e) => update({ witnesses: data.witnesses.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="Nome" />
              </Field>
              <Field label="CPF">
                <Input value={w.doc} onChange={(e) => update({ witnesses: data.witnesses.map((x, j) => (j === i ? { ...x, doc: e.target.value } : x)) })} inputMode="numeric" />
              </Field>
            </div>
          ))}
          <Field label="Cláusulas extras (uma por linha)" className="col-span-2">
            <Textarea value={data.extraClauses} onChange={(e) => update({ extraClauses: e.target.value })} placeholder="Ex.: O CONTRATANTE autoriza a divulgação de fotos da usina instalada." />
          </Field>
        </div>
      </Section>

      <PlaceDate data={data} update={update} />
    </>
  );
}
