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
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_segment_check') then
    alter table public.leads add constraint leads_segment_check check (segment in ('solar', 'save', 'ambos'));
  end if;
end $$;
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
  v_phone text := left(trim(p ->> 'phone'), 30);
  v_email text := lower(left(nullif(trim(p ->> 'email'), ''), 160));
begin
  if coalesce(trim(p ->> 'name'), '') = '' or coalesce(v_phone, '') = '' then
    raise exception 'nome e telefone são obrigatórios';
  end if;

  -- Envio repetido (duplo clique, recarregar a página): devolve o mesmo lead, sem duplicar.
  select * into new_lead from public.leads
  where created_at > now() - interval '15 minutes'
    and (regexp_replace(coalesce(phone, ''), '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g') or (v_email is not null and lower(email) = v_email))
  order by created_at desc limit 1;
  if found then
    return to_jsonb(new_lead) || jsonb_build_object('duplicate', true);
  end if;

  insert into public.leads (name, phone, email, city, state, address, avg_bill, consumption_kwh, source, notes, segment, roof_type, connection_type, temperature)
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
    left(nullif(trim(p ->> 'notes'), ''), 1000),
    case when p ->> 'segment' in ('solar', 'save', 'ambos') then p ->> 'segment' else 'solar' end,
    left(nullif(trim(p ->> 'roof_type'), ''), 60),
    case when p ->> 'connection_type' in ('mono', 'bi', 'tri') then p ->> 'connection_type' else null end,
    case when p ->> 'temperature' in ('frio', 'morno', 'quente') then p ->> 'temperature' else 'morno' end
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
    'gallery', data -> 'proposal' -> 'gallery'
  )
  from public.settings where id = 1;
$$;
revoke all on function public.get_public_company() from public;
grant execute on function public.get_public_company() to anon, authenticated;

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
-- Tempo real
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['leads', 'proposals', 'tasks', 'activities', 'settings', 'xp_events', 'profiles'] loop
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
