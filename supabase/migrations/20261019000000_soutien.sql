-- Soutien scolaire : un « groupe de soutien » est une ligne de `groups` (data.kind = 'soutien') avec ses élèves
-- dans `memberships` ; les règles d'accès des classes s'appliquent donc telles quelles (élèves, notes, flashcards).
-- Nouvelles tables : séances, notes de séance (une par élève et par destinataire), documents, travail coché.

create table public.tutoring_sessions (
  id text primary key,
  group_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.tutoring_sessions (group_id);

create table public.session_notes (
  id text primary key,
  teacher_id uuid not null,
  student_id uuid not null,
  kind text not null check (kind in ('eleve', 'parents', 'prive')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.session_notes (student_id);

create table public.tutoring_files (
  id text primary key,
  group_id text not null,
  author_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.tutoring_files (group_id);

create table public.homework_checks (
  id text primary key,
  group_id text not null,
  student_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.homework_checks (student_id);

do $$
declare t text;
begin
  foreach t in array array['tutoring_sessions','session_notes','tutoring_files','homework_checks'] loop
    execute format('create trigger touch before insert or update on public.%I for each row execute function public.touch()', t);
    execute format('create index on public.%I (updated_at)', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Groupes (classes ou soutien) dont l'utilisateur est professeur
create function public.my_teacher_group_ids() returns setof text language sql stable security definer set search_path = public as $$
  select id from groups where auth.uid() = any (teacher_ids) and not deleted
$$;

-- Séances : lues par le professeur et les élèves du groupe, écrites par le professeur
create policy ts_read on public.tutoring_sessions for select using (group_id = any (array(select public.my_group_ids())));
create policy ts_insert on public.tutoring_sessions for insert with check (group_id = any (array(select public.my_teacher_group_ids())));
create policy ts_update on public.tutoring_sessions for update using (group_id = any (array(select public.my_teacher_group_ids())));

-- Notes de séance : le professeur qui les écrit ; l'élève lit seulement la note qui lui est destinée.
-- (La note « parents » n'est lisible par personne d'autre tant que l'accès parents n'existe pas ; la note « prive » jamais.)
create policy sn_teacher on public.session_notes for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid() and student_id = any (array(select public.my_student_ids())));
create policy sn_student on public.session_notes for select using (student_id = auth.uid() and kind = 'eleve');

-- Documents : lus par le groupe ; chacun dépose les siens ; le professeur peut aussi modifier ceux de ses élèves
create policy tf_read on public.tutoring_files for select using (group_id = any (array(select public.my_group_ids())));
create policy tf_insert on public.tutoring_files for insert
  with check (author_id = auth.uid() and group_id = any (array(select public.my_group_ids())));
create policy tf_update on public.tutoring_files for update
  using (author_id = auth.uid() or group_id = any (array(select public.my_teacher_group_ids())));

-- Travail coché : écrit par l'élève, lu par l'élève et ses professeurs
create policy hc_read on public.homework_checks for select
  using (student_id = auth.uid() or group_id = any (array(select public.my_teacher_group_ids())));
create policy hc_insert on public.homework_checks for insert
  with check (student_id = auth.uid() and group_id = any (array(select public.my_group_ids())));
create policy hc_update on public.homework_checks for update using (student_id = auth.uid());

-- Fichiers du soutien, rangés sous sout/<groupe>/<fichier> : privés au groupe (professeur et élèves)
insert into storage.buckets (id, name, public, file_size_limit) values ('soutien', 'soutien', false, 52428800);
create policy soutien_read on storage.objects for select using (
  bucket_id = 'soutien' and split_part(name, '/', 2) = any (array(select public.my_group_ids())));
create policy soutien_write on storage.objects for insert with check (
  bucket_id = 'soutien' and split_part(name, '/', 2) = any (array(select public.my_group_ids())));
create policy soutien_update on storage.objects for update using (
  bucket_id = 'soutien' and (owner_id = auth.uid()::text or split_part(name, '/', 2) = any (array(select public.my_teacher_group_ids()))));
create policy soutien_delete on storage.objects for delete using (
  bucket_id = 'soutien' and (owner_id = auth.uid()::text or split_part(name, '/', 2) = any (array(select public.my_teacher_group_ids()))));
