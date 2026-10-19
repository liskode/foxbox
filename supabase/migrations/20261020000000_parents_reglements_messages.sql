-- Comptes parents, tarifs et règlements du soutien, fils de discussion.

-- ---------- Comptes parents ----------
-- Un compte parent (créé par la fonction serveur) est rattaché à un ou plusieurs enfants
create table public.parents (
  id uuid primary key references auth.users on delete cascade,
  student_ids uuid[] not null default '{}',
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- Tarifs (avec date d'effet) et mode de règlement d'un élève suivi en soutien
create table public.billing (
  id text primary key,
  teacher_id uuid not null,
  student_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- Règlements reçus (séance, forfait payé d'avance, fin de mois)
create table public.payments (
  id text primary key,
  teacher_id uuid not null,
  student_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.payments (student_id);

-- Messages : un fil « eleve » (élève ↔ professeur) et un fil « parents » (parents ↔ professeur) par élève
create table public.messages (
  id text primary key,
  teacher_id uuid not null,
  student_id uuid not null,
  thread text not null check (thread in ('eleve', 'parents')),
  author_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.messages (student_id);

-- Dernier message lu par chacun dans chaque fil
create table public.message_reads (
  id text primary key,
  user_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

do $$
declare t text;
begin
  foreach t in array array['parents','billing','payments','messages','message_reads'] loop
    execute format('create trigger touch before insert or update on public.%I for each row execute function public.touch()', t);
    execute format('create index on public.%I (updated_at)', t);
    execute format('alter table public.%I enable row level security', t);
    -- Accès explicite pour les comptes connectés (les règles ci-dessous filtrent ce que chacun voit)
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Enfants du parent connecté
create function public.my_children() returns setof uuid language sql stable security definer set search_path = public as $$
  select unnest(student_ids) from parents where id = auth.uid() and not deleted
$$;
-- Groupes de soutien des enfants du parent connecté (les classes restent fermées aux parents pour l'instant)
create function public.my_children_tutoring_ids() returns setof text language sql stable security definer set search_path = public as $$
  select g.id from groups g join memberships m on m.group_id = g.id
  where m.student_id = any (array(select public.my_children())) and not m.deleted and not g.deleted and g.data->>'kind' = 'soutien'
$$;

-- Comptes parents : le parent lui-même (qui peut régler ses préférences) et les professeurs de ses enfants
create policy pa_read on public.parents for select
  using (id = auth.uid() or student_ids && array(select public.my_student_ids()));
create policy pa_update on public.parents for update using (id = auth.uid());

-- Ce que voit un parent : la fiche de ses enfants, leur soutien (séances, documents, travail coché),
-- la note qui lui est destinée
create policy s_parent on public.students for select using (id = any (array(select public.my_children())));
create policy g_parent on public.groups for select using (id = any (array(select public.my_children_tutoring_ids())));
create policy m_parent on public.memberships for select using (group_id = any (array(select public.my_children_tutoring_ids())));
create policy ts_parent on public.tutoring_sessions for select using (group_id = any (array(select public.my_children_tutoring_ids())));
create policy tf_parent on public.tutoring_files for select using (group_id = any (array(select public.my_children_tutoring_ids())));
create policy hc_parent on public.homework_checks for select using (student_id = any (array(select public.my_children())));
create policy sn_parent on public.session_notes for select using (kind = 'parents' and student_id = any (array(select public.my_children())));
create policy soutien_parent on storage.objects for select using (
  bucket_id = 'soutien' and split_part(name, '/', 2) = any (array(select public.my_children_tutoring_ids())));

-- Tarifs et règlements : écrits par le professeur, lus par lui et par les parents
create policy bi_teacher on public.billing for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid() and student_id = any (array(select public.my_student_ids())));
create policy bi_parent on public.billing for select using (student_id = any (array(select public.my_children())));
create policy py_teacher on public.payments for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid() and student_id = any (array(select public.my_student_ids())));
create policy py_parent on public.payments for select using (student_id = any (array(select public.my_children())));

-- Messages : chacun lit et écrit dans les fils qui le concernent
create function public.can_see_thread(teacher uuid, student uuid, thr text) returns boolean language sql stable security definer set search_path = public as $$
  select (teacher = auth.uid() and student = any (array(select public.my_student_ids())))
      or (thr = 'eleve' and student = auth.uid())
      or (thr = 'parents' and student = any (array(select public.my_children())))
$$;
create policy msg_read on public.messages for select using (public.can_see_thread(teacher_id, student_id, thread));
create policy msg_insert on public.messages for insert
  with check (author_id = auth.uid() and public.can_see_thread(teacher_id, student_id, thread));
create policy msg_update on public.messages for update using (author_id = auth.uid());

create policy mr_all on public.message_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Pièces jointes des messages, rangées sous msg/<élève>/<fil>/<fichier>
insert into storage.buckets (id, name, public, file_size_limit) values ('messages', 'messages', false, 52428800);
create function public.can_see_thread_path(path text) returns boolean language sql stable security definer set search_path = public as $$
  select split_part(path, '/', 1) = 'msg' and (
       split_part(path, '/', 2)::uuid = any (array(select public.my_student_ids()))
    or (split_part(path, '/', 3) = 'eleve' and split_part(path, '/', 2)::uuid = auth.uid())
    or (split_part(path, '/', 3) = 'parents' and split_part(path, '/', 2)::uuid = any (array(select public.my_children()))))
$$;
create policy messages_read on storage.objects for select using (bucket_id = 'messages' and public.can_see_thread_path(name));
create policy messages_write on storage.objects for insert with check (bucket_id = 'messages' and public.can_see_thread_path(name));
create policy messages_update on storage.objects for update using (bucket_id = 'messages' and owner_id = auth.uid()::text);
