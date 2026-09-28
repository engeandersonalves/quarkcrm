"use client";

import { Camera, Check, ChevronRight, Copy, Download, Flame, Loader2, Megaphone, MessageCircle, Rocket, Share2, Sparkles, Target, UserRoundSearch, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CHARACTERS, CharacterArt, DEFAULT_CHARACTER, characterOf, presetId } from "../avatars";
import { POSTERS, posterAvatar, posterOfAvatar, posterUrl } from "@/lib/cinema";
import { renderCopy } from "@/lib/cadence";
import { levelOf } from "@/lib/gamification";
import { pickDaily, quotePool } from "@/lib/inspiration";
import { formatOf } from "@/lib/marketing";
import { whatsappUrl } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/upload";
import type { Lead } from "@/lib/types";
import { useApp } from "./app-context";
import { useReward } from "./rewards";
import { cx } from "../ui";

const today = () => new Date().toISOString().slice(0, 10);
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* navegação privada */
    }
  },
};

/* ------------------------------------------------------------ foto de perfil */

export function AvatarPicker({ open, onClose, firstTime = false }: { open: boolean; onClose: () => void; firstTime?: boolean }) {
  const { user, profile } = useApp();
  const current = profile?.avatar_url ?? null;
  const [choice, setChoice] = useState<string>(current ?? posterAvatar("wall-street"));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<"cinema" | "personagens">("cinema");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setChoice(current ?? posterAvatar("wall-street"));
    setTab(presetId(current) ? "personagens" : "cinema");
  }, [open, current]);

  if (!open) return null;
  const first = (profile?.full_name ?? "").split(" ")[0];
  const selected = characterOf(presetId(choice));
  const poster = posterOfAvatar(choice);

  const save = async (value = choice) => {
    setSaving(true);
    const { error } = await supabase().from("profiles").update({ avatar_url: value }).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(/avatar_url/.test(error.message) ? "Rode novamente o supabase/schema.sql para liberar a foto de perfil." : error.message);
      return;
    }
    toast.success(selected && presetId(value) ? `Agora você é ${selected.name}. ${selected.line}` : poster ? `Modo ${poster.title} ativado. 🎬` : "Foto atualizada. Ficou show!");
    onClose();
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file, "avatars");
      setChoice(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a foto");
    }
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Foto de perfil">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-md" onClick={() => !firstTime && onClose()} />
      <div className="animate-sheet-up relative max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-t-[32px] bg-[#0E0A1C] text-white shadow-2xl ring-1 ring-white/10 sm:rounded-[32px]">
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[#5B34D6]/40 blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-[#9BD373]/20 blur-[90px]" />
        <div className="relative p-6 sm:p-8">
          <button onClick={onClose} className="absolute top-4 right-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/70 hover:bg-white/20" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#9BD373] uppercase">{firstTime ? "Primeiro passo" : "Seu personagem"}</p>
          <h2 className="mt-2 font-display text-[28px] leading-tight font-semibold">{firstTime ? `${first ? `${first}, q` : "Q"}uem vai dominar o mercado hoje?` : "Escolha sua foto de perfil"}</h2>
          <p className="mt-1 text-sm text-white/60">Envie sua foto ou escolha um personagem. Ele aparece no ranking da Arena e para toda a equipe.</p>

          <div className="mt-6 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            {/* Prévia grande */}
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#F3EA3B] to-[#9BD373] blur-xl opacity-50" />
              <div className="relative h-36 w-36 overflow-hidden rounded-full ring-4 ring-[#F3EA3B]">
                {presetId(choice) ? (
                  <CharacterArt id={presetId(choice)!} className="h-full w-full" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={choice} alt="Sua foto" className="h-full w-full object-cover" />
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -right-1 bottom-1 grid h-11 w-11 place-items-center rounded-full bg-[#F3EA3B] text-[#1C1234] shadow-lg ring-4 ring-[#0E0A1C] transition active:scale-90"
                aria-label="Enviar foto"
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </div>
            <div className="text-center sm:pt-6 sm:text-left">
              <p className="font-display text-xl font-semibold">{selected ? selected.name : poster ? poster.title : "Sua foto"}</p>
              <p className="font-serif text-[15px] text-white/70 italic">“{selected ? selected.line : poster ? poster.tag : "Quem é visto, é lembrado."}”</p>
              <button onClick={() => fileRef.current?.click()} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold ring-1 ring-white/15 hover:bg-white/15">
                <Camera className="h-3.5 w-3.5" /> Usar minha foto
              </button>
            </div>
          </div>

          <div className="mt-6 flex gap-1 rounded-2xl bg-white/[0.06] p-1 ring-1 ring-white/10" role="tablist">
            {(
              [
                ["cinema", "🎬 Cinema"],
                ["personagens", "✨ Personagens"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cx("h-10 flex-1 rounded-xl text-sm font-semibold transition", tab === k ? "bg-white text-[#1C1234]" : "text-white/60 hover:text-white")}
              >
                {l}
              </button>
            ))}
          </div>

          {tab === "cinema" ? (
            <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3">
              {POSTERS.map((p) => {
                const on = choice === posterAvatar(p.id);
                return (
                  <button key={p.id} onClick={() => setChoice(posterAvatar(p.id))} className="group text-left" aria-pressed={on} aria-label={p.title}>
                    <span className={cx("relative block aspect-[4/5] overflow-hidden rounded-2xl ring-2 transition", on ? "scale-[1.03] ring-[#F3EA3B]" : "ring-white/10 group-hover:ring-white/30")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={posterUrl(p.id)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      {on && (
                        <span className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#F3EA3B] text-[#1C1234]">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-4 gap-2.5 sm:gap-3">
            {CHARACTERS.map((c) => {
              const on = choice === `preset:${c.id}`;
              return (
                <button key={c.id} onClick={() => setChoice(`preset:${c.id}`)} className="group flex flex-col items-center gap-1.5" aria-pressed={on}>
                  <span className={cx("relative block aspect-square w-full overflow-hidden rounded-[22px] ring-2 transition", on ? "scale-[1.03] ring-[#F3EA3B]" : "ring-white/10 group-hover:ring-white/30")}>
                    <CharacterArt id={c.id} className="h-full w-full" />
                    {on && (
                      <span className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#F3EA3B] text-[#1C1234]">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className={cx("line-clamp-2 min-h-[2.4em] text-center text-[10.5px] leading-tight font-semibold", on ? "text-white" : "text-white/55")}>{c.name}</span>
                </button>
              );
            })}
          </div>
          )}

          <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {firstTime && (
              <button
                onClick={() => {
                  store.set(`avatar-skip-${user.id}`, today());
                  onClose();
                }}
                className="h-12 rounded-2xl px-5 text-sm font-semibold text-white/55 hover:text-white"
              >
                Depois
              </button>
            )}
            <button
              onClick={() => save()}
              disabled={saving || uploading}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#F3EA3B] px-6 text-[15px] font-bold text-[#1C1234] shadow-[0_14px_36px_-12px_rgba(243,234,59,0.8)] transition active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {firstTime ? "Esse sou eu" : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- plano do dia */

interface Asset {
  id: string;
  title: string;
  url: string;
  kind: string;
  width: number | null;
  height: number | null;
  caption: string | null;
}
type LeadLite = Pick<Lead, "id" | "name" | "phone" | "city" | "segment" | "created_at">;
interface Brief {
  asset: Asset | null;
  lead: LeadLite | null;
  waiting: number;
  referrals: LeadLite[];
  lost: LeadLite[];
  tasksToday: number;
  late: number;
}

const hoursSince = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3600000));
const waitLabel = (iso: string) => {
  const h = hoursSince(iso);
  return h < 1 ? "agora mesmo" : h < 24 ? `há ${h}h` : `há ${Math.round(h / 24)} dia${h >= 48 ? "s" : ""}`;
};

async function fetchBlob(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("download");
  return res.blob();
}

export function DailyBriefing({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile, settings } = useApp();
  const { xp, streak, reward } = useReward();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const doneKey = `missions-${user.id}-${today()}`;

  useEffect(() => {
    if (!open) return;
    try {
      setDone(JSON.parse(store.get(doneKey) ?? "[]"));
    } catch {
      setDone([]);
    }
    const sb = supabase();
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    Promise.all([
      sb.from("marketing_assets").select("id,title,url,kind,width,height,caption").order("created_at", { ascending: false }).limit(60),
      sb.from("leads").select("id,name,phone,city,segment,created_at,owner_id").eq("status", "novo").order("created_at", { ascending: true }).limit(50),
      sb.from("leads").select("id,name,phone,city,segment,created_at").eq("status", "ganho").order("updated_at", { ascending: false }).limit(40),
      sb.from("leads").select("id,name,phone,city,segment,created_at").eq("status", "perdido").lt("updated_at", new Date(Date.now() - 30 * 86400000).toISOString()).limit(40),
      sb.from("tasks").select("id,due_at,assigned_to,created_by").eq("done", false).lte("due_at", end.toISOString()).limit(300),
    ]).then(([assets, novos, won, lost, tasks]) => {
      const list = ((assets.error ? [] : assets.data) ?? []) as Asset[];
      const images = list.filter((a) => a.kind === "image");
      const stories = images.filter((a) => formatOf(a.width, a.height) === "story");
      const mineLead = ((novos.data ?? []) as (LeadLite & { owner_id: string | null })[]).filter((l) => !l.owner_id || l.owner_id === user.id);
      const mineTasks = ((tasks.data ?? []) as { due_at: string; assigned_to: string | null; created_by: string | null }[]).filter(
        (t) => t.assigned_to === user.id || (!t.assigned_to && (t.created_by === user.id || !t.created_by)),
      );
      const wonList = (won.data ?? []) as LeadLite[];
      const offset = new Date().getDate();
      setBrief({
        asset: pickDaily(stories.length ? stories : images) ?? null,
        lead: mineLead[0] ?? null,
        waiting: mineLead.length,
        referrals: wonList.length ? [0, 1, 2].map((i) => wonList[(offset + i) % wonList.length]).filter((l, i, arr) => arr.findIndex((x) => x.id === l.id) === i) : [],
        lost: ((lost.data ?? []) as LeadLite[]).slice(0, 3),
        tasksToday: mineTasks.length,
        late: mineTasks.filter((t) => new Date(t.due_at) < new Date()).length,
      });
    });
  }, [open, user.id, doneKey]);

  const mark = useCallback(
    (id: string) =>
      setDone((d) => {
        if (d.includes(id)) return d;
        const next = [...d, id];
        store.set(doneKey, JSON.stringify(next));
        return next;
      }),
    [doneKey],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const first = (profile?.full_name ?? "").split(" ")[0] || "campeão";
  const me = profile?.full_name ?? "";
  const company = settings.company_name || "Quark Energia";
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const quote = pickDaily(quotePool(settings.app.customQuotes, settings.app.useDefaultQuotes), 3);
  const level = xp != null ? levelOf(xp).level : null;
  const character = characterOf(presetId(profile?.avatar_url));

  const logWhats = async (leadId: string, content: string) => {
    const { data } = await supabase().from("activities").insert({ lead_id: leadId, type: "whatsapp", content, created_by: user.id }).select("id").single();
    reward("followup", (data as { id: string } | null)?.id);
  };

  const postAsset = async (a: Asset, share: boolean) => {
    setBusy(share ? "share" : "down");
    try {
      const blob = await fetchBlob(a.url);
      const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
      const file = new File([blob], `${a.title || "arte"}.${ext}`, { type: blob.type });
      if (share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: a.caption ?? undefined }).catch(() => {});
      else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        if (a.caption) await navigator.clipboard.writeText(a.caption).catch(() => {});
        toast.success(a.caption ? "Arte baixada e legenda copiada. Agora é só postar!" : "Arte baixada. Agora é só postar!");
      }
      mark("post");
    } catch {
      toast.error("Não foi possível baixar a arte");
    }
    setBusy(null);
  };

  const firstContact = brief?.lead
    ? renderCopy(settings.cadence.stages.novo?.[0]?.copy ?? "Olá, {nome}! Aqui é {vendedor}, da {empresa}. Recebi seu interesse em {interesse}. Posso te ajudar?", {
        name: brief.lead.name,
        seller: me,
        company,
        segment: brief.lead.segment,
        city: brief.lead.city,
      })
    : "";
  const referralText = (name: string) =>
    renderCopy("Oi, {nome}! Tudo bem? Aqui é {vendedor}, da {empresa} ☀️ Como está a economia com a energia solar? Se tiver um amigo ou familiar que também quer pagar menos de luz, me passa o contato? Vou cuidar dele como cuidei de você 🙌", {
      name,
      seller: me,
      company,
    });
  const reactivateText = (name: string) =>
    renderCopy("Oi, {nome}! Aqui é {vendedor}, da {empresa}. A tarifa de energia subiu de novo e saíram novas condições de financiamento. Quer que eu refaça a sua simulação, sem compromisso?", { name, seller: me, company });
  const anamneseLink = typeof window !== "undefined" ? `${window.location.origin}/anamnese?v=${user.id}` : "";

  const play = new Date().getDate() % 3; // prospecção muda a cada dia
  const missions: { id: string; ok: boolean }[] = [
    { id: "post", ok: done.includes("post") },
    { id: "lead", ok: done.includes("lead") || (!!brief && !brief.lead) },
    { id: "prospect", ok: done.includes("prospect") },
    { id: "tasks", ok: done.includes("tasks") || (!!brief && brief.tasksToday === 0) },
  ];
  const doneCount = missions.filter((m) => m.ok).length;

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#07060F] text-white" role="dialog" aria-modal="true" aria-label="Plano do dia">
      <div className="pointer-events-none fixed -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-[#5B34D6]/35 blur-[120px]" />
      <div className="pointer-events-none fixed -right-32 -bottom-40 h-[28rem] w-[28rem] rounded-full bg-[#9BD373]/20 blur-[120px]" />
      <div className="relative mx-auto max-w-3xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-32 sm:px-6 sm:pt-10">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-[0.22em] text-[#9BD373] uppercase">Plano do dia</span>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/70 hover:bg-white/20" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cabeçalho com personagem */}
        <div className="mt-5 flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#F3EA3B] to-[#9BD373] opacity-60 blur-lg" />
            <div className="relative h-20 w-20 overflow-hidden rounded-full ring-[3px] ring-[#F3EA3B] sm:h-24 sm:w-24">
              {profile?.avatar_url && !presetId(profile.avatar_url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <CharacterArt id={presetId(profile?.avatar_url) ?? DEFAULT_CHARACTER} className="h-full w-full" />
              )}
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[26px] leading-tight font-semibold sm:text-4xl">
              {greet}, {first}!
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-white/60">
              {level && <span className="font-semibold text-[#F3EA3B]">Nível {level.n} · {level.title}</span>}
              {streak > 0 && (
                <span className="flex items-center gap-1 font-semibold text-[#FFB36B]">
                  <Flame className="h-3.5 w-3.5" /> {streak} {streak === 1 ? "dia" : "dias"} seguidos
                </span>
              )}
              {character && <span>{character.name}</span>}
              <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold text-white sm:hidden">
                {doneCount}/{missions.length} missões
              </span>
            </p>
          </div>
          <MissionRing done={doneCount} total={missions.length} />
        </div>
        {quote && <p className="mt-4 border-l-2 border-[#9BD373]/60 pl-3 font-serif text-[15px] text-white/75 italic">“{quote.text}” <span className="text-xs text-white/40 not-italic">— {quote.author}</span></p>}

        {!brief ? (
          <div className="mt-8 grid gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-[26px] bg-white/[0.05]" />
            ))}
          </div>
        ) : (
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {/* 1. Postar */}
            <Mission
              ok={missions[0].ok}
              icon={<Megaphone className="h-5 w-5" />}
              kicker="Conteúdo"
              title={brief.asset ? "Poste esta arte hoje" : "Monte seu banco de conteúdo"}
              xp="+ presença"
              className="sm:row-span-2"
            >
              {brief.asset ? (
                <>
                  <div className="relative mt-3 overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={brief.asset.url} alt={brief.asset.title} className="mx-auto max-h-44 w-auto object-contain sm:max-h-72" />
                  </div>
                  <p className="mt-2 truncate text-[13px] font-semibold">{brief.asset.title}</p>
                  {brief.asset.caption && <p className="line-clamp-2 text-xs text-white/55">{brief.asset.caption}</p>}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Action onClick={() => postAsset(brief.asset!, true)} loading={busy === "share"} primary>
                      <Share2 className="h-4 w-4" /> Postar
                    </Action>
                    <Action onClick={() => postAsset(brief.asset!, false)} loading={busy === "down"}>
                      <Download className="h-4 w-4" /> Baixar
                    </Action>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-white/65">Quem posta todo dia é lembrado na hora da compra. Suba suas artes uma vez e o app sugere uma por dia.</p>
                  <Link href="/marketing" onClick={onClose} className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-sm font-semibold ring-1 ring-white/15 hover:bg-white/15">
                    Abrir Marketing <ChevronRight className="h-4 w-4" />
                  </Link>
                </>
              )}
            </Mission>

            {/* 2. Lead sem contato */}
            <Mission ok={missions[1].ok} icon={<UserRoundSearch className="h-5 w-5" />} kicker="Lead esperando" title={brief.lead ? brief.lead.name : "Nenhum lead parado"} xp="+5 XP">
              {brief.lead ? (
                <>
                  <p className="mt-1 text-sm text-white/60">
                    Chegou {waitLabel(brief.lead.created_at)}
                    {brief.lead.city ? ` · ${brief.lead.city}` : ""}
                    {brief.waiting > 1 ? ` · +${brief.waiting - 1} na fila` : ""}. Quem responde primeiro vende mais.
                  </p>
                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                    <Action
                      primary
                      onClick={() => {
                        window.open(whatsappUrl(brief.lead!.phone, firstContact), "_blank", "noopener");
                        logWhats(brief.lead!.id, "Primeiro contato pelo Plano do dia");
                        mark("lead");
                      }}
                      disabled={!brief.lead.phone}
                    >
                      <MessageCircle className="h-4 w-4" /> Chamar no WhatsApp
                    </Action>
                    <Link href={`/leads/${brief.lead.id}`} onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15 hover:bg-white/15" aria-label="Abrir lead">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-sm text-white/60">Todos os leads novos já foram contatados. Máquina! 🔥</p>
              )}
            </Mission>

            {/* 3. Prospecção ativa */}
            <Mission ok={missions[2].ok} icon={<Target className="h-5 w-5" />} kicker="Prospecção ativa" title={play === 0 && brief.referrals.length ? "Peça 3 indicações" : play === 1 && brief.lost.length ? "Reative quem disse não" : "Espalhe seu diagnóstico"} xp="+ funil">
              {play === 0 && brief.referrals.length ? (
                <ul className="mt-2 grid gap-1.5">
                  {brief.referrals.map((l) => (
                    <PersonRow
                      key={l.id}
                      name={l.name}
                      sub="Cliente · pedir indicação"
                      onClick={() => {
                        window.open(whatsappUrl(l.phone, referralText(l.name)), "_blank", "noopener");
                        logWhats(l.id, "Pedido de indicação pelo Plano do dia");
                        mark("prospect");
                      }}
                    />
                  ))}
                </ul>
              ) : play === 1 && brief.lost.length ? (
                <ul className="mt-2 grid gap-1.5">
                  {brief.lost.map((l) => (
                    <PersonRow
                      key={l.id}
                      name={l.name}
                      sub="Perdido há +30 dias · nova chance"
                      onClick={() => {
                        window.open(whatsappUrl(l.phone, reactivateText(l.name)), "_blank", "noopener");
                        logWhats(l.id, "Reativação pelo Plano do dia");
                        mark("prospect");
                      }}
                    />
                  ))}
                </ul>
              ) : (
                <>
                  <p className="mt-1 text-sm text-white/60">Mande seu link de diagnóstico para 5 contatos (amigos, vizinhos, grupos). Quem responder cai no funil como seu lead.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Action
                      primary
                      onClick={() => {
                        window.open(whatsappUrl("", `Oi! Descobri quanto dá para economizar na conta de luz com energia solar. Faz o teste, leva 2 minutos ☀️ ${anamneseLink}`), "_blank", "noopener");
                        mark("prospect");
                      }}
                    >
                      <MessageCircle className="h-4 w-4" /> Enviar
                    </Action>
                    <Action
                      onClick={async () => {
                        await navigator.clipboard.writeText(anamneseLink).catch(() => {});
                        toast.success("Link copiado — cole no status e nos grupos");
                        mark("prospect");
                      }}
                    >
                      <Copy className="h-4 w-4" /> Copiar link
                    </Action>
                  </div>
                  <Link
                    href="/prospeccao"
                    onClick={() => {
                      mark("prospect");
                      onClose();
                    }}
                    className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-semibold ring-1 ring-white/15 hover:bg-white/15"
                  >
                    <Target className="h-4 w-4 text-[#F3EA3B]" /> Radar: ache 5 comércios perto de você <ChevronRight className="h-4 w-4" />
                  </Link>
                </>
              )}
            </Mission>

            {/* 4. Agenda */}
            <Mission ok={missions[3].ok} icon={<Rocket className="h-5 w-5" />} kicker="Agenda" title={brief.tasksToday ? `${brief.tasksToday} ${brief.tasksToday === 1 ? "tarefa" : "tarefas"} para hoje` : "Agenda livre"} xp="+5 XP cada" className="sm:col-span-2">
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-white/60">{brief.late ? `${brief.late} atrasada${brief.late > 1 ? "s" : ""}: comece por elas.` : brief.tasksToday ? "Cada follow-up é uma venda mais perto." : "Aproveite para prospectar e fazer o funil girar."}</p>
                <Link
                  href="/tarefas"
                  onClick={() => {
                    mark("tasks");
                    onClose();
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-sm font-semibold ring-1 ring-white/15 hover:bg-white/15"
                >
                  Abrir tarefas <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </Mission>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-[#07060F] via-[#07060F]/95 to-transparent px-4 pt-10 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          onClick={onClose}
          className="mx-auto flex h-14 w-full max-w-3xl items-center justify-center gap-2 rounded-2xl bg-[#F3EA3B] text-[16px] font-bold text-[#1C1234] shadow-[0_18px_40px_-14px_rgba(243,234,59,0.8)] transition active:scale-[0.98]"
        >
          <Rocket className="h-5 w-5" /> {doneCount === missions.length ? "Dia dominado. Bora!" : "Bora pra cima"}
        </button>
      </div>
    </div>
  );
}

function MissionRing({ done, total }: { done: number; total: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative ml-auto hidden h-16 w-16 shrink-0 sm:block">
      <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke="#F3EA3B" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - done / total)} className="transition-all duration-700" />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-bold">
        {done}/{total}
      </span>
    </div>
  );
}

function Mission({ ok, icon, kicker, title, xp, className, children }: { ok: boolean; icon: ReactNode; kicker: string; title: string; xp: string; className?: string; children: ReactNode }) {
  return (
    <section className={cx("relative overflow-hidden rounded-[26px] p-4 ring-1 transition sm:p-5", ok ? "bg-[#9BD373]/10 ring-[#9BD373]/40" : "bg-white/[0.05] ring-white/10", className)}>
      <div className="flex items-start gap-3">
        <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-2xl", ok ? "bg-[#9BD373] text-[#1C1234]" : "bg-white/10 text-[#C7E36B]")}>{ok ? <Check className="h-5 w-5" strokeWidth={3} /> : icon}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center justify-between gap-2 text-[11px] font-bold tracking-[0.16em] text-white/45 uppercase">
            {kicker} <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] tracking-normal text-[#F3EA3B] normal-case">{ok ? "feito ✓" : xp}</span>
          </p>
          <h3 className="truncate font-display text-[17px] font-semibold">{title}</h3>
        </div>
      </div>
      {children}
    </section>
  );
}

function Action({ children, onClick, primary, loading, disabled }: { children: ReactNode; onClick: () => void; primary?: boolean; loading?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={cx(
        "flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40",
        primary ? "bg-[#F3EA3B] text-[#1C1234]" : "bg-white/10 ring-1 ring-white/15 hover:bg-white/15",
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

function PersonRow({ name, sub, onClick }: { name: string; sub: string; onClick: () => void }) {
  return (
    <li className="flex items-center gap-2.5 rounded-xl bg-white/[0.05] px-3 py-2 ring-1 ring-white/10">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate text-[11px] text-white/50">{sub}</p>
      </div>
      <button onClick={onClick} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500 text-white" aria-label={`WhatsApp para ${name}`}>
        <MessageCircle className="h-4 w-4" />
      </button>
    </li>
  );
}

/* ---------------------------------------------------------- orquestração */

/**
 * Depois da abertura cinematográfica: pede a foto de perfil (1ª vez) e mostra o
 * Plano do dia uma vez por dia. Também pode ser aberto pelo evento "quark:briefing".
 */
export function OpeningFlow() {
  const { user, profile } = useApp();
  const [stage, setStage] = useState<"wait" | "avatar" | "brief" | "done">("wait");

  useEffect(() => {
    const open = () => setStage("brief");
    window.addEventListener("quark:briefing", open);
    return () => window.removeEventListener("quark:briefing", open);
  }, []);

  useEffect(() => {
    if (!profile || stage !== "wait") return;
    // Espera a abertura cinematográfica sair da tela.
    const t = setInterval(() => {
      if (document.querySelector('[aria-label="Abertura"]')) return;
      clearInterval(t);
      const needAvatar = !profile.avatar_url && store.get(`avatar-skip-${user.id}`) !== today();
      const needBrief = store.get(`brief-${user.id}`) !== today();
      setStage(needAvatar ? "avatar" : needBrief ? "brief" : "done");
    }, 600);
    return () => clearInterval(t);
  }, [profile, stage, user.id]);

  return (
    <>
      <AvatarPicker
        open={stage === "avatar"}
        firstTime
        onClose={() => setStage(store.get(`brief-${user.id}`) !== today() ? "brief" : "done")}
      />
      <DailyBriefing
        open={stage === "brief"}
        onClose={() => {
          store.set(`brief-${user.id}`, today());
          setStage("done");
        }}
      />
    </>
  );
}
