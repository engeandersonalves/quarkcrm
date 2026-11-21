"use client";

import { BadgeCheck, CalendarDays, Check, Download, Loader2, QrCode, Share2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { brlPlain, dateBr } from "@/lib/br";
import { couponData, type CouponPayment } from "@/lib/moto-coupon";
import { motoPhoto, vehicleName, warrantyEnd, type MotoData } from "@/lib/moto-sale";
import { COUPON_W, SaleCoupon, couponQr, downloadCoupon, shareCoupon } from "@/components/mobilidade/sale-coupon";
import type { SaleCompany } from "@/components/mobilidade/sale-docs";

/**
 * Aba "Minha compra" da área do cliente: resumo da compra em destaque e o cupom de venda
 * apresentado como um documento premium, pronto para baixar ou enviar.
 */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const GOLD = "linear-gradient(135deg,#F3E3A6 0%,#D9B85C 45%,#B8913A 100%)";
const money = (v: number) => brlPlain(v);

export function PurchaseTab({ d, id, company, payments }: { d: MotoData; id: string; company: SaleCompany; payments: CouponPayment[] }) {
  const x = useMemo(() => couponData(d, id, payments), [d, id, payments]);
  const [qr, setQr] = useState("");
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState<"pdf" | "share" | null>(null);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanShare(typeof navigator.canShare === "function");
    let live = true;
    void couponQr(d, company, id).then((u) => live && setQr(u));
    return () => {
      live = false;
    };
  }, [d, company, id]);

  const run = async (kind: "pdf" | "share") => {
    setBusy(kind);
    setErr(null);
    try {
      if (kind === "pdf") await downloadCoupon(d, company, id, payments);
      else await shareCoupon(d, company, id, payments);
      setDone(true);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setErr("Não foi possível gerar o PDF agora. Tente de novo em instantes.");
    } finally {
      setBusy(null);
    }
  };

  const model = vehicleName(d).replace(/^Scooter elétrica\s*/, "") || "Scooter";
  const end = d.delivery.date ? warrantyEnd(d) : "";
  const progress = x.paidSoFar != null && x.total > 0 ? Math.min(100, Math.round((x.paidSoFar / x.total) * 100)) : null;
  const settled = x.paidSoFar != null && (x.open ?? 0) <= 0;

  return (
    <div className="mx-auto mt-5 grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-start">
      {/* resumo */}
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 lg:sticky lg:top-20">
        <section className="qp-up relative overflow-hidden rounded-[32px] bg-[#0B1A12] p-6 text-white sm:p-7">
          <div className="absolute -top-28 -right-24 h-80 w-80 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(217,184,92,0.32), rgba(217,184,92,0))" }} />
          <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(79,195,138,0.30), rgba(79,195,138,0))" }} />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold tracking-[0.24em] text-[#E8D48A] uppercase">Sua compra</p>
              <span className="rounded-full bg-white/[0.08] px-3 py-1 text-[12px] font-bold tracking-[0.06em] text-white/80 tabular-nums ring-1 ring-white/10">{x.number}</span>
            </div>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[28px] leading-[1.02] font-bold tracking-[-0.04em] break-words sm:text-[40px]">{model}</h2>
                <p className="mt-1.5 text-[14px] text-white/60">{[d.color, d.year && `ano ${d.year}`].filter(Boolean).join(" · ")}</p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={motoPhoto(d)} alt="" className="qp-float -mb-2 h-20 w-auto max-w-[45%] shrink-0 object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.5)] sm:h-28" />
            </div>

            <div className="mt-6">
              <p className="text-[12px] font-semibold tracking-[0.08em] text-white/50 uppercase">Valor da compra</p>
              <p className="mt-0.5 text-[38px] leading-none font-bold tracking-[-0.04em] tabular-nums" style={{ background: GOLD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                {money(x.total)}
              </p>
              <p className="mt-1.5 text-[13px] text-white/55">{x.pay.length > 1 ? `${x.pay.length} formas de pagamento` : x.pay[0] ? [x.pay[0].label, x.pay[0].detail].filter(Boolean).join(" · ") : ""}</p>
            </div>

            {progress != null && (
              <div className="mt-5 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-1.5 font-semibold">
                    {settled ? <Check className="h-4 w-4 text-[#9FDB7C]" strokeWidth={3} /> : null}
                    {settled ? "Compra quitada" : `Pago ${money(x.paidSoFar ?? 0)}`}
                  </span>
                  {!settled && <span className="text-white/60">falta {money(x.open ?? 0)}</span>}
                </div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${progress}%`, background: settled ? "linear-gradient(90deg,#4FC38A,#9FDB7C)" : GOLD }} />
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                [CalendarDays, "Compra", dateBr(d.date)],
                [ShieldCheck, end ? "Garantia até" : "Garantia", end ? dateBr(end) : `${d.warrantyDays} dias`],
                [BadgeCheck, "Chassi", d.chassis.trim().toUpperCase() || "—"],
              ].map(([I, k, v]) => {
                const Icon = I as typeof CalendarDays;
                return (
                  <div key={k as string} className="min-w-0 rounded-2xl bg-white/[0.05] px-3 py-2.5 ring-1 ring-white/[0.08]">
                    <Icon className="h-4 w-4 text-[#E8D48A]" />
                    <p className="mt-1.5 text-[11px] text-white/50">{k as string}</p>
                    <p className="text-[12.5px] leading-tight font-semibold break-all tabular-nums">{v as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="hidden gap-2 lg:grid">
          <Actions busy={busy} done={done} canShare={canShare} run={run} />
          <Hint />
        </div>
      </div>

      {/* cupom */}
      <div className="grid min-w-0 gap-4">
        <section className="qp-up relative overflow-hidden rounded-[32px] px-3 pt-8 pb-7 [animation-delay:.08s] sm:px-6" style={{ background: "linear-gradient(160deg,#F3EEDD 0%,#E9F0E2 55%,#DCEBDD 100%)" }}>
          <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: GOLD }} />
          <p className="mb-4 text-center text-[11px] font-bold tracking-[0.24em] text-[#0B1A12]/45 uppercase">Cupom de venda</p>
          <div className="relative mx-auto" style={{ maxWidth: COUPON_W }}>
            <div className="[transform:rotate(-0.6deg)]">
              <SaleCoupon d={d} c={company} id={id} payments={payments} qr={qr} origin={origin || "quark"} />
            </div>
            <span className="qp-pop absolute -top-4 -right-2 grid h-[74px] w-[74px] rotate-[10deg] place-items-center rounded-full text-center shadow-[0_12px_24px_-10px_rgba(120,90,20,0.7)] [animation-delay:.5s] sm:-right-5" style={{ background: GOLD }}>
              <span className="grid h-[62px] w-[62px] place-items-center rounded-full border border-dashed border-[#5A4210]/40">
                <span className="leading-none text-[#3D2C08]">
                  <ShieldCheck className="mx-auto h-5 w-5" strokeWidth={2.2} />
                  <span className="mt-0.5 block text-[8.5px] font-extrabold tracking-[0.12em] uppercase">Original</span>
                  <span className="block text-[7.5px] font-bold tracking-[0.1em] uppercase opacity-70">Quark</span>
                </span>
              </span>
            </span>
          </div>
        </section>
        <div className="grid gap-2 lg:hidden">
          <Actions busy={busy} done={done} canShare={canShare} run={run} />
          <Hint />
        </div>
        <div aria-live="polite">{err && <p className="rounded-2xl bg-[#FDECEA] px-4 py-3 text-center text-[13px] text-[#A12A17]">{err}</p>}</div>
      </div>
    </div>
  );
}

function Actions({ busy, done, canShare, run }: { busy: "pdf" | "share" | null; done: boolean; canShare: boolean; run: (k: "pdf" | "share") => void }) {
  return (
    <div className={cx("grid gap-2", canShare && "grid-cols-2")}>
      <button type="button" disabled={!!busy} onClick={() => run("pdf")} className="flex h-14 items-center justify-center gap-2 rounded-full bg-[#0B1A12] text-[15px] font-bold text-[#E8D48A] shadow-[0_14px_30px_-16px_rgba(11,26,18,0.8)] transition active:scale-[0.98] disabled:opacity-60">
        {busy === "pdf" ? <Loader2 className="h-5 w-5 animate-spin" /> : done ? <Check className="h-5 w-5" strokeWidth={3} /> : <Download className="h-5 w-5" />} Baixar PDF
      </button>
      {canShare && (
        <button type="button" disabled={!!busy} onClick={() => run("share")} className="flex h-14 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-bold text-[#0B1A12] ring-1 ring-[#0B1A12]/10 transition active:scale-[0.98] disabled:opacity-60">
          {busy === "share" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />} Enviar
        </button>
      )}
    </div>
  );
}

function Hint() {
  return (
    <p className="flex items-start gap-2.5 rounded-2xl bg-white/70 px-4 py-3 text-[12.5px] leading-snug text-[#0B1A12]/60 ring-1 ring-[#0B1A12]/[0.06]">
      <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-[#1F9D55]" />
      Qualquer pessoa pode conferir se o cupom é original: é só apontar a câmera para o QR code. Ele abre a página oficial de verificação da Quark.
    </p>
  );
}
