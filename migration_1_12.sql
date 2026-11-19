-- GuiaLab Pedidos 2.0.2
-- Registro general de notas y calificación presencial complementaria.
-- Ejecutar UNA SOLA VEZ después de migration_1_11.sql.

alter table public.glp_generated_submissions
  add column if not exists practical_grade numeric(5,2),
  add column if not exists practical_grade_updated_at timestamptz,
  add column if not exists practical_grade_updated_by uuid references auth.users(id) on delete set null;

-- Permite guardar o borrar la nota presencial sin alterar la nota del pedido.
create or replace function public.glp_admin_set_practical_grade(
  p_submission_id uuid,
  p_practical_grade numeric default null
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_order public.glp_generated_orders;
begin
  if auth.uid() is null or not public.is_glp_admin() then raise exception 'No autorizado'; end if;
  if p_practical_grade is not null and (p_practical_grade<0 or p_practical_grade>100) then
    raise exception 'La calificación presencial debe estar entre 0 y 100';
  end if;
  select o.* into v_order
  from public.glp_generated_submissions s
  join public.glp_generated_orders o on o.id=s.order_id
  where s.id=p_submission_id and o.owner_id=auth.uid();
  if not found then raise exception 'No se encontró la entrega o no tenés permiso'; end if;
  update public.glp_generated_submissions
  set practical_grade=p_practical_grade,
      practical_grade_updated_at=case when p_practical_grade is null then null else now() end,
      practical_grade_updated_by=case when p_practical_grade is null then null else auth.uid() end
  where id=p_submission_id;
  return jsonb_build_object('practical_grade',p_practical_grade);
end; $$;

-- Exportación global: pedidos compartidos e individuales, con notas virtual y presencial.
create or replace function public.glp_admin_export_all_generated_grades()
returns table(
  activity_title text,
  order_type text,
  student_name text,
  submitted_at timestamptz,
  review_status text,
  order_grade numeric,
  practical_grade numeric,
  access_code text,
  teacher_feedback text
)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_glp_admin() then raise exception 'No autorizado'; end if;
  return query
  select o.title,
    case when o.session_id is null then 'Pedido compartido' else 'Pedido aleatorio individual' end,
    s.student_name,s.submitted_at,s.review_status,s.teacher_grade,s.practical_grade,
    s.access_code,s.teacher_feedback
  from public.glp_generated_submissions s
  join public.glp_generated_orders o on o.id=s.order_id
  where o.owner_id=auth.uid()
  order by s.submitted_at desc;
end; $$;

-- Incluye la nota presencial en la vista docente de cada entrega.
drop function if exists public.glp_admin_get_generated_submissions(uuid);
create function public.glp_admin_get_generated_submissions(p_order_id uuid)
returns table(
  id uuid,student_name text,response jsonb,answer_key jsonb,submitted_at timestamptz,
  review_status text,item_grades jsonb,teacher_grade numeric,teacher_feedback text,
  access_code text,practical_grade numeric
)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_glp_admin() then raise exception 'No autorizado'; end if;
  return query
  select s.id,s.student_name,s.response,o.answer_key,s.submitted_at,
    s.review_status,s.item_grades,s.teacher_grade,s.teacher_feedback,s.access_code,s.practical_grade
  from public.glp_generated_submissions s
  join public.glp_generated_orders o on o.id=s.order_id
  where s.order_id=p_order_id and o.owner_id=auth.uid()
  order by s.submitted_at desc;
end; $$;

revoke all on function public.glp_admin_set_practical_grade(uuid,numeric) from public,anon;
revoke all on function public.glp_admin_export_all_generated_grades() from public,anon;
revoke all on function public.glp_admin_get_generated_submissions(uuid) from public,anon;
grant execute on function public.glp_admin_set_practical_grade(uuid,numeric) to authenticated;
grant execute on function public.glp_admin_export_all_generated_grades() to authenticated;
grant execute on function public.glp_admin_get_generated_submissions(uuid) to authenticated;
