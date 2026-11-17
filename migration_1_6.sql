-- GuiaLab Pedidos 1.6.0: límites diarios, créditos y preparación de compras.
-- Ejecutar UNA SOLA VEZ después de migration_1_5.sql.
-- Migración aditiva: no elimina ni modifica datos de biblioteca, comisiones o evaluaciones.

create table if not exists public.glp_credit_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.glp_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  transaction_type text not null check (transaction_type in ('purchase','practice','admin_grant','refund','adjustment')),
  description text not null default '',
  reference_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists glp_credit_transactions_user_created_idx on public.glp_credit_transactions(user_id, created_at desc);

create table if not exists public.glp_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now(),
  primary key(user_id, usage_date)
);

create table if not exists public.glp_practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.glp_cases(id) on delete restrict,
  access_type text not null check (access_type in ('visitor','free','student','teacher','credit')),
  credits_charged integer not null default 0 check (credits_charged in (0,1)),
  created_at timestamptz not null default now()
);
create index if not exists glp_practice_attempts_user_created_idx on public.glp_practice_attempts(user_id, created_at desc);

create table if not exists public.glp_credit_packages (
  id text primary key,
  name text not null,
  credits integer not null check (credits > 0),
  price_ars numeric(12,2) not null check (price_ars >= 0),
  active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.glp_credit_packages(id,name,credits,price_ars,active,sort_order) values
 ('starter','Pack inicial',10,0,false,1),
 ('plus','Pack intermedio',30,0,false,2),
 ('advanced','Pack avanzado',60,0,false,3),
 ('intensive','Pack intensivo',100,0,false,4)
on conflict(id) do nothing;

create table if not exists public.glp_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id text not null references public.glp_credit_packages(id),
  credits integer not null check (credits > 0),
  amount_ars numeric(12,2) not null check (amount_ars >= 0),
  provider text not null default 'mercadopago',
  provider_payment_id text,
  provider_preference_id text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','refunded','charged_back')),
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists glp_purchases_provider_payment_unique on public.glp_purchases(provider,provider_payment_id) where provider_payment_id is not null;
create index if not exists glp_purchases_user_created_idx on public.glp_purchases(user_id,created_at desc);

alter table public.glp_credit_wallets enable row level security;
alter table public.glp_credit_transactions enable row level security;
alter table public.glp_daily_usage enable row level security;
alter table public.glp_practice_attempts enable row level security;
alter table public.glp_credit_packages enable row level security;
alter table public.glp_purchases enable row level security;

drop policy if exists glp_wallet_read_own on public.glp_credit_wallets;
create policy glp_wallet_read_own on public.glp_credit_wallets for select to authenticated using(user_id=auth.uid() or public.is_glp_admin());
drop policy if exists glp_transactions_read_own on public.glp_credit_transactions;
create policy glp_transactions_read_own on public.glp_credit_transactions for select to authenticated using(user_id=auth.uid() or public.is_glp_admin());
drop policy if exists glp_usage_read_own on public.glp_daily_usage;
create policy glp_usage_read_own on public.glp_daily_usage for select to authenticated using(user_id=auth.uid() or public.is_glp_admin());
drop policy if exists glp_attempts_read_own on public.glp_practice_attempts;
create policy glp_attempts_read_own on public.glp_practice_attempts for select to authenticated using(user_id=auth.uid() or public.is_glp_admin());
drop policy if exists glp_packages_read_active on public.glp_credit_packages;
create policy glp_packages_read_active on public.glp_credit_packages for select to anon,authenticated using(active=true or public.is_glp_admin());
drop policy if exists glp_purchases_read_own on public.glp_purchases;
create policy glp_purchases_read_own on public.glp_purchases for select to authenticated using(user_id=auth.uid() or public.is_glp_admin());

revoke all on public.glp_credit_wallets, public.glp_credit_transactions, public.glp_daily_usage, public.glp_practice_attempts, public.glp_purchases from anon, authenticated;
grant select on public.glp_credit_wallets, public.glp_credit_transactions, public.glp_daily_usage, public.glp_practice_attempts, public.glp_purchases to authenticated;
grant select on public.glp_credit_packages to anon, authenticated;

create or replace function public.glp_get_practice_status()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_attempts integer := 0;
  v_cap integer := 3;
  v_balance integer := 0;
  v_unlimited boolean := false;
  v_type text := 'free';
begin
  if v_uid is null then raise exception 'Se requiere una sesión de usuario'; end if;
  if public.is_glp_admin() then v_unlimited:=true; v_type:='teacher';
  elsif exists(
    select 1 from public.glp_cohort_members m join public.glp_cohorts c on c.id=m.cohort_id
    where m.user_id=v_uid and m.status='active' and c.status='active'
      and (c.starts_on is null or c.starts_on<=v_today)
      and (c.ends_on is null or c.ends_on>=v_today)
  ) then v_unlimited:=true; v_type:='student';
  end if;
  select coalesce(attempts,0) into v_attempts from public.glp_daily_usage where user_id=v_uid and usage_date=v_today;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then v_cap:=1; v_type:='visitor'; end if;
  select coalesce(balance,0) into v_balance from public.glp_credit_wallets where user_id=v_uid;
  return jsonb_build_object('free_remaining',case when v_unlimited then null else greatest(v_cap-coalesce(v_attempts,0),0) end,
    'free_cap',v_cap,'daily_used',coalesce(v_attempts,0),'credit_balance',coalesce(v_balance,0),
    'unlimited',v_unlimited,'access_type',v_type,'date',v_today);
end; $$;

create or replace function public.glp_start_practice(p_case_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_cap integer := 3;
  v_used integer := 0;
  v_balance integer := 0;
  v_unlimited boolean := false;
  v_type text := 'free';
  v_charge integer := 0;
begin
  if v_uid is null then raise exception 'Iniciá una sesión para practicar'; end if;
  if not exists(select 1 from public.glp_cases where id=p_case_id and status='published') then raise exception 'Pedido no disponible'; end if;
  if public.is_glp_admin() then v_unlimited:=true; v_type:='teacher';
  elsif exists(
    select 1 from public.glp_cohort_members m join public.glp_cohorts c on c.id=m.cohort_id
    where m.user_id=v_uid and m.status='active' and c.status='active'
      and (c.starts_on is null or c.starts_on<=v_today)
      and (c.ends_on is null or c.ends_on>=v_today)
  ) then v_unlimited:=true; v_type:='student';
  end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then v_cap:=1; v_type:='visitor'; end if;

  if not v_unlimited then
    insert into public.glp_daily_usage(user_id,usage_date,attempts) values(v_uid,v_today,0)
      on conflict(user_id,usage_date) do nothing;
    select attempts into v_used from public.glp_daily_usage where user_id=v_uid and usage_date=v_today for update;
    if v_used < v_cap then
      update public.glp_daily_usage set attempts=attempts+1,updated_at=now() where user_id=v_uid and usage_date=v_today;
    else
      insert into public.glp_credit_wallets(user_id,balance) values(v_uid,0) on conflict(user_id) do nothing;
      select balance into v_balance from public.glp_credit_wallets where user_id=v_uid for update;
      if v_balance < 1 then
        return jsonb_build_object('allowed',false,'reason','no_credits','free_remaining',0,'credit_balance',v_balance,'message','Agotaste tus intentos gratuitos y no tenés créditos disponibles.');
      end if;
      update public.glp_credit_wallets set balance=balance-1,updated_at=now() where user_id=v_uid returning balance into v_balance;
      insert into public.glp_credit_transactions(user_id,amount,transaction_type,description) values(v_uid,-1,'practice','Práctica adicional');
      v_charge:=1;v_type:='credit';
    end if;
  end if;
  insert into public.glp_practice_attempts(user_id,case_id,access_type,credits_charged) values(v_uid,p_case_id,v_type,v_charge);
  select coalesce(balance,0) into v_balance from public.glp_credit_wallets where user_id=v_uid;
  select coalesce(attempts,0) into v_used from public.glp_daily_usage where user_id=v_uid and usage_date=v_today;
  return jsonb_build_object('allowed',true,'access_type',v_type,'credits_charged',v_charge,
    'free_remaining',case when v_unlimited then null else greatest(v_cap-v_used,0) end,'credit_balance',coalesce(v_balance,0),'unlimited',v_unlimited);
end; $$;

create or replace function public.glp_admin_grant_credits(p_user_id uuid,p_amount integer,p_description text default 'Créditos otorgados por administración')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_balance integer;
begin
  if not public.is_glp_admin() then raise exception 'No autorizado'; end if;
  if p_amount is null or p_amount<1 or p_amount>10000 then raise exception 'Cantidad de créditos inválida'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Usuario inexistente'; end if;
  insert into public.glp_credit_wallets(user_id,balance) values(p_user_id,0) on conflict(user_id) do nothing;
  update public.glp_credit_wallets set balance=balance+p_amount,updated_at=now() where user_id=p_user_id returning balance into v_balance;
  insert into public.glp_credit_transactions(user_id,amount,transaction_type,description) values(p_user_id,p_amount,'admin_grant',coalesce(nullif(trim(p_description),''),'Créditos otorgados por administración'));
  return jsonb_build_object('amount',p_amount,'balance',v_balance);
end; $$;

revoke all on function public.glp_get_practice_status() from public,anon;
revoke all on function public.glp_start_practice(uuid) from public,anon;
revoke all on function public.glp_admin_grant_credits(uuid,integer,text) from public,anon;
grant execute on function public.glp_get_practice_status() to authenticated;
grant execute on function public.glp_start_practice(uuid) to authenticated;
grant execute on function public.glp_admin_grant_credits(uuid,integer,text) to authenticated;

-- Mercado Pago queda preparado a nivel de tablas. La acreditación automática requiere
-- desplegar Edge Functions y configurar secretos privados; no se activa desde GitHub Pages.
