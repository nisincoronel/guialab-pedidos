-- GuiaLab Pedidos 1.9.1: código individual para consultar la devolución.
-- Ejecutar UNA SOLA VEZ después de migration_1_8.sql.

alter table public.glp_generated_submissions
  add column if not exists access_code text;

create unique index if not exists glp_generated_submissions_access_code_uidx
  on public.glp_generated_submissions(access_code)
  where access_code is not null;

-- Reemplaza el envío para asignar a cada entrega un código corto independiente.
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
  v_access_code text;
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

  -- Diez caracteres hexadecimales (40 bits), generados en el servidor.
  loop
    v_access_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
    exit when not exists(
      select 1 from public.glp_generated_submissions s where s.access_code=v_access_code
    );
  end loop;

  insert into public.glp_generated_submissions(
    order_id,student_name,response,score,feedback,access_code,review_status
  ) values(
    v_o.id,
    coalesce(nullif(trim(p_student_name),''),'Alumno'),
    p_response,
    0,
    jsonb_build_object('status','pending_teacher_review'),
    v_access_code,
    'pending'
  )
  returning id into v_id;

  return jsonb_build_object(
    'submission_id',v_id,
    'access_code',v_access_code,
    'review_status','pending',
    'message','Entrega registrada. Guardá el código para consultar la devolución.'
  );
end;
$$;

-- Consulta pública protegida por código individual. La clave esperada solo se
-- devuelve después de que el docente publica la corrección.
create or replace function public.glp_get_generated_feedback(p_access_code text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_s public.glp_generated_submissions;
  v_o public.glp_generated_orders;
begin
  if p_access_code is null or length(trim(p_access_code))<>10 then
    return jsonb_build_object('found',false);
  end if;

  select * into v_s
  from public.glp_generated_submissions
  where access_code=upper(trim(p_access_code));
  if not found then return jsonb_build_object('found',false); end if;

  if v_s.review_status<>'graded' then
    return jsonb_build_object(
      'found',true,
      'review_status','pending',
      'student_name',v_s.student_name,
      'submitted_at',v_s.submitted_at
    );
  end if;

  select * into v_o from public.glp_generated_orders where id=v_s.order_id;
  return jsonb_build_object(
    'found',true,
    'review_status','graded',
    'student_name',v_s.student_name,
    'submitted_at',v_s.submitted_at,
    'response',v_s.response,
    'answer_key',v_o.answer_key,
    'item_grades',v_s.item_grades,
    'teacher_grade',v_s.teacher_grade,
    'teacher_feedback',v_s.teacher_feedback
  );
end;
$$;

revoke all on function public.glp_submit_generated_order(text,text,jsonb) from public;
grant execute on function public.glp_submit_generated_order(text,text,jsonb) to anon,authenticated;
revoke all on function public.glp_get_generated_feedback(text) from public;
grant execute on function public.glp_get_generated_feedback(text) to anon,authenticated;
