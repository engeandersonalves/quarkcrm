"use client";

import {
  Copy,
  ExternalLink,
  Gift,
  HeartHandshake,
  MessageCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { toStoredSettings } from "@/lib/defaults";
import { whatsappUrl } from "@/lib/format";
import {
  DEFAULT_REFERRAL,
  rewardLabel,
  rewardSuffix,
  sanitizeReferral,
  type ReferralReward,
} from "@/lib/referral";
import { supabase } from "@/lib/supabase/client";
import { Button, Input, Modal, cx } from "../ui";
import { useApp } from "./app-context";

/** Link da tela de indicação com o vendedor embutido: cada indicação vira lead dele (origem "Indicação"). */
export function indicacaoUrl(seller?: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/indique${seller ? `?v=${seller}` : ""}`;
}

export function IndicacaoLinkButton() {
  const { user, settings, profile } = useApp();
  const [open, setOpen] = useState(false);
  const url = indicacaoUrl(user.id);
  const me = (profile?.full_name ?? "").split(" ")[0];
  const company = settings.company_name || "Quark Energia";
  const current = sanitizeReferral(settings.referral ?? DEFAULT_REFERRAL);
  const prize = rewardLabel(current);
  const message = `Oi! ${me ? `Aqui é ${me}, da ${company}. ` : ""}Conhece alguém que paga caro na conta de luz? 🌞\n\nIndica pra gente por aqui, leva 1 minuto: ${url}${prize ? `\n\n🎁 Você ganha ${prize}${rewardSuffix(current) ? ` ${rewardSuffix(current)}` : ""} ${current.note ?? ""}`.trimEnd() : ""}\n\nFazemos o estudo de energia solar sem custo e cuidamos de tudo. Obrigado pela confiança! 💚`;
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        title="Link para amigos e clientes indicarem novos clientes"
      >
        <HeartHandshake className="h-4 w-4" />{" "}
        <span className="hidden sm:inline">Indicação</span>
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Indique um amigo"
        subtitle="Envie para amigos e clientes: eles informam o nome deles e os dados de quem estão indicando, e a indicação cai no funil como seu lead."
      >
        <div className="rounded-2xl bg-ink-950 p-4 text-white">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-brand-lime uppercase">
            Seu link de indicação
          </p>
          <p className="mt-1 font-mono text-[13px] break-all text-white/80">
            {url}
          </p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <a
            href={whatsappUrl("", message)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(url).catch(() => {});
              toast.success(
                "Link copiado: cole no status, no grupo ou no direct",
              );
            }}
          >
            <Copy className="h-4 w-4" /> Copiar link
          </Button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50"
          >
            <ExternalLink className="h-4 w-4" /> Ver como cliente
          </a>
        </div>
        <RewardEditor current={current} canEdit={profile?.role === "admin"} />
        <ul className="mt-4 grid gap-1.5 text-[13px] text-ink-600">
          <li>
            • A pessoa preenche: nome dela, nome e WhatsApp do indicado, tipo de
            telhado, consumo médio, local de instalação e informações
            adicionais.
          </li>
          <li>
            • O lead entra com origem “Indicação”, e quem indicou fica nas
            observações. Você recebe o aviso de novo lead.
          </li>
        </ul>
      </Modal>
    </>
  );
}

/** Recompensa no topo da tela de indicação: sem recompensa, % do projeto ou valor fixo em R$. */
function RewardEditor({
  current,
  canEdit,
}: {
  current: ReferralReward;
  canEdit: boolean;
}) {
  const { settings } = useApp();
  const [kind, setKind] = useState<ReferralReward["kind"]>(current.kind);
  const [value, setValue] = useState(
    current.value ? String(current.value).replace(".", ",") : "",
  );
  const [note, setNote] = useState(current.note ?? DEFAULT_REFERRAL.note ?? "");
  const [saving, setSaving] = useState(false);
  const draft = sanitizeReferral({ kind, value, note });
  const label = rewardLabel(draft);
  const save = async () => {
    if (kind !== "none" && !label)
      return toast.error(
        kind === "percent"
          ? "Digite a porcentagem (ex.: 2)."
          : "Digite o valor em reais (ex.: 300).",
      );
    setSaving(true);
    const { error } = await supabase()
      .from("settings")
      .upsert({
        id: 1,
        data: toStoredSettings({ ...settings, referral: draft }),
      });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(
      label
        ? `Recompensa de ${label} no topo da tela de indicação`
        : "Recompensa removida da tela de indicação",
    );
  };
  return (
    <div className="mt-4 rounded-2xl p-4 ring-1 ring-ink-200">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Gift className="h-4 w-4" /> Recompensa no topo da tela
      </p>
      {canEdit ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1">
            {(
              [
                ["none", "Sem recompensa"],
                ["percent", "% do projeto"],
                ["fixed", "Valor em R$"],
              ] as const
            ).map(([k, t]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cx(
                  "h-9 rounded-lg text-[13px] font-semibold transition",
                  kind === k
                    ? "bg-white text-ink-900 shadow-sm dark:bg-white/15 dark:text-white"
                    : "text-ink-500",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          {kind !== "none" && (
            <div className="mt-3 grid gap-2 sm:grid-cols-[150px_1fr]">
              <div className="relative">
                {kind === "fixed" && (
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-400">
                    R$
                  </span>
                )}
                <Input
                  inputMode="decimal"
                  value={value}
                  onChange={(e) =>
                    setValue(
                      e.target.value.replace(/[^\d,.]/g, "").slice(0, 10),
                    )
                  }
                  placeholder={kind === "percent" ? "2" : "300"}
                  className={kind === "fixed" ? "pl-9" : "pr-8"}
                />
                {kind === "percent" && (
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-400">
                    %
                  </span>
                )}
              </div>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 80))}
                placeholder="por indicação que fechar contrato"
              />
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-ink-500">
              {label ? (
                <>
                  Aparece:{" "}
                  <b className="text-ink-900 dark:text-white">Ganhe {label}</b>{" "}
                  {rewardSuffix(draft)} {draft.note}
                </>
              ) : (
                "A tela mostra só “Você indica, a gente agradece”."
              )}
            </p>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-1 text-[13px] text-ink-500">
          {rewardLabel(current)
            ? `Ganhe ${rewardLabel(current)} ${rewardSuffix(current)} ${current.note ?? ""}`
            : "Sem recompensa definida. Só o administrador altera."}
        </p>
      )}
    </div>
  );
}
