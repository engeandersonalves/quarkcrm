import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductPage } from "@/components/store/product";
import { loadCompany } from "@/lib/public-company";
import { totalPct } from "@/lib/store";
import { loadStore } from "@/lib/store-data";

export const dynamic = "force-dynamic";
export const viewport = { themeColor: "#000000" };

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const store = await loadStore();
  const p = store.products.find((x) => x.id === id);
  if (!p) return { title: "Produto não encontrado" };
  const pct = totalPct(p.discount_pct, store.campaign?.extra_pct ?? 0);
  const title = `${pct ? `${pct}% OFF · ` : ""}${p.name}`;
  // Prévia bonita ao compartilhar no WhatsApp/Instagram
  return { title: { absolute: `${title} · Loja Quark Energia` }, description: p.subtitle ?? "Cotação grátis com desconto.", openGraph: { title, description: p.subtitle ?? "Cotação grátis com desconto.", images: [p.images[0] ?? "/brand/icon-512.png"] } };
}

export default async function ProdutoPage({ params }: Props) {
  const { id } = await params;
  const [company, store] = await Promise.all([loadCompany(), loadStore()]);
  const product = store.products.find((x) => x.id === id);
  if (!product) notFound();
  const related = store.products.filter((x) => x.id !== id && x.category === product.category).slice(0, 10);
  return (
    <div translate="no" className="notranslate">
      <Suspense>
        <ProductPage company={company} product={product} related={related} campaign={store.campaign} coupons={store.coupons} />
      </Suspense>
    </div>
  );
}
