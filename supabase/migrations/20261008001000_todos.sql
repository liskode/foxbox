-- To-do list du professeur : strictement personnelle
create table public.todos (
  id text primary key,
  teacher_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create trigger touch before insert or update on public.todos for each row execute function public.touch();
create index on public.todos (updated_at);
alter table public.todos enable row level security;
create policy td_all on public.todos for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
