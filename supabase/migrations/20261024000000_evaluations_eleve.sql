-- Évaluations de l'élève dans son établissement (DS, contrôles) : signalées à l'avance, puis note et documents.
-- Lues et modifiables par l'élève, ses parents et ses professeurs ; par personne d'autre.
create table public.assessments (
  id text primary key,
  student_id uuid not null,
  author_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.assessments (student_id);
create trigger touch before insert or update on public.assessments for each row execute function public.touch();
create index on public.assessments (updated_at);
alter table public.assessments enable row level security;
grant select, insert, update, delete on public.assessments to authenticated;

create function public.can_follow_student(student uuid) returns boolean language sql stable security definer set search_path = public as $$
  select student = auth.uid()
      or student = any (array(select public.my_children()))
      or student = any (array(select public.my_student_ids()))
$$;
create policy as_read on public.assessments for select using (public.can_follow_student(student_id));
create policy as_insert on public.assessments for insert with check (author_id = auth.uid() and public.can_follow_student(student_id));
create policy as_update on public.assessments for update using (public.can_follow_student(student_id));
