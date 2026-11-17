-- GuiaLab Pedidos 1.5.0: constructor de exámenes, bandeja de entregas y corrección docente.
-- Ejecutar UNA SOLA VEZ después de migration_1_4.sql. No elimina datos.

-- El docente necesita leer los perfiles de los alumnos inscriptos en sus propias comisiones.
drop policy if exists glp_profile_teacher_roster on public.glp_profiles;
create policy glp_profile_teacher_roster on public.glp_profiles for select to authenticated
using (exists (select 1 from public.glp_cohort_members m where m.user_id=glp_profiles.user_id and public.glp_is_teacher_of(auth.uid(),m.cohort_id)));

-- Los alumnos pueden leer únicamente las notas de sus entregas; ya existe glp_grades_access.
-- Los docentes pueden insertar y actualizar rúbricas asociadas a sus propias evaluaciones.
drop policy if exists glp_grades_teacher on public.glp_submission_grades;
create policy glp_grades_teacher on public.glp_submission_grades for all to authenticated
using (exists(select 1 from public.glp_submission_answers a join public.glp_submissions s on s.id=a.submission_id where a.id=answer_id and public.glp_is_exam_teacher(s.exam_id)))
with check (grader_id=auth.uid() and exists(select 1 from public.glp_submission_answers a join public.glp_submissions s on s.id=a.submission_id where a.id=answer_id and public.glp_is_exam_teacher(s.exam_id)));

-- Asegurar lectura de exámenes y sus cinco pedidos para el alumno activo, y administración del propietario.
drop policy if exists glp_exam_access on public.glp_exams;
create policy glp_exam_access on public.glp_exams for select to authenticated
using (public.glp_is_exam_teacher(id) or exists(select 1 from public.glp_cohort_members m where m.cohort_id=glp_exams.cohort_id and m.user_id=auth.uid() and m.status='active'));
drop policy if exists glp_exam_manage on public.glp_exams;
create policy glp_exam_manage on public.glp_exams for all to authenticated
using (owner_id=auth.uid() or public.is_glp_admin()) with check (owner_id=auth.uid() or public.is_glp_admin());

-- El envío del alumno requiere evaluación publicada, pertenencia activa y ventana temporal válida.
drop policy if exists glp_submissions_insert on public.glp_submissions;
create policy glp_submissions_insert on public.glp_submissions for insert to authenticated
with check (student_id=auth.uid() and exists(select 1 from public.glp_exams e join public.glp_cohort_members m on m.cohort_id=e.cohort_id where e.id=exam_id and e.status='published' and m.user_id=auth.uid() and m.status='active' and (e.opens_at is null or now()>=e.opens_at) and (e.closes_at is null or now()<=e.closes_at)));

-- Evitar que los alumnos modifiquen entregas ya enviadas. Solo el docente cambia estados y publica notas.
drop policy if exists glp_submissions_teacher_update on public.glp_submissions;
create policy glp_submissions_teacher_update on public.glp_submissions for update to authenticated
using (public.glp_is_exam_teacher(exam_id)) with check (public.glp_is_exam_teacher(exam_id));

-- Asegurar que respuestas nuevas se inserten solo en una entrega propia recién creada.
drop policy if exists glp_answers_insert on public.glp_submission_answers;
create policy glp_answers_insert on public.glp_submission_answers for insert to authenticated
with check (exists(select 1 from public.glp_submissions s where s.id=submission_id and s.student_id=auth.uid() and s.status in ('submitted','resubmitted')));

-- Los alumnos solo pueden modificar respuestas cuando la entrega fue devuelta para corregir.
drop policy if exists glp_answers_update on public.glp_submission_answers;
create policy glp_answers_update on public.glp_submission_answers for update to authenticated
using (exists(select 1 from public.glp_submissions s where s.id=submission_id and s.student_id=auth.uid() and s.status='returned'))
with check (exists(select 1 from public.glp_submissions s where s.id=submission_id and s.student_id=auth.uid() and s.status='returned'));
