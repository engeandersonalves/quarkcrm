/**
 * Cartão da scooter para o Google Wallet: as mesmas informações para
 * o Wallet e para a imagem do cartão na área do cliente.
 */
import { dateBr, formatDoc, maskDoc } from "./br.ts";
import { receiptNumber, receiptQrText } from "./moto-receipt.ts";
import { vehicleName, warrantyEnd, type MotoData } from "./moto-sale.ts";

export interface WalletCompany {
  name: string;
  cnpj: string;
  whatsapp: string;
  instagram: string;
  city: string;
}

export interface WalletField {
  key: string;
  label: string;
  value: string;
}

export interface WalletCard {
  serial: string;
  number: string;
  model: string;
  color: string;
  owner: string;
  /** Imagem de destaque: um dos modelos do catálogo ou a genérica. */
  art: "t1" | "cappuccino" | "mz" | "scooter";
  /** Frente do cartão. */
  primary: WalletField;
  secondary: WalletField[];
  auxiliary: WalletField[];
  /** Módulos de texto do Google Wallet. */
  back: WalletField[];
  qr: string;
  warrantyEnd: string;
  /** Links do cartão: área do cliente e assistência pelo WhatsApp. */
  links: { id: string; uri: string; description: string }[];
}

const clean = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, " ").trim();
const phoneBr = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
};

export function walletCard(d: MotoData, id: string, company: WalletCompany, portalUrl: string): WalletCard {
  const model = vehicleName(d).replace(/^Scooter elétrica\s*/, "") || "Scooter";
  const end = d.delivery.date || d.date ? warrantyEnd(d) : "";
  const { number, code } = receiptNumber(id);
  const doc = d.client.doc.replace(/\D/g, "");
  const art = (["t1", "cappuccino", "mz"] as const).find((m) => m === d.model) ?? "scooter";
  const contact = [company.whatsapp && `WhatsApp ${phoneBr(company.whatsapp)}`, company.instagram && `@${company.instagram.replace(/^@/, "")}`].filter(Boolean).join(" · ");
  const back: WalletField[] = [
    { key: "owner_full", label: "Proprietário", value: clean(d.client.name) },
    { key: "doc", label: doc.length > 11 ? "CNPJ" : "CPF", value: doc.length > 11 ? formatDoc(doc) : maskDoc(doc) },
    { key: "motor", label: "Motor", value: clean(d.motorNo).toUpperCase() },
    { key: "battery", label: "Bateria", value: clean(d.batteryNo).toUpperCase() },
    { key: "charger", label: "Carregador", value: clean(d.chargerNo).toUpperCase() },
    { key: "specs", label: "Ficha técnica", value: [d.specs.power, d.specs.battery, d.specs.range && `${d.specs.range} de autonomia`, d.specs.speed].filter(Boolean).join(" · ") },
    { key: "purchase", label: "Data da compra", value: d.date ? dateBr(d.date) : "" },
    { key: "warranty", label: "Garantia", value: end ? `${d.warrantyDays} dias contra defeitos de fabricação, até ${dateBr(end)}` : `${d.warrantyDays} dias a partir da entrega` },
    { key: "receipt", label: "Comprovante", value: `${number}${code ? ` · código ${code}` : ""}` },
    { key: "legal", label: "Categoria", value: "Autopropelido · até 1.000 W e 32 km/h · sem placa e sem CNH (Resolução CONTRAN 996/2023)" },
    { key: "help", label: "Assistência", value: contact || "Quark Mobilidade" },
    { key: "seller", label: "Emitido por", value: [company.name, company.cnpj && `CNPJ ${formatDoc(company.cnpj)}`].filter(Boolean).join(" · ") },
  ].filter((f) => f.value);

  return {
    serial: id,
    number,
    model,
    color: clean(d.color),
    owner: clean(d.client.name),
    art,
    primary: { key: "model", label: "SCOOTER ELÉTRICA", value: model },
    secondary: [
      { key: "owner", label: "PROPRIETÁRIO", value: clean(d.client.name).split(" ").slice(0, 2).join(" ") },
      { key: "warranty_end", label: "GARANTIA ATÉ", value: end ? dateBr(end) : "na entrega" },
    ],
    auxiliary: [
      { key: "chassis", label: "CHASSI", value: clean(d.chassis).toUpperCase() || "—" },
      { key: "color", label: "COR · ANO", value: [clean(d.color), d.year].filter(Boolean).join(" · ") || "—" },
    ],
    back,
    qr: receiptQrText(d, id, { name: company.name, cnpj: company.cnpj }),
    links: [
      { id: "portal", uri: portalUrl, description: "Área do cliente · manual, garantia e comprovante" },
      ...(company.whatsapp.replace(/\D/g, "").length >= 10 ? [{ id: "help", uri: `https://wa.me/55${company.whatsapp.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")}`, description: "Assistência Quark pelo WhatsApp" }] : []),
    ],
    warrantyEnd: end,
  };
}
