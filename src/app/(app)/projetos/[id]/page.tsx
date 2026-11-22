"use client";

import { use } from "react";
import { ProjectEditor } from "@/components/projetos/editor";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ProjectEditor id={id} />;
}
