-- GuiaLab Pedidos 1.9.0: revisión y corrección docente de pedidos aleatorios.
-- Ejecutar UNA SOLA VEZ después de migration_1_7.sql.

alter table public.glp_generated_submissions
  add column if not exists review_status text not null default 'pending'
    check (review_status in ('pending','graded')),
  add column if not exists item_grades jsonb not null default '[]'::jsonb,
  add column if not exists teacher_grade numeric(5,2),
  add column if not exists teacher_feedback text not null default '',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

-- Entregas y claves esperadas: solo se exponen mediante RPC a docentes autorizados.
create or replace function public.glp_admin_get_generated_submissions(p_order_id uuid)
returns table(
  id uuid,
  student_name text,
  response jsonb,
  answer_key jsonb,
  submitted_at timestamptz,
  review_status text,
  item_grades jsonb,
  teacher_grade numeric,
  teacher_feedback text
)
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_glp_admin() then
    raise exception 'No autorizado';
  end if;

  return query
  select s.id, s.student_name, s.response, o.answer_key, s.submitted_at,
         s.review_status, s.item_grades, s.teacher_grade, s.teacher_feedback
  from public.glp_generated_submissions s
  join public.glp_generated_orders o on o.id=s.order_id
  where s.order_id=p_order_id and o.owner_id=auth.uid()
  order by s.submitted_at desc;
end;
$$;

create or replace function public.glp_admin_grade_generated_submission(
  p_submission_id uuid,
  p_item_grades jsonb,
  p_teacher_feedback text default ''
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_submission public.glp_generated_submissions;
  v_order public.glp_generated_orders;
  v_count integer;
  v_grade numeric(5,2);
begin
  if not public.is_glp_admin() then
    raise exception 'No autorizado';
  end if;
  if jsonb_typeof(p_item_grades)<>'array' then
    raise exception 'Los puntajes deben enviarse como una lista';
  end if;

  select * into v_submission
  from public.glp_generated_submissions
  where id=p_submission_id;
  if not found then raise exception 'No se encontró la entrega'; end if;

  select * into v_order
  from public.glp_generated_orders
  where id=v_submission.order_id and owner_id=auth.uid();
  if not found then raise exception 'No tenés permiso para corregir esta entrega'; end if;

  v_count:=jsonb_array_length(v_submission.response);
  if jsonb_array_length(p_item_grades)<>v_count then
    raise exception 'Debe haber un puntaje por cada determinación';
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_item_grades) e(value)
    where jsonb_typeof(e.value)<>'number'
       or (e.value::text)::numeric<0
       or (e.value::text)::numeric>100
  ) then
    raise exception 'Cada puntaje debe estar entre 0 y 100';
  end if;

  select round(avg((e.value::text)::numeric),2)
    into v_grade
  from jsonb_array_elements(p_item_grades) e(value);

  update public.glp_generated_submissions
  set item_grades=p_item_grades,
      teacher_grade=v_grade,
      teacher_feedback=coalesce(p_teacher_feedback,''),
      review_status='graded',
      reviewed_at=now(),
      reviewed_by=auth.uid()
  where id=p_submission_id;

  return jsonb_build_object('teacher_grade',v_grade,'review_status','graded');
end;
$$;

-- La puntuación anterior reconocía el nombre de la determinación, que el formulario
-- ya mostraba al alumno. Por eso podía dar falsos positivos. Desde esta versión
-- la nota queda pendiente hasta la corrección manual docente.
create or replace function public.glp_submit_generated_order(
  p_token text,
  p_student_name text,
  p_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_o public.glp_generated_orders;
  v_count integer;
  v_id uuid;
begin
  select * into v_o
  from public.glp_generated_orders
  where token=p_token and status='active';
  if not found then raise exception 'Pedido inexistente o cerrado'; end if;
  if v_o.expires_at is not null and v_o.expires_at<now() then
    raise exception 'El enlace de este pedido venció';
  end if;
  if jsonb_typeof(p_response)<>'array' then
    raise exception 'La respuesta enviada no tiene un formato válido';
  end if;
  v_count:=jsonb_array_length(p_response);
  if v_count<>v_o.item_count then
    raise exception 'La cantidad de respuestas no coincide con el pedido';
  end if;

  insert into public.glp_generated_submissions(order_id,student_name,response,score,feedback)
  values(
    v_o.id,
    coalesce(nullif(trim(p_student_name),''),'Alumno'),
    p_response,
    0,
    jsonb_build_object('status','pending_teacher_review')
  )
  returning id into v_id;

  return jsonb_build_object(
    'submission_id',v_id,
    'review_status','pending',
    'message','Entrega registrada. La calificación será asignada por el docente.'
  );
end;
$$;

revoke all on function public.glp_admin_get_generated_submissions(uuid) from public,anon;
revoke all on function public.glp_admin_grade_generated_submission(uuid,jsonb,text) from public,anon;
grant execute on function public.glp_admin_get_generated_submissions(uuid) to authenticated;
grant execute on function public.glp_admin_grade_generated_submission(uuid,jsonb,text) to authenticated;
revoke all on function public.glp_submit_generated_order(text,text,jsonb) from public;
grant execute on function public.glp_submit_generated_order(text,text,jsonb) to anon,authenticated;
