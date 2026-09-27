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
-- Segmentos: solar, carregador (save), ambos, eletroposto, manutenção de usina e gestão energética.
alter table public.leads drop constraint if exists leads_segment_check;
alter table public.leads add constraint leads_segment_check check (segment in ('solar', 'save', 'ambos', 'eletroposto', 'manutencao', 'gestao'));
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
    case when p ->> 'segment' in ('solar', 'save', 'ambos', 'eletroposto', 'manutencao', 'gestao') then p ->> 'segment' else 'solar' end,
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
-- Documentos com assinatura eletrônica (procuração e contrato de aluguel)
-- -----------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('procuracao', 'aluguel')),
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
    'signer', jsonb_build_object('role', s.role, 'name', s.name, 'cpf', s.cpf, 'signed_at', s.signed_at, 'signed_name', s.signed_name),
    'signers', (select coalesce(jsonb_agg(jsonb_build_object(
                  'role', x.role, 'name', x.name, 'signed_at', x.signed_at, 'signed_name', x.signed_name,
                  'signed_cpf', x.signed_cpf, 'signature', x.signature, 'ip', x.ip, 'content_hash', x.content_hash
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

revoke all on function public.get_public_document(text) from public;
revoke all on function public.view_public_document(text) from public;
revoke all on function public.sign_public_document(text, text, text, text, text, text) from public;
grant execute on function public.get_public_document(text) to anon, authenticated;
grant execute on function public.view_public_document(text) to anon, authenticated;
grant execute on function public.sign_public_document(text, text, text, text, text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Tempo real
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['leads', 'proposals', 'tasks', 'activities', 'settings', 'xp_events', 'profiles', 'documents', 'document_signers'] loop
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
