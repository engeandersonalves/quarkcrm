"use client";

import { Bike, Building2, CreditCard, Hash, PackagePlus, Plus, ShieldCheck, Trash2, Truck, User, Users } from "lucide-react";
import { digits, formatDoc } from "@/lib/br";
import {
  MOTO_ACCESSORIES,
  MOTO_COLORS,
  accessoriesTotal,
  applyModel,
  applyProduct,
  cardTotal,
  motoTotal,
  newItem,
  warrantyEnd,
  type MotoData,
  type MotoPayMethod,
  type MotoSpecs,
} from "@/lib/moto-sale";
import { brl } from "@/lib/pricing";
import { dateBr } from "@/lib/br";
import { useMotoProducts } from "@/lib/moto-products-db";
import { installmentValue } from "@/lib/moto-products";
import { Field, Input, MoneyInput, NumberInput, Segmented, Switch, Textarea, cx } from "../ui";
import { LeadPicker, PlaceDate, Section, type LeadLite } from "./form-bits";
import { PartyFields } from "./party-fields";


const SPEC_FIELDS: { k: keyof MotoSpecs; label: string; ph: string }[] = [
  { k: "power", label: "Motor", ph: "1.000W" },
  { k: "battery", label: "Bateria", ph: "Lítio 60V 20Ah" },
  { k: "range", label: "Autonomia", ph: "60 km" },
  { k: "speed", label: "Velocidade máx.", ph: "32 km/h" },
  { k: "recharge", label: "Recarga", ph: "6 a 7 h" },
  { k: "load", label: "Carga máx.", ph: "150 kg" },
  { k: "brakes", label: "Freios", ph: "Disco + tambor" },
  { k: "weight", label: "Peso", ph: "60 kg" },
];

export function MotoForm({
  data,
  update,
  leads,
  leadId,
  onLead,
}: {
  data: MotoData;
  update: (p: Partial<MotoData>) => void;
  leads: LeadLite[];
  leadId: string | null;
  onLead: (id: string) => void;
}) {
  const d = data;
  const total = motoTotal(d);
  const card = cardTotal(d);
  const end = warrantyEnd(d);
  const setPay = (p: Partial<MotoData["payment"]>) => update({ payment: { ...d.payment, ...p } });
  const setDelivery = (p: Partial<MotoData["delivery"]>) => update({ delivery: { ...d.delivery, ...p } });
  const setContractor = (p: Partial<MotoData["contractor"]>) => update({ contractor: { ...d.contractor, ...p } });
  const setAcc = (id: string, p: Partial<MotoData["accessories"][number]>) => update({ accessories: d.accessories.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  const { products } = useMotoProducts();
  const catalog = products.filter((p) => p.active || p.slug === d.model);
  const product = catalog.find((p) => p.slug === d.model);
  const colors = product?.colors.length ? product.colors : (MOTO_COLORS[d.model] ?? []);
  const plan = product ? { n: product.installments, each: installmentValue(product.price, product.installments, product.rate), rate: product.rate } : null;

  return (
    <>
      <Section icon={<User className="h-4 w-4" />} title="Comprador" subtitle="Quem compra e assina o contrato (com selfie)">
        <div className="grid gap-3">
          <LeadPicker leads={leads} value={leadId} onChange={onLead} label="Cliente do CRM" />
          <PartyFields value={d.client} onChange={(client) => update({ client })} />
        </div>
      </Section>

      <Section icon={<Bike className="h-4 w-4" />} title="Scooter" subtitle="Modelo, cor e ficha técnica (vem do catálogo e pode ser ajustada)">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[...catalog.map((p) => ({ id: p.slug, name: p.name, sub: p.kicker || "Scooter elétrica", photo: p.photo, product: p })), { id: "outro", name: "Outro", sub: "modelo fora do catálogo", photo: "/mob/cmp-scooter.webp", product: null }].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => update(m.product ? applyProduct(d, m.product) : applyModel(d, "outro"))}
              className={cx(
                "group relative overflow-hidden rounded-2xl p-2.5 text-left ring-1 transition",
                d.model === m.id ? "bg-[#0f2117] text-white ring-2 ring-[#6FBF8E] shadow-[0_10px_30px_-12px_rgba(111,191,142,0.7)]" : "bg-ink-50 ring-ink-200 hover:ring-ink-300",
              )}
            >
              <div className="grid h-16 place-items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.photo || "/mob/cmp-scooter.webp"} alt="" className="max-h-16 w-auto object-contain" />
              </div>
              <p className="mt-1 text-sm leading-tight font-bold">{m.name}</p>
              <p className={cx("text-[11px] leading-tight", d.model === m.id ? "text-white/60" : "text-ink-500")}>{m.sub}</p>
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {d.model === "outro" && (
            <Field label="Nome do modelo" className="col-span-2">
              <Input value={d.modelName} onChange={(e) => update({ modelName: e.target.value })} placeholder="Ex.: Urbana 800W" />
            </Field>
          )}
          <Field label="Cor">
            <Input list="moto-colors" value={d.color} onChange={(e) => update({ color: e.target.value })} placeholder="Ex.: Branca" />
            <datalist id="moto-colors">
              {colors.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ano">
              <Input inputMode="numeric" value={String(d.year)} onChange={(e) => update({ year: Number(e.target.value.replace(/\D/g, "").slice(0, 4)) || new Date().getFullYear() })} />
            </Field>
            <Field label="Quantidade">
              <NumberInput value={d.qty} digits={0} onChange={(v) => update({ qty: Math.max(1, Math.round(v) || 1) })} />
            </Field>
          </div>
        </div>

        <details className="mt-3 rounded-xl bg-ink-50 p-3 ring-1 ring-ink-200/70">
          <summary className="cursor-pointer text-sm font-semibold">Ficha técnica {product ? `da ${product.name}` : ""}</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {SPEC_FIELDS.map((f) => (
              <Field key={f.k} label={f.label}>
                <Input value={d.specs[f.k]} onChange={(e) => update({ specs: { ...d.specs, [f.k]: e.target.value } })} placeholder={f.ph} />
              </Field>
            ))}
          </div>
        </details>
      </Section>

      <Section icon={<Hash className="h-4 w-4" />} title="Identificação do veículo" subtitle="Números de série: vão no contrato e no certificado de garantia">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Chassi / quadro">
            <Input value={d.chassis} onChange={(e) => update({ chassis: e.target.value.toUpperCase() })} placeholder="Gravado no quadro" className="font-mono" />
          </Field>
          <Field label="Nº do motor">
            <Input value={d.motorNo} onChange={(e) => update({ motorNo: e.target.value.toUpperCase() })} placeholder="Etiqueta do motor" className="font-mono" />
          </Field>
          <Field label="Nº da bateria">
            <Input value={d.batteryNo} onChange={(e) => update({ batteryNo: e.target.value.toUpperCase() })} placeholder="Etiqueta da bateria" className="font-mono" />
          </Field>
          <Field label="Nº do carregador">
            <Input value={d.chargerNo} onChange={(e) => update({ chargerNo: e.target.value.toUpperCase() })} placeholder="Etiqueta do carregador" className="font-mono" />
          </Field>
        </div>
        <p className="mt-2 text-xs text-ink-500">Pode deixar em branco no orçamento e completar na entrega, antes de gerar o certificado.</p>
      </Section>

      <Section icon={<PackagePlus className="h-4 w-4" />} title="Acessórios" subtitle={accessoriesTotal(d) > 0 ? `Total em acessórios: ${brl(accessoriesTotal(d))}` : "Opcional: capacete, baú, cadeado…"}>
        <div className="grid gap-2">
          {d.accessories.map((a) => (
            <div key={a.id} className="grid grid-cols-[minmax(0,1fr)_64px_120px_36px] items-center gap-2">
              <Input value={a.name} onChange={(e) => setAcc(a.id, { name: e.target.value })} placeholder="Acessório" />
              <NumberInput value={a.qty} digits={0} onChange={(v) => setAcc(a.id, { qty: Math.max(0, Math.round(v)) })} />
              <MoneyInput value={a.price} onChange={(v) => setAcc(a.id, { price: v })} />
              <button type="button" aria-label="Remover" onClick={() => update({ accessories: d.accessories.filter((x) => x.id !== a.id) })} className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 hover:bg-rose-50 hover:text-rose-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {MOTO_ACCESSORIES.filter((s) => !d.accessories.some((a) => a.name.trim().toLowerCase() === s.name.toLowerCase())).map((s) => (
              <button key={s.name} type="button" onClick={() => update({ accessories: [...d.accessories, newItem({ name: s.name, price: s.price })] })} className="rounded-full bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-700 ring-1 ring-ink-200 hover:ring-ink-300">
                + {s.name}
              </button>
            ))}
            <button type="button" onClick={() => update({ accessories: [...d.accessories, newItem()] })} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-ink-600 ring-1 ring-dashed ring-ink-300">
              <Plus className="h-3.5 w-3.5" /> Outro
            </button>
          </div>
          <p className="text-xs text-ink-500">Acessório de brinde: deixe o valor em R$ 0,00.</p>
        </div>
      </Section>

      <Section icon={<CreditCard className="h-4 w-4" />} title="Valores e pagamento" subtitle={`Total à vista: ${brl(total)}`}>
        <div className="grid grid-cols-3 gap-3">
          <Field label={d.qty > 1 ? "Preço unitário" : "Preço à vista"}>
            <MoneyInput value={d.price} onChange={(v) => update({ price: v })} />
          </Field>
          <Field label="Frete">
            <MoneyInput value={d.freight} onChange={(v) => update({ freight: v })} />
          </Field>
          <Field label="Desconto">
            <MoneyInput value={d.discount} onChange={(v) => update({ discount: v })} />
          </Field>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-ink-950 px-4 py-3 text-white">
          <span className="text-sm text-white/70">Total à vista</span>
          <span className="font-display text-xl font-semibold tabular-nums">{brl(total)}</span>
        </div>

        <Segmented
          className="mt-4"
          size="sm"
          value={d.payment.method}
          onChange={(v: MotoPayMethod) => setPay({ method: v })}
          options={[
            { value: "cartao", label: "Cartão" },
            { value: "pix", label: "PIX à vista" },
            { value: "entrada", label: "Entrada + saldo" },
            { value: "personalizado", label: "Outra" },
          ]}
        />
        {d.payment.method === "cartao" && (
          <div className="mt-3 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Parcelas">
                <NumberInput value={d.payment.installments} digits={0} suffix="x" onChange={(v) => setPay({ installments: Math.min(24, Math.max(1, Math.round(v) || 1)) })} />
              </Field>
              <Field label="Valor da parcela" hint={card > 0 ? `Total no cartão: ${brl(card)}` : undefined}>
                <MoneyInput value={d.payment.installmentValue} onChange={(v) => setPay({ installmentValue: v })} />
              </Field>
            </div>
            {plan && (
              <button type="button" onClick={() => setPay({ installments: plan.n, installmentValue: plan.each })} className="justify-self-start text-xs font-semibold text-emerald-700 hover:underline">
                Usar a tabela do modelo: {plan.n}x de {brl(plan.each)} ({plan.rate.toLocaleString("pt-BR")}% a.m.)
              </button>
            )}
            <Switch checked={d.payment.multipleCards} onChange={(v) => setPay({ multipleCards: v })} label="Aceita mais de um cartão" />
          </div>
        )}
        {d.payment.method === "entrada" && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Entrada" hint={`Saldo: ${brl(Math.max(0, total - d.payment.entry))}`}>
              <MoneyInput value={d.payment.entry} onChange={(v) => setPay({ entry: v })} />
            </Field>
            <Field label="Saldo pago">
              <Input value={d.payment.balanceWhen} onChange={(e) => setPay({ balanceWhen: e.target.value })} placeholder="na entrega da scooter" />
            </Field>
          </div>
        )}
        {d.payment.method === "personalizado" && (
          <Field label="Como será o pagamento" className="mt-3">
            <Textarea rows={3} value={d.payment.custom} onChange={(e) => setPay({ custom: e.target.value })} placeholder="Ex.: R$ 2.000 no PIX e o restante em 10x no cartão…" />
          </Field>
        )}
      </Section>

      <Section icon={<Truck className="h-4 w-4" />} title="Entrega" subtitle="A garantia começa a contar da data de entrega">
        <Segmented
          size="sm"
          value={d.delivery.mode}
          onChange={(v: "retirada" | "entrega") => setDelivery({ mode: v })}
          options={[
            { value: "entrega", label: "Entregamos montada" },
            { value: "retirada", label: "Retira na loja" },
          ]}
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          {d.delivery.mode === "entrega" && (
            <Field
              label="Endereço de entrega"
              className="col-span-2"
              hint={
                d.client.address.trim() && !d.delivery.address.trim() ? (
                  <button type="button" className="font-semibold text-emerald-700 hover:underline" onClick={() => setDelivery({ address: [d.client.address, d.client.city && `${d.client.city}/${d.client.state || "AL"}`].filter(Boolean).join(", ") })}>
                    Usar o endereço do comprador
                  </button>
                ) : undefined
              }
            >
              <Input value={d.delivery.address} onChange={(e) => setDelivery({ address: e.target.value })} placeholder="Rua, número, bairro, cidade" />
            </Field>
          )}
          <Field label="Data da entrega">
            <Input type="date" value={d.delivery.date} onChange={(e) => setDelivery({ date: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section icon={<ShieldCheck className="h-4 w-4" />} title="Garantia e orçamento" subtitle={end ? `Garantia válida até ${dateBr(end)}` : undefined}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Garantia" hint="Padrão: 90 dias (garantia legal do CDC)">
            <NumberInput value={d.warrantyDays} digits={0} suffix="dias" onChange={(v) => update({ warrantyDays: Math.max(0, Math.round(v)) })} />
          </Field>
          <Field label="Validade do orçamento">
            <NumberInput value={d.quoteValidityDays} digits={0} suffix="dias" onChange={(v) => update({ quoteValidityDays: Math.max(1, Math.round(v) || 7) })} />
          </Field>
          <div className="col-span-2">
            <Switch checked={d.freeRevision} onChange={(v) => update({ freeRevision: v })} label="Revisão de 30 dias (ou 300 km) com mão de obra gratuita" />
          </div>
          <Field label="Observações do orçamento" className="col-span-2">
            <Textarea rows={2} value={d.quoteNotes} onChange={(e) => update({ quoteNotes: e.target.value })} placeholder="Ex.: Test ride na loja · cor sujeita a disponibilidade" />
          </Field>
        </div>
      </Section>

      <Section icon={<Building2 className="h-4 w-4" />} title="Vendedora" subtitle="Sua empresa no contrato">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Razão social" className="col-span-2">
            <Input value={d.contractor.name} onChange={(e) => setContractor({ name: e.target.value })} />
          </Field>
          <Field label="CNPJ">
            <Input value={formatDoc(d.contractor.doc)} onChange={(e) => setContractor({ doc: digits(e.target.value).slice(0, 14) })} inputMode="numeric" />
          </Field>
          <Field label="Cidade">
            <Input value={d.contractor.city} onChange={(e) => setContractor({ city: e.target.value })} />
          </Field>
          <Field label="Endereço" className="col-span-2">
            <Input value={d.contractor.address} onChange={(e) => setContractor({ address: e.target.value })} />
          </Field>
          <Field label="Representante">
            <Input value={d.contractor.repName} onChange={(e) => setContractor({ repName: e.target.value })} />
          </Field>
          <Field label="Cargo">
            <Input value={d.contractor.repRole} onChange={(e) => setContractor({ repRole: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section icon={<Users className="h-4 w-4" />} title="Contrato" subtitle="Encargos, foro, testemunhas e cláusulas extras">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Multa por atraso">
            <NumberInput value={d.lateFee} suffix="%" onChange={(v) => update({ lateFee: v })} />
          </Field>
          <Field label="Juros ao mês">
            <NumberInput value={d.interest} suffix="%" onChange={(v) => update({ interest: v })} />
          </Field>
          <Field label="Foro (comarca)">
            <Input value={d.forum} onChange={(e) => update({ forum: e.target.value })} />
          </Field>
          <Field label="Estado">
            <Input value={d.forumState} onChange={(e) => update({ forumState: e.target.value })} />
          </Field>
          {d.witnesses.map((w, i) => (
            <div key={i} className="col-span-2 grid grid-cols-[1fr_150px] gap-2">
              <Field label={`Testemunha ${i + 1} (opcional)`}>
                <Input value={w.name} onChange={(e) => update({ witnesses: d.witnesses.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="Nome" />
              </Field>
              <Field label="CPF">
                <Input value={formatDoc(w.doc)} onChange={(e) => update({ witnesses: d.witnesses.map((x, j) => (j === i ? { ...x, doc: digits(e.target.value).slice(0, 11) } : x)) })} inputMode="numeric" />
              </Field>
            </div>
          ))}
          <Field label="Cláusulas extras" hint="Uma por linha" className="col-span-2">
            <Textarea rows={3} value={d.extraClauses} onChange={(e) => update({ extraClauses: e.target.value })} />
          </Field>
        </div>
      </Section>

      <PlaceDate data={d} update={update} />
    </>
  );
}
