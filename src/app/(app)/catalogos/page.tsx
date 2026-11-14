import { redirect } from "next/navigation";

/** O catálogo agora fica dentro de Mobilidade elétrica. */
export default function CatalogosPage() {
  redirect("/mobilidade?aba=catalogo");
}
