"use client";

import type { ReactNode } from "react";
import type { Lead } from "@/lib/types";
import { Card, Field, Input, Select } from "../ui";

export type LeadLite = Pick<Lead, "id" | "name" | "document" | "email" | "phone" | "address" | "city" | "state">;

export function Section({ icon, title, subtitle, children }: { icon?: ReactNode; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        {icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-900 text-brand-yellow">{icon}</span>}
        <div>
          <h2 className="font-display text-[15px] font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

export function LeadPicker({ leads, value, onChange, label }: { leads: LeadLite[]; value: string | null; onChange: (id: string) => void; label: string }) {
  return (
    <Field label={label} hint="Puxa nome, CPF, contato e endereço do cadastro do lead">
      <Select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecionar um lead…</option>
        {leads.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
            {l.city ? ` — ${l.city}` : ""}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function PlaceDate({ data, update }: { data: { place: string; date: string }; update: (p: { place?: string; date?: string }) => void }) {
  return (
    <Section title="Local e data">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Local">
          <Input value={data.place} onChange={(e) => update({ place: e.target.value })} />
        </Field>
        <Field label="Data">
          <Input type="date" value={data.date} onChange={(e) => update({ date: e.target.value })} />
        </Field>
      </div>
    </Section>
  );
}
