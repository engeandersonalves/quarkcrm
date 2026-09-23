import { NextResponse } from "next/server";
import { notifyNewLead, notifyNewTask } from "@/lib/notifications";
import { serverSupabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const sb = await serverSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type, id } = (await req.json().catch(() => ({}))) as { type?: string; id?: string };
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  if (type === "lead") {
    const { data: lead } = await sb.from("leads").select("*").eq("id", id).maybeSingle();
    if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(await notifyNewLead(sb, lead));
  }
  if (type === "task") {
    const { data: task } = await sb.from("tasks").select("*, lead:leads(name)").eq("id", id).maybeSingle();
    if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(await notifyNewTask(sb, task));
  }
  return NextResponse.json({ error: "invalid type" }, { status: 400 });
}
