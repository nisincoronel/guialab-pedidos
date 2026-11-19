-- GuiaLab Pedidos 2.0.0
-- Agrega sesiones de comisión: un enlace compartido crea un pedido individual
-- por alumno. Ejecutar UNA SOLA VEZ después de migration_1_9.sql.

create table if not exists public.glp_random_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  title text not null,
  instructions text not null default '',
  difficulty text not null default 'Inicial' check (difficulty in ('Inicial','Intermedio','Avanzado')),
  item_count integer not null check (item_count between 1 and 40),
  status text not null default 'active' check (status in ('active','closed')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.glp_generated_orders
  add column if not exists session_id uuid references public.glp_random_sessions(id) on delete cascade,
  add column if not exists assigned_student_name text,
  add column if not exists client_key text;

create unique index if not exists glp_generated_orders_session_client_uidx
  on public.glp_generated_orders(session_id,client_key)
  where session_id is not null and client_key is not null;
-- Evita que dos alumnos de la misma comisión reciban exactamente la misma combinación.
create unique index if not exists glp_generated_orders_session_orderdata_uidx
  on public.glp_generated_orders(session_id,md5(order_data::text))
  where session_id is not null;
create index if not exists glp_random_sessions_owner_created_idx
  on public.glp_random_sessions(owner_id,created_at desc);

alter table public.glp_random_sessions enable row level security;
revoke all on public.glp_random_sessions from anon,authenticated;

create or replace function public.glp_create_random_session(
  p_title text,
  p_instructions text,
  p_difficulty text,
  p_item_count integer,
  p_expires_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid:=auth.uid(); v_token text; v_id uuid;
begin
  if v_uid is null or not public.is_glp_admin() then raise exception 'Solo un docente administrador puede crear actividades'; end if;
  if p_difficulty not in ('Inicial','Intermedio','Avanzado') then raise exception 'Dificultad inválida'; end if;
  if p_item_count<1 or p_item_count>40 then raise exception 'Cantidad de determinaciones inválida'; end if;
  if p_expires_at is not null and p_expires_at<=now() then raise exception 'La fecha de vencimiento debe ser futura'; end if;
  v_token:=replace(gen_random_uuid()::text,'-','');
  insert into public.glp_random_sessions(owner_id,token,title,instructions,difficulty,item_count,expires_at)
  values(v_uid,v_token,coalesce(nullif(trim(p_title),''),'Actividad individual'),coalesce(p_instructions,''),p_difficulty,p_item_count,p_expires_at)
  returning id into v_id;
  return jsonb_build_object('id',v_id,'token',v_token,'item_count',p_item_count);
end; $$;

create or replace function public.glp_get_random_session(p_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_s public.glp_random_sessions;
begin
  select * into v_s from public.glp_random_sessions where token=p_token;
  if not found then return jsonb_build_object('found',false); end if;
  if v_s.expires_at is not null and v_s.expires_at<now() then return jsonb_build_object('found',false,'expired',true); end if;
  return jsonb_build_object('found',true,'title',v_s.title,'instructions',v_s.instructions,'difficulty',v_s.difficulty,'item_count',v_s.item_count,'expires_at',v_s.expires_at,'status',v_s.status);
end; $$;

create or replace function public.glp_create_random_assignment(
  p_session_token text,
  p_student_name text,
  p_client_key text,
  p_order_data jsonb,
  p_answer_key jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_s public.glp_random_sessions; v_token text; v_id uuid; v_count integer;
begin
  select * into v_s from public.glp_random_sessions where token=p_session_token;
  if not found then raise exception 'La actividad no existe'; end if;
  if v_s.expires_at is not null and v_s.expires_at<now() then raise exception 'El enlace de esta actividad venció'; end if;
  if p_client_key is null or length(p_client_key)<12 or length(p_client_key)>100 then raise exception 'Identificador de sesión inválido'; end if;
  if jsonb_typeof(p_order_data)<>'array' or jsonb_typeof(p_answer_key)<>'array' then raise exception 'Datos del pedido inválidos'; end if;
  v_count:=jsonb_array_length(p_order_data);
  if v_count<>v_s.item_count or jsonb_array_length(p_answer_key)<>v_count then raise exception 'La cantidad de determinaciones no coincide con la actividad'; end if;

  -- Una clave de navegador por sesión evita que recargar la página genere otro pedido.
  select token,id into v_token,v_id from public.glp_generated_orders where session_id=v_s.id and client_key=p_client_key;
  if found then return jsonb_build_object('token',v_token,'id',v_id,'recovered',true); end if;
  if v_s.status<>'active' then raise exception 'La actividad fue cerrada y no admite nuevos alumnos'; end if;

  v_token:=replace(gen_random_uuid()::text,'-','');
  insert into public.glp_generated_orders(owner_id,token,title,instructions,difficulty,item_count,order_data,answer_key,expires_at,session_id,assigned_student_name,client_key)
  values(v_s.owner_id,v_token,v_s.title,v_s.instructions,v_s.difficulty,v_count,p_order_data,p_answer_key,v_s.expires_at,v_s.id,coalesce(nullif(trim(p_student_name),''),'Alumno'),p_client_key)
  on conflict (session_id,client_key) where session_id is not null and client_key is not null
  do update set client_key=excluded.client_key
  returning id,token into v_id,v_token;
  return jsonb_build_object('token',v_token,'id',v_id,'recovered',false);
end; $$;


-- El nombre ingresado al comenzar la sesión queda asociado al pedido y se
-- precarga en el formulario final para que la entrega llegue identificada.
create or replace function public.glp_get_generated_order(p_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_o public.glp_generated_orders;
begin
  select * into v_o from public.glp_generated_orders where token=p_token and status='active';
  if not found then raise exception 'Pedido inexistente o cerrado'; end if;
  if v_o.expires_at is not null and v_o.expires_at<now() then raise exception 'El enlace de este pedido venció'; end if;
  return jsonb_build_object('title',v_o.title,'instructions',v_o.instructions,'difficulty',v_o.difficulty,'item_count',v_o.item_count,'order_data',v_o.order_data,'expires_at',v_o.expires_at,'assigned_student_name',v_o.assigned_student_name);
end; $$;

-- Actualiza el listado docente para identificar pedidos individuales y sus alumnos.
drop function if exists public.glp_admin_list_generated_orders();
create function public.glp_admin_list_generated_orders()
returns table(
  id uuid,token text,title text,difficulty text,item_count integer,status text,
  expires_at timestamptz,created_at timestamptz,submission_count bigint,
  session_id uuid,assigned_student_name text
)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_glp_admin() then raise exception 'No autorizado'; end if;
  return query
  select o.id,o.token,o.title,o.difficulty,o.item_count,o.status,o.expires_at,o.created_at,
    (select count(*) from public.glp_generated_submissions s where s.order_id=o.id),
    o.session_id,o.assigned_student_name
  from public.glp_generated_orders o where o.owner_id=auth.uid()
  order by o.created_at desc;
end; $$;

-- Incluye el código corto para que el docente pueda compartirlo cuando publique la devolución.
drop function if exists public.glp_admin_get_generated_submissions(uuid);
create function public.glp_admin_get_generated_submissions(p_order_id uuid)
returns table(
  id uuid,student_name text,response jsonb,answer_key jsonb,submitted_at timestamptz,
  review_status text,item_grades jsonb,teacher_grade numeric,teacher_feedback text,access_code text
)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_glp_admin() then raise exception 'No autorizado'; end if;
  return query
  select s.id,s.student_name,s.response,o.answer_key,s.submitted_at,
    s.review_status,s.item_grades,s.teacher_grade,s.teacher_feedback,s.access_code
  from public.glp_generated_submissions s
  join public.glp_generated_orders o on o.id=s.order_id
  where s.order_id=p_order_id and o.owner_id=auth.uid()
  order by s.submitted_at desc;
end; $$;

revoke all on function public.glp_create_random_session(text,text,text,integer,timestamptz) from public,anon;
revoke all on function public.glp_get_random_session(text) from public;
revoke all on function public.glp_create_random_assignment(text,text,text,jsonb,jsonb) from public;
revoke all on function public.glp_admin_list_generated_orders() from public,anon;
revoke all on function public.glp_admin_get_generated_submissions(uuid) from public,anon;
grant execute on function public.glp_create_random_session(text,text,text,integer,timestamptz) to authenticated;
grant execute on function public.glp_get_random_session(text) to anon,authenticated;
grant execute on function public.glp_create_random_assignment(text,text,text,jsonb,jsonb) to anon,authenticated;
grant execute on function public.glp_admin_list_generated_orders() to authenticated;
grant execute on function public.glp_admin_get_generated_submissions(uuid) to authenticated;

create or replace function public.glp_admin_list_random_sessions()
returns table(id uuid,token text,title text,difficulty text,item_count integer,status text,expires_at timestamptz,created_at timestamptz,assignment_count bigint)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_glp_admin() then raise exception 'No autorizado'; end if;
  return query select s.id,s.token,s.title,s.difficulty,s.item_count,s.status,s.expires_at,s.created_at,
    (select count(*) from public.glp_generated_orders o where o.session_id=s.id)
  from public.glp_random_sessions s where s.owner_id=auth.uid() order by s.created_at desc;
end; $$;

create or replace function public.glp_admin_set_random_session_status(p_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_glp_admin() then raise exception 'No autorizado'; end if;
  if p_status not in ('active','closed') then raise exception 'Estado inválido'; end if;
  update public.glp_random_sessions set status=p_status where id=p_id and owner_id=auth.uid();
  return found;
end; $$;

-- En modalidad individual, cada pedido admite una sola entrega. Los pedidos
-- compartidos del modo anterior conservan el comportamiento original.
create or replace function public.glp_submit_generated_order(
  p_token text,p_student_name text,p_response jsonb
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_o public.glp_generated_orders; v_count integer; v_id uuid; v_access_code text;
begin
  select * into v_o from public.glp_generated_orders where token=p_token and status='active' for update;
  if not found then raise exception 'Pedido inexistente o cerrado'; end if;
  if v_o.expires_at is not null and v_o.expires_at<now() then raise exception 'El enlace de este pedido venció'; end if;
  if jsonb_typeof(p_response)<>'array' then raise exception 'La respuesta enviada no tiene un formato válido'; end if;
  v_count:=jsonb_array_length(p_response);
  if v_count<>v_o.item_count then raise exception 'La cantidad de respuestas no coincide con el pedido'; end if;
  if v_o.session_id is not null and exists(select 1 from public.glp_generated_submissions s where s.order_id=v_o.id) then
    raise exception 'Este pedido individual ya fue entregado. Utilizá tu código para consultar la devolución.';
  end if;

  loop
    v_access_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
    exit when not exists(select 1 from public.glp_generated_submissions s where s.access_code=v_access_code);
  end loop;

  insert into public.glp_generated_submissions(order_id,student_name,response,score,feedback,access_code,review_status)
  values(v_o.id,coalesce(nullif(trim(p_student_name),''),nullif(v_o.assigned_student_name,''),'Alumno'),p_response,0,
    jsonb_build_object('status','pending_teacher_review'),v_access_code,'pending')
  returning id into v_id;
  return jsonb_build_object('submission_id',v_id,'access_code',v_access_code,'review_status','pending','message','Entrega registrada. Guardá el código para consultar la devolución.');
end; $$;

revoke all on function public.glp_admin_list_random_sessions() from public,anon;
revoke all on function public.glp_admin_set_random_session_status(uuid,text) from public,anon;
revoke all on function public.glp_submit_generated_order(text,text,jsonb) from public;
grant execute on function public.glp_admin_list_random_sessions() to authenticated;
grant execute on function public.glp_admin_set_random_session_status(uuid,text) to authenticated;
grant execute on function public.glp_submit_generated_order(text,text,jsonb) to anon,authenticated;

create or replace function public.glp_admin_export_random_session(p_session_id uuid)
returns table(student_name text,access_code text,review_status text,teacher_grade numeric,submitted_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_glp_admin() then raise exception 'No autorizado'; end if;
  if not exists(select 1 from public.glp_random_sessions s where s.id=p_session_id and s.owner_id=auth.uid()) then
    raise exception 'No tenés permiso para consultar esta comisión';
  end if;
  return query
  select o.assigned_student_name,s.access_code,s.review_status,s.teacher_grade,s.submitted_at
  from public.glp_generated_orders o
  left join public.glp_generated_submissions s on s.order_id=o.id
  where o.session_id=p_session_id
  order by o.created_at;
end; $$;
revoke all on function public.glp_admin_export_random_session(uuid) from public,anon;
grant execute on function public.glp_admin_export_random_session(uuid) to authenticated;
