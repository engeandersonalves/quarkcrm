"use client";

import { BookOpen, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Field, Input, Modal } from "@/components/ui";
import type { MotoProduct } from "@/lib/moto-products";
import { emptyOwner, type ManualOwner } from "./moto-manual";

const today = () => new Date().toISOString().slice(0, 10);

const FIELDS: { k: keyof ManualOwner; label: string; type?: string; placeholder?: string; wide?: boolean; mono?: boolean }[] = [
  { k: "name", label: "Nome do cliente", placeholder: "Nome completo", wide: true },
  { k: "doc", label: "CPF ou CNPJ", placeholder: "000.000.000-00" },
  { k: "phone", label: "Telefone", placeholder: "(82) 9 0000-0000" },
  { k: "city", label: "Cidade/UF", placeholder: "Maceió/AL" },
  { k: "color", label: "Cor da scooter" },
  { k: "year", label: "Ano" },
  { k: "chassis", label: "Nº do chassi", mono: true },
  { k: "motorNo", label: "Nº do motor", mono: true },
  { k: "batteryNo", label: "Nº da bateria", mono: true },
  { k: "chargerNo", label: "Nº do carregador", mono: true },
  { k: "purchaseDate", label: "Data da compra", type: "date" },
  { k: "deliveryDate", label: "Data da entrega (início da garantia)", type: "date" },
];

/** Pede os dados do cliente que vão no certificado de garantia antes de gerar o manual. */
export function ManualOwnerModal({ product, onClose, onGenerate, busy }: { product: MotoProduct | null; onClose: () => void; onGenerate: (owner: ManualOwner | null) => void; busy?: boolean }) {
  const [o, setO] = useState<ManualOwner>(() => emptyOwner());
  useEffect(() => {
    if (product) setO(emptyOwner({ color: product.colors.length === 1 ? product.colors[0] : "", purchaseDate: today(), deliveryDate: today() }));
  }, [product]);
  const set = (k: keyof ManualOwner, v: string) => setO((x) => ({ ...x, [k]: k === "warrantyDays" ? Number(v) || 90 : v }));

  return (
    <Modal
      open={!!product}
      onClose={onClose}
      size="lg"
      title={`Manual + garantia${product ? ` · ${product.name}` : ""}`}
      subtitle="Os dados abaixo vão para a identificação do veículo e para o certificado de garantia na última página. Campos vazios saem com linha para preencher à mão."
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => onGenerate(null)} disabled={busy}>
            <FileText className="h-4 w-4" /> Gerar em branco
          </Button>
          <Button onClick={() => onGenerate({ ...o, name: o.name.trim() })} loading={busy} disabled={!o.name.trim()}>
            <BookOpen className="h-4 w-4" /> Gerar com os dados do cliente
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <Field key={f.k} label={f.label} htmlFor={`mo-${f.k}`} className={f.wide ? "sm:col-span-2" : undefined}>
            <Input
              id={`mo-${f.k}`}
              type={f.type ?? "text"}
              value={String(o[f.k] ?? "")}
              placeholder={f.placeholder}
              maxLength={f.type ? undefined : f.wide ? 80 : 40}
              onChange={(e) => set(f.k, e.target.value)}
              className={f.mono ? "font-mono uppercase" : undefined}
            />
            {f.k === "color" && product && product.colors.length > 1 && <p className="text-xs text-ink-500">Cores do modelo: {product.colors.join(", ")}</p>}
          </Field>
        ))}
        <Field label="Garantia (dias)" htmlFor="mo-warrantyDays">
          <Input id="mo-warrantyDays" type="number" min={30} max={1095} value={o.warrantyDays} onChange={(e) => set("warrantyDays", e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
