"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Crosshair, ExternalLink, Loader2, MapPin } from "lucide-react";
import { fmtCep, linkMaps, soDigitos, temEndereco } from "@/lib/format";
import type { Endereco } from "@/lib/types";
import { Button, cx, Field, Input, Textarea } from "./ui";

export function EnderecoForm({ value, onChange, compacto }: { value: Endereco; onChange: (e: Endereco) => void; compacto?: boolean }) {
  const [buscando, setBuscando] = useState(false);
  const [gps, setGps] = useState(false);
  const set = (patch: Partial<Endereco>) => onChange({ ...value, ...patch });

  async function buscarCep(cep: string) {
    const d = soDigitos(cep);
    if (d.length !== 8) return;
    setBuscando(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (j.erro) throw new Error("CEP não encontrado");
      onChange({
        ...value,
        cep: fmtCep(d),
        logradouro: j.logradouro || value.logradouro,
        bairro: j.bairro || value.bairro,
        cidade: j.localidade || value.cidade,
        uf: j.uf || value.uf,
        complemento: value.complemento || "",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível buscar o CEP");
    } finally {
      setBuscando(false);
    }
  }

  function capturarGps() {
    if (!navigator.geolocation) return toast.error("Este aparelho não tem GPS disponível");
    setGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        set({ maps_url: `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}` });
        setGps(false);
        toast.success("Localização exata salva", { description: "O entregador vai cair no ponto certo." });
      },
      (err) => {
        setGps(false);
        toast.error("Não foi possível pegar a localização", { description: err.message });
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-6">
      <Field label="CEP" className="sm:col-span-2">
        <div className="relative">
          <Input
            inputMode="numeric"
            placeholder="00000-000"
            value={value.cep}
            onChange={(e) => {
              const v = fmtCep(e.target.value);
              set({ cep: v });
              if (soDigitos(v).length === 8) buscarCep(v);
            }}
          />
          {buscando && <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-brand-600" />}
        </div>
      </Field>
      <Field label="Rua / avenida / condomínio" className="sm:col-span-4">
        <Input value={value.logradouro} onChange={(e) => set({ logradouro: e.target.value })} placeholder="Ex.: Condomínio Atlantis" />
      </Field>
      <Field label="Número" className="sm:col-span-1">
        <Input value={value.numero} onChange={(e) => set({ numero: e.target.value })} placeholder="S/N" />
      </Field>
      <Field label="Complemento (lote, quadra, casa…)" className="sm:col-span-3">
        <Input value={value.complemento} onChange={(e) => set({ complemento: e.target.value })} placeholder="Ex.: Lote E1" />
      </Field>
      <Field label="Bairro" className="sm:col-span-2">
        <Input value={value.bairro} onChange={(e) => set({ bairro: e.target.value })} placeholder="Ex.: Garça Torta" />
      </Field>
      {!compacto && (
        <>
          <Field label="Cidade" className="sm:col-span-4">
            <Input value={value.cidade} onChange={(e) => set({ cidade: e.target.value })} placeholder="Maceió" />
          </Field>
          <Field label="UF" className="sm:col-span-2">
            <Input value={value.uf} maxLength={2} onChange={(e) => set({ uf: e.target.value.toUpperCase() })} placeholder="AL" />
          </Field>
        </>
      )}
      <Field label="Ponto de referência para o entregador" className="sm:col-span-6">
        <Textarea
          className="min-h-[64px]"
          value={value.referencia}
          onChange={(e) => set({ referencia: e.target.value })}
          placeholder="Ex.: portão cinza depois da pousada, entrar na 2ª rua de barro à direita"
        />
      </Field>
      <Field
        label={
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-brand-600" /> Localização exata (link do Maps ou do WhatsApp)
          </span>
        }
        className="sm:col-span-6"
        hint="Peça ao cliente para mandar a localização pelo WhatsApp e cole aqui — ou, estando na obra, toque em “Usar GPS”."
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={value.maps_url} onChange={(e) => set({ maps_url: e.target.value.trim() })} placeholder="https://maps.app.goo.gl/…" />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={capturarGps} loading={gps} className="flex-1 sm:flex-none">
              {!gps && <Crosshair className="h-4 w-4" />} GPS
            </Button>
            <a
              href={temEndereco(value) ? linkMaps(value) : undefined}
              target="_blank"
              rel="noreferrer"
              className={cx(
                "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold ring-1 ring-ink-200 sm:flex-none",
                temEndereco(value) ? "bg-white text-ink-800 hover:bg-ink-50" : "pointer-events-none text-ink-300",
              )}
            >
              <ExternalLink className="h-4 w-4" /> Mapa
            </a>
          </div>
        </div>
      </Field>
    </div>
  );
}
