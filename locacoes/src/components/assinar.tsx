"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Eraser, Loader2, MapPin, PenLine, RefreshCcw, UserRound } from "lucide-react";
import { fmtDocumento, soDigitos } from "@/lib/format";
import { hashTermo } from "@/lib/publico";
import type { TermoCongelado } from "@/lib/types";
import { Button, cx, Field, Input } from "./ui";

/* ------------------------------------------------------------------ Assinatura desenhada */

function PadAssinatura({ onChange }: { onChange: (png: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);
  const [vazio, setVazio] = useState(true);

  const preparar = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0d0b2b";
    ctx.lineWidth = 2.4;
    setVazio(true);
    onChange(null);
  }, [onChange]);

  useEffect(() => {
    preparar();
  }, [preparar]);

  const ponto = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-ink-300">
        <canvas
          ref={canvas}
          className="block h-44 w-full touch-none"
          aria-label="Área para assinar com o dedo"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            desenhando.current = true;
            ultimo.current = ponto(e);
          }}
          onPointerMove={(e) => {
            if (!desenhando.current || !ultimo.current) return;
            const p = ponto(e);
            const ctx = canvas.current!.getContext("2d")!;
            ctx.beginPath();
            ctx.moveTo(ultimo.current.x, ultimo.current.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            ultimo.current = p;
            if (vazio) setVazio(false);
          }}
          onPointerUp={() => {
            desenhando.current = false;
            ultimo.current = null;
            if (!vazio) onChange(canvas.current!.toDataURL("image/png"));
          }}
        />
        {vazio && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-ink-400">Assine aqui com o dedo</p>}
        <div className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-dashed border-ink-300" />
      </div>
      <button type="button" onClick={preparar} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 hover:text-ink-900">
        <Eraser className="h-4 w-4" /> Limpar e assinar de novo
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ Selfie */

/** Recorta ao centro, reduz e comprime (selfie leve para enviar pelo celular). */
function reduzir(fonte: CanvasImageSource, w: number, h: number, espelhar: boolean): string {
  const lado = Math.min(w, h);
  const c = document.createElement("canvas");
  c.width = c.height = 480;
  const ctx = c.getContext("2d")!;
  if (espelhar) {
    ctx.translate(480, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(fonte, (w - lado) / 2, (h - lado) / 2, lado, lado, 0, 0, 480, 480);
  return c.toDataURL("image/jpeg", 0.72);
}

function Selfie({ valor, onChange }: { valor: string | null; onChange: (jpg: string | null) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<"off" | "abrindo" | "on" | "erro">("off");
  const arquivo = useRef<HTMLInputElement>(null);

  const parar = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => parar, []);

  async function abrir() {
    onChange(null);
    if (!navigator.mediaDevices?.getUserMedia) return arquivo.current?.click();
    setCamera("abrindo");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } }, audio: false });
      setCamera("on");
      requestAnimationFrame(() => {
        if (video.current && stream.current) {
          video.current.srcObject = stream.current;
          void video.current.play();
        }
      });
    } catch {
      setCamera("erro");
    }
  }

  function tirar() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    onChange(reduzir(v, v.videoWidth, v.videoHeight, true));
    parar();
    setCamera("off");
  }

  function doArquivo(f?: File | null) {
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      onChange(reduzir(img, img.naturalWidth, img.naturalHeight, false));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative grid h-56 w-56 place-items-center overflow-hidden rounded-full bg-ink-100 ring-4 ring-white shadow-lift">
        {valor ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={valor} alt="Sua selfie" className="h-full w-full object-cover" />
        ) : camera === "on" ? (
          <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        ) : camera === "abrindo" ? (
          <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
        ) : (
          <UserRound className="h-20 w-20 text-ink-300" />
        )}
        {camera === "on" && <div className="pointer-events-none absolute inset-6 rounded-full border-2 border-dashed border-white/70" />}
      </div>
      {camera === "erro" && <p className="max-w-xs text-center text-[13px] text-rose-600">Não conseguimos abrir a câmera. Permita o acesso à câmera ou use o botão abaixo para tirar a foto.</p>}
      <div className="flex flex-wrap justify-center gap-2">
        {camera === "on" ? (
          <Button type="button" variant="brand" size="lg" onClick={tirar}>
            <Camera className="h-5 w-5" /> Tirar selfie
          </Button>
        ) : valor ? (
          <Button type="button" variant="secondary" onClick={abrir}>
            <RefreshCcw className="h-4 w-4" /> Tirar outra
          </Button>
        ) : (
          <Button type="button" variant="brand" size="lg" onClick={abrir}>
            <Camera className="h-5 w-5" /> Abrir câmera
          </Button>
        )}
        {(camera === "erro" || camera === "off") && !valor && (
          <Button type="button" variant="ghost" onClick={() => arquivo.current?.click()}>
            Usar a câmera do celular
          </Button>
        )}
      </div>
      <input ref={arquivo} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => doArquivo(e.target.files?.[0])} />
    </div>
  );
}

/* ------------------------------------------------------------------ Fluxo completo */

export interface DadosAssinatura {
  nome: string;
  documento: string;
  imagem: string;
  selfie: string;
  hash: string;
  geo: string;
}

const PASSOS = [
  { id: "dados", nome: "Seus dados", icon: UserRound },
  { id: "assinatura", nome: "Assinatura", icon: PenLine },
  { id: "selfie", nome: "Selfie", icon: Camera },
] as const;

/**
 * Coleta nome/CPF, assinatura desenhada e selfie. O botão final só libera com tudo preenchido
 * e com o "li e concordo". Usado no link do cliente e na assinatura presencial.
 */
export function FluxoAssinatura({
  termo,
  nomeInicial,
  documentoInicial,
  onConcluir,
  textoBotao = "Assinar termo",
}: {
  termo: TermoCongelado;
  nomeInicial: string;
  documentoInicial: string;
  onConcluir: (d: DadosAssinatura) => Promise<void>;
  textoBotao?: string;
}) {
  const [passo, setPasso] = useState(0);
  const [nome, setNome] = useState(nomeInicial);
  const [documento, setDocumento] = useState(documentoInicial);
  const [imagem, setImagem] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [concordo, setConcordo] = useState(false);
  const [local, setLocal] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const dadosOk = nome.trim().split(/\s+/).length >= 2 && [11, 14].includes(soDigitos(documento).length);
  const pronto = dadosOk && imagem && selfie && concordo;

  async function localizacao(): Promise<string> {
    if (!local || !navigator.geolocation) return "";
    return new Promise((ok) => {
      navigator.geolocation.getCurrentPosition(
        (p) => ok(`${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`),
        () => ok(""),
        { timeout: 6000, maximumAge: 60000 },
      );
    });
  }

  async function concluir() {
    if (!pronto) return;
    setErro("");
    setEnviando(true);
    try {
      const [hash, geo] = await Promise.all([hashTermo(termo), localizacao()]);
      await onConcluir({ nome: nome.trim(), documento: fmtDocumento(documento), imagem: imagem!, selfie: selfie!, hash, geo });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-5">
      {/* Passos */}
      <ol className="grid grid-cols-3 gap-2">
        {PASSOS.map((p, i) => {
          const feito = (i === 0 && dadosOk) || (i === 1 && imagem) || (i === 2 && selfie);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setPasso(i)}
                className={cx(
                  "flex w-full flex-col items-center gap-1.5 rounded-2xl px-2 py-2.5 text-[12px] font-semibold ring-1 transition",
                  passo === i ? "bg-ink-900 text-white ring-ink-900" : feito ? "bg-brand-50 text-brand-800 ring-brand-200" : "bg-white text-ink-500 ring-ink-200",
                )}
              >
                <span className={cx("grid h-7 w-7 place-items-center rounded-full", passo === i ? "bg-white/10 text-brand-300" : feito ? "bg-brand-500 text-white" : "bg-ink-100")}>
                  {feito && passo !== i ? <Check className="h-4 w-4" strokeWidth={3} /> : <p.icon className="h-4 w-4" />}
                </span>
                {p.nome}
              </button>
            </li>
          );
        })}
      </ol>

      {passo === 0 && (
        <div className="grid gap-4">
          <Field label="Nome completo">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" placeholder="Como no documento" />
          </Field>
          <Field label="CPF ou CNPJ">
            <Input inputMode="numeric" value={documento} onChange={(e) => setDocumento(e.target.value)} onBlur={(e) => setDocumento(fmtDocumento(e.target.value))} placeholder="000.000.000-00" />
          </Field>
          {!dadosOk && (nome || documento) && <p className="text-[12.5px] text-ink-500">Informe nome e sobrenome e um CPF (11 números) ou CNPJ (14 números).</p>}
          <Button type="button" size="lg" disabled={!dadosOk} onClick={() => setPasso(1)}>
            Continuar
          </Button>
        </div>
      )}

      {passo === 1 && (
        <div className="grid gap-4">
          <PadAssinatura onChange={setImagem} />
          <Button type="button" size="lg" disabled={!imagem} onClick={() => setPasso(2)}>
            Continuar
          </Button>
        </div>
      )}

      {passo === 2 && (
        <div className="grid gap-5">
          <p className="text-center text-[13.5px] text-ink-600">Uma foto do rosto confirma que foi você quem assinou. Tire em um lugar iluminado, sem boné ou óculos escuros.</p>
          <Selfie valor={selfie} onChange={setSelfie} />
        </div>
      )}

      {/* Confirmação final */}
      <div className="grid gap-3 rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-200">
        <label className="flex cursor-pointer items-start gap-3 text-[13.5px] text-ink-700">
          <input type="checkbox" checked={concordo} onChange={(e) => setConcordo(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600" />
          Li o termo de locação e concordo com todas as condições.
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-[13px] text-ink-500">
          <input type="checkbox" checked={local} onChange={(e) => setLocal(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600" />
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> Registrar minha localização junto com a assinatura (opcional)
          </span>
        </label>
        {erro && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-rose-200">{erro}</p>}
        <Button type="button" variant="brand" size="lg" disabled={!pronto} loading={enviando} onClick={concluir}>
          <Check className="h-5 w-5" /> {textoBotao}
        </Button>
        {!pronto && (
          <p className="text-center text-[12px] text-ink-500">
            Falta: {[!dadosOk && "seus dados", !imagem && "assinatura", !selfie && "selfie", !concordo && "marcar “li e concordo”"].filter(Boolean).join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
