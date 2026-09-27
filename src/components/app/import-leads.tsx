"use client";

import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { downloadCsv, parseCsv, parseMoney } from "@/lib/csv";
import { supabase } from "@/lib/supabase/client";
import type { Segment } from "@/lib/types";
import { Button, Modal } from "../ui";
import { useApp } from "./app-context";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");

/** Reconhece o nome das colunas mais comuns em planilhas de leads. */
const COLUMNS: { key: string; label: string; match: string[] }[] = [
  { key: "name", label: "Nome", match: ["nome", "name", "cliente", "nomecompleto", "contato"] },
  { key: "phone", label: "Telefone", match: ["telefone", "whatsapp", "celular", "phone", "fone", "tel"] },
  { key: "email", label: "E-mail", match: ["email", "mail"] },
  { key: "city", label: "Cidade", match: ["cidade", "city", "municipio"] },
  { key: "state", label: "UF", match: ["uf", "estado", "state"] },
  { key: "source", label: "Origem", match: ["origem", "source", "canal", "fonte"] },
  { key: "avg_bill", label: "Conta de luz", match: ["conta", "contadeluz", "valordaconta", "contamedia", "avgbill", "valor"] },
  { key: "segment", label: "Interesse", match: ["interesse", "segmento", "servico", "segment", "produto"] },
  { key: "notes", label: "Observações", match: ["observacoes", "observacao", "obs", "notas", "notes", "comentarios"] },
];

const SEGMENT_WORDS: [RegExp, Segment][] = [
  [/eletroposto|posto de recarga/i, "eletroposto"],
  [/manuten|limpeza/i, "manutencao"],
  [/gest|titular|rateio/i, "gestao"],
  [/ambos|solar.*carreg|carreg.*solar/i, "ambos"],
  [/carreg|veicul|save|wallbox/i, "save"],
];

type Row = Record<string, string>;

export function ImportLeadsButton({ onDone }: { onDone?: () => void }) {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapped, setMapped] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const read = async (file: File) => {
    const text = await file.text();
    const data = parseCsv(text);
    if (data.length < 2) return toast.error("A planilha precisa de um cabeçalho e ao menos uma linha.");
    const header = data[0].map(norm);
    const index: Record<string, number> = {};
    for (const c of COLUMNS) {
      const i = header.findIndex((h) => c.match.includes(h));
      if (i >= 0) index[c.key] = i;
    }
    if (index.name == null) return toast.error("Não encontrei a coluna de nome. Use o modelo para ver o formato.");
    const list = data
      .slice(1)
      .map((r) => Object.fromEntries(Object.entries(index).map(([k, i]) => [k, (r[i] ?? "").trim()])))
      .filter((r) => r.name);
    setFileName(file.name);
    setMapped(Object.keys(index));
    setRows(list);
  };

  const importAll = async () => {
    setBusy(true);
    const payload = rows.map((r) => ({
      name: r.name.slice(0, 120),
      phone: r.phone || null,
      email: r.email?.toLowerCase() || null,
      city: r.city || null,
      state: r.state ? r.state.slice(0, 2).toUpperCase() : null,
      source: (r.source || "Importação").slice(0, 40),
      avg_bill: r.avg_bill ? parseMoney(r.avg_bill) : null,
      segment: SEGMENT_WORDS.find(([re]) => re.test(r.segment ?? ""))?.[1] ?? "solar",
      notes: r.notes || null,
      owner_id: user.id,
    }));
    let ok = 0;
    for (let i = 0; i < payload.length; i += 200) {
      const { error } = await supabase().from("leads").insert(payload.slice(i, i + 200));
      if (error) {
        setBusy(false);
        return toast.error(`Parou na linha ${i + 2}: ${error.message}`);
      }
      ok += Math.min(200, payload.length - i);
    }
    setBusy(false);
    toast.success(`${ok} ${ok === 1 ? "lead importado" : "leads importados"} para o funil`);
    setOpen(false);
    setRows([]);
    onDone?.();
  };

  const template = () =>
    downloadCsv(
      "modelo-importacao-leads.csv",
      COLUMNS.map((c) => c.label),
      [["Maria Oliveira", "(82) 99999-0000", "maria@email.com", "Maceió", "AL", "Instagram", "650", "Energia solar", "Quer instalar até dezembro"]],
    );

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} title="Importar leads de uma planilha (CSV)">
        <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Importar</span>
      </Button>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Importar leads"
        subtitle="Traga os contatos de uma planilha do Excel ou do Google Planilhas (salve como CSV)."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={importAll} disabled={!rows.length} loading={busy}>
              Importar {rows.length ? `${rows.length} ${rows.length === 1 ? "lead" : "leads"}` : ""}
            </Button>
          </>
        }
      >
        <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
        <button
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) read(f);
          }}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50 px-4 py-8 text-center transition hover:border-ink-400"
        >
          <FileSpreadsheet className="h-8 w-8 text-ink-400" />
          <span className="text-sm font-semibold">{fileName || "Toque para escolher ou arraste o arquivo aqui"}</span>
          <span className="text-xs text-ink-500">Colunas reconhecidas: nome, telefone, e-mail, cidade, UF, origem, conta de luz, interesse e observações</span>
        </button>
        <button onClick={template} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-sun-700 hover:underline">
          <Download className="h-3.5 w-3.5" /> Baixar planilha modelo
        </button>

        {rows.length > 0 && (
          <div className="mt-4">
            <p className="text-sm">
              <b>{rows.length}</b> {rows.length === 1 ? "lead encontrado" : "leads encontrados"} · colunas: {mapped.map((k) => COLUMNS.find((c) => c.key === k)?.label).join(", ")}
            </p>
            <div className="mt-2 max-h-56 overflow-auto rounded-xl ring-1 ring-ink-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-ink-50 text-left text-ink-500">
                  <tr>
                    {mapped.slice(0, 4).map((k) => (
                      <th key={k} className="px-3 py-2 font-semibold">
                        {COLUMNS.find((c) => c.key === k)?.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.slice(0, 8).map((r, i) => (
                    <tr key={i}>
                      {mapped.slice(0, 4).map((k) => (
                        <td key={k} className="max-w-[160px] truncate px-3 py-2">
                          {r[k]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 8 && <p className="mt-1 text-xs text-ink-400">e mais {rows.length - 8}…</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
