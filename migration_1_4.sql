-- GuiaLab Pedidos 1.4.0: gestión inicial de comisiones y alumnos.
-- Ejecutar UNA SOLA VEZ después de migration_1_3.sql.
-- No borra ni reemplaza datos existentes.

alter table public.glp_cohorts
  add column if not exists description text not null default '';

-- Los alumnos solo pueden consultar su propia vinculación.
-- La inscripción se realiza exclusivamente mediante glp_join_cohort_by_code().
-- El docente/administrador gestiona estados de los miembros.
drop policy if exists glp_cohort_members_access on public.glp_cohort_members;
drop policy if exists glp_cohort_members_read on public.glp_cohort_members;
drop policy if exists glp_cohort_members_teacher_update on public.glp_cohort_members;
drop policy if exists glp_cohort_members_teacher_delete on public.glp_cohort_members;

create policy glp_cohort_members_read
on public.glp_cohort_members
for select to authenticated
using (user_id = auth.uid() or public.glp_is_teacher_of(auth.uid(), cohort_id));

create policy glp_cohort_members_teacher_update
on public.glp_cohort_members
for update to authenticated
using (public.glp_is_teacher_of(auth.uid(), cohort_id))
with check (public.glp_is_teacher_of(auth.uid(), cohort_id));

create policy glp_cohort_members_teacher_delete
on public.glp_cohort_members
for delete to authenticated
using (public.glp_is_teacher_of(auth.uid(), cohort_id));

-- Sin política INSERT directa: el alta de alumnos debe pasar por la RPC
-- glp_join_cohort_by_code(), que valida el código y la vigencia de la comisión.
