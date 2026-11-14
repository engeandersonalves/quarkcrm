"use client";

import { Bike, CheckCircle2, ClipboardCopy, Eraser, Home, IdCard, Phone, Sparkles, UserPlus, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Badge, Button, Card, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { digits, formatCep, formatDoc, isValidCnpj, isValidCpf } from "@/lib/br";
import { EMPTY_CADASTRO, UFS_BR, fullAddress, missingCadastro, parseCadastro, type Cadastro } from "@/lib/cadastro-parser";
import { supabase } from "@/lib/supabase/client";

export const CADASTRO_DRAFT = "quark-moto-cadastro";

const EXAMPLE = `Nome completo: MARIA JOSÉ DA SILVA
CPF: 529.982.247-25
RG: 1234567 SSP/AL
Data de nascimento: 12/03/1985
Estado civil: casada
Profissão: professora
Endereço: Rua das Flores, 120, apto 302 - Ponta Verde
Cidade: Maceió - AL
CEP: 57035-000
Whatsapp: (82) 99999-1234
E-mail: maria.silva@gmail.com
Quero a Cappuccino creme, 21x no cartão
Obs: entregar depois das 18h`;

const LABEL: Partial<Record<keyof Cadastro, string>> = {
  name: "Nome completo",
  doc: "CPF / CNPJ",
  rg: "RG",
  birth: "Nascimento",
  marital: "Estado civil",
  profession: "Profissão",
  street: "Rua / avenida",
  number: "Número",
  complement: "Complemento",
  district: "Bairro",
  city: "Cidade",
  state: "UF",
  cep: "CEP",
  phone: "WhatsApp",
  email: "E-mail",
  color: "Cor",
  chassis: "Chassi",
  motorNo: "Nº do motor",
  batteryNo: "Nº da bateria",
  payment: "Pagamento",
};

const MODEL_NAME = { t1: "T1", cappuccino: "Cappuccino", mz: "MZ" } as const;

/** Cadastro rápido: cola o texto do cliente e o CRM separa cada informação. */
export function CadastroPanel() {
  const router = useRouter();
  const { user } = useApp();
  const [text, setText] = useState("");
  const [d, setD] = useState<Cadastro>(EMPTY_CADASTRO);
  const [found, setFound] = useState<(keyof Cadastro)[]>([]);
  const [busy, setBusy] = useState<"venda" | "lead" | null>(null);

  // Organiza enquanto digita/cola (com um respiro de 250 ms).
  useEffect(() => {
    const t = setTimeout(() => {
      if (!text.trim()) {
        setD(EMPTY_CADASTRO);
        setFound([]);
        return;
      }
      const r = parseCadastro(text);
      setD(r.data);
      setFound(r.found);
    }, 250);
    return () => clearTimeout(t);
  }, [text]);

  const set = <K extends keyof Cadastro>(k: K, v: Cadastro[K]) => setD((x) => ({ ...x, [k]: v }));
  const miss = useMemo(() => missingCadastro(d), [d]);
  const docOk = digits(d.doc).length === 11 ? isValidCpf(d.doc) : digits(d.doc).length === 14 ? isValidCnpj(d.doc) : false;
  const filled = (Object.keys(LABEL) as (keyof Cadastro)[]).filter((k) => d[k]).length + (d.model ? 1 : 0);

  const notes = () =>
    [d.birth && `Nascimento: ${d.birth}`, d.rg && `RG: ${d.rg}`, d.payment && `Pagamento desejado: ${d.payment}`, d.model && `Interesse: scooter ${MODEL_NAME[d.model]}${d.color ? ` ${d.color.toLowerCase()}` : ""}`, d.notes]
      .filter(Boolean)
      .join("\n");

  /** Cria (ou atualiza, se o CPF já existir) o lead com os dados organizados. */
  const upsertLead = async (): Promise<string | null> => {
    const sb = supabase();
    const payload = {
      name: d.name.trim(),
      phone: d.phone.trim() || null,
      email: d.email.trim() || null,
      document: digits(d.doc) || null,
      address: fullAddress(d) || null,
      city: d.city.trim() || null,
      state: d.state || null,
    };
    let id: string | null = null;
    if (payload.document) {
      const { data } = await sb.from("leads").select("id,notes").eq("document", payload.document).limit(1).maybeSingle();
      if (data) {
        const merged = [data.notes, notes()].filter(Boolean).join("\n\n").slice(0, 6000);
        const { error } = await sb.from("leads").update({ ...payload, notes: merged }).eq("id", data.id);
        if (error) throw new Error(error.message);
        id = data.id as string;
      }
    }
    if (!id) {
      const { data, error } = await sb
        .from("leads")
        .insert({ ...payload, notes: notes() || null, source: "Cadastro", segment: "mobilidade", temperature: "quente", owner_id: user.id, created_by: user.id })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = data.id as string;
    }
    return id;
  };

  const createSale = async () => {
    if (!d.name.trim()) return toast.error("Falta o nome do cliente");
    setBusy("venda");
    try {
      const leadId = await upsertLead();
      try {
        sessionStorage.setItem(CADASTRO_DRAFT, JSON.stringify(d));
      } catch {
        /* navegação privada: segue só com o lead */
      }
      router.push(`/documentos/novo?tipo=moto&lead=${leadId}${d.model ? `&modelo=${d.model}` : ""}&cadastro=1`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o cadastro");
      setBusy(null);
    }
  };

  const saveLead = async () => {
    if (!d.name.trim()) return toast.error("Falta o nome do cliente");
    setBusy("lead");
    try {
      const id = await upsertLead();
      toast.success("Cliente salvo nos leads", { action: { label: "Abrir", onClick: () => router.push(`/leads/${id}`) } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setBusy(null);
    }
  };

  const copyTidy = async () => {
    const lines = [
      d.name && `Nome: ${d.name}`,
      d.doc && `${digits(d.doc).length > 11 ? "CNPJ" : "CPF"}: ${formatDoc(d.doc)}`,
      d.rg && `RG: ${d.rg}`,
      d.birth && `Nascimento: ${d.birth}`,
      d.marital && `Estado civil: ${d.marital}`,
      d.profession && `Profissão: ${d.profession}`,
      fullAddress(d) && `Endereço: ${fullAddress(d)}`,
      d.city && `Cidade: ${d.city}${d.state ? `/${d.state}` : ""}`,
      d.cep && `CEP: ${formatCep(d.cep)}`,
      d.phone && `WhatsApp: ${d.phone}`,
      d.email && `E-mail: ${d.email}`,
      d.model && `Scooter: ${MODEL_NAME[d.model]}${d.color ? ` ${d.color}` : ""}`,
      d.payment && `Pagamento: ${d.payment}`,
      d.notes && `Obs.: ${d.notes}`,
    ].filter(Boolean);
    await navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
    toast.success("Cadastro organizado copiado");
  };

  const fp = { d, found, set };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
      {/* ---------------------------------------------------- texto colado */}
      <div className="lg:sticky lg:top-6">
        <div className="relative overflow-hidden rounded-[28px] bg-[#050706] p-5 text-white ring-1 ring-white/[0.06] sm:p-6">
          <div className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(111,191,142,0.25),rgba(111,191,142,0))]" />
          <p className="relative flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-[#A9DE86] uppercase">
            <Wand2 className="h-4 w-4" /> Cadastro inteligente
          </p>
          <p className="relative mt-1 font-display text-xl font-semibold">Cole o texto completo. O CRM organiza.</p>
          <p className="relative mt-1 text-[13px] text-white/55">Ficha do WhatsApp, e-mail ou mensagem corrida: com ou sem “Nome:”, “CPF:”, em uma linha ou em várias.</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            placeholder={"Ex.:\nMaria José da Silva\n529.982.247-25\nRua das Flores, 120 - Ponta Verde, Maceió/AL\nCEP 57035-000 · (82) 99999-1234\nmaria@gmail.com · casada · professora\nQuero a Cappuccino creme em 21x"}
            className="relative mt-4 w-full resize-y rounded-[18px] bg-white/[0.06] p-4 font-mono text-[13px] leading-relaxed text-white ring-1 ring-white/10 outline-none placeholder:text-white/25 focus:ring-2 focus:ring-[#6FBF8E]"
          />
          <div className="relative mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setText(EXAMPLE)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 text-[13px] font-semibold ring-1 ring-white/10 hover:bg-white/[0.12]">
              <Sparkles className="h-4 w-4 text-[#F3E93B]" /> Ver exemplo
            </button>
            {text && (
              <button type="button" onClick={() => setText("")} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-white/60 ring-1 ring-white/10 hover:text-white">
                <Eraser className="h-4 w-4" /> Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- organizado */}
      <div className="grid gap-4">
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-[15px] font-semibold">Dados organizados</p>
            <div className="flex flex-wrap items-center gap-2">
              {text.trim() ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/15">{filled} campos preenchidos</Badge> : null}
              {text.trim() && miss.length ? (
                <Badge className="bg-amber-50 text-amber-800 ring-amber-600/20">Falta: {miss.join(", ")}</Badge>
              ) : text.trim() ? (
                <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/15">
                  <CheckCircle2 className="h-3 w-3" /> Pronto para a venda
                </Badge>
              ) : null}
            </div>
          </div>
          {!text.trim() && <p className="mt-1 text-sm text-ink-500">Cole o texto ao lado: cada informação aparece aqui no lugar certo, pronta para conferir.</p>}

          <Group icon={<IdCard className="h-4 w-4" />} title="Pessoa">
            <Fld {...fp} k="name" className="col-span-2" />
            <Fld {...fp} k="doc" className="col-span-2 sm:col-span-1">
              <div className="relative">
                <Input value={formatDoc(d.doc)} onChange={(e) => set("doc", digits(e.target.value).slice(0, 14))} inputMode="numeric" className="pr-20" />
                {digits(d.doc).length >= 11 && (
                  <span className={cx("absolute top-1/2 right-2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[11px] font-bold", docOk ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{docOk ? "válido" : "inválido"}</span>
                )}
              </div>
            </Fld>
            <Fld {...fp} k="rg" />
            <Fld {...fp} k="birth" />
            <Fld {...fp} k="marital" />
            <Fld {...fp} k="profession" className="col-span-2" />
          </Group>

          <Group icon={<Home className="h-4 w-4" />} title="Endereço">
            <Fld {...fp} k="street" className="col-span-2" />
            <Fld {...fp} k="number" />
            <Fld {...fp} k="complement" />
            <Fld {...fp} k="district" />
            <Fld {...fp} k="cep" />
            <Fld {...fp} k="city" />
            <Fld {...fp} k="state">
              <Select value={d.state} onChange={(e) => set("state", e.target.value)}>
                <option value="">—</option>
                {UFS_BR.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </Select>
            </Fld>
          </Group>

          <Group icon={<Phone className="h-4 w-4" />} title="Contato">
            <Fld {...fp} k="phone" />
            <Fld {...fp} k="email" />
          </Group>

          <Group icon={<Bike className="h-4 w-4" />} title="Scooter (se veio no texto)">
            <Field
              label={
                <span className="flex items-center gap-1.5">
                  Modelo {found.includes("model") && d.model ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
                </span>
              }
            >
              <Select value={d.model} onChange={(e) => set("model", e.target.value as Cadastro["model"])}>
                <option value="">Escolher na venda</option>
                <option value="t1">T1</option>
                <option value="cappuccino">Cappuccino</option>
                <option value="mz">MZ</option>
              </Select>
            </Field>
            <Fld {...fp} k="color" />
            <Fld {...fp} k="payment" className="col-span-2" />
            <Fld {...fp} k="chassis" mono />
            <Fld {...fp} k="motorNo" mono />
          </Group>

          <div className="mt-4">
            <Field label="Observações (o que não virou campo)">
              <Textarea rows={2} value={d.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
        </Card>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <Button onClick={createSale} loading={busy === "venda"} disabled={!d.name.trim()} variant="sun">
            <Bike className="h-4 w-4" /> Criar venda com estes dados
          </Button>
          <Button variant="secondary" onClick={saveLead} loading={busy === "lead"} disabled={!d.name.trim()}>
            <UserPlus className="h-4 w-4" /> Só salvar o cliente
          </Button>
          <Button variant="secondary" onClick={copyTidy} disabled={!text.trim()}>
            <ClipboardCopy className="h-4 w-4" /> Copiar
          </Button>
        </div>
        <p className="text-xs text-ink-500">O cliente entra nos Leads (origem “Cadastro”, segmento Mobilidade). Se o CPF já existir, o cadastro é atualizado em vez de duplicar.</p>
      </div>
    </div>
  );
}

function Group({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-2.5 flex items-center gap-2 text-[12px] font-bold tracking-[0.12em] text-ink-500 uppercase">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-ink-900 text-brand-yellow">{icon}</span>
        {title}
      </p>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Fld({
  k,
  d,
  found,
  set,
  className,
  mono,
  children,
}: {
  k: keyof Cadastro;
  d: Cadastro;
  found: (keyof Cadastro)[];
  set: <K extends keyof Cadastro>(k: K, v: Cadastro[K]) => void;
  className?: string;
  mono?: boolean;
  children?: ReactNode;
}) {
  return (
    <Field
      className={className}
      label={
        <span className="flex items-center gap-1.5">
          {LABEL[k]}
          {found.includes(k) && d[k] ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Reconhecido no texto" /> : null}
        </span>
      }
    >
      {children ?? <Input value={d[k] as string} onChange={(e) => set(k, e.target.value as never)} className={cx(mono && "font-mono")} />}
    </Field>
  );
}
