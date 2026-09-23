"use client";

import { CheckCircle2, Sun } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Field, Input, MoneyInput, Select, cx } from "@/components/ui";
import { UFS } from "@/lib/constants";

export default function CapturePage() {
  return (
    <Suspense>
      <Capture />
    </Suspense>
  );
}

function Capture() {
  const params = useSearchParams();
  const embed = params.get("embed") === "1";
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "", state: "", avg_bill: 0, website: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/public/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, avg_bill: form.avg_bill || "", source: params.get("origem") || "Site" }),
    }).catch(() => null);
    setLoading(false);
    if (!res?.ok) return setError("Não foi possível enviar. Tente novamente em instantes.");
    setDone(true);
  };

  return (
    <div className={cx("grid min-h-dvh place-items-center p-4", embed ? "bg-transparent" : "bg-ink-950")}>
      {!embed && <div className="pointer-events-none fixed -top-40 right-0 h-[480px] w-[480px] rounded-full bg-sun-500/25 blur-[120px]" />}
      <div className="animate-fade-up relative w-full max-w-md rounded-[28px] bg-white p-7 shadow-lift sm:p-9">
        {done ? (
          <div className="py-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight">Recebemos seus dados!</h1>
            <p className="mt-2 text-sm text-ink-500">Um especialista vai entrar em contato em breve com uma simulação personalizada.</p>
          </div>
        ) : (
          <>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sun-gradient shadow-glow">
              <Sun className="h-6 w-6 text-ink-950" strokeWidth={2.5} />
            </div>
            <h1 className="mt-5 font-display text-[26px] leading-tight font-semibold tracking-tight">Descubra quanto você pode economizar com energia solar</h1>
            <p className="mt-2 text-sm text-ink-500">Simulação gratuita e sem compromisso.</p>
            <form onSubmit={submit} className="mt-6 grid gap-4">
              <Field label="Seu nome">
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
              </Field>
              <Field label="WhatsApp">
                <Input required type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" autoComplete="tel" />
              </Field>
              <Field label="E-mail (opcional)">
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
              </Field>
              <div className="grid grid-cols-[1fr_96px] gap-3">
                <Field label="Cidade">
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} autoComplete="address-level2" />
                </Field>
                <Field label="UF">
                  <Select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                    <option value="">—</option>
                    {UFS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Valor médio da sua conta de luz">
                <MoneyInput value={form.avg_bill} onChange={(v) => setForm({ ...form, avg_bill: v })} digits={0} placeholder="0" />
              </Field>
              <input tabIndex={-1} autoComplete="off" className="hidden" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} aria-hidden />
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <Button type="submit" variant="sun" size="lg" loading={loading} className="mt-1">
                Quero minha simulação
              </Button>
              <p className="text-center text-[11px] text-ink-400">Seus dados são usados apenas para contato sobre energia solar.</p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
