-- FoxBox : schéma en ligne.
-- Chaque table stocke l'objet de l'application dans `data` (jsonb) ; les colonnes à part servent
-- uniquement aux règles d'accès (RLS) et à la synchronisation (`updated_at`, `deleted`).

create table public.allowed_teachers (email text primary key);

create table public.teachers (
  id uuid primary key references auth.users on delete cascade,
  school_id text not null default 'claudel',
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table public.students (
  id uuid primary key references auth.users on delete cascade,
  school_id text not null default 'claudel',
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table public.groups (
  id text primary key,
  teacher_ids uuid[] not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table public.memberships (
  id text primary key,
  group_id text not null,
  student_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.memberships (group_id);
create index on public.memberships (student_id);

create table public.cards (
  id text primary key,
  owner_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table public.units (
  id text primary key,
  owner_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table public.unit_cards (
  id text primary key,
  owner_id uuid not null,
  unit_id text not null,
  card_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table public.publications (
  id text primary key,
  group_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table public.student_cards (
  id text primary key,
  student_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.student_cards (student_id);

create table public.reviews (
  id text primary key,
  student_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.reviews (student_id);

create table public.trombi (
  id text primary key,
  teacher_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- Horodatage serveur, utilisé comme curseur de synchronisation
create function public.touch() returns trigger language plpgsql as $$
begin new.updated_at := clock_timestamp(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['teachers','students','groups','memberships','cards','units','unit_cards',
                           'publications','student_cards','reviews','trombi'] loop
    execute format('create trigger touch before insert or update on public.%I for each row execute function public.touch()', t);
    execute format('create index on public.%I (updated_at)', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
alter table public.allowed_teachers enable row level security;

-- Fonctions d'aide aux règles d'accès
create function public.is_teacher() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from teachers where id = auth.uid() and not deleted)
$$;

create function public.my_group_ids() returns setof text language sql stable security definer set search_path = public as $$
  select id from groups where auth.uid() = any (teacher_ids) and not deleted
  union
  select group_id from memberships where student_id = auth.uid() and not deleted
$$;

create function public.my_student_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select m.student_id from memberships m join groups g on g.id = m.group_id
  where auth.uid() = any (g.teacher_ids) and not m.deleted and not g.deleted
$$;

-- Professeurs : lisibles par les professeurs (co-enseignement) ; chacun modifie sa fiche
create policy t_read on public.teachers for select using (id = auth.uid() or public.is_teacher());
create policy t_update on public.teachers for update using (id = auth.uid());

-- Élèves : l'élève lui-même et ses professeurs. Création uniquement par la fonction serveur.
create policy s_read on public.students for select
  using (id = auth.uid() or id = any (array(select public.my_student_ids())));
create policy s_update on public.students for update
  using (id = auth.uid() or id = any (array(select public.my_student_ids())));

-- Classes
create policy g_read on public.groups for select using (id = any (array(select public.my_group_ids())));
create policy g_insert on public.groups for insert with check (public.is_teacher() and auth.uid() = any (teacher_ids));
create policy g_update on public.groups for update using (auth.uid() = any (teacher_ids));

-- Inscriptions
create policy m_read on public.memberships for select
  using (student_id = auth.uid() or group_id = any (array(select public.my_group_ids())));
create policy m_write on public.memberships for insert with check (public.is_teacher() and group_id = any (array(select public.my_group_ids())));
create policy m_update on public.memberships for update using (public.is_teacher() and group_id = any (array(select public.my_group_ids())));

-- Contenu pédagogique : lisible par tous les comptes, modifiable par son auteur
create policy c_read on public.cards for select using (auth.uid() is not null);
create policy c_insert on public.cards for insert with check (public.is_teacher() and owner_id = auth.uid());
create policy c_update on public.cards for update using (owner_id = auth.uid());
create policy u_read on public.units for select using (auth.uid() is not null);
create policy u_insert on public.units for insert with check (public.is_teacher() and owner_id = auth.uid());
create policy u_update on public.units for update using (owner_id = auth.uid());
create policy uc_read on public.unit_cards for select using (auth.uid() is not null);
create policy uc_insert on public.unit_cards for insert with check (public.is_teacher() and owner_id = auth.uid());
create policy uc_update on public.unit_cards for update using (owner_id = auth.uid());

-- Publications
create policy p_read on public.publications for select using (group_id = any (array(select public.my_group_ids())));
create policy p_insert on public.publications for insert with check (public.is_teacher() and group_id = any (array(select public.my_group_ids())));
create policy p_update on public.publications for update using (public.is_teacher() and group_id = any (array(select public.my_group_ids())));

-- Progression et historique : écrits par l'élève, lus par l'élève et ses professeurs
create policy sc_read on public.student_cards for select
  using (student_id = auth.uid() or student_id = any (array(select public.my_student_ids())));
create policy sc_insert on public.student_cards for insert with check (student_id = auth.uid());
create policy sc_update on public.student_cards for update using (student_id = auth.uid());
create policy r_read on public.reviews for select
  using (student_id = auth.uid() or student_id = any (array(select public.my_student_ids())));
create policy r_insert on public.reviews for insert with check (student_id = auth.uid());
create policy r_update on public.reviews for update using (student_id = auth.uid());

-- Trombi : propre à chaque professeur
create policy tr_all on public.trombi for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- Codes de cartes uniques
create sequence public.card_code_seq;
create function public.next_card_code() returns text language sql volatile security definer set search_path = public as $$
  select 'C' || lpad(nextval('card_code_seq')::text, 4, '0')
$$;
revoke execute on function public.next_card_code() from anon;

-- Création automatique de la fiche professeur pour les adresses autorisées
create function public.on_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from allowed_teachers where lower(email) = lower(new.email)) then
    insert into teachers (id, data) values (
      new.id,
      jsonb_build_object('id', new.id, 'name', coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
                         'login', new.email, 'password', '')
    );
  end if;
  return new;
end $$;
create trigger on_new_user after insert on auth.users for each row execute function public.on_new_user();

-- Stockage des images : cartes (lisibles par tous les comptes) et photos d'élèves (privées)
insert into storage.buckets (id, name, public) values ('cards', 'cards', false), ('photos', 'photos', false);

create policy cards_read on storage.objects for select using (bucket_id = 'cards' and auth.uid() is not null);
create policy cards_write on storage.objects for insert with check (bucket_id = 'cards' and public.is_teacher());
create policy cards_update on storage.objects for update using (bucket_id = 'cards' and owner_id = auth.uid()::text);
create policy cards_delete on storage.objects for delete using (bucket_id = 'cards' and owner_id = auth.uid()::text);

-- Photos rangées sous <id de l'élève>/<fichier>
create policy photos_read on storage.objects for select using (
  bucket_id = 'photos' and (
    split_part(name, '/', 1) = auth.uid()::text
    or split_part(name, '/', 1)::uuid = any (array(select public.my_student_ids()))
  ));
create policy photos_write on storage.objects for insert with check (
  bucket_id = 'photos' and split_part(name, '/', 1)::uuid = any (array(select public.my_student_ids())));
create policy photos_update on storage.objects for update using (
  bucket_id = 'photos' and split_part(name, '/', 1)::uuid = any (array(select public.my_student_ids())));
create policy photos_delete on storage.objects for delete using (
  bucket_id = 'photos' and split_part(name, '/', 1)::uuid = any (array(select public.my_student_ids())));
