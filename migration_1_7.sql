-- GuiaLab Pedidos 1.8.0: generador de pedidos aleatorios con enlaces y token.
-- Ejecutar UNA SOLA VEZ después de migration_1_6.sql.
create table if not exists public.glp_generated_orders (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 token text not null unique,
 title text not null,
 instructions text not null default '',
 difficulty text not null default 'Inicial' check (difficulty in ('Inicial','Intermedio','Avanzado')),
 item_count integer not null check (item_count between 1 and 40),
 order_data jsonb not null,
 answer_key jsonb not null,
 status text not null default 'active' check (status in ('active','closed')),
 expires_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.glp_generated_submissions (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.glp_generated_orders(id) on delete cascade,
 student_name text not null default 'Alumno',
 response jsonb not null,
 score integer not null default 0 check (score between 0 and 100),
 feedback jsonb not null default '{}'::jsonb,
 submitted_at timestamptz not null default now()
);
create index if not exists glp_generated_orders_owner_created_idx on public.glp_generated_orders(owner_id,created_at desc);
create index if not exists glp_generated_submissions_order_idx on public.glp_generated_submissions(order_id,submitted_at desc);
alter table public.glp_generated_orders enable row level security;
alter table public.glp_generated_submissions enable row level security;
drop policy if exists glp_generated_orders_owner_read on public.glp_generated_orders;
create policy glp_generated_orders_owner_read on public.glp_generated_orders for select to authenticated using(owner_id=auth.uid() or public.is_glp_admin());
drop policy if exists glp_generated_submissions_owner_read on public.glp_generated_submissions;
create policy glp_generated_submissions_owner_read on public.glp_generated_submissions for select to authenticated using(exists(select 1 from public.glp_generated_orders o where o.id=order_id and (o.owner_id=auth.uid() or public.is_glp_admin())));
revoke all on public.glp_generated_orders, public.glp_generated_submissions from anon,authenticated;
grant select on public.glp_generated_orders, public.glp_generated_submissions to authenticated;

create or replace function public.glp_create_generated_order(
 p_title text,p_instructions text,p_difficulty text,p_order_data jsonb,p_answer_key jsonb,p_expires_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_token text; v_id uuid; v_count integer;
begin
 if v_uid is null or not public.is_glp_admin() then raise exception 'Solo un docente administrador puede generar pedidos'; end if;
 if jsonb_typeof(p_order_data)<>'array' or jsonb_typeof(p_answer_key)<>'array' then raise exception 'Datos del pedido inválidos'; end if;
 v_count:=jsonb_array_length(p_order_data);
 if v_count<1 or v_count>40 or jsonb_array_length(p_answer_key)<>v_count then raise exception 'Cantidad de determinaciones inválida'; end if;
 if p_difficulty not in ('Inicial','Intermedio','Avanzado') then raise exception 'Dificultad inválida'; end if;
 v_token:=encode(gen_random_bytes(12),'hex');
 insert into public.glp_generated_orders(owner_id,token,title,instructions,difficulty,item_count,order_data,answer_key,expires_at)
 values(v_uid,v_token,coalesce(nullif(trim(p_title),''),'Pedido simulado'),coalesce(p_instructions,''),p_difficulty,v_count,p_order_data,p_answer_key,p_expires_at)
 returning id into v_id;
 return jsonb_build_object('id',v_id,'token',v_token,'item_count',v_count);
end; $$;

create or replace function public.glp_get_generated_order(p_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_o public.glp_generated_orders;
begin
 select * into v_o from public.glp_generated_orders where token=p_token and status='active';
 if not found then raise exception 'Pedido inexistente o cerrado'; end if;
 if v_o.expires_at is not null and v_o.expires_at<now() then raise exception 'El enlace de este pedido venció'; end if;
 return jsonb_build_object('title',v_o.title,'instructions',v_o.instructions,'difficulty',v_o.difficulty,'item_count',v_o.item_count,'order_data',v_o.order_data,'expires_at',v_o.expires_at);
end; $$;

create or replace function public.glp_submit_generated_order(p_token text,p_student_name text,p_response jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_o public.glp_generated_orders; v_expected text[]; v_found text[]; v_missing text[]; v_text text; v_score integer;
begin
 select * into v_o from public.glp_generated_orders where token=p_token and status='active';
 if not found then raise exception 'Pedido inexistente o cerrado'; end if;
 if v_o.expires_at is not null and v_o.expires_at<now() then raise exception 'El enlace de este pedido venció'; end if;
 v_text:=lower(unaccent(coalesce(p_response::text,'')));
 select coalesce(array_agg(x),'{}'::text[]) into v_expected from jsonb_array_elements(v_o.answer_key) as elem(value), lateral (select lower(unaccent(coalesce(elem.value->>'determinacion',''))) x) q where x<>'';
 select coalesce(array_agg(x),'{}'::text[]) into v_found from unnest(v_expected) x where position(x in v_text)>0;
 select coalesce(array_agg(x),'{}'::text[]) into v_missing from unnest(v_expected) x where position(x in v_text)=0;
 v_score:=case when cardinality(v_expected)=0 then 0 else round(cardinality(v_found)::numeric/cardinality(v_expected)*100)::integer end;
 insert into public.glp_generated_submissions(order_id,student_name,response,score,feedback)
 values(v_o.id,coalesce(nullif(trim(p_student_name),''),'Alumno'),p_response,v_score,jsonb_build_object('matched',to_jsonb(v_found),'missing',to_jsonb(v_missing)));
 return jsonb_build_object('score',v_score,'matched',to_jsonb(v_found),'missing',to_jsonb(v_missing),'message','Entrega registrada. La corrección automática reconoce determinaciones; el docente debe revisar muestra, tubo y preanalítica.');
end; $$;

create or replace function public.glp_admin_list_generated_orders()
returns table(id uuid,token text,title text,difficulty text,item_count integer,status text,expires_at timestamptz,created_at timestamptz,submission_count bigint)
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_glp_admin() then raise exception 'No autorizado'; end if;
 return query select o.id,o.token,o.title,o.difficulty,o.item_count,o.status,o.expires_at,o.created_at,
 (select count(*) from public.glp_generated_submissions s where s.order_id=o.id)
 from public.glp_generated_orders o where o.owner_id=auth.uid() order by o.created_at desc;
end; $$;

create or replace function public.glp_admin_set_generated_order_status(p_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not public.is_glp_admin() then raise exception 'No autorizado'; end if;
 if p_status not in ('active','closed') then raise exception 'Estado inválido'; end if;
 update public.glp_generated_orders set status=p_status where id=p_id and owner_id=auth.uid();
 return found;
end; $$;

revoke all on function public.glp_create_generated_order(text,text,text,jsonb,jsonb,timestamptz) from public,anon;
revoke all on function public.glp_get_generated_order(text) from public;
revoke all on function public.glp_submit_generated_order(text,text,jsonb) from public;
revoke all on function public.glp_admin_list_generated_orders() from public,anon;
revoke all on function public.glp_admin_set_generated_order_status(uuid,text) from public,anon;
grant execute on function public.glp_create_generated_order(text,text,text,jsonb,jsonb,timestamptz) to authenticated;
grant execute on function public.glp_get_generated_order(text) to anon,authenticated;
grant execute on function public.glp_submit_generated_order(text,text,jsonb) to anon,authenticated;
grant execute on function public.glp_admin_list_generated_orders() to authenticated;
grant execute on function public.glp_admin_set_generated_order_status(uuid,text) to authenticated;
