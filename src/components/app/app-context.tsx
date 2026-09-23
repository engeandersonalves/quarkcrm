"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { mergeSettings, type CompanySettings } from "@/lib/defaults";
import { must, useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

interface AppCtx {
  user: User;
  profile: Profile | null;
  profiles: Profile[];
  settings: CompanySettings;
  settingsLoaded: boolean;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ user, children }: { user: User; children: ReactNode }) {
  const { data: settingsRow, loading } = useLive(
    async () => must(await supabase().from("settings").select("data").eq("id", 1).maybeSingle()) as { data: Partial<CompanySettings> } | null,
    [],
    ["settings"],
  );
  const { data: profiles } = useLive(
    async () => must(await supabase().from("profiles").select("*").order("full_name")) as Profile[],
    [],
    [],
  );

  const value: AppCtx = {
    user,
    profile: profiles?.find((p) => p.id === user.id) ?? null,
    profiles: profiles ?? [],
    settings: mergeSettings(settingsRow?.data),
    settingsLoaded: !loading,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp fora do AppProvider");
  return ctx;
}
