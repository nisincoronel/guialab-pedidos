-- GuiaLab Pedidos 0.6 · esquema inicial Supabase
-- Ejecutar completo en Supabase > SQL Editor.
create extension if not exists pgcrypto;
create extension if not exists unaccent with schema public;

create table if not exists public.glp_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_glp_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.glp_admins where user_id = auth.uid());
$$;

create table if not exists public.glp_cases (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  difficulty text not null check (difficulty in ('Inicial','Intermedio','Avanzado')),
  format text not null check (format in ('Manuscrito','Impreso','Mixto')),
  areas text[] not null default '{}',
  skills text[] not null default '{}',
  prompt text not null,
  transcription text,
  image_path text not null,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.glp_answer_keys (
  case_id uuid primary key references public.glp_cases(id) on delete cascade,
  expected_terms text[] not null,
  explanation text not null,
  transcription text,
  updated_at timestamptz not null default now()
);

alter table public.glp_admins enable row level security;
alter table public.glp_cases enable row level security;
alter table public.glp_answer_keys enable row level security;

drop policy if exists "admin read own role" on public.glp_admins;
create policy "admin read own role" on public.glp_admins for select to authenticated using (user_id = auth.uid());

drop policy if exists "published cases visible" on public.glp_cases;
create policy "published cases visible" on public.glp_cases for select to anon, authenticated using (status = 'published' or public.is_glp_admin());
drop policy if exists "admin insert cases" on public.glp_cases;
create policy "admin insert cases" on public.glp_cases for insert to authenticated with check (public.is_glp_admin());
drop policy if exists "admin update cases" on public.glp_cases;
create policy "admin update cases" on public.glp_cases for update to authenticated using (public.is_glp_admin()) with check (public.is_glp_admin());
drop policy if exists "admin delete cases" on public.glp_cases;
create policy "admin delete cases" on public.glp_cases for delete to authenticated using (public.is_glp_admin());

drop policy if exists "answer keys admin only" on public.glp_answer_keys;
create policy "answer keys admin only" on public.glp_answer_keys for all to authenticated using (public.is_glp_admin()) with check (public.is_glp_admin());

-- La clave de respuestas nunca se expone mediante SELECT público.
-- Esta función compara términos esperados en el servidor y devuelve solo la devolución.
create or replace function public.glp_evaluate_case(p_case_id uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terms text[];
  v_explanation text;
  v_matched text[];
  v_missing text[];
  v_total integer;
  v_score integer;
begin
  if not exists(select 1 from public.glp_cases where id = p_case_id and status = 'published') then
    raise exception 'Caso no disponible';
  end if;

  select expected_terms, explanation
    into v_terms, v_explanation
    from public.glp_answer_keys
    where case_id = p_case_id;

  if v_terms is null or cardinality(v_terms) = 0 then
    raise exception 'El caso todavía no tiene una clave de corrección';
  end if;

  select coalesce(array_agg(t), '{}'::text[])
    into v_matched
    from unnest(v_terms) as t
    where position(lower(unaccent(t)) in lower(unaccent(coalesce(p_answer,'')))) > 0;

  select coalesce(array_agg(t), '{}'::text[])
    into v_missing
    from unnest(v_terms) as t
    where position(lower(unaccent(t)) in lower(unaccent(coalesce(p_answer,'')))) = 0;

  v_total := cardinality(v_terms);
  v_score := round((cardinality(v_matched)::numeric / v_total) * 100);

  return jsonb_build_object(
    'score', v_score,
    'matched', to_jsonb(v_matched),
    'missing', to_jsonb(v_missing),
    'explanation', v_explanation,
    'transcription', (select transcription from public.glp_answer_keys where case_id = p_case_id)
  );
end;
$$;

grant execute on function public.glp_evaluate_case(uuid,text) to anon, authenticated;
grant select on public.glp_cases to anon, authenticated;
grant insert, update, delete on public.glp_cases to authenticated;
grant select, insert, update, delete on public.glp_answer_keys to authenticated;

-- Bucket PRIVADO: los borradores no quedan expuestos por URL pública.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('glp-pedidos','glp-pedidos',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=8388608, allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "public read teaching images" on storage.objects;
drop policy if exists "published teaching images or admin" on storage.objects;
create policy "published teaching images or admin" on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'glp-pedidos'
  and (
    public.is_glp_admin()
    or exists (
      select 1 from public.glp_cases c
      where c.image_path = storage.objects.name and c.status = 'published'
    )
  )
);
drop policy if exists "admins upload teaching images" on storage.objects;
create policy "admins upload teaching images" on storage.objects for insert to authenticated with check (bucket_id = 'glp-pedidos' and public.is_glp_admin());
drop policy if exists "admins update teaching images" on storage.objects;
create policy "admins update teaching images" on storage.objects for update to authenticated using (bucket_id = 'glp-pedidos' and public.is_glp_admin()) with check (bucket_id = 'glp-pedidos' and public.is_glp_admin());
drop policy if exists "admins delete teaching images" on storage.objects;
create policy "admins delete teaching images" on storage.objects for delete to authenticated using (bucket_id = 'glp-pedidos' and public.is_glp_admin());

-- Después de crear el usuario docente en Authentication > Users, asignarle rol:
-- insert into public.glp_admins(user_id) values ('UUID-DEL-USUARIO-DOCENTE');
