-- Notes du professeur sur une classe : strictement personnelles
create table public.class_notes (
  id text primary key, -- teacherId|groupId
  teacher_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create trigger touch before insert or update on public.class_notes for each row execute function public.touch();
create index on public.class_notes (updated_at);
alter table public.class_notes enable row level security;
create policy cn_all on public.class_notes for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
