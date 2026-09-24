-- =============================================================================
-- Quark Locações — banco de dados (Supabase / PostgreSQL)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
-- Pode rodar de novo sem problema (é idempotente).
-- =============================================================================

create table if not exists public.equipamentos (
  id uuid primary key,
  nome text not null,
  categoria text not null default '',
  unidade text not null default 'un',
  estoque_total integer not null default 0,
  em_manutencao integer not null default 0,
  preco_diaria numeric not null default 0,
  preco_semanal numeric not null default 0,
  preco_quinzenal numeric not null default 0,
  preco_mensal numeric not null default 0,
  valor_reposicao numeric not null default 0,
  ativo boolean not null default true,
  observacoes text not null default '',
  criado_em timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key,
  nome text not null,
  documento text not null default '',
  telefone text not null default '',
  email text not null default '',
  endereco jsonb not null default '{}'::jsonb,
  observacoes text not null default '',
  criado_em timestamptz not null default now()
);

create table if not exists public.locacoes (
  id uuid primary key,
  numero integer not null,
  status text not null default 'orcamento'
    check (status in ('orcamento', 'agendada', 'na_obra', 'finalizada', 'recusada')),
  cliente_id uuid references public.clientes (id) on delete set null,
  cliente_nome text not null default '',
  cliente_telefone text not null default '',
  cliente_documento text not null default '',
  endereco jsonb not null default '{}'::jsonb,
  recebedor_nome text not null default '',
  recebedor_documento text not null default '',
  itens jsonb not null default '[]'::jsonb,
  modalidade text not null default 'mensal'
    check (modalidade in ('diaria', 'semanal', 'quinzenal', 'mensal', 'dias')),
  quantidade_periodos integer not null default 1,
  taxa_entrega numeric not null default 0,
  taxa_retirada numeric not null default 0,
  desconto numeric not null default 0,
  acrescimo numeric not null default 0,
  valor_total numeric not null default 0,
  data_entrega date,
  data_coleta date,
  entregue_em timestamptz,
  recolhido_em timestamptz,
  observacoes text not null default '',
  historico jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists locacoes_numero_idx on public.locacoes (numero);
create index if not exists locacoes_status_idx on public.locacoes (status);

create table if not exists public.lancamentos (
  id uuid primary key,
  tipo text not null check (tipo in ('entrada', 'saida')),
  categoria text not null default '',
  descricao text not null default '',
  valor numeric not null default 0,
  data date not null default current_date,
  pago boolean not null default false,
  pago_em date,
  forma text not null default 'PIX',
  locacao_id uuid references public.locacoes (id) on delete set null,
  modalidade text,
  criado_em timestamptz not null default now()
);
create index if not exists lancamentos_data_idx on public.lancamentos (data);
create index if not exists lancamentos_locacao_idx on public.lancamentos (locacao_id);

create table if not exists public.config (
  id int primary key default 1 check (id = 1),
  dados jsonb not null default '{}'::jsonb
);
insert into public.config (id) values (1) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Segurança: só quem está logado (a sua equipe) lê e grava.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['equipamentos', 'clientes', 'locacoes', 'lancamentos', 'config'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists equipe on public.%I', t);
    execute format('create policy equipe on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Tempo real: um celular altera, os outros atualizam sozinhos.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['equipamentos', 'clientes', 'locacoes', 'lancamentos', 'config'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
