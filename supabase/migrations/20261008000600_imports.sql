-- Historique des imports Anki (pour pouvoir annuler un import), propre à chaque professeur
create table public.imports (
  id text primary key,
  owner_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create trigger touch before insert or update on public.imports for each row execute function public.touch();
create index on public.imports (updated_at);
alter table public.imports enable row level security;
create policy i_all on public.imports for all using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.is_teacher());
