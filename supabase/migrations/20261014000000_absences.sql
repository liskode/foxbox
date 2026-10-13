-- Absences relevées à l'appel (plan de classe) : propres au professeur, comme ses notes
create table public.absences (
  id text primary key,
  teacher_id uuid not null,
  student_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create trigger touch before insert or update on public.absences for each row execute function public.touch();
create index on public.absences (updated_at);
alter table public.absences enable row level security;
create policy ab_all on public.absences for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid() and student_id = any (array(select public.my_student_ids())));
