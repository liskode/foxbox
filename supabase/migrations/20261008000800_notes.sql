-- Notes du professeur sur un élève : strictement privées (ni l'élève, ni les co-enseignants)
create table public.notes (
  id text primary key, -- teacherId|studentId
  teacher_id uuid not null,
  student_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create trigger touch before insert or update on public.notes for each row execute function public.touch();
create index on public.notes (updated_at);
alter table public.notes enable row level security;
create policy n_all on public.notes for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid() and student_id = any (array(select public.my_student_ids())));
