-- Autocorrection d'une copie par l'élève : ressenti global, niveau estimé par critère, bilan.
-- Écrite par l'élève ; lue par lui et par le professeur de l'évaluation.
create table public.self_checks (
  id text primary key, -- evaluationId|studentId
  student_id uuid not null,
  teacher_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.self_checks (student_id);
create index on public.self_checks (teacher_id);
create index on public.self_checks (updated_at);
create trigger touch before insert or update on public.self_checks for each row execute function public.touch();
alter table public.self_checks enable row level security;
grant select, insert, update, delete on public.self_checks to authenticated;
grant select, insert, update, delete on public.self_checks to service_role;

create policy sc_student on public.self_checks for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());
create policy sc_teacher on public.self_checks for select
  using (teacher_id = auth.uid() and student_id = any (array(select public.my_student_ids())));

create policy demo_readonly_ins on public.self_checks as restrictive for insert to authenticated with check (not public.is_demo_session());
create policy demo_readonly_upd on public.self_checks as restrictive for update to authenticated using (not public.is_demo_session());
create policy demo_readonly_del on public.self_checks as restrictive for delete to authenticated using (not public.is_demo_session());
