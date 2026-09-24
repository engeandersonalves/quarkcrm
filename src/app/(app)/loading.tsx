import { Skeleton } from "@/components/ui";

/** Aparece na hora do clique, enquanto a próxima tela carrega. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-2 h-4 w-40" />
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[104px]" />
        ))}
      </div>
      <Skeleton className="mt-5 h-72" />
    </div>
  );
}
