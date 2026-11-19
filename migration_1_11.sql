-- GuiaLab Pedidos 2.0.1
-- Permite eliminar pedidos y comisiones desde el panel docente.
-- Ejecutar UNA SOLA VEZ después de migration_1_10.sql.
-- Las claves foráneas existentes eliminan en cascada entregas y pedidos individuales.

create or replace function public.glp_admin_delete_generated_order(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null or not public.is_glp_admin() then
    raise exception 'No autorizado';
  end if;

  delete from public.glp_generated_orders
  where id=p_id and owner_id=auth.uid();

  return found;
end;
$$;

create or replace function public.glp_admin_delete_random_session(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null or not public.is_glp_admin() then
    raise exception 'No autorizado';
  end if;

  delete from public.glp_random_sessions
  where id=p_id and owner_id=auth.uid();

  return found;
end;
$$;

revoke all on function public.glp_admin_delete_generated_order(uuid) from public,anon;
revoke all on function public.glp_admin_delete_random_session(uuid) from public,anon;
grant execute on function public.glp_admin_delete_generated_order(uuid) to authenticated;
grant execute on function public.glp_admin_delete_random_session(uuid) to authenticated;
