"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/components/app/app-context";

/** /perfil abre o perfil de quem está logado. */
export default function MyProfile() {
  const { user } = useApp();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/perfil/${user.id}`);
  }, [router, user.id]);
  return null;
}
