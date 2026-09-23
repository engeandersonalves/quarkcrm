import { redirect } from "next/navigation";
import { Shell } from "@/components/app/shell";
import { serverSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await serverSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");
  return <Shell user={user}>{children}</Shell>;
}
