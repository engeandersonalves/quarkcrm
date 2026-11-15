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

-- Acesso à equipe: só entra quem foi aprovado (active) por um administrador.
-- Na primeira execução, todos os usuários que já existiam continuam com acesso.
alter table public.profiles add column if not exists active boolean;
update public.profiles set active = true where active is null;
alter table public.profiles alter column active set default false;
alter table public.profiles alter column active set not null;
-- Foto de perfil (URL enviada ou um personagem ilustrado: "preset:lobo").
alter table public.profiles add column if not exists avatar_url text;
-- Garante ao menos um administrador (o usuário mais antigo).
update public.profiles set role = 'admin'
where id = (select id from public.profiles order by created_at limit 1)
  and not exists (select 1 from public.profiles where role = 'admin');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_user boolean := not exists (select 1 from public.profiles);
begin
  -- O primeiro usuário vira administrador. Os demais entram com acesso liberado apenas
  -- quando cadastrados pelo administrador no app (app_metadata.invited); quem se cadastra
  -- sozinho aguarda aprovação.
  insert into public.profiles (id, email, full_name, role, active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when first_user then 'admin' else 'vendedor' end,
    first_user or coalesce((new.raw_app_meta_data ->> 'invited')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'admin');
$$;

-- Só administradores mudam papel e acesso; e sempre sobra ao menos um administrador ativo.
create or replace function public.guard_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active) then
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Apenas administradores podem alterar o papel ou o acesso de um usuário';
    end if;
    if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)
       and not exists (select 1 from public.profiles where role = 'admin' and active and id <> old.id) then
      raise exception 'A equipe precisa de ao menos um administrador ativo';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile();

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
-- Segmento do cliente: energia solar, carregador veicular (S.A.V.E) ou ambos.
alter table public.leads add column if not exists segment text not null default 'solar';
-- Segmentos: solar, carregador (save), ambos, eletroposto, manutenção de usina e gestão energética.
alter table public.leads drop constraint if exists leads_segment_check;
alter table public.leads add constraint leads_segment_check check (segment in ('solar', 'save', 'ambos', 'eletroposto', 'manutencao', 'gestao', 'mobilidade'));
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
create index if not exists tasks_lead_idx on public.tasks (lead_id);

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
    execute format('create policy "team_all" on public.%I for all to authenticated using (public.is_member()) with check (public.is_member())', t);
  end loop;
end $$;
-- Quem ainda aguarda aprovação consegue ler apenas o próprio perfil.
drop policy if exists "self_read" on public.profiles;
create policy "self_read" on public.profiles for select to authenticated using (id = auth.uid());

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
    'settings', coalesce((select s.data - array['notify_emails', 'defaults', 'integrations', 'cadence'] from public.settings s where s.id = 1), '{}'::jsonb)
  )
  into result
  from public.proposals p
  join public.leads l on l.id = p.lead_id
  left join public.profiles pr on pr.id = p.created_by
  where p.public_token = p_token;

  return result;
end;
$$;

alter table public.proposals add column if not exists last_viewed_at timestamptz;

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
         last_viewed_at = now(),
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
  v_phone text := left(trim(p ->> 'phone'), 30);
  v_email text := lower(left(nullif(trim(p ->> 'email'), ''), 160));
  v_lead uuid;
  v_owner uuid;
begin
  if coalesce(trim(p ->> 'name'), '') = '' or coalesce(v_phone, '') = '' then
    raise exception 'nome e telefone são obrigatórios';
  end if;

  -- Vendedor que enviou o link (?v=): só vale para um usuário ativo da equipe.
  begin
    select id into v_owner from public.profiles where id = nullif(p ->> 'owner', '')::uuid and active;
  exception when others then
    v_owner := null;
  end;

  -- Anamnese enviada para um lead que já existe (?l=): completa o cadastro em vez de duplicar.
  begin
    v_lead := nullif(p ->> 'lead_id', '')::uuid;
  exception when others then
    v_lead := null;
  end;
  if v_lead is not null then
    update public.leads set
      email = coalesce(email, v_email),
      city = coalesce(city, left(nullif(trim(p ->> 'city'), ''), 80)),
      avg_bill = coalesce(nullif(p ->> 'avg_bill', '')::numeric, avg_bill),
      consumption_kwh = coalesce(nullif(p ->> 'consumption_kwh', '')::numeric, consumption_kwh),
      roof_type = coalesce(left(nullif(trim(p ->> 'roof_type'), ''), 60), roof_type),
      temperature = case when p ->> 'temperature' in ('frio', 'morno', 'quente') then p ->> 'temperature' else temperature end,
      notes = left(concat_ws(E'\n\n', nullif(notes, ''), nullif(trim(p ->> 'notes'), '')), 6000)
    where id = v_lead
    returning * into new_lead;
    if found then
      insert into public.activities (lead_id, type, content)
      values (new_lead.id, 'nota', 'Cliente respondeu a ' || coalesce(nullif(trim(p ->> 'source'), ''), 'pesquisa') || ' pelo link');
      return to_jsonb(new_lead) || jsonb_build_object('duplicate', false, 'updated', true);
    end if;
  end if;

  -- Envio repetido (duplo clique, recarregar a página): devolve o mesmo lead, sem duplicar.
  select * into new_lead from public.leads
  where created_at > now() - interval '15 minutes'
    and (regexp_replace(coalesce(phone, ''), '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g') or (v_email is not null and lower(email) = v_email))
  order by created_at desc limit 1;
  if found then
    return to_jsonb(new_lead) || jsonb_build_object('duplicate', true);
  end if;

  insert into public.leads (name, phone, email, city, state, address, avg_bill, consumption_kwh, source, notes, segment, roof_type, connection_type, temperature, owner_id)
  values (
    left(trim(p ->> 'name'), 120),
    v_phone,
    v_email,
    left(nullif(trim(p ->> 'city'), ''), 80),
    upper(left(nullif(trim(p ->> 'state'), ''), 2)),
    left(nullif(trim(p ->> 'address'), ''), 200),
    nullif(p ->> 'avg_bill', '')::numeric,
    nullif(p ->> 'consumption_kwh', '')::numeric,
    left(coalesce(nullif(trim(p ->> 'source'), ''), 'Site'), 40),
    left(nullif(trim(p ->> 'notes'), ''), 2000),
    case when p ->> 'segment' in ('solar', 'save', 'ambos', 'eletroposto', 'manutencao', 'gestao', 'mobilidade') then p ->> 'segment' else 'solar' end,
    left(nullif(trim(p ->> 'roof_type'), ''), 60),
    case when p ->> 'connection_type' in ('mono', 'bi', 'tri') then p ->> 'connection_type' else null end,
    case when p ->> 'temperature' in ('frio', 'morno', 'quente') then p ->> 'temperature' else 'morno' end,
    v_owner
  )
  returning * into new_lead;

  insert into public.activities (lead_id, type, content)
  values (new_lead.id, 'nota', 'Lead recebido pelo formulário público' || coalesce(' (' || nullif(trim(p ->> 'source'), '') || ')', ''));

  return to_jsonb(new_lead) || jsonb_build_object('duplicate', false);
end;
$$;

-- Dados públicos da empresa para a página de captura (sem custos, margens ou configurações internas).
create or replace function public.get_public_company()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'company_name', data ->> 'company_name',
    'whatsapp', data ->> 'whatsapp',
    'instagram', data ->> 'instagram',
    'logo_url', data ->> 'logo_url',
    'city', data ->> 'city',
    'about', data ->> 'about',
    'tech_name', data ->> 'tech_name',
    'tech_registry', data ->> 'tech_registry',
    'warranty_modules_performance_years', data -> 'warranty_modules_performance_years',
    'tariff', data -> 'defaults' -> 'tariff',
    'sunHours', data -> 'defaults' -> 'sunHours',
    'fioBTariff', data -> 'defaults' -> 'fioBTariff',
    'publicLighting', data -> 'defaults' -> 'publicLighting',
    'gallery', data -> 'proposal' -> 'gallery',
    'capture', data -> 'capture',
    'metaPixelId', data -> 'integrations' ->> 'metaPixelId',
    'gaId', data -> 'integrations' ->> 'gaId'
  )
  from public.settings where id = 1;
$$;
revoke all on function public.get_public_company() from public;
grant execute on function public.get_public_company() to anon, authenticated;

-- Endereço do webhook de integrações (Zapier, Make, n8n…), usado pelo servidor ao receber leads.
create or replace function public.get_webhook_url()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(trim(data -> 'integrations' ->> 'webhookUrl'), '') from public.settings where id = 1;
$$;
revoke all on function public.get_webhook_url() from public;
grant execute on function public.get_webhook_url() to anon, authenticated;

revoke all on function public.get_public_proposal(text) from public;
revoke all on function public.track_proposal_view(text) from public;
revoke all on function public.accept_public_proposal(text, text) from public;
grant execute on function public.get_public_proposal(text) to anon, authenticated;
grant execute on function public.track_proposal_view(text) to anon, authenticated;
grant execute on function public.accept_public_proposal(text, text) to anon, authenticated;
revoke all on function public.create_public_lead(jsonb) from public;
grant execute on function public.create_public_lead(jsonb) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Gamificação: pontos (XP) por ação e tempo de uso do app
-- Os pontos são dados pelo próprio banco (gatilhos), e não pelo navegador.
-- -----------------------------------------------------------------------------
alter table public.leads add column if not exists created_by uuid references public.profiles (id) on delete set null default auth.uid();

create table if not exists public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  points int not null,
  ref_id uuid,
  lead_id uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists xp_events_unique on public.xp_events (user_id, kind, ref_id);
create index if not exists xp_events_time_idx on public.xp_events (created_at desc);
create index if not exists xp_events_ref_idx on public.xp_events (ref_id);

create table if not exists public.usage_daily (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  minutes int not null default 0,
  last_ping timestamptz,
  primary key (user_id, day)
);

alter table public.xp_events enable row level security;
alter table public.usage_daily enable row level security;
drop policy if exists "team_read" on public.xp_events;
create policy "team_read" on public.xp_events for select to authenticated using (public.is_member());
drop policy if exists "team_read" on public.usage_daily;
create policy "team_read" on public.usage_daily for select to authenticated using (public.is_member());

-- Concede pontos com limites contra abuso (sem duplicar e com teto diário por tipo).
create or replace function public.award_xp(p_user uuid, p_kind text, p_points int, p_ref uuid, p_lead uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  daily_cap int := case p_kind when 'followup' then 40 when 'tarefa' then 40 when 'proposta' then 20 when 'lead' then 60 else null end;
begin
  if p_user is null then return; end if;
  if daily_cap is not null and (
    select count(*) from public.xp_events
    where user_id = p_user and kind = p_kind and created_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
  ) >= daily_cap then return; end if;
  -- Follow-up: vale no máximo uma vez a cada 30 minutos por cliente.
  if p_kind = 'followup' and p_lead is not null and exists (
    select 1 from public.xp_events where user_id = p_user and kind = 'followup' and lead_id = p_lead and created_at > now() - interval '30 minutes'
  ) then return; end if;
  insert into public.xp_events (user_id, kind, points, ref_id, lead_id)
  values (p_user, p_kind, p_points, p_ref, p_lead)
  on conflict (user_id, kind, ref_id) do nothing;
end;
$$;
revoke all on function public.award_xp(uuid, text, int, uuid, uuid) from public, anon, authenticated;

create or replace function public.xp_on_lead()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.xp_events where ref_id = old.id;
    return old;
  elsif tg_op = 'INSERT' then
    perform public.award_xp(coalesce(auth.uid(), new.created_by), 'lead', 10, new.id, new.id);
  elsif new.status is distinct from old.status then
    if new.status = 'ganho' then
      perform public.award_xp(coalesce(auth.uid(), new.owner_id, new.created_by), 'venda', 100, new.id, new.id);
    elsif old.status = 'ganho' then
      delete from public.xp_events where ref_id = new.id and kind = 'venda';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists leads_xp on public.leads;
create trigger leads_xp after insert or update of status or delete on public.leads
  for each row execute function public.xp_on_lead();

create or replace function public.xp_on_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.xp_events where ref_id = old.id;
    return old;
  end if;
  if new.type in ('ligacao', 'whatsapp', 'visita', 'email') then
    perform public.award_xp(coalesce(auth.uid(), new.created_by), 'followup', 5, new.id, new.lead_id);
  end if;
  return new;
end;
$$;
drop trigger if exists activities_xp on public.activities;
create trigger activities_xp after insert or delete on public.activities
  for each row execute function public.xp_on_activity();

create or replace function public.xp_on_task()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.xp_events where ref_id = old.id;
    return old;
  end if;
  -- Só tarefas ligadas a um cliente contam (follow-up de verdade).
  if new.done and not old.done and new.lead_id is not null then
    perform public.award_xp(coalesce(auth.uid(), new.assigned_to, new.created_by), 'tarefa', 5, new.id, new.lead_id);
  elsif old.done and not new.done then
    delete from public.xp_events where ref_id = new.id and kind = 'tarefa';
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_xp on public.tasks;
create trigger tasks_xp after update of done or delete on public.tasks
  for each row execute function public.xp_on_task();

create or replace function public.xp_on_proposal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.xp_events where ref_id = old.id;
    return old;
  elsif tg_op = 'INSERT' then
    perform public.award_xp(coalesce(auth.uid(), new.created_by), 'proposta', 15, new.id, new.lead_id);
  else
    if new.sent_at is not null and old.sent_at is null then
      perform public.award_xp(coalesce(auth.uid(), new.created_by), 'envio', 10, new.id, new.lead_id);
    end if;
    -- Aceite pelo cliente (link público): o ponto vai para quem criou a proposta.
    if new.status = 'aceita' and old.status is distinct from 'aceita' then
      perform public.award_xp(new.created_by, 'aceite', 150, new.id, new.lead_id);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists proposals_xp on public.proposals;
create trigger proposals_xp after insert or update or delete on public.proposals
  for each row execute function public.xp_on_proposal();

-- Tempo de uso: o app chama a cada minuto enquanto está aberto e em uso.
create or replace function public.track_usage()
returns int language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  m int;
begin
  if not public.is_member() then return 0; end if;
  insert into public.usage_daily (user_id, day, minutes, last_ping)
  values (auth.uid(), today, 1, now())
  on conflict (user_id, day) do update
    set minutes = public.usage_daily.minutes + 1, last_ping = now()
    where public.usage_daily.last_ping is null or public.usage_daily.last_ping < now() - interval '50 seconds'
  returning minutes into m;
  return coalesce(m, 0);
end;
$$;
revoke all on function public.track_usage() from public, anon;
grant execute on function public.track_usage() to authenticated;

-- Ranking da equipe no período. Tempo de uso: 1 XP a cada 10 minutos (até 4 h por dia).
create or replace function public.leaderboard(p_from timestamptz default '-infinity')
returns table (
  user_id uuid, full_name text, email text, role text,
  xp bigint, total_xp bigint, leads bigint, followups bigint, proposals bigint, sent bigint, sales bigint, minutes bigint, active_days bigint
)
language sql stable security definer set search_path = public as $$
  with usage as (
    select u.user_id,
      sum(least(u.minutes, 240) / 10) filter (where u.day >= (p_from at time zone 'America/Sao_Paulo')::date) as xp_p,
      sum(least(u.minutes, 240) / 10) as xp_all,
      sum(u.minutes) filter (where u.day >= (p_from at time zone 'America/Sao_Paulo')::date) as minutes,
      count(*) filter (where u.day >= (p_from at time zone 'America/Sao_Paulo')::date and u.minutes >= 5) as days
    from public.usage_daily u group by u.user_id
  ), ev as (
    select e.user_id,
      sum(e.points) filter (where e.created_at >= p_from) as xp_p,
      sum(e.points) as xp_all,
      count(*) filter (where e.created_at >= p_from and e.kind = 'lead') as leads,
      count(*) filter (where e.created_at >= p_from and e.kind in ('followup', 'tarefa')) as followups,
      count(*) filter (where e.created_at >= p_from and e.kind = 'proposta') as proposals,
      count(*) filter (where e.created_at >= p_from and e.kind = 'envio') as sent,
      count(*) filter (where e.created_at >= p_from and e.kind in ('venda', 'aceite')) as sales
    from public.xp_events e group by e.user_id
  )
  select p.id, p.full_name, p.email, p.role,
    coalesce(ev.xp_p, 0) + coalesce(usage.xp_p, 0),
    coalesce(ev.xp_all, 0) + coalesce(usage.xp_all, 0),
    coalesce(ev.leads, 0), coalesce(ev.followups, 0), coalesce(ev.proposals, 0), coalesce(ev.sent, 0), coalesce(ev.sales, 0),
    coalesce(usage.minutes, 0), coalesce(usage.days, 0)
  from public.profiles p
  left join ev on ev.user_id = p.id
  left join usage on usage.user_id = p.id
  where p.active and public.is_member()
  order by 5 desc, 6 desc;
$$;
revoke all on function public.leaderboard(timestamptz) from public, anon;
grant execute on function public.leaderboard(timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- Cadência de follow-up: ao criar o lead ou mudar de etapa, cria as tarefas da etapa
-- com a mensagem pronta. As tarefas automáticas ainda abertas da etapa anterior saem.
-- -----------------------------------------------------------------------------
alter table public.tasks add column if not exists cadence text;
alter table public.tasks add column if not exists copy text;
alter table public.tasks add column if not exists action text;

-- Cadência padrão (editável em Configurações → Cadências). Só é gravada se ainda não existir.
update public.settings
   set data = data || jsonb_build_object('cadence', $cadence$ {"enabled":true,"materials":[],"stages":{"novo":[{"id":"novo-1","day":0,"hour":null,"type":"whatsapp","priority":"alta","title":"Primeiro contato (responda em até 5 minutos)","copy":"Olá, {nome}! Aqui é {vendedor}, da {empresa} ☀️ Recebi seu interesse em {interesse} e já estou preparando seu estudo. Posso te fazer 3 perguntinhas rápidas para calcular a sua economia?"},{"id":"novo-2","day":1,"hour":10,"type":"ligacao","priority":"alta","title":"Ligar para qualificar o cliente","copy":"Roteiro da ligação:\n1. Quanto vem, em média, a sua conta de luz?\n2. O imóvel é próprio? Qual o tipo de telhado?\n3. Em quanto tempo pensa em instalar?\n4. Mais alguém participa da decisão?\n5. Fechar: \"Vou montar seu estudo. Posso agendar a visita técnica gratuita?\""},{"id":"novo-3","day":2,"hour":15,"type":"whatsapp","priority":"media","title":"Pedir a conta de luz","copy":"{nome}, para eu calcular exatamente quanto você vai economizar, me manda uma foto da sua última conta de luz (frente e verso)? Com ela eu te entrego o projeto certinho, sem chute 📄"},{"id":"novo-4","day":4,"hour":10,"type":"whatsapp","priority":"media","title":"Enviar material gráfico: obras e depoimentos","copy":"{nome}, olha só algumas obras que entregamos aqui na região 👇 Tem cliente que pagava mais de R$ 600 e hoje paga só a taxa mínima. Quer que eu faça essa simulação para você?"},{"id":"novo-5","day":7,"hour":10,"type":"whatsapp","priority":"baixa","title":"Última tentativa (mensagem de despedida)","copy":"{nome}, tentei falar com você algumas vezes e não quero ser inconveniente 🙂 Ainda faz sentido conversarmos sobre {interesse}? Se não for o momento, me avisa que eu te chamo mais para frente."}],"contato":[{"id":"contato-1","day":0,"hour":null,"type":"whatsapp","priority":"alta","title":"Agendar a visita técnica","copy":"{nome}, para deixar o projeto perfeito, nosso técnico faz uma visita rápida (uns 30 minutos), sem custo nenhum. Qual dia e horário ficam melhores para você esta semana?"},{"id":"contato-2","day":1,"hour":10,"type":"email","priority":"media","title":"Enviar apresentação da empresa e garantias","copy":"Assunto: Sua energia solar com a {empresa}\n\nOlá, {nome}!\n\nConforme conversamos, segue nossa apresentação: como funciona o sistema, as garantias dos equipamentos e algumas obras que entregamos em {cidade}.\n\nQualquer dúvida, é só responder este e-mail ou me chamar no WhatsApp.\n\nAbraço,\n{vendedor} — {empresa}"},{"id":"contato-3","day":3,"hour":16,"type":"ligacao","priority":"media","title":"Ligar para tirar dúvidas e confirmar a visita","copy":"Pergunte: \"{nome}, ficou alguma dúvida sobre o material que te enviei?\" Reforce que a visita é gratuita e sem compromisso e já sugira dois horários."}],"visita":[{"id":"visita-1","day":0,"hour":null,"type":"whatsapp","priority":"alta","title":"Confirmar a visita técnica","copy":"Oi, {nome}! Passando para confirmar a nossa visita técnica. Nosso técnico vai avaliar o telhado e o padrão de energia — leva uns 30 minutinhos. Se puder, deixe separada a última conta de luz 😉"},{"id":"visita-2","day":1,"hour":9,"type":"tarefa","priority":"alta","title":"Montar o projeto e a proposta","copy":"Checklist: fotos do telhado, orientação e inclinação, padrão de entrada, distância até o quadro, consumo dos últimos 12 meses. Gere a proposta no app e envie no mesmo dia.","action":"proposta"},{"id":"visita-3","day":1,"hour":17,"type":"whatsapp","priority":"media","title":"Agradecer a visita","copy":"{nome}, obrigado por receber a gente! Já estou finalizando o seu projeto e em breve te mando a proposta com a economia detalhada ☀️"}],"proposta":[{"id":"proposta-1","day":0,"hour":null,"type":"whatsapp","priority":"alta","title":"Apresentar a proposta","copy":"{nome}, sua proposta está pronta! 🎉 Preparei tudo a partir da sua conta de luz: quanto você vai economizar, em quanto tempo o sistema se paga e as formas de pagamento. Consegue 10 minutinhos hoje para eu te explicar por chamada de vídeo?"},{"id":"proposta-2","day":1,"hour":10,"type":"ligacao","priority":"alta","title":"Ligar para explicar a proposta","copy":"Roteiro: 1) Relembre a dor (valor da conta hoje). 2) Mostre a economia em 25 anos. 3) Compare a parcela do financiamento com a conta atual. 4) Pergunte: \"O que falta para seguirmos?\""},{"id":"proposta-3","day":3,"hour":10,"type":"whatsapp","priority":"media","title":"Follow-up: tirar dúvidas do financiamento","copy":"{nome}, conseguiu dar uma olhada na proposta? Uma dúvida comum é o financiamento: a parcela costuma ficar menor que a conta de luz de hoje. Ou seja, você troca a conta pela parcela e, depois de quitado, fica só com a economia 💡 Quer que eu simule em quantas vezes fica melhor para você?"},{"id":"proposta-4","day":5,"hour":10,"type":"whatsapp","priority":"media","title":"Enviar material gráfico: depoimento em vídeo","copy":"{nome}, separei o depoimento de um cliente que estava na mesma situação que você 🎥 Vale a pena assistir! Depois me conta o que achou."},{"id":"proposta-5","day":7,"hour":10,"type":"whatsapp","priority":"alta","title":"Gatilho da validade da proposta","copy":"{nome}, a condição da sua proposta vale só até o fim desta semana — os preços dos equipamentos estão em alta. Quer que eu reserve o seu kit com esse valor?"},{"id":"proposta-6","day":12,"hour":10,"type":"ligacao","priority":"media","title":"Última tentativa antes de arquivar","copy":"Pergunte com sinceridade: \"{nome}, o que te impede de seguir hoje?\" Ouça a objeção (preço, confiança, momento) e ofereça uma saída: nova simulação, outra forma de pagamento ou visita de um cliente atendido."}],"negociacao":[{"id":"negociacao-1","day":0,"hour":null,"type":"ligacao","priority":"alta","title":"Entender a objeção e negociar","copy":"Descubra a objeção real: \"Se resolvermos isso, você fecha hoje?\" Preço → mostre a economia mensal. Confiança → envie obras e avaliações. Momento → mostre quanto ele perde por mês esperando."},{"id":"negociacao-2","day":1,"hour":10,"type":"whatsapp","priority":"alta","title":"Enviar condição especial","copy":"{nome}, conversei com a diretoria e consegui uma condição especial para você fechar esta semana 🙌 Posso te mandar o contrato para assinar pelo celular?"},{"id":"negociacao-3","day":2,"hour":10,"type":"whatsapp","priority":"alta","title":"Enviar contrato e procuração para assinatura digital","copy":"{nome}, segue o link para assinar a procuração que nos permite cuidar de todo o processo com a Equatorial para você. É só abrir e assinar pelo celular, leva 1 minuto ✍️","action":"procuracao"},{"id":"negociacao-4","day":4,"hour":10,"type":"whatsapp","priority":"media","title":"Follow-up de fechamento","copy":"{nome}, conseguiu ver o contrato? Assim que você assinar, eu já reservo o seu kit e agendo a instalação 📅"}],"ganho":[{"id":"ganho-1","day":0,"hour":null,"type":"whatsapp","priority":"alta","title":"Boas-vindas ao cliente","copy":"{nome}, seja muito bem-vindo(a) à {empresa}! 🎉 A partir de agora eu acompanho cada etapa: projeto, aprovação na Equatorial, instalação e ligação do sistema. Qualquer dúvida, é só me chamar."},{"id":"ganho-2","day":0,"hour":null,"type":"tarefa","priority":"alta","title":"Gerar a procuração e enviar para assinatura","copy":"{nome}, para darmos entrada no seu projeto na Equatorial, preciso que você assine a procuração pelo link abaixo. É rapidinho, direto pelo celular ✍️","action":"procuracao"},{"id":"ganho-3","day":1,"hour":10,"type":"tarefa","priority":"media","title":"Enviar kit de boas-vindas (material gráfico e cronograma)","copy":"{nome}, preparei um material para você acompanhar tudo: o cronograma da sua instalação e as próximas etapas. Qualquer dúvida, me chama! 📘"},{"id":"ganho-4","day":15,"hour":10,"type":"whatsapp","priority":"media","title":"Atualizar o cliente sobre a homologação","copy":"Oi, {nome}! Passando para te atualizar: o seu projeto está em análise na Equatorial e está tudo correndo bem. Assim que tivermos a aprovação, eu te aviso para agendarmos a instalação ⚡"},{"id":"ganho-5","day":45,"hour":10,"type":"whatsapp","priority":"media","title":"Pedir avaliação no Google","copy":"{nome}, que alegria ver seu sistema funcionando! ☀️ Você poderia deixar uma avaliação sobre a {empresa} no Google? Leva 30 segundos e ajuda muito o nosso trabalho 🙏"},{"id":"ganho-6","day":60,"hour":10,"type":"whatsapp","priority":"media","title":"Pedir indicações","copy":"{nome}, e aí, já está curtindo a conta de luz menor? ☀️ Se tiver amigos ou familiares que também querem economizar, me passa o contato — quem indica ganha um presente especial da {empresa} 🎁"},{"id":"ganho-7","day":180,"hour":10,"type":"ligacao","priority":"baixa","title":"Oferecer limpeza e manutenção preventiva","copy":"{nome}, seu sistema completa 6 meses! Poeira e fuligem nas placas podem reduzir a geração em até 25%. Posso agendar uma limpeza com inspeção completa?"}],"perdido":[{"id":"perdido-1","day":30,"hour":10,"type":"whatsapp","priority":"baixa","title":"Reativação: novas condições","copy":"Oi, {nome}! Tudo bem? Faz um tempinho que conversamos sobre {interesse}. Saíram novas condições de pagamento este mês — quer que eu atualize a sua simulação, sem compromisso?"},{"id":"perdido-2","day":90,"hour":10,"type":"whatsapp","priority":"baixa","title":"Reativação: aumento da tarifa","copy":"{nome}, a tarifa de energia subiu de novo 📈 Cada mês sem energia solar é dinheiro que não volta. Posso refazer os cálculos com a sua conta mais recente?"}]}} $cadence$::jsonb)
 where id = 1 and not (data ? 'cadence');

-- Horário da tarefa: dia 0 sem hora = em 10 minutos; domingo passa para segunda.
create or replace function public.cadence_due(p_day int, p_hour int)
returns timestamptz language plpgsql stable as $$
declare
  tz text := 'America/Maceio';
  d timestamptz;
begin
  if coalesce(p_day, 0) = 0 and p_hour is null then
    return now() + interval '10 minutes';
  end if;
  d := (date_trunc('day', now() at time zone tz) + make_interval(days => greatest(coalesce(p_day, 0), 0), hours => least(greatest(coalesce(p_hour, 9), 0), 23))) at time zone tz;
  if extract(dow from d at time zone tz) = 0 then
    d := d + interval '1 day';
  end if;
  if d < now() + interval '30 minutes' then
    d := now() + interval '2 hours';
  end if;
  return d;
end;
$$;

create or replace function public.apply_cadence()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb;
  step jsonb;
  who uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  select data -> 'cadence' into cfg from public.settings where id = 1;
  if cfg is null or coalesce(cfg ->> 'enabled', 'true') = 'false' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    delete from public.tasks where lead_id = new.id and cadence is not null and not done;
  end if;
  who := coalesce(new.owner_id, new.created_by);
  for step in select * from jsonb_array_elements(coalesce(cfg -> 'stages' -> new.status, '[]'::jsonb)) loop
    begin
      insert into public.tasks (title, type, priority, due_at, lead_id, assigned_to, created_by, cadence, copy, action)
      values (
        left(coalesce(nullif(trim(step ->> 'title'), ''), 'Follow-up'), 200),
        coalesce(step ->> 'type', 'tarefa'),
        coalesce(step ->> 'priority', 'media'),
        public.cadence_due((step ->> 'day')::int, (step ->> 'hour')::int),
        new.id, who, who, new.status,
        nullif(left(step ->> 'copy', 4000), ''),
        nullif(step ->> 'action', '')
      );
    exception when others then
      raise warning 'cadência: passo ignorado (%)', sqlerrm;
    end;
  end loop;
  return new;
end;
$$;
drop trigger if exists leads_cadence on public.leads;
create trigger leads_cadence after insert or update of status on public.leads
  for each row execute function public.apply_cadence();

-- -----------------------------------------------------------------------------
-- Documentos com assinatura eletrônica (procuração, contrato de aluguel e contrato solar)
-- -----------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('procuracao', 'aluguel', 'contrato', 'moto')),
  title text not null,
  lead_id uuid references public.leads (id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'assinado', 'cancelado')),
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_lead_idx on public.documents (lead_id);
-- Bancos criados antes do contrato solar: amplia os tipos aceitos.
alter table public.documents drop constraint if exists documents_kind_check;
alter table public.documents add constraint documents_kind_check check (kind in ('procuracao', 'aluguel', 'contrato', 'moto'));

create table if not exists public.document_signers (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  role text not null,
  name text not null,
  email text,
  phone text,
  cpf text,
  position int not null default 0,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  viewed_at timestamptz,
  signed_at timestamptz,
  signed_name text,
  signed_cpf text,
  signature text,
  ip text,
  user_agent text,
  content_hash text,
  created_at timestamptz not null default now(),
  unique (document_id, role)
);
create index if not exists document_signers_doc_idx on public.document_signers (document_id);
-- Selfie de segurança tirada logo após a assinatura (comprova a autoria).
alter table public.document_signers add column if not exists selfie text;
alter table public.document_signers add column if not exists selfie_at timestamptz;

alter table public.documents enable row level security;
alter table public.document_signers enable row level security;
drop policy if exists "team_all" on public.documents;
create policy "team_all" on public.documents for all to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "team_all" on public.document_signers;
create policy "team_all" on public.document_signers for all to authenticated using (public.is_member()) with check (public.is_member());

drop trigger if exists touch_documents on public.documents;
create trigger touch_documents before update on public.documents for each row execute function public.touch_updated_at();

-- Depois da primeira assinatura, o texto do documento não pode mais mudar.
create or replace function public.guard_document()
returns trigger language plpgsql as $$
begin
  if new.data is distinct from old.data or new.kind is distinct from old.kind then
    if exists (select 1 from public.document_signers where document_id = old.id and signed_at is not null) then
      raise exception 'Documento já assinado: crie uma nova versão para alterar o texto.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists documents_guard on public.documents;
create trigger documents_guard before update on public.documents for each row execute function public.guard_document();

-- Uma assinatura registrada é permanente.
create or replace function public.guard_signer()
returns trigger language plpgsql as $$
begin
  if old.signed_at is not null then
    -- Única exceção: anexar a selfie de segurança uma vez, sem mudar mais nada.
    if old.selfie is null and new.selfie is not null
       and (to_jsonb(new) - 'selfie' - 'selfie_at') = (to_jsonb(old) - 'selfie' - 'selfie_at') then
      return new;
    end if;
    raise exception 'Assinatura já registrada não pode ser alterada.';
  end if;
  return new;
end;
$$;
drop trigger if exists document_signers_guard on public.document_signers;
create trigger document_signers_guard before update on public.document_signers for each row execute function public.guard_signer();

-- Código de verificação do conteúdo assinado.
create or replace function public.document_hash(p_doc public.documents)
returns text language sql immutable as $$
  select encode(sha256(convert_to(p_doc.kind || ':' || p_doc.data::text, 'UTF8')), 'hex');
$$;

-- Página pública de assinatura: documento, quem assina e o registro das assinaturas.
create or replace function public.get_public_document(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s public.document_signers;
  d public.documents;
begin
  select * into s from public.document_signers where token = p_token;
  if s.id is null then
    return null;
  end if;
  select * into d from public.documents where id = s.document_id;
  if d.status = 'cancelado' then
    return jsonb_build_object('cancelled', true);
  end if;
  return jsonb_build_object(
    'document', jsonb_build_object('id', d.id, 'kind', d.kind, 'title', d.title, 'data', d.data, 'status', d.status,
                                   'created_at', d.created_at, 'completed_at', d.completed_at, 'hash', public.document_hash(d)),
    'signer', jsonb_build_object('role', s.role, 'name', s.name, 'cpf', s.cpf, 'signed_at', s.signed_at, 'signed_name', s.signed_name, 'selfie_at', s.selfie_at),
    'signers', (select coalesce(jsonb_agg(jsonb_build_object(
                  'role', x.role, 'name', x.name, 'signed_at', x.signed_at, 'signed_name', x.signed_name,
                  'signed_cpf', x.signed_cpf, 'signature', x.signature, 'ip', x.ip, 'content_hash', x.content_hash,
                  'selfie_at', x.selfie_at
                ) order by x.position), '[]'::jsonb)
                from public.document_signers x where x.document_id = d.id),
    'company', (select jsonb_build_object('company_name', data ->> 'company_name', 'logo_url', data ->> 'logo_url',
                  'whatsapp', data ->> 'whatsapp', 'phone', data ->> 'phone', 'email', data ->> 'email')
                from public.settings where id = 1),
    'seller', (select jsonb_build_object('name', p.full_name, 'email', p.email, 'phone', p.phone) from public.profiles p where p.id = d.created_by)
  );
end;
$$;

create or replace function public.view_public_document(p_token text)
returns void language sql security definer set search_path = public as $$
  update public.document_signers set viewed_at = now() where token = p_token and viewed_at is null and signed_at is null;
$$;

create or replace function public.sign_public_document(p_token text, p_name text, p_cpf text, p_signature text, p_ip text, p_ua text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.document_signers;
  d public.documents;
  pending int;
begin
  if coalesce(length(trim(p_name)), 0) < 5 or length(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g')) not in (11, 14)
     or p_signature not like 'data:image/png;base64,%' or length(p_signature) > 300000 then
    return jsonb_build_object('ok', false, 'error', 'dados');
  end if;
  select * into s from public.document_signers where token = p_token for update;
  if s.id is null or s.signed_at is not null then
    return jsonb_build_object('ok', false, 'error', 'assinado');
  end if;
  select * into d from public.documents where id = s.document_id;
  if d.status = 'cancelado' then
    return jsonb_build_object('ok', false, 'error', 'cancelado');
  end if;

  update public.document_signers
     set signed_at = now(), signed_name = left(trim(p_name), 160), signed_cpf = left(regexp_replace(p_cpf, '\D', '', 'g'), 14),
         signature = p_signature, ip = left(p_ip, 64), user_agent = left(p_ua, 300), content_hash = public.document_hash(d),
         viewed_at = coalesce(viewed_at, now())
   where id = s.id;

  select count(*) into pending from public.document_signers where document_id = d.id and signed_at is null;
  update public.documents
     set status = case when pending = 0 then 'assinado' else 'enviado' end,
         completed_at = case when pending = 0 then now() else null end
   where id = d.id;

  if d.lead_id is not null then
    insert into public.activities (lead_id, type, content)
    values (d.lead_id, 'documento', d.title || ': assinado por ' || left(trim(p_name), 160) || case when pending = 0 then ' (todas as assinaturas concluídas)' else '' end);
  end if;
  return jsonb_build_object('ok', true, 'completed', pending = 0, 'title', d.title, 'document_id', d.id, 'lead_id', d.lead_id);
end;
$$;

-- Selfie de segurança: só depois de assinar, uma única vez, JPEG de até ~500 KB.
create or replace function public.attach_signer_selfie(p_token text, p_selfie text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.document_signers;
begin
  if p_selfie not like 'data:image/jpeg;base64,%' or length(p_selfie) > 700000 then
    return jsonb_build_object('ok', false, 'error', 'imagem');
  end if;
  select * into s from public.document_signers where token = p_token for update;
  if s.id is null or s.signed_at is null then
    return jsonb_build_object('ok', false, 'error', 'nao_assinado');
  end if;
  if s.selfie is not null then
    return jsonb_build_object('ok', false, 'error', 'ja_enviada');
  end if;
  update public.document_signers set selfie = p_selfie, selfie_at = now() where id = s.id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.get_public_document(text) from public;
revoke all on function public.attach_signer_selfie(text, text) from public;
grant execute on function public.attach_signer_selfie(text, text) to anon, authenticated;
revoke all on function public.view_public_document(text) from public;
revoke all on function public.sign_public_document(text, text, text, text, text, text) from public;
grant execute on function public.get_public_document(text) to anon, authenticated;
grant execute on function public.view_public_document(text) to anon, authenticated;
grant execute on function public.sign_public_document(text, text, text, text, text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Marketing: artes prontas (Claude Design, Canva…) para baixar e postar
-- -----------------------------------------------------------------------------
create table if not exists public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  url text not null,
  path text,
  kind text not null default 'image' check (kind in ('image', 'video')),
  width int,
  height int,
  caption text,
  campaign text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists marketing_assets_created_idx on public.marketing_assets (created_at desc);
alter table public.marketing_assets enable row level security;
drop policy if exists "team_all" on public.marketing_assets;
create policy "team_all" on public.marketing_assets for all to authenticated using (public.is_member()) with check (public.is_member());

-- -----------------------------------------------------------------------------
-- Perfil: capa, frase de apresentação, bio e mural de atualizações
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists cover_url text;
alter table public.profiles add column if not exists headline text;
alter table public.profiles add column if not exists bio text;

create table if not exists public.profile_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists profile_updates_user_idx on public.profile_updates (user_id, created_at desc);
alter table public.profile_updates enable row level security;
drop policy if exists "team_read" on public.profile_updates;
create policy "team_read" on public.profile_updates for select to authenticated using (public.is_member());
drop policy if exists "own_insert" on public.profile_updates;
create policy "own_insert" on public.profile_updates for insert to authenticated with check (public.is_member() and user_id = auth.uid());
drop policy if exists "own_delete" on public.profile_updates;
create policy "own_delete" on public.profile_updates for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- Recibos emitidos (numeração sequencial e histórico)
-- -----------------------------------------------------------------------------
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  lead_id uuid references public.leads (id) on delete set null,
  payer_name text not null,
  payer_doc text,
  amount numeric not null check (amount > 0),
  description text not null,
  method text,
  installment text,
  paid_at date not null default current_date,
  city text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists receipts_created_idx on public.receipts (created_at desc);
alter table public.receipts enable row level security;
drop policy if exists "team_all" on public.receipts;
create policy "team_all" on public.receipts for all to authenticated using (public.is_member()) with check (public.is_member());

-- -----------------------------------------------------------------------------
-- Monitoramento de usinas (Solis, Deye, Solarman, Sungrow, Growatt, Huawei, Solplanet)
-- -----------------------------------------------------------------------------
create table if not exists public.monitoring_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  label text not null,
  status text not null default 'ok' check (status in ('ok', 'error', 'syncing')),
  last_error text,
  last_sync_at timestamptz,
  plants_count int not null default 0,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.monitoring_connections drop constraint if exists monitoring_connections_provider_check;
alter table public.monitoring_connections add constraint monitoring_connections_provider_check
  check (provider in ('solarz', 'solis', 'deye', 'solarman', 'sungrow', 'growatt', 'huawei', 'solplanet', 'goodwe', 'livoltek', 'foxess', 'apsystems', 'manual'));
alter table public.monitoring_connections enable row level security;
drop policy if exists "team_read" on public.monitoring_connections;
create policy "team_read" on public.monitoring_connections for select to authenticated using (public.is_member());
-- Criar, sincronizar e excluir passam pelo servidor (que valida e criptografa as credenciais).

-- Credenciais criptografadas (AES-256-GCM no servidor). Sem políticas: só a service role lê.
create table if not exists public.monitoring_secrets (
  connection_id uuid primary key references public.monitoring_connections (id) on delete cascade,
  payload text not null,
  updated_at timestamptz not null default now()
);
alter table public.monitoring_secrets enable row level security;
revoke all on public.monitoring_secrets from anon, authenticated;

create table if not exists public.monitoring_plants (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.monitoring_connections (id) on delete cascade,
  provider text not null,
  external_id text not null,
  name text not null,
  capacity_kwp numeric,
  power_kw numeric,
  today_kwh numeric,
  month_kwh numeric,
  total_kwh numeric,
  status text not null default 'unknown' check (status in ('online', 'offline', 'alarm', 'unknown')),
  last_update_at timestamptz,
  address text,
  lead_id uuid references public.leads (id) on delete set null,
  synced_at timestamptz not null default now(),
  unique (connection_id, external_id)
);
create index if not exists monitoring_plants_lead_idx on public.monitoring_plants (lead_id);
alter table public.monitoring_plants enable row level security;
drop policy if exists "team_read" on public.monitoring_plants;
create policy "team_read" on public.monitoring_plants for select to authenticated using (public.is_member());
-- A equipe pode vincular a usina a um cliente do CRM (só a coluna lead_id).
drop policy if exists "team_link" on public.monitoring_plants;
create policy "team_link" on public.monitoring_plants for update to authenticated using (public.is_member()) with check (public.is_member());
revoke update on public.monitoring_plants from authenticated;
grant update (lead_id) on public.monitoring_plants to authenticated;

create table if not exists public.monitoring_daily (
  plant_id uuid not null references public.monitoring_plants (id) on delete cascade,
  day date not null,
  kwh numeric not null,
  primary key (plant_id, day)
);
alter table public.monitoring_daily enable row level security;
drop policy if exists "team_read" on public.monitoring_daily;
create policy "team_read" on public.monitoring_daily for select to authenticated using (public.is_member());

-- Baixar uma vez, mostrar do banco: controle do que já foi baixado e do ritmo das consultas
alter table public.monitoring_plants add column if not exists details_synced_at timestamptz;
alter table public.monitoring_plants add column if not exists devices jsonb;
alter table public.monitoring_plants add column if not exists devices_at timestamptz;
alter table public.monitoring_connections add column if not exists retry_after timestamptz;

create table if not exists public.monitoring_months (
  plant_id uuid not null references public.monitoring_plants (id) on delete cascade,
  month text not null,
  kwh numeric,
  -- dia a dia do mês já baixado por completo (mês passado não é consultado de novo)
  complete boolean not null default false,
  fetched_at timestamptz not null default now(),
  primary key (plant_id, month)
);
alter table public.monitoring_months enable row level security;
drop policy if exists "team_read" on public.monitoring_months;
create policy "team_read" on public.monitoring_months for select to authenticated using (public.is_member());

-- Histórico elétrico dos inversores (uma leitura por download)
create table if not exists public.monitoring_readings (
  plant_id uuid not null references public.monitoring_plants (id) on delete cascade,
  device_sn text not null,
  at timestamptz not null default now(),
  grid_v numeric,
  v_r numeric,
  v_s numeric,
  v_t numeric,
  v_line numeric,
  i_r numeric,
  i_s numeric,
  i_t numeric,
  power_kw numeric,
  temp_c numeric,
  freq_hz numeric,
  dc_v numeric,
  dc_i numeric,
  phases int,
  primary key (plant_id, device_sn, at)
);
create index if not exists monitoring_readings_at_idx on public.monitoring_readings (plant_id, at desc);
alter table public.monitoring_readings enable row level security;
drop policy if exists "team_read" on public.monitoring_readings;
create policy "team_read" on public.monitoring_readings for select to authenticated using (public.is_member());

-- Alarmes (abertos enquanto a condição persiste; resolvidos quando some)
create table if not exists public.monitoring_alarms (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.monitoring_plants (id) on delete cascade,
  device_sn text not null default '',
  kind text not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  message text not null,
  value numeric,
  threshold numeric,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles (id) on delete set null,
  notified_at timestamptz
);
create unique index if not exists monitoring_alarms_open_idx on public.monitoring_alarms (plant_id, device_sn, kind) where resolved_at is null;
create index if not exists monitoring_alarms_recent_idx on public.monitoring_alarms (started_at desc);
alter table public.monitoring_alarms enable row level security;
drop policy if exists "team_read" on public.monitoring_alarms;
create policy "team_read" on public.monitoring_alarms for select to authenticated using (public.is_member());

-- -----------------------------------------------------------------------------
-- Rastreamento detalhado da proposta: seções lidas, tempo de leitura e cliques
-- -----------------------------------------------------------------------------
create table if not exists public.proposal_events (
  id bigint generated always as identity primary key,
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  kind text not null check (kind in ('open', 'section', 'time', 'click')),
  detail text,
  value int not null default 0,
  device text,
  created_at timestamptz not null default now()
);
create index if not exists proposal_events_proposal_idx on public.proposal_events (proposal_id, created_at);
alter table public.proposal_events enable row level security;
drop policy if exists "team_read" on public.proposal_events;
create policy "team_read" on public.proposal_events for select to authenticated using (public.is_member());

-- Grava um evento a partir do link público (sem login). Limita o volume por proposta.
create or replace function public.track_proposal_event(p_token text, p_kind text, p_detail text, p_value int, p_device text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if p_kind not in ('open', 'section', 'time', 'click') then
    return false;
  end if;
  select id into pid from public.proposals where public_token = p_token;
  if pid is null then
    return false;
  end if;
  if (select count(*) from public.proposal_events where proposal_id = pid) >= 3000 then
    return false;
  end if;
  insert into public.proposal_events (proposal_id, kind, detail, value, device)
  values (pid, p_kind, left(coalesce(p_detail, ''), 60), greatest(0, least(coalesce(p_value, 0), 120)), left(coalesce(p_device, ''), 20));
  return true;
end;
$$;
revoke all on function public.track_proposal_event(text, text, text, int, text) from public;
grant execute on function public.track_proposal_event(text, text, text, int, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Tempo real
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['leads', 'proposals', 'tasks', 'activities', 'settings', 'xp_events', 'profiles', 'documents', 'document_signers', 'marketing_assets', 'profile_updates', 'receipts', 'monitoring_connections', 'monitoring_plants', 'proposal_events', 'monitoring_alarms'] loop
      if not exists (
        select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Fotos (placas, inversores, capa e obras) — Supabase Storage, bucket público "media"
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('media', 'media', true)
    on conflict (id) do update set public = true;

    drop policy if exists "media_public_read" on storage.objects;
    create policy "media_public_read" on storage.objects for select using (bucket_id = 'media');
    drop policy if exists "media_team_insert" on storage.objects;
    create policy "media_team_insert" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_member());
    drop policy if exists "media_team_update" on storage.objects;
    create policy "media_team_update" on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_member());
    drop policy if exists "media_team_delete" on storage.objects;
    create policy "media_team_delete" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_member());
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Catálogos com acesso por cadastro (ex.: Quark Mobilidade · Black Friday).
-- Quem abre informa nome, telefone e e-mail; cada visita e clique fica registrado.
-- -----------------------------------------------------------------------------
create table if not exists public.catalog_access (
  id uuid primary key default gen_random_uuid(),
  catalog text not null,
  token uuid not null default gen_random_uuid() unique,
  lead_id uuid references public.leads (id) on delete set null,
  owner_id uuid references public.profiles (id) on delete set null,
  name text not null,
  phone text not null,
  email text,
  visits int not null default 1,
  seconds int not null default 0,
  interest text,
  device text,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);
create index if not exists catalog_access_recent_idx on public.catalog_access (catalog, last_at desc);
create unique index if not exists catalog_access_phone_idx on public.catalog_access (catalog, (regexp_replace(phone, '\D', '', 'g')));

create table if not exists public.catalog_events (
  id bigint generated always as identity primary key,
  access_id uuid not null references public.catalog_access (id) on delete cascade,
  kind text not null,
  detail text,
  value int not null default 0,
  at timestamptz not null default now()
);
create index if not exists catalog_events_access_idx on public.catalog_events (access_id, at desc);

alter table public.catalog_access enable row level security;
alter table public.catalog_events enable row level security;
drop policy if exists "catalog_access_team" on public.catalog_access;
create policy "catalog_access_team" on public.catalog_access for select to authenticated using (public.is_member());
drop policy if exists "catalog_access_admin_delete" on public.catalog_access;
create policy "catalog_access_admin_delete" on public.catalog_access for delete to authenticated using (public.is_admin());
drop policy if exists "catalog_events_team" on public.catalog_events;
create policy "catalog_events_team" on public.catalog_events for select to authenticated using (public.is_member());

-- Cadastro de quem abre o catálogo: cria (ou reaproveita) o lead e devolve o token de acesso.
create or replace function public.catalog_register(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_catalog text := left(coalesce(nullif(trim(p ->> 'catalog'), ''), 'catalogo'), 60);
  v_phone text := left(trim(coalesce(p ->> 'phone', '')), 30);
  v_digits text := regexp_replace(coalesce(p ->> 'phone', ''), '\D', '', 'g');
  v_email text := lower(left(nullif(trim(p ->> 'email'), ''), 160));
  v_name text := left(trim(coalesce(p ->> 'name', '')), 120);
  v_access public.catalog_access;
  v_lead jsonb;
  v_lead_id uuid;
  v_owner uuid;
begin
  if v_name = '' or length(v_digits) < 10 then
    raise exception 'nome e telefone são obrigatórios';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'e-mail inválido';
  end if;

  select * into v_access from public.catalog_access
  where catalog = v_catalog and regexp_replace(phone, '\D', '', 'g') = v_digits;

  if found then
    update public.catalog_access set
      visits = visits + 1, last_at = now(), name = v_name, email = coalesce(v_email, email),
      device = coalesce(left(p ->> 'device', 20), device)
    where id = v_access.id
    returning * into v_access;
    insert into public.catalog_events (access_id, kind, detail) values (v_access.id, 'open', 'cadastro');
    if v_access.lead_id is not null then
      insert into public.activities (lead_id, type, content)
      values (v_access.lead_id, 'nota', 'Abriu o catálogo ' || v_catalog || ' de novo (' || v_access.visits || 'ª visita)');
    end if;
    return jsonb_build_object('token', v_access.token, 'visits', v_access.visits, 'returning', true);
  end if;

  v_lead := public.create_public_lead(jsonb_build_object(
    'name', v_name, 'phone', v_phone, 'email', v_email,
    'segment', coalesce(nullif(p ->> 'segment', ''), 'mobilidade'),
    'source', left(coalesce(nullif(p ->> 'source', ''), 'Catálogo'), 40),
    'temperature', 'morno', 'owner', p ->> 'owner',
    'notes', 'Abriu o catálogo ' || v_catalog
  ));
  v_lead_id := nullif(v_lead ->> 'id', '')::uuid;
  begin
    v_owner := nullif(p ->> 'owner', '')::uuid;
    perform 1 from public.profiles where id = v_owner and active;
    if not found then v_owner := null; end if;
  exception when others then v_owner := null;
  end;

  insert into public.catalog_access (catalog, lead_id, owner_id, name, phone, email, device)
  values (v_catalog, v_lead_id, v_owner, v_name, v_phone, v_email, left(p ->> 'device', 20))
  returning * into v_access;
  insert into public.catalog_events (access_id, kind, detail) values (v_access.id, 'open', 'cadastro');
  return jsonb_build_object('token', v_access.token, 'visits', 1, 'returning', false, 'lead', v_lead);
end;
$$;
revoke all on function public.catalog_register(jsonb) from public;
grant execute on function public.catalog_register(jsonb) to anon, authenticated;

-- Visitante que já se cadastrou volta pelo mesmo navegador: conta mais uma visita.
create or replace function public.catalog_visit(p_token uuid, p_device text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.catalog_access;
begin
  update public.catalog_access set visits = visits + 1, last_at = now(), device = coalesce(left(p_device, 20), device)
  where token = p_token returning * into v;
  if not found then return null; end if;
  insert into public.catalog_events (access_id, kind, detail) values (v.id, 'open', 'retorno');
  if v.lead_id is not null then
    insert into public.activities (lead_id, type, content)
    values (v.lead_id, 'nota', 'Abriu o catálogo ' || v.catalog || ' de novo (' || v.visits || 'ª visita)');
  end if;
  return jsonb_build_object('name', v.name, 'visits', v.visits);
end;
$$;
revoke all on function public.catalog_visit(uuid, text) from public;
grant execute on function public.catalog_visit(uuid, text) to anon, authenticated;

-- Seções vistas, tempo de leitura e cliques (interesse em modelos, WhatsApp).
create or replace function public.catalog_track(p_token uuid, p_kind text, p_detail text default null, p_value int default 0)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.catalog_access;
  v_kind text := left(coalesce(p_kind, ''), 20);
begin
  if v_kind not in ('section', 'time', 'click', 'interest') then return; end if;
  select * into v from public.catalog_access where token = p_token;
  if not found then return; end if;
  -- Proteção contra excesso de eventos: no máximo 400 por acesso
  if (select count(*) from public.catalog_events where access_id = v.id) >= 400 then return; end if;
  insert into public.catalog_events (access_id, kind, detail, value)
  values (v.id, v_kind, left(p_detail, 80), greatest(0, least(coalesce(p_value, 0), 3600)));
  if v_kind = 'time' then
    update public.catalog_access set seconds = seconds + greatest(0, least(coalesce(p_value, 0), 600)), last_at = now() where id = v.id;
  elsif v_kind = 'interest' then
    update public.catalog_access set interest = left(p_detail, 80), last_at = now() where id = v.id;
    if v.lead_id is not null then
      insert into public.activities (lead_id, type, content) values (v.lead_id, 'nota', 'Quer a scooter ' || left(p_detail, 80) || ' (catálogo ' || v.catalog || ')');
      update public.leads set temperature = 'quente' where id = v.lead_id;
    end if;
  end if;
end;
$$;
revoke all on function public.catalog_track(uuid, text, text, int) from public;
grant execute on function public.catalog_track(uuid, text, text, int) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'catalog_access') then
    alter publication supabase_realtime add table public.catalog_access;
  end if;
end $$;

-- Atualiza o cache da API do Supabase para as funções novas aparecerem na hora
notify pgrst, 'reload schema';

-- Fotos extras dos produtos do catálogo (vários ângulos), enviadas pela equipe no CRM
create table if not exists public.catalog_photos (
  id uuid primary key default gen_random_uuid(),
  catalog text not null,
  model text not null,
  url text not null,
  caption text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists catalog_photos_idx on public.catalog_photos (catalog, model, position);
alter table public.catalog_photos enable row level security;
drop policy if exists "catalog_photos_public" on public.catalog_photos;
create policy "catalog_photos_public" on public.catalog_photos for select using (true);
drop policy if exists "catalog_photos_team" on public.catalog_photos;
create policy "catalog_photos_team" on public.catalog_photos for all to authenticated using (public.is_member()) with check (public.is_member());

notify pgrst, 'reload schema';

-- Modelos de scooter cadastrados no CRM (ficha técnica, custos, preço e parcelamento)
create table if not exists public.moto_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kicker text not null default '',
  pitch text not null default '',
  for_who text not null default '',
  accent text not null default '#9FDB7C',
  photo text not null default '',
  gallery jsonb not null default '[]'::jsonb,
  colors text[] not null default '{}',
  specs jsonb not null default '{}'::jsonb,
  costs jsonb not null default '{}'::jsonb,
  price numeric not null default 0,
  installments int not null default 21,
  rate numeric not null default 2.1,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.moto_products enable row level security;
drop policy if exists "moto_products_team" on public.moto_products;
create policy "moto_products_team" on public.moto_products for all to authenticated using (public.is_member()) with check (public.is_member());

-- Catálogo online: só os dados públicos dos modelos ativos (nunca os custos).
create or replace function public.get_public_motos()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'slug', slug, 'name', name, 'kicker', kicker, 'pitch', pitch, 'forWho', for_who,
    'accent', accent, 'photo', photo, 'gallery', gallery, 'colors', to_jsonb(colors), 'specs', specs,
    'price', price, 'installments', installments, 'rate', rate
  ) order by position, name), '[]'::jsonb)
  from public.moto_products where active and price > 0;
$$;
revoke all on function public.get_public_motos() from public;
grant execute on function public.get_public_motos() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Portal do cliente (/cliente): o comprador entra com CPF + 4 últimos dígitos do
-- celular da venda e vê o manual, a garantia, o comprovante e o contrato.
-- -----------------------------------------------------------------------------
create table if not exists public.portal_attempts (
  id bigint generated always as identity primary key,
  key text not null,
  ip text,
  ok boolean not null default false,
  at timestamptz not null default now()
);
create index if not exists portal_attempts_key_idx on public.portal_attempts (key, at);
create index if not exists portal_attempts_ip_idx on public.portal_attempts (ip, at);
-- Sem políticas: só as funções abaixo (security definer) leem e gravam.
alter table public.portal_attempts enable row level security;

-- Ficha do cliente da Mobilidade (contatos atualizados, foto 3/4 e anotações).
-- A chave é a mesma do CRM: 'doc:' + CPF/CNPJ só com números.
create table if not exists public.moto_customers (
  key text primary key,
  name text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  cep text,
  photo text,
  notes text,
  updated_at timestamptz not null default now()
);
alter table public.moto_customers enable row level security;
drop policy if exists "moto_customers_team" on public.moto_customers;
create policy "moto_customers_team" on public.moto_customers for all to authenticated using (public.is_member()) with check (public.is_member());

-- Dados que chegam depois da venda (sem mexer no contrato assinado): números da scooter e entrega.
create table if not exists public.moto_sale_info (
  document_id uuid primary key references public.documents (id) on delete cascade,
  chassis text,
  motor_no text,
  battery_no text,
  charger_no text,
  delivery_date date,
  updated_at timestamptz not null default now()
);
alter table public.moto_sale_info enable row level security;
drop policy if exists "moto_sale_info_team" on public.moto_sale_info;
create policy "moto_sale_info_team" on public.moto_sale_info for all to authenticated using (public.is_member()) with check (public.is_member());
-- Transferência de propriedade: o novo dono passa a valer por cima do comprador do contrato.
alter table public.moto_sale_info add column if not exists owner jsonb;
alter table public.moto_sale_info add column if not exists transferred_at timestamptz;

-- Venda com as atualizações da ficha aplicadas (o que o cliente vê).
create or replace function public.moto_effective_data(p_data jsonb, p_info public.moto_sale_info, p_cust public.moto_customers)
returns jsonb language sql immutable as $$
  select (p_data - 'contractorSignature')
    || jsonb_strip_nulls(jsonb_build_object(
         'chassis', nullif(p_info.chassis, ''), 'motorNo', nullif(p_info.motor_no, ''),
         'batteryNo', nullif(p_info.battery_no, ''), 'chargerNo', nullif(p_info.charger_no, '')))
    || jsonb_build_object(
         'delivery', coalesce(p_data -> 'delivery', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('date', p_info.delivery_date::text)),
         'transferredAt', p_info.transferred_at,
         'client', coalesce(p_info.owner, p_data -> 'client', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
           'phone', nullif(p_cust.phone, ''), 'email', nullif(p_cust.email, ''), 'address', nullif(p_cust.address, ''),
           'city', nullif(p_cust.city, ''), 'state', nullif(p_cust.state, ''), 'cep', nullif(p_cust.cep, ''))));
$$;

-- Documento (só dígitos) do dono atual: o novo dono, se houve transferência; senão o comprador.
create or replace function public.moto_owner_doc(p_data jsonb, p_info public.moto_sale_info)
returns text language sql immutable as $$
  select regexp_replace(coalesce(nullif(p_info.owner ->> 'doc', ''), p_data -> 'client' ->> 'doc', ''), '\D', '', 'g');
$$;
create or replace function public.moto_owner_phone(p_data jsonb, p_info public.moto_sale_info)
returns text language sql immutable as $$
  select regexp_replace(coalesce(nullif(p_info.owner ->> 'phone', ''), p_data -> 'client' ->> 'phone', ''), '\D', '', 'g');
$$;

create table if not exists public.moto_transfers (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  status text not null default 'analise' check (status in ('analise', 'aprovada', 'recusada', 'concluida', 'cancelada')),
  from_name text,
  from_doc text not null,
  new_owner jsonb not null,
  reason text,
  notes text,
  fee numeric not null default 50,
  paid_at timestamptz,
  decision_note text,
  decided_at timestamptz,
  completed_at timestamptz,
  ip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists moto_transfers_doc on public.moto_transfers (document_id, created_at desc);
alter table public.moto_transfers enable row level security;
drop policy if exists "moto_transfers_team" on public.moto_transfers;
create policy "moto_transfers_team" on public.moto_transfers for all to authenticated using (public.is_member()) with check (public.is_member());

create or replace function public.get_client_portal(p_cpf text, p_check text, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_check text := regexp_replace(coalesce(p_check, ''), '\D', '', 'g');
  v_key text;
  v_ip text := left(nullif(trim(p_ip), ''), 64);
  v_ok boolean;
  v_sales jsonb;
  v_cust public.moto_customers;
begin
  if length(v_doc) not in (11, 14) or length(v_check) <> 4 then
    return jsonb_build_object('ok', false, 'error', 'dados');
  end if;
  v_key := encode(sha256(convert_to('portal:' || v_doc, 'UTF8')), 'hex');

  -- Limite contra tentativas: 5 erros por CPF ou 20 por IP em 15 minutos.
  delete from public.portal_attempts where at < now() - interval '1 day';
  if (select count(*) from public.portal_attempts where key = v_key and not ok and at > now() - interval '15 minutes') >= 5
     or (v_ip is not null and (select count(*) from public.portal_attempts where ip = v_ip and not ok and at > now() - interval '15 minutes') >= 20) then
    return jsonb_build_object('ok', false, 'error', 'bloqueado');
  end if;

  select * into v_cust from public.moto_customers where key = 'doc:' || v_doc;

  -- Senha = 4 últimos dígitos do celular (o atualizado na ficha vale; o da venda também).
  select exists (
    select 1 from public.documents d
    left join public.moto_sale_info i on i.document_id = d.id
    where d.kind = 'moto' and d.status in ('enviado', 'assinado')
      and public.moto_owner_doc(d.data, i) = v_doc
      and (right(public.moto_owner_phone(d.data, i), 4) = v_check
           or right(regexp_replace(coalesce(v_cust.phone, ''), '\D', '', 'g'), 4) = v_check)
  ) into v_ok;

  insert into public.portal_attempts (key, ip, ok) values (v_key, v_ip, v_ok);
  if not v_ok then
    -- Mesmo erro para CPF inexistente e dígitos errados: não revela quem é cliente.
    return jsonb_build_object('ok', false, 'error', 'nao_encontrado');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id,
           'status', d.status,
           'created_at', d.created_at,
           'completed_at', d.completed_at,
           'data', public.moto_effective_data(d.data, i, v_cust),
           'signed_at', s.signed_at,
           'token', s.token,
           -- Foto 3/4 do cartão: a salva na ficha ou, na falta, a selfie da assinatura.
           -- Depois de transferida, a selfie do comprador original não vale para o novo dono.
           'selfie', coalesce(v_cust.photo, case when i.owner is null then s.selfie end),
           'transfer', (select jsonb_build_object('id', t.id, 'status', t.status, 'created_at', t.created_at, 'new_owner', t.new_owner ->> 'name',
                                                  'decision_note', t.decision_note, 'fee', t.fee, 'paid', t.paid_at is not null)
                          from public.moto_transfers t where t.document_id = d.id and t.from_doc = v_doc
                         order by t.created_at desc limit 1)
         ) order by d.created_at desc), '[]'::jsonb)
    into v_sales
    from public.documents d
    left join public.document_signers s on s.document_id = d.id and s.role = 'comprador'
    left join public.moto_sale_info i on i.document_id = d.id
   where d.kind = 'moto' and d.status in ('enviado', 'assinado')
     and public.moto_owner_doc(d.data, i) = v_doc;

  return jsonb_build_object(
    'ok', true,
    'sales', v_sales,
    'company', (select jsonb_build_object(
                  'company_name', data ->> 'company_name', 'legal_name', data ->> 'legal_name', 'cnpj', data ->> 'cnpj',
                  'address', data ->> 'address', 'city', data ->> 'city', 'phone', data ->> 'phone', 'whatsapp', data ->> 'whatsapp',
                  'email', data ->> 'email', 'instagram', data ->> 'instagram', 'logo_url', data ->> 'logo_url')
                from public.settings where id = 1)
  );
end;
$$;
revoke all on function public.get_client_portal(text, text, text) from public;
grant execute on function public.get_client_portal(text, text, text) to anon, authenticated;

-- O próprio cliente salva a foto 3/4 do cartão (mesma verificação do login da área do cliente).
create or replace function public.set_client_photo(p_cpf text, p_check text, p_photo text, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  r jsonb;
begin
  if p_photo is not null and (p_photo not like 'data:image/jpeg;base64,%' or length(p_photo) > 700000) then
    return jsonb_build_object('ok', false, 'error', 'imagem');
  end if;
  r := public.get_client_portal(p_cpf, p_check, p_ip);
  if not coalesce((r ->> 'ok')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', coalesce(r ->> 'error', 'nao_encontrado'));
  end if;
  insert into public.moto_customers (key, photo, updated_at) values ('doc:' || v_doc, p_photo, now())
  on conflict (key) do update set photo = excluded.photo, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.set_client_photo(text, text, text, text) from public;
grant execute on function public.set_client_photo(text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Verificação pública do cartão do proprietário (QR code).
-- Recebe o id da venda (QR) ou o código de 10 caracteres impresso no cartão e
-- devolve só o necessário para conferir: nada de telefone, e-mail, endereço,
-- valores ou forma de pagamento. CPF sai mascarado.
-- ---------------------------------------------------------------------------
create or replace function public.verify_owner_card(p_ref text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ref text := lower(regexp_replace(coalesce(p_ref, ''), '[^0-9a-fA-F]', '', 'g'));
  v_id uuid;
  d public.documents;
  s public.document_signers;
  i public.moto_sale_info;
  c public.moto_customers;
  v_data jsonb;
  v_doc text;
  v_state text;
begin
  if length(v_ref) = 32 then
    v_id := v_ref::uuid;
  elsif length(v_ref) = 10 then
    -- Código impresso no cartão: os 10 últimos caracteres do id (precisa ser único).
    select x.id into v_id from public.documents x
     where x.kind = 'moto' and right(replace(x.id::text, '-', ''), 10) = v_ref
     limit 2;
    if (select count(*) from public.documents x where x.kind = 'moto' and right(replace(x.id::text, '-', ''), 10) = v_ref) <> 1 then
      return jsonb_build_object('found', false);
    end if;
  else
    return jsonb_build_object('found', false);
  end if;

  select * into d from public.documents where id = v_id and kind = 'moto';
  if not found then
    return jsonb_build_object('found', false);
  end if;
  select * into s from public.document_signers where document_id = d.id and role = 'comprador' limit 1;
  select * into i from public.moto_sale_info where document_id = d.id;
  v_doc := public.moto_owner_doc(d.data, i);
  select * into c from public.moto_customers where key = 'doc:' || v_doc;
  v_data := public.moto_effective_data(d.data, i, c);

  v_state := case
    when d.status = 'cancelado' then 'cancelado'
    when d.status = 'assinado' or s.signed_at is not null then 'original'
    else 'pendente'
  end;

  return jsonb_build_object(
    'found', true,
    'state', v_state,
    'id', d.id,
    'signed_at', coalesce(s.signed_at, d.completed_at),
    'photo', case when v_state = 'original' then coalesce(c.photo, case when i.owner is null then s.selfie end) end,
    'transferred_at', i.transferred_at,
    'data', jsonb_build_object(
      'client', jsonb_build_object(
        'name', v_data -> 'client' ->> 'name',
        'kind', v_data -> 'client' ->> 'kind',
        'doc', case when length(v_doc) = 11
                    then '***.' || substr(v_doc, 4, 3) || '.' || substr(v_doc, 7, 3) || '-**'
                    else v_data -> 'client' ->> 'doc' end),
      'model', v_data -> 'model',
      'modelName', v_data -> 'modelName',
      'color', v_data -> 'color',
      'year', v_data -> 'year',
      'chassis', v_data -> 'chassis',
      'motorNo', v_data -> 'motorNo',
      'batteryNo', v_data -> 'batteryNo',
      'chargerNo', v_data -> 'chargerNo',
      'specs', v_data -> 'specs',
      'photo', v_data -> 'photo',
      'delivery', jsonb_build_object('mode', v_data -> 'delivery' ->> 'mode', 'date', v_data -> 'delivery' ->> 'date'),
      'warrantyDays', v_data -> 'warrantyDays',
      'date', v_data -> 'date',
      'contractor', jsonb_build_object('name', v_data -> 'contractor' ->> 'name', 'doc', v_data -> 'contractor' ->> 'doc')),
    'company', (select jsonb_build_object(
                  'company_name', data ->> 'company_name', 'legal_name', data ->> 'legal_name', 'cnpj', data ->> 'cnpj',
                  'city', data ->> 'city', 'phone', data ->> 'phone', 'whatsapp', data ->> 'whatsapp')
                from public.settings where id = 1)
  );
end;
$$;
revoke all on function public.verify_owner_card(text) from public;
grant execute on function public.verify_owner_card(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pedido de transferência de propriedade, feito pelo dono na área do cliente.
-- A Quark analisa; aprovado e pago (taxa de R$ 50), a equipe conclui e o novo
-- dono passa a valer no cartão, na verificação e na área do cliente.
-- ---------------------------------------------------------------------------
create or replace function public.request_owner_transfer(p_cpf text, p_check text, p_document uuid, p_new jsonb, p_reason text, p_notes text, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_portal jsonb;
  v_sale jsonb;
  v_new_doc text := regexp_replace(coalesce(p_new ->> 'doc', ''), '\D', '', 'g');
  v_new_phone text := regexp_replace(coalesce(p_new ->> 'phone', ''), '\D', '', 'g');
  v_id uuid;
begin
  v_portal := public.get_client_portal(p_cpf, p_check, p_ip);
  if not coalesce((v_portal ->> 'ok')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'acesso');
  end if;
  select x into v_sale from jsonb_array_elements(v_portal -> 'sales') x where x ->> 'id' = p_document::text;
  if v_sale is null then
    return jsonb_build_object('ok', false, 'error', 'venda');
  end if;
  if v_sale ->> 'status' <> 'assinado' and v_sale ->> 'signed_at' is null then
    return jsonb_build_object('ok', false, 'error', 'nao_assinada');
  end if;
  if length(trim(coalesce(p_new ->> 'name', ''))) < 5 or length(v_new_doc) not in (11, 14) or length(v_new_phone) not between 10 and 13 then
    return jsonb_build_object('ok', false, 'error', 'dados');
  end if;
  if v_new_doc = v_doc then
    return jsonb_build_object('ok', false, 'error', 'mesmo_dono');
  end if;
  if exists (select 1 from public.moto_transfers where document_id = p_document and status in ('analise', 'aprovada')) then
    return jsonb_build_object('ok', false, 'error', 'em_andamento');
  end if;
  -- Contra abuso: no máximo 3 pedidos por venda em 24 horas.
  if (select count(*) from public.moto_transfers where document_id = p_document and created_at > now() - interval '1 day') >= 3 then
    return jsonb_build_object('ok', false, 'error', 'limite');
  end if;

  insert into public.moto_transfers (document_id, from_name, from_doc, new_owner, reason, notes, ip)
  values (
    p_document,
    v_sale -> 'data' -> 'client' ->> 'name',
    v_doc,
    jsonb_build_object(
      'name', left(trim(p_new ->> 'name'), 120),
      'doc', v_new_doc,
      'kind', case when length(v_new_doc) = 14 then 'pj' else 'pf' end,
      'phone', v_new_phone,
      'email', left(trim(coalesce(p_new ->> 'email', '')), 120),
      'cep', left(regexp_replace(coalesce(p_new ->> 'cep', ''), '\D', '', 'g'), 8),
      'address', left(trim(coalesce(p_new ->> 'address', '')), 200),
      'city', left(trim(coalesce(p_new ->> 'city', '')), 80),
      'state', upper(left(trim(coalesce(p_new ->> 'state', '')), 2))),
    left(trim(coalesce(p_reason, '')), 40),
    left(trim(coalesce(p_notes, '')), 600),
    left(nullif(trim(p_ip), ''), 64))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
revoke all on function public.request_owner_transfer(text, text, uuid, jsonb, text, text, text) from public;
grant execute on function public.request_owner_transfer(text, text, uuid, jsonb, text, text, text) to anon, authenticated;

-- Decisão da equipe: aprovar, recusar, marcar pago, concluir ou cancelar.
create or replace function public.decide_owner_transfer(p_id uuid, p_action text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.moto_transfers;
begin
  if not public.is_member() then
    return jsonb_build_object('ok', false, 'error', 'permissao');
  end if;
  select * into t from public.moto_transfers where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'nao_encontrado');
  end if;

  if p_action = 'aprovar' and t.status = 'analise' then
    update public.moto_transfers set status = 'aprovada', decision_note = nullif(trim(coalesce(p_note, '')), ''), decided_at = now(), updated_at = now() where id = p_id;
  elsif p_action = 'recusar' and t.status in ('analise', 'aprovada') then
    if length(trim(coalesce(p_note, ''))) < 3 then
      return jsonb_build_object('ok', false, 'error', 'motivo');
    end if;
    update public.moto_transfers set status = 'recusada', decision_note = trim(p_note), decided_at = now(), updated_at = now() where id = p_id;
  elsif p_action = 'pago' and t.status = 'aprovada' then
    update public.moto_transfers set paid_at = coalesce(paid_at, now()), updated_at = now() where id = p_id;
  elsif p_action = 'concluir' and t.status = 'aprovada' then
    if t.paid_at is null then
      return jsonb_build_object('ok', false, 'error', 'nao_pago');
    end if;
    insert into public.moto_sale_info (document_id, owner, transferred_at, updated_at)
    values (t.document_id, t.new_owner, now(), now())
    on conflict (document_id) do update set owner = excluded.owner, transferred_at = excluded.transferred_at, updated_at = now();
    update public.moto_transfers set status = 'concluida', completed_at = now(), updated_at = now() where id = p_id;
  elsif p_action = 'cancelar' and t.status in ('analise', 'aprovada') then
    update public.moto_transfers set status = 'cancelada', decision_note = nullif(trim(coalesce(p_note, '')), ''), updated_at = now() where id = p_id;
  else
    return jsonb_build_object('ok', false, 'error', 'estado');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.decide_owner_transfer(uuid, text, text) from public;
grant execute on function public.decide_owner_transfer(uuid, text, text) to authenticated;

-- Atualização ao vivo no CRM (ficha, dados pós-venda e transferências).
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['moto_customers', 'moto_sale_info', 'moto_transfers'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Vendedores parceiros da Mobilidade (/vendedor): entram com telefone + código de
-- 4 dígitos, veem o catálogo para divulgar, indicam clientes e acompanham as
-- indicações. A equipe cadastra e acompanha tudo no CRM (Mobilidade → Vendedores).
-- ---------------------------------------------------------------------------
create table if not exists public.moto_sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  pin text not null default lpad((floor(random() * 10000))::int::text, 4, '0'),
  ref text not null default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  photo text,
  city text,
  instagram text,
  commission text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists moto_sellers_phone_idx on public.moto_sellers ((regexp_replace(phone, '\D', '', 'g')));
create unique index if not exists moto_sellers_ref_idx on public.moto_sellers (ref);
alter table public.moto_sellers enable row level security;
drop policy if exists "moto_sellers_team" on public.moto_sellers;
create policy "moto_sellers_team" on public.moto_sellers for all to authenticated using (public.is_member()) with check (public.is_member());

create table if not exists public.moto_referrals (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.moto_sellers (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  name text not null,
  phone text not null,
  model text,
  notes text,
  status text not null default 'nova' check (status in ('nova', 'contato', 'negociacao', 'fechada', 'perdida')),
  commission numeric,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists moto_referrals_seller on public.moto_referrals (seller_id, created_at desc);
alter table public.moto_referrals enable row level security;
drop policy if exists "moto_referrals_team" on public.moto_referrals;
create policy "moto_referrals_team" on public.moto_referrals for all to authenticated using (public.is_member()) with check (public.is_member());

-- Confere telefone + código (com limite de tentativas) e devolve o vendedor.
create or replace function public.seller_check(p_phone text, p_pin text, p_ip text)
returns public.moto_sellers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_key text;
  v_ip text := left(nullif(trim(p_ip), ''), 64);
  s public.moto_sellers;
begin
  v_phone := regexp_replace(v_phone, '^55(?=\d{10,11}$)', '');
  if length(v_phone) not between 10 and 11 or coalesce(p_pin, '') !~ '^\d{4}$' then
    return null;
  end if;
  v_key := encode(sha256(convert_to('seller:' || v_phone, 'UTF8')), 'hex');
  if (select count(*) from public.portal_attempts where key = v_key and not ok and at > now() - interval '15 minutes') >= 5
     or (v_ip is not null and (select count(*) from public.portal_attempts where ip = v_ip and not ok and at > now() - interval '15 minutes') >= 20) then
    raise exception 'bloqueado';
  end if;
  select * into s from public.moto_sellers
   where active and regexp_replace(regexp_replace(phone, '\D', '', 'g'), '^55(?=\d{10,11}$)', '') = v_phone and pin = p_pin;
  insert into public.portal_attempts (key, ip, ok) values (v_key, v_ip, s.id is not null);
  return case when s.id is null then null else s end;
end;
$$;
revoke all on function public.seller_check(text, text, text) from public, anon, authenticated;

create or replace function public.seller_portal(p_phone text, p_pin text, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.moto_sellers;
begin
  begin
    s := public.seller_check(p_phone, p_pin, p_ip);
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'bloqueado');
  end;
  if s.id is null then
    return jsonb_build_object('ok', false, 'error', 'nao_encontrado');
  end if;
  return jsonb_build_object(
    'ok', true,
    'seller', jsonb_build_object('id', s.id, 'name', s.name, 'phone', s.phone, 'ref', s.ref, 'photo', s.photo, 'city', s.city,
                                 'instagram', s.instagram, 'commission', s.commission, 'since', s.created_at),
    'referrals', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'phone', r.phone, 'model', r.model, 'status', r.status,
                                                               'commission', r.commission, 'paid', r.paid_at is not null, 'created_at', r.created_at, 'updated_at', r.updated_at)
                                            order by r.created_at desc)
                           from public.moto_referrals r where r.seller_id = s.id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.seller_portal(text, text, text) from public;
grant execute on function public.seller_portal(text, text, text) to anon, authenticated;

-- Indicação feita pelo vendedor: vira lead da Mobilidade e entra no histórico dele.
create or replace function public.seller_refer(p_phone text, p_pin text, p_name text, p_client_phone text, p_model text, p_notes text, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.moto_sellers;
  v_client text := regexp_replace(coalesce(p_client_phone, ''), '\D', '', 'g');
  v_lead uuid;
  v_id uuid;
begin
  begin
    s := public.seller_check(p_phone, p_pin, p_ip);
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'bloqueado');
  end;
  if s.id is null then
    return jsonb_build_object('ok', false, 'error', 'acesso');
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(v_client) not between 10 and 13 then
    return jsonb_build_object('ok', false, 'error', 'dados');
  end if;
  if exists (select 1 from public.moto_referrals where seller_id = s.id and regexp_replace(phone, '\D', '', 'g') = v_client and created_at > now() - interval '30 days') then
    return jsonb_build_object('ok', false, 'error', 'repetida');
  end if;
  if (select count(*) from public.moto_referrals where seller_id = s.id and created_at > now() - interval '1 day') >= 30 then
    return jsonb_build_object('ok', false, 'error', 'limite');
  end if;

  insert into public.leads (name, phone, segment, source, temperature, notes)
  values (left(trim(p_name), 120), v_client, 'mobilidade', 'Vendedor parceiro', 'quente',
          concat_ws(E'\n', 'Indicação do vendedor ' || s.name || ' (' || s.phone || ')',
                    nullif('Modelo: ' || nullif(trim(coalesce(p_model, '')), ''), 'Modelo: '),
                    nullif(left(trim(coalesce(p_notes, '')), 600), '')))
  returning id into v_lead;

  insert into public.moto_referrals (seller_id, lead_id, name, phone, model, notes)
  values (s.id, v_lead, left(trim(p_name), 120), v_client, left(nullif(trim(coalesce(p_model, '')), ''), 60), left(nullif(trim(coalesce(p_notes, '')), ''), 600))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
revoke all on function public.seller_refer(text, text, text, text, text, text, text) from public;
grant execute on function public.seller_refer(text, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.seller_set_photo(p_phone text, p_pin text, p_photo text, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.moto_sellers;
begin
  if p_photo is not null and (p_photo not like 'data:image/jpeg;base64,%' or length(p_photo) > 700000) then
    return jsonb_build_object('ok', false, 'error', 'imagem');
  end if;
  begin
    s := public.seller_check(p_phone, p_pin, p_ip);
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'bloqueado');
  end;
  if s.id is null then
    return jsonb_build_object('ok', false, 'error', 'acesso');
  end if;
  update public.moto_sellers set photo = p_photo, updated_at = now() where id = s.id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.seller_set_photo(text, text, text, text) from public;
grant execute on function public.seller_set_photo(text, text, text, text) to anon, authenticated;

-- Link de divulgação (/scooters?v=código): mostra quem está atendendo. Só nome e foto.
create or replace function public.get_seller_public(p_ref text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('name', name, 'photo', photo, 'ref', ref)
    from public.moto_sellers where active and ref = lower(regexp_replace(coalesce(p_ref, ''), '[^0-9a-zA-Z]', '', 'g'));
$$;
revoke all on function public.get_seller_public(text) from public;
grant execute on function public.get_seller_public(text) to anon, authenticated;

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['moto_sellers', 'moto_referrals'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Modelo City (cadastro inicial). Só cria se ainda não existir: depois disso,
-- edite à vontade em Mobilidade → Modelos, que este bloco não sobrescreve nada.
-- Preço da campanha: R$ 7.197 à vista ou 21x de R$ 420 (taxa de 1,928% ao mês).
-- ---------------------------------------------------------------------------
insert into public.moto_products (slug, name, kicker, pitch, for_who, accent, photo, gallery, colors, specs, price, installments, rate, active, position)
select 'city', 'City', 'A estilosa de pneu largo',
       'Visual chopper, pneus largos e encosto pra garupa.',
       'quer chegar com estilo, conforto e estabilidade nos pneus largos.',
       '#E5484D', '/mob/city-lateral.jpg',
       '[{"src":"/mob/city-lateral.jpg","caption":"Lateral","fit":"contain"},{"src":"/mob/city-frente.jpg","caption":"Frente","fit":"contain"},{"src":"/mob/city-traseira.jpg","caption":"Traseira","fit":"contain"}]'::jsonb,
       array['Vermelha'],
       '{"power":"1.000W","battery":"Lítio 60V 24Ah","range":"60 km","speed":"32 km/h","recharge":"~7 h","load":"150 kg","brakes":"Disco dianteiro","weight":"73,7 kg","security":"Alarme","highlight":"Suspensão dupla na traseira"}'::jsonb,
       7197, 21, 1.928, true,
       coalesce((select max(position) + 1 from public.moto_products), 0)
where not exists (select 1 from public.moto_products where slug = 'city');

-- Modelo A2 (cadastro inicial, DESATIVADO): só fotos e apresentação. Complete a ficha
-- técnica, o preço e as cores em Mobilidade → Modelos e ative para aparecer no catálogo.
insert into public.moto_products (slug, name, kicker, pitch, for_who, accent, photo, gallery, colors, specs, price, installments, rate, active, position)
select 'a2', 'A2', 'A charmosa retrô',
       'Visual retrô, banco largo com encosto e para-brisa.',
       'quer estilo clássico e conforto para o dia a dia e para a garupa.',
       '#8E2C3A', '/mob/a2-perfil.webp',
       '[{"src":"/mob/a2-perfil.webp","caption":"Perfil","fit":"contain"},{"src":"/mob/a2-frente.webp","caption":"De frente","fit":"contain"}]'::jsonb,
       array['Branca e vinho'],
       '{"power":"","battery":"","range":"","speed":"","recharge":"","load":"","brakes":"","weight":"","security":"","highlight":"Para-brisa e encosto"}'::jsonb,
       0, 21, 2.1, false,
       coalesce((select max(position) + 1 from public.moto_products), 0)
where not exists (select 1 from public.moto_products where slug = 'a2');
