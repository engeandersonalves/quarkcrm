"use client";

import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { parseCsv } from "@/lib/csv";
import { parseGenerationRows, type SheetResult } from "@/lib/monitoring/sheet";
import { fmtKwh } from "@/lib/monitoring/view";
import { Button, Modal } from "../ui";

/** Importa a geração diária de uma usina a partir do Excel/CSV exportado do portal do fabricante. */
export function ImportModal({ plantId, open, onClose, onDone }: { plantId: string; open: boolean; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<SheetResult | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const read = async (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setError("");
    setResult(null);
    setReading(true);
    try {
      let table: string[][];
      if (/\.xlsx$/i.test(f.name)) {
        const { readXlsx } = await import("@/lib/xlsx-lite");
        table = await readXlsx(f);
      } else if (/\.xls$/i.test(f.name)) {
        throw new Error("Arquivo .xls antigo: abra no Excel e salve como .xlsx ou .csv.");
      } else {
        table = parseCsv(await f.text());
      }
      const r = parseGenerationRows(table);
      if (!r.rows.length) throw new Error("Não encontrei colunas de data e de energia (kWh) nesta planilha.");
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setReading(false);
    }
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    const res = await fetch("/api/monitoring/manual/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plantId, rows: result.rows }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setSaving(false);
    if (!res?.ok) return setError(json.error ?? "Falha ao importar.");
    toast.success(`${json.imported} dias de geração importados`);
    setFile(null);
    setResult(null);
    onDone();
    onClose();
  };

  const total = result?.rows.reduce((t, r) => t + r.kwh, 0) ?? 0;

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="Importar planilha de geração"
      subtitle="Excel (.xlsx) ou CSV exportado do portal do fabricante"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!result || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Importar {result ? `${result.rows.length} dias` : ""}
          </Button>
        </>
      }
    >
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 px-4 py-8 text-center transition hover:border-sun-400">
        <input type="file" accept=".xlsx,.csv,.txt,.xls" className="hidden" onChange={(e) => read(e.target.files?.[0])} />
        {reading ? <Loader2 className="h-7 w-7 animate-spin text-sun-600" /> : <FileSpreadsheet className="h-7 w-7 text-sun-600" />}
        <span className="text-sm font-semibold text-ink-900">{file ? file.name : "Escolher arquivo"}</span>
        <span className="text-xs text-ink-500">Uma linha por dia, com a data e a energia gerada. Linhas de total são ignoradas.</span>
      </label>

      {error && <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

      {result && (
        <div className="mt-4 grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { k: "Dias", v: String(result.rows.length) },
              { k: "Período", v: `${result.rows[0].day.split("-").reverse().join("/")} a ${result.rows[result.rows.length - 1].day.split("-").reverse().join("/")}` },
              { k: "Total", v: fmtKwh(total) },
            ].map((x) => (
              <div key={x.k} className="rounded-xl bg-ink-50 px-3 py-2.5 ring-1 ring-ink-200/60 dark:bg-white/[0.03]">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-ink-500 uppercase">{x.k}</p>
                <p className="mt-0.5 text-sm font-semibold text-ink-900">{x.v}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-500">
            Colunas usadas: <b className="text-ink-700">{result.dateHeader || "data"}</b> e <b className="text-ink-700">{result.valueHeader || "energia"}</b> ({result.unit}
            {result.unit !== "kWh" ? " → convertido para kWh" : ""}){result.skipped ? ` · ${result.skipped} linhas ignoradas` : ""}. Dias já importados são atualizados.
          </p>
          <div className="max-h-44 overflow-y-auto rounded-xl ring-1 ring-ink-200/70">
            <table className="w-full text-sm">
              <tbody>
                {result.rows.slice(-31).map((r) => (
                  <tr key={r.day} className="border-b border-ink-100 last:border-0">
                    <td className="px-3 py-1.5 text-ink-600">{r.day.split("-").reverse().join("/")}</td>
                    <td className="tnum px-3 py-1.5 text-right font-medium text-ink-900">{fmtKwh(r.kwh)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
