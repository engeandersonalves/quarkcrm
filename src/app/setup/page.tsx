import { Sun } from "lucide-react";

export default function SetupPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 grid h-12 w-12 place-items-center rounded-xl bg-sun-gradient shadow-glow">
        <Sun className="h-6 w-6 text-ink-950" strokeWidth={2.5} />
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Configure o banco de dados</h1>
      <p className="mt-3 text-ink-500">
        O app ainda não está conectado ao Supabase. Siga o passo a passo do <code className="rounded bg-ink-100 px-1.5 py-0.5">README.md</code>:
      </p>
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-ink-700">
        <li>Crie um projeto gratuito em supabase.com.</li>
        <li>No SQL Editor, execute o arquivo <code className="rounded bg-ink-100 px-1.5 py-0.5">supabase/schema.sql</code>.</li>
        <li>
          Defina as variáveis <code className="rounded bg-ink-100 px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
          <code className="rounded bg-ink-100 px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (em <code>.env.local</code> ou na Vercel).
        </li>
        <li>Reinicie/reimplante o app.</li>
      </ol>
      <p className="mt-8 text-sm text-ink-500">
        Enquanto isso, veja um exemplo de proposta em{" "}
        <a className="font-semibold text-sun-700 underline" href="/p/exemplo">
          /p/exemplo
        </a>
        .
      </p>
    </div>
  );
}
