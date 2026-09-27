"use client";

import { Building2, User } from "lucide-react";
import { digits, formatCep, formatDoc, isValidDoc } from "@/lib/br";
import { UFS } from "@/lib/constants";
import type { Party } from "@/lib/documents";
import { formatPhone } from "@/lib/format";
import { Field, Input, Segmented, Select } from "../ui";

const MARITAL = ["solteiro(a)", "casado(a)", "divorciado(a)", "viúvo(a)", "em união estável"];

/** Dados de uma pessoa física ou empresa (outorgante, locador, locatário, fiador). */
export function PartyFields({ value, onChange, withContact = true }: { value: Party; onChange: (p: Party) => void; withContact?: boolean }) {
  const set = <K extends keyof Party>(k: K, v: Party[K]) => onChange({ ...value, [k]: v });
  const pj = value.kind === "pj";
  const docBad = digits(value.doc).length >= (pj ? 14 : 11) && !isValidDoc(value.doc);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Segmented
        className="col-span-2 justify-self-start"
        size="sm"
        value={value.kind}
        onChange={(v) => set("kind", v)}
        options={[
          { value: "pf", label: <><User className="h-3.5 w-3.5" /> Pessoa física</> },
          { value: "pj", label: <><Building2 className="h-3.5 w-3.5" /> Empresa</> },
        ]}
      />
      <Field label={pj ? "Razão social" : "Nome completo"} className="col-span-2">
        <Input value={value.name} onChange={(e) => set("name", e.target.value)} placeholder={pj ? "Empresa Ltda" : "Nome como no documento"} />
      </Field>
      <Field label={pj ? "CNPJ" : "CPF"} hint={docBad ? <span className="text-rose-600">Número inválido — confira os dígitos</span> : undefined}>
        <Input value={formatDoc(value.doc)} onChange={(e) => set("doc", digits(e.target.value))} inputMode="numeric" placeholder={pj ? "00.000.000/0000-00" : "000.000.000-00"} />
      </Field>
      {pj ? (
        <Field label="CPF do representante">
          <Input value={formatDoc(value.repDoc)} onChange={(e) => set("repDoc", digits(e.target.value).slice(0, 11))} inputMode="numeric" placeholder="000.000.000-00" />
        </Field>
      ) : (
        <Field label="RG">
          <Input value={value.rg} onChange={(e) => set("rg", e.target.value)} placeholder="Opcional" />
        </Field>
      )}
      {pj ? (
        <Field label="Representante legal" className="col-span-2">
          <Input value={value.repName} onChange={(e) => set("repName", e.target.value)} placeholder="Nome de quem assina pela empresa" />
        </Field>
      ) : (
        <>
          <Field label="Estado civil">
            <Select value={value.marital} onChange={(e) => set("marital", e.target.value)}>
              <option value="">Não informar</option>
              {MARITAL.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="Profissão">
            <Input value={value.profession} onChange={(e) => set("profession", e.target.value)} placeholder="Opcional" />
          </Field>
        </>
      )}
      <Field label="Endereço" className="col-span-2">
        <Input value={value.address} onChange={(e) => set("address", e.target.value)} placeholder="Rua, número, complemento e bairro" />
      </Field>
      <Field label="Cidade">
        <Input value={value.city} onChange={(e) => set("city", e.target.value)} />
      </Field>
      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
        <Field label="UF">
          <Select value={value.state} onChange={(e) => set("state", e.target.value)}>
            {UFS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </Select>
        </Field>
        <Field label="CEP">
          <Input value={formatCep(value.cep)} onChange={(e) => set("cep", digits(e.target.value))} inputMode="numeric" placeholder="00000-000" />
        </Field>
      </div>
      {withContact && (
        <>
          <Field label="WhatsApp" hint="Para enviar o link de assinatura">
            <Input value={formatPhone(value.phone)} onChange={(e) => set("phone", e.target.value)} inputMode="tel" placeholder="(82) 99999-0000" />
          </Field>
          <Field label="E-mail">
            <Input value={value.email} onChange={(e) => set("email", e.target.value)} type="email" placeholder="Opcional" />
          </Field>
        </>
      )}
    </div>
  );
}
