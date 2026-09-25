-- =============================================================================
-- Quark Locações — banco de dados (Supabase / PostgreSQL) — versão 3
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
-- Pode rodar de novo sempre que o app for atualizado: não apaga nada.
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
-- Colunas novas (bancos criados em versões anteriores recebem aqui, sem perder dados)
alter table public.locacoes add column if not exists assinado_em timestamptz;
alter table public.locacoes add column if not exists assinado_por text;
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
-- Assinatura digital do termo (link para o cliente assinar com selfie)
-- Fica numa tabela à parte para as imagens não pesarem a lista de locações.
-- -----------------------------------------------------------------------------
create table if not exists public.assinaturas (
  locacao_id uuid primary key references public.locacoes (id) on delete cascade,
  token text not null unique,
  criado_em timestamptz not null default now(),
  termo jsonb not null default '{}'::jsonb,
  assinado_em timestamptz,
  nome text,
  documento text,
  imagem text,
  selfie text,
  via text,
  hash text,
  ip text,
  dispositivo text,
  geo text
);

-- -----------------------------------------------------------------------------
-- Equipe: só os e-mails desta lista acessam os dados.
-- A primeira pessoa que entrar no app vira a primeira da lista; as demais
-- são liberadas por ela em Ajustes → Equipe.
-- -----------------------------------------------------------------------------
create table if not exists public.equipe (
  email text primary key,
  criado_em timestamptz not null default now()
);

create or replace function public.eh_equipe()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.equipe where email = lower(auth.jwt() ->> 'email'));
$$;

create or replace function public.entrar_equipe()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  if not exists (select 1 from public.equipe) then
    insert into public.equipe (email) values (lower(auth.jwt() ->> 'email')) on conflict do nothing;
  end if;
  return public.eh_equipe();
end;
$$;

-- Página pública de assinatura: o cliente só enxerga o termo do próprio link.
create or replace function public.termo_para_assinar(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('termo', a.termo, 'assinado_em', a.assinado_em, 'nome', a.nome)
  from public.assinaturas a
  where a.token = p_token and length(p_token) >= 20;
$$;

create or replace function public.assinar_termo(p_token text, p_dados jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.assinaturas;
  v_ip text;
begin
  select * into a from public.assinaturas where token = p_token and length(p_token) >= 20 for update;
  if not found or a.assinado_em is not null then
    return false;
  end if;
  if coalesce(p_dados ->> 'nome', '') = '' or coalesce(p_dados ->> 'imagem', '') = '' or coalesce(p_dados ->> 'selfie', '') = '' then
    raise exception 'Faltam nome, assinatura ou selfie';
  end if;
  if length(p_dados ->> 'imagem') > 400000 or length(p_dados ->> 'selfie') > 900000 then
    raise exception 'Imagem grande demais';
  end if;
  begin
    v_ip := split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1);
  exception when others then
    v_ip := null;
  end;
  update public.assinaturas
     set assinado_em = now(), nome = p_dados ->> 'nome', documento = p_dados ->> 'documento',
         imagem = p_dados ->> 'imagem', selfie = p_dados ->> 'selfie', via = 'link',
         hash = p_dados ->> 'hash', ip = v_ip, dispositivo = left(p_dados ->> 'dispositivo', 300), geo = p_dados ->> 'geo'
   where locacao_id = a.locacao_id;
  update public.locacoes
     set assinado_em = now(), assinado_por = p_dados ->> 'nome',
         cliente_documento = case when cliente_documento = '' then coalesce(p_dados ->> 'documento', '') else cliente_documento end,
         historico = historico || jsonb_build_array(jsonb_build_object('em', now(), 'texto', 'Termo assinado pelo cliente pelo link (com selfie): ' || (p_dados ->> 'nome')))
   where id = a.locacao_id;
  update public.clientes c
     set documento = p_dados ->> 'documento'
    from public.locacoes l
   where l.id = a.locacao_id and c.id = l.cliente_id and c.documento = '' and coalesce(p_dados ->> 'documento', '') <> '';
  return true;
end;
$$;

-- Versão do banco: o app avisa quando é preciso rodar este arquivo de novo.
create or replace function public.versao_schema()
returns int
language sql
immutable
as $$ select 3 $$;

grant execute on function public.termo_para_assinar(text) to anon, authenticated;
grant execute on function public.assinar_termo(text, jsonb) to anon, authenticated;
grant execute on function public.versao_schema() to anon, authenticated;

revoke execute on function public.eh_equipe() from public, anon;
revoke execute on function public.entrar_equipe() from public, anon;
grant execute on function public.eh_equipe() to authenticated;
grant execute on function public.entrar_equipe() to authenticated;

-- -----------------------------------------------------------------------------
-- Segurança: só quem está logado E na lista da equipe lê e grava.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['equipamentos', 'clientes', 'locacoes', 'lancamentos', 'config', 'equipe', 'assinaturas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists equipe on public.%I', t);
    execute format('create policy equipe on public.%I for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe())', t);
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

-- Recarrega o cache da API para as colunas novas aparecerem na hora.
notify pgrst, 'reload schema';
