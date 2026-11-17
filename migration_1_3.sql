-- GuiaLab Pedidos 1.3.0 beta: registro, inscripción por código y protección de roles.
-- Ejecutar después de migration_1_2.sql. No reemplaza el esquema original.
create or replace function public.glp_protect_profile_access_level() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and current_setting('glp.allow_access_level_change',true) is distinct from 'on' and new.access_level is distinct from old.access_level and not public.is_glp_admin() then
   new.access_level := old.access_level;
 end if;
 new.updated_at := now(); return new;
end; $$;
drop trigger if exists glp_profile_access_guard on public.glp_profiles;
create trigger glp_profile_access_guard before update on public.glp_profiles for each row execute function public.glp_protect_profile_access_level();

create or replace function public.glp_join_cohort_by_code(p_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_cohort public.glp_cohorts;
begin
 if auth.uid() is null then raise exception 'Iniciá sesión para inscribirte.'; end if;
 select * into v_cohort from public.glp_cohorts where upper(access_code)=upper(trim(p_code)) and status='active' and (starts_on is null or starts_on<=current_date) and (ends_on is null or ends_on>=current_date) limit 1;
 if not found then raise exception 'El código no existe o la comisión no está activa.'; end if;
 insert into public.glp_cohort_members(cohort_id,user_id,status) values(v_cohort.id,auth.uid(),'active') on conflict(cohort_id,user_id) do update set status='active';
 perform set_config('glp.allow_access_level_change','on',true);
 insert into public.glp_profiles(user_id,display_name,email,access_level) values(auth.uid(),coalesce(auth.jwt()->'user_metadata'->>'display_name',''),auth.jwt()->>'email','student') on conflict(user_id) do update set access_level=case when glp_profiles.access_level='free' then 'student' else glp_profiles.access_level end,updated_at=now();
 return jsonb_build_object('success',true,'message','Ya estás vinculado a la comisión '||v_cohort.name||'.');
end; $$;
revoke all on function public.glp_join_cohort_by_code(text) from public;
grant execute on function public.glp_join_cohort_by_code(text) to authenticated;

-- Permitir que el usuario lea su propio perfil. El trigger impide elevarse privilegios.
drop policy if exists glp_profile_self on public.glp_profiles;
create policy glp_profile_self on public.glp_profiles for select to authenticated using(user_id=auth.uid() or public.is_glp_admin());
drop policy if exists glp_profile_insert_self on public.glp_profiles;
create policy glp_profile_insert_self on public.glp_profiles for insert to authenticated with check(user_id=auth.uid() and access_level='free');
drop policy if exists glp_profile_update_self on public.glp_profiles;
create policy glp_profile_update_self on public.glp_profiles for update to authenticated using(user_id=auth.uid() or public.is_glp_admin()) with check(user_id=auth.uid() or public.is_glp_admin());

-- Cuotas de visitantes: no se finge un límite seguro solo con localStorage. Requiere Edge Function/antiabuso.
