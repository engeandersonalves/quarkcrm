-- =============================================================================
-- Quark CRM — schema do banco (Supabase / PostgreSQL)
-- Execute este arquivo inteiro no SQL Editor do Supabase (é idempotente).
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  role text not null default 'vendedor',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Configurações da empresa (linha única, id = 1)
-- -----------------------------------------------------------------------------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Leads
-- -----------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  document text,
  city text,
  state text,
  address text,
  source text default 'Indicação',
  status text not null default 'novo'
    check (status in ('novo', 'contato', 'visita', 'proposta', 'negociacao', 'ganho', 'perdido')),
  temperature text default 'morno' check (temperature in ('frio', 'morno', 'quente')),
  consumption_kwh numeric,
  avg_bill numeric,
  tariff numeric,
  connection_type text default 'bi' check (connection_type in ('mono', 'bi', 'tri')),
  roof_type text,
  estimated_value numeric,
  lost_reason text,
  notes text,
  owner_id uuid references public.profiles (id) on delete set null,
  position double precision not null default extract(epoch from now()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_created_idx on public.leads (created_at desc);

-- -----------------------------------------------------------------------------
-- Propostas / orçamentos
-- -----------------------------------------------------------------------------
create sequence if not exists public.proposal_number_seq start 1001;

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  number int not null default nextval('public.proposal_number_seq'),
  lead_id uuid not null references public.leads (id) on delete cascade,
  title text,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'enviada', 'visualizada', 'aceita', 'recusada')),
  inputs jsonb not null default '{}'::jsonb,
  power_kwp numeric not null default 0,
  monthly_generation numeric not null default 0,
  direct_cost numeric not null default 0,
  commission_value numeric not null default 0,
  tax_value numeric not null default 0,
  profit_value numeric not null default 0,
  final_price numeric not null default 0,
  public_token text not null unique default encode(gen_random_bytes(12), 'hex'),
  valid_until date,
  sent_at timestamptz,
  viewed_at timestamptz,
  view_count int not null default 0,
  accepted_at timestamptz,
  accepted_by text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists proposals_lead_idx on public.proposals (lead_id);

-- -----------------------------------------------------------------------------
-- Tarefas
-- -----------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  type text not null default 'tarefa' check (type in ('tarefa', 'ligacao', 'whatsapp', 'visita', 'email', 'reuniao')),
  priority text not null default 'media' check (priority in ('baixa', 'media', 'alta')),
  due_at timestamptz,
  done boolean not null default false,
  done_at timestamptz,
  lead_id uuid references public.leads (id) on delete cascade,
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_due_idx on public.tasks (done, due_at);

-- -----------------------------------------------------------------------------
-- Histórico de atividades do lead
-- -----------------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  type text not null default 'nota',
  content text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists activities_lead_idx on public.activities (lead_id, created_at desc);

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['leads', 'proposals', 'tasks', 'settings'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Registra mudanças de etapa no histórico do lead.
create or replace function public.log_lead_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.activities (lead_id, type, content, created_by)
    values (new.id, 'etapa', old.status || '→' || new.status, auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists leads_status_log on public.leads;
create trigger leads_status_log after update of status on public.leads
  for each row execute function public.log_lead_status();

-- -----------------------------------------------------------------------------
-- Row Level Security — toda a equipe autenticada compartilha os dados
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.leads enable row level security;
alter table public.proposals enable row level security;
alter table public.tasks enable row level security;
alter table public.activities enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'settings', 'leads', 'proposals', 'tasks', 'activities'] loop
    execute format('drop policy if exists "team_all" on public.%I', t);
    execute format('create policy "team_all" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Acesso público à proposta (link compartilhável, sem login)
-- -----------------------------------------------------------------------------
create or replace function public.get_public_proposal(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'proposal', jsonb_build_object(
      'id', p.id, 'number', p.number, 'title', p.title, 'status', p.status,
      -- custos internos (kit, mão de obra, comissão, imposto, lucro...) nunca saem do banco
      'inputs', p.inputs - array['kitPrice', 'laborPerModule', 'electricalPerKwp', 'extraCosts',
                                 'commission', 'tax', 'profit', 'discount', 'roundTo', 'notes'],
      'final_price', p.final_price, 'power_kwp', p.power_kwp, 'valid_until', p.valid_until,
      'created_at', p.created_at, 'accepted_at', p.accepted_at, 'accepted_by', p.accepted_by
    ),
    'lead', jsonb_build_object('name', l.name, 'city', l.city, 'state', l.state, 'address', l.address),
    'seller', jsonb_build_object('name', pr.full_name, 'email', pr.email, 'phone', pr.phone),
    'settings', coalesce((select s.data - array['notify_emails', 'defaults'] from public.settings s where s.id = 1), '{}'::jsonb)
  )
  into result
  from public.proposals p
  join public.leads l on l.id = p.lead_id
  left join public.profiles pr on pr.id = p.created_by
  where p.public_token = p_token;

  return result;
end;
$$;

create or replace function public.track_proposal_view(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  update public.proposals
     set view_count = view_count + 1,
         viewed_at = coalesce(viewed_at, now()),
         status = case when status = 'enviada' then 'visualizada' else status end
   where public_token = p_token
  returning id, number, lead_id, view_count into rec;

  if rec.id is null then
    return null;
  end if;
  if rec.view_count = 1 then
    insert into public.activities (lead_id, type, content)
    values (rec.lead_id, 'proposta', 'Cliente abriu a proposta #' || rec.number);
  end if;
  return jsonb_build_object('first_view', rec.view_count = 1, 'id', rec.id);
end;
$$;

create or replace function public.accept_public_proposal(p_token text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  update public.proposals
     set status = 'aceita', accepted_at = now(), accepted_by = left(coalesce(nullif(trim(p_name), ''), 'Cliente'), 120)
   where public_token = p_token
     and status not in ('aceita', 'recusada')
     and (valid_until is null or valid_until >= current_date)
  returning id, number, lead_id into rec;

  if rec.id is null then
    return jsonb_build_object('ok', false);
  end if;

  update public.leads set status = 'negociacao' where id = rec.lead_id and status in ('novo', 'contato', 'visita', 'proposta');
  insert into public.activities (lead_id, type, content)
  values (rec.lead_id, 'proposta', 'Proposta #' || rec.number || ' aceita online por ' || coalesce(nullif(trim(p_name), ''), 'Cliente'));
  return jsonb_build_object('ok', true, 'id', rec.id);
end;
$$;

-- Formulário público de captura de leads (site, Instagram, landing page).
create or replace function public.create_public_lead(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_lead public.leads;
begin
  if coalesce(trim(p ->> 'name'), '') = '' or coalesce(trim(p ->> 'phone'), '') = '' then
    raise exception 'nome e telefone são obrigatórios';
  end if;
  insert into public.leads (name, phone, email, city, state, avg_bill, consumption_kwh, source, notes)
  values (
    left(trim(p ->> 'name'), 120),
    left(trim(p ->> 'phone'), 30),
    left(nullif(trim(p ->> 'email'), ''), 160),
    left(nullif(trim(p ->> 'city'), ''), 80),
    left(nullif(trim(p ->> 'state'), ''), 2),
    nullif(p ->> 'avg_bill', '')::numeric,
    nullif(p ->> 'consumption_kwh', '')::numeric,
    left(coalesce(nullif(trim(p ->> 'source'), ''), 'Site'), 40),
    left(nullif(trim(p ->> 'notes'), ''), 1000)
  )
  returning * into new_lead;

  insert into public.activities (lead_id, type, content)
  values (new_lead.id, 'nota', 'Lead recebido pelo formulário público');

  return to_jsonb(new_lead);
end;
$$;

revoke all on function public.get_public_proposal(text) from public;
revoke all on function public.track_proposal_view(text) from public;
revoke all on function public.accept_public_proposal(text, text) from public;
grant execute on function public.get_public_proposal(text) to anon, authenticated;
grant execute on function public.track_proposal_view(text) to anon, authenticated;
grant execute on function public.accept_public_proposal(text, text) to anon, authenticated;
revoke all on function public.create_public_lead(jsonb) from public;
grant execute on function public.create_public_lead(jsonb) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Tempo real
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['leads', 'proposals', 'tasks', 'activities', 'settings'] loop
      if not exists (
        select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
