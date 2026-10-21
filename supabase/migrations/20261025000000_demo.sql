-- Démo en lecture seule : un lien public ouvre une session sur un profil choisi par le professeur
-- (professeur, élève en classe, élève en soutien, parent). Ces sessions sont notées dans demo_sessions,
-- et le serveur y refuse toute modification (règle « restrictive » ajoutée à chaque table).

-- Réglages de la démo (un par professeur) : active ou non, profils proposés, texte d'accueil
create table public.demo_config (
  teacher_id uuid primary key references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.demo_config enable row level security;
create policy demo_config_own on public.demo_config for all
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
grant select, insert, update, delete on public.demo_config to authenticated;
grant select, insert, update, delete on public.demo_config to service_role;

-- Sessions ouvertes par le lien de démo (identifiant de session de Supabase Auth) : lues seulement par le serveur
create table public.demo_sessions (
  id uuid primary key,
  user_id uuid not null,
  teacher_id uuid not null, -- professeur qui a ouvert la démo
  profile text not null,
  created_at timestamptz not null default now()
);
alter table public.demo_sessions enable row level security;
grant select, insert, update, delete on public.demo_sessions to service_role;

create or replace function public.is_demo_session() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.demo_sessions
    where id = nullif(auth.jwt() ->> 'session_id', '')::uuid
  )
$$;
grant execute on function public.is_demo_session() to authenticated;

-- Aucune modification depuis une session de démo, sur toutes les tables (et les fichiers)
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename not in ('demo_sessions') loop
    execute format('create policy demo_readonly_ins on public.%I as restrictive for insert to authenticated with check (not public.is_demo_session())', t.tablename);
    execute format('create policy demo_readonly_upd on public.%I as restrictive for update to authenticated using (not public.is_demo_session())', t.tablename);
    execute format('create policy demo_readonly_del on public.%I as restrictive for delete to authenticated using (not public.is_demo_session())', t.tablename);
  end loop;
end $$;
create policy demo_readonly_ins on storage.objects as restrictive for insert to authenticated with check (not public.is_demo_session());
create policy demo_readonly_upd on storage.objects as restrictive for update to authenticated using (not public.is_demo_session());
create policy demo_readonly_del on storage.objects as restrictive for delete to authenticated using (not public.is_demo_session());

-- Arrêt de la démo par le professeur : ferme toutes les sessions de démo ouvertes sur ses profils
create or replace function public.end_demo_sessions() returns integer
language plpgsql security definer set search_path = public, auth as $$
declare n integer;
begin
  if public.is_demo_session() then raise exception 'Non autorisé en démo'; end if;
  delete from auth.sessions s using public.demo_sessions d
    where s.id = d.id and d.teacher_id = auth.uid();
  get diagnostics n = row_count;
  delete from public.demo_sessions where not exists (select 1 from auth.sessions s where s.id = demo_sessions.id);
  return n;
end $$;
grant execute on function public.end_demo_sessions() to authenticated;
