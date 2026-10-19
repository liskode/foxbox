-- Journal des connexions des élèves et des parents (date, heure, durée), lu par les professeurs de l'élève.
create table public.visits (
  id text primary key,
  user_id uuid not null,
  student_ids uuid[] not null default '{}',
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.visits (user_id);
create trigger touch before insert or update on public.visits for each row execute function public.touch();
create index on public.visits (updated_at);
alter table public.visits enable row level security;
grant select, insert, update, delete on public.visits to authenticated;

-- Chacun note ses propres connexions ; les professeurs de l'élève les lisent
create policy vi_own on public.visits for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy vi_teacher on public.visits for select using (student_ids && array(select public.my_student_ids()));
