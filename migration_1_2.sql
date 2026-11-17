-- GuiaLab Pedidos 1.2.0 - migración educativa
-- Ejecutar UNA SOLA VEZ después del esquema inicial. No reemplaza ni borra datos.
create extension if not exists pgcrypto;

create table if not exists public.glp_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 email text,
 access_level text not null default 'free' check (access_level in ('free','student','teacher','institution','admin')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.glp_institutions (
 id uuid primary key default gen_random_uuid(), name text not null,
 status text not null default 'pending' check(status in ('pending','active','suspended')),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.glp_institution_members (
 institution_id uuid not null references public.glp_institutions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('manager','teacher')),
 status text not null default 'active' check(status in ('invited','active','disabled')),
 created_at timestamptz not null default now(), primary key(institution_id,user_id)
);
create table if not exists public.glp_cohorts (
 id uuid primary key default gen_random_uuid(), name text not null,
 owner_id uuid not null references auth.users(id), institution_id uuid references public.glp_institutions(id) on delete set null,
 access_code text unique, starts_on date, ends_on date,
 status text not null default 'active' check(status in ('active','archived')),
 created_at timestamptz not null default now()
);
create table if not exists public.glp_cohort_members (
 cohort_id uuid not null references public.glp_cohorts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'active' check(status in ('invited','active','disabled')),
 enrolled_at timestamptz not null default now(), primary key(cohort_id,user_id)
);
create table if not exists public.glp_exams (
 id uuid primary key default gen_random_uuid(), title text not null,
 instructions text not null default '', owner_id uuid not null references auth.users(id),
 cohort_id uuid references public.glp_cohorts(id) on delete cascade,
 opens_at timestamptz, closes_at timestamptz,
 allow_catalog boolean not null default true,
 passing_score integer not null default 70 check(passing_score between 0 and 100),
 status text not null default 'draft' check(status in ('draft','published','closed')),
 created_at timestamptz not null default now()
);
create table if not exists public.glp_exam_cases (
 exam_id uuid not null references public.glp_exams(id) on delete cascade,
 case_id uuid not null references public.glp_cases(id), position smallint not null check(position between 1 and 5),
 primary key(exam_id,case_id), unique(exam_id,position)
);
create table if not exists public.glp_submissions (
 id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.glp_exams(id) on delete cascade,
 student_id uuid not null references auth.users(id), attempt_no integer not null default 1,
 status text not null default 'submitted' check(status in ('submitted','in_review','returned','resubmitted','graded')),
 submitted_at timestamptz not null default now(), returned_at timestamptz, graded_at timestamptz,
 total_score numeric(5,2), passed boolean, teacher_feedback text,
 unique(exam_id,student_id,attempt_no)
);
create table if not exists public.glp_submission_answers (
 id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.glp_submissions(id) on delete cascade,
 case_id uuid not null references public.glp_cases(id), answer jsonb not null default '{}'::jsonb,
 transcription text, created_at timestamptz not null default now(), unique(submission_id,case_id)
);
create table if not exists public.glp_submission_grades (
 id uuid primary key default gen_random_uuid(), answer_id uuid not null unique references public.glp_submission_answers(id) on delete cascade,
 grader_id uuid not null references auth.users(id), recognition numeric(5,2) not null default 0 check(recognition between 0 and 20),
 areas numeric(5,2) not null default 0 check(areas between 0 and 15),
 sample_tubes numeric(5,2) not null default 0 check(sample_tubes between 0 and 25),
 preanalytics numeric(5,2) not null default 0 check(preanalytics between 0 and 20),
 judgement numeric(5,2) not null default 0 check(judgement between 0 and 20),
 feedback text not null default '', updated_at timestamptz not null default now()
);

create or replace function public.glp_is_teacher_of(p_user uuid, p_cohort uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.glp_cohorts c where c.id=p_cohort and c.owner_id=p_user)
 or exists(select 1 from public.glp_cohorts c join public.glp_institution_members m on m.institution_id=c.institution_id where c.id=p_cohort and m.user_id=p_user and m.status='active' and m.role in ('manager','teacher'))
 or exists(select 1 from public.glp_admins a where a.user_id=p_user);
$$;
create or replace function public.glp_is_exam_teacher(p_exam uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.glp_exams e where e.id=p_exam and (e.owner_id=auth.uid() or public.glp_is_teacher_of(auth.uid(),e.cohort_id)))
 or exists(select 1 from public.glp_admins a where a.user_id=auth.uid());
$$;

alter table public.glp_profiles enable row level security;
alter table public.glp_institutions enable row level security;
alter table public.glp_institution_members enable row level security;
alter table public.glp_cohorts enable row level security;
alter table public.glp_cohort_members enable row level security;
alter table public.glp_exams enable row level security;
alter table public.glp_exam_cases enable row level security;
alter table public.glp_submissions enable row level security;
alter table public.glp_submission_answers enable row level security;
alter table public.glp_submission_grades enable row level security;

drop policy if exists glp_profile_self on public.glp_profiles;
create policy glp_profile_self on public.glp_profiles for all to authenticated using(user_id=auth.uid() or public.is_glp_admin()) with check(user_id=auth.uid() or public.is_glp_admin());
drop policy if exists glp_institution_read on public.glp_institutions;
create policy glp_institution_read on public.glp_institutions for select to authenticated using(created_by=auth.uid() or exists(select 1 from public.glp_institution_members m where m.institution_id=id and m.user_id=auth.uid()) or public.is_glp_admin());
drop policy if exists glp_institution_create on public.glp_institutions;
create policy glp_institution_create on public.glp_institutions for insert to authenticated with check(created_by=auth.uid());
drop policy if exists glp_institution_admin on public.glp_institutions;
create policy glp_institution_admin on public.glp_institutions for update to authenticated using(created_by=auth.uid() or public.is_glp_admin()) with check(created_by=auth.uid() or public.is_glp_admin());
drop policy if exists glp_members_read on public.glp_institution_members;
create policy glp_members_read on public.glp_institution_members for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.glp_institutions i where i.id=institution_id and i.created_by=auth.uid()) or public.is_glp_admin());
drop policy if exists glp_members_manage on public.glp_institution_members;
create policy glp_members_manage on public.glp_institution_members for all to authenticated using(exists(select 1 from public.glp_institutions i where i.id=institution_id and i.created_by=auth.uid()) or public.is_glp_admin()) with check(exists(select 1 from public.glp_institutions i where i.id=institution_id and i.created_by=auth.uid()) or public.is_glp_admin());
drop policy if exists glp_cohort_access on public.glp_cohorts;
create policy glp_cohort_access on public.glp_cohorts for all to authenticated using(owner_id=auth.uid() or public.glp_is_teacher_of(auth.uid(),id) or exists(select 1 from public.glp_cohort_members m where m.cohort_id=id and m.user_id=auth.uid()) or public.is_glp_admin()) with check(owner_id=auth.uid() or public.is_glp_admin());
drop policy if exists glp_cohort_members_access on public.glp_cohort_members;
create policy glp_cohort_members_access on public.glp_cohort_members for all to authenticated using(user_id=auth.uid() or public.glp_is_teacher_of(auth.uid(),cohort_id)) with check(user_id=auth.uid() or public.glp_is_teacher_of(auth.uid(),cohort_id));
drop policy if exists glp_exam_access on public.glp_exams;
create policy glp_exam_access on public.glp_exams for select to authenticated using(public.glp_is_exam_teacher(id) or exists(select 1 from public.glp_cohort_members m where m.cohort_id=cohort_id and m.user_id=auth.uid() and m.status='active'));
drop policy if exists glp_exam_manage on public.glp_exams;
create policy glp_exam_manage on public.glp_exams for all to authenticated using(public.glp_is_exam_teacher(id)) with check(owner_id=auth.uid() or public.is_glp_admin());
drop policy if exists glp_exam_cases_access on public.glp_exam_cases;
create policy glp_exam_cases_access on public.glp_exam_cases for select to authenticated using(public.glp_is_exam_teacher(exam_id) or exists(select 1 from public.glp_exams e join public.glp_cohort_members m on m.cohort_id=e.cohort_id where e.id=exam_id and m.user_id=auth.uid() and m.status='active'));
drop policy if exists glp_exam_cases_manage on public.glp_exam_cases;
create policy glp_exam_cases_manage on public.glp_exam_cases for all to authenticated using(public.glp_is_exam_teacher(exam_id)) with check(public.glp_is_exam_teacher(exam_id));
drop policy if exists glp_submissions_student_teacher on public.glp_submissions;
create policy glp_submissions_student_teacher on public.glp_submissions for select to authenticated using(student_id=auth.uid() or public.glp_is_exam_teacher(exam_id));
drop policy if exists glp_submissions_insert on public.glp_submissions;
create policy glp_submissions_insert on public.glp_submissions for insert to authenticated with check(student_id=auth.uid() and exists(select 1 from public.glp_exams e join public.glp_cohort_members m on m.cohort_id=e.cohort_id where e.id=exam_id and e.status='published' and m.user_id=auth.uid() and m.status='active' and (e.opens_at is null or now()>=e.opens_at) and (e.closes_at is null or now()<=e.closes_at)));
drop policy if exists glp_submissions_teacher_update on public.glp_submissions;
create policy glp_submissions_teacher_update on public.glp_submissions for update to authenticated using(public.glp_is_exam_teacher(exam_id)) with check(public.glp_is_exam_teacher(exam_id));
drop policy if exists glp_answers_access on public.glp_submission_answers;
create policy glp_answers_access on public.glp_submission_answers for select to authenticated using(exists(select 1 from public.glp_submissions s where s.id=submission_id and (s.student_id=auth.uid() or public.glp_is_exam_teacher(s.exam_id))));
drop policy if exists glp_answers_insert on public.glp_submission_answers;
create policy glp_answers_insert on public.glp_submission_answers for insert to authenticated with check(exists(select 1 from public.glp_submissions s where s.id=submission_id and s.student_id=auth.uid() and s.status in ('submitted','returned')));
drop policy if exists glp_answers_update on public.glp_submission_answers;
create policy glp_answers_update on public.glp_submission_answers for update to authenticated using(exists(select 1 from public.glp_submissions s where s.id=submission_id and s.student_id=auth.uid() and s.status='returned')) with check(exists(select 1 from public.glp_submissions s where s.id=submission_id and s.student_id=auth.uid() and s.status='returned'));
drop policy if exists glp_grades_access on public.glp_submission_grades;
create policy glp_grades_access on public.glp_submission_grades for select to authenticated using(exists(select 1 from public.glp_submission_answers a join public.glp_submissions s on s.id=a.submission_id where a.id=answer_id and (s.student_id=auth.uid() or public.glp_is_exam_teacher(s.exam_id))));
drop policy if exists glp_grades_teacher on public.glp_submission_grades;
create policy glp_grades_teacher on public.glp_submission_grades for all to authenticated using(exists(select 1 from public.glp_submission_answers a join public.glp_submissions s on s.id=a.submission_id where a.id=answer_id and public.glp_is_exam_teacher(s.exam_id))) with check(grader_id=auth.uid() and exists(select 1 from public.glp_submission_answers a join public.glp_submissions s on s.id=a.submission_id where a.id=answer_id and public.glp_is_exam_teacher(s.exam_id)));

-- No se activa aún un límite de invitados por IP: requiere Edge Function + CAPTCHA/controles antiabuso.
-- La cuota local no se considera un control de seguridad.
