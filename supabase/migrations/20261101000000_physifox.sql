-- Physifox : site public du professeur. Les visiteurs (comptes séparés des élèves) lisent les chapitres publiés,
-- ajoutent leurs flashcards à leur Deck et écrivent au professeur. Ils ne voient rien d'autre de FoxBox.
-- Exception à la règle « pas de lecture sans connexion » : les chapitres publiés se consultent sans compte.

-- Administrateurs de Physifox : seuls eux voient les visiteurs, leurs statistiques et leurs messages
create table public.pf_admins (user_id uuid primary key references auth.users on delete cascade);
alter table public.pf_admins enable row level security;
create policy pf_admins_own on public.pf_admins for select using (user_id = auth.uid());
grant select on public.pf_admins to authenticated;
grant select, insert, update, delete on public.pf_admins to service_role;
insert into public.pf_admins (user_id)
  select id from auth.users where lower(email) in ('etienne.renard@claudel.org', 'etienne.renard@mac.com');

create function public.is_pf_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from pf_admins where user_id = auth.uid())
$$;
grant execute on function public.is_pf_admin() to anon, authenticated;

-- Membre de FoxBox (professeur, élève ou parent), par opposition à un visiteur ou à un compte sans rôle
create function public.is_foxbox_member() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from teachers where id = auth.uid())
      or exists (select 1 from students where id = auth.uid())
      or exists (select 1 from parents where id = auth.uid())
$$;
grant execute on function public.is_foxbox_member() to authenticated;

-- Chapitres : `notion_ids` et `published` servent aux règles d'accès, le contenu est dans `data`
create table public.pf_chapters (
  id text primary key,
  owner_id uuid not null,
  published boolean not null default false,
  notion_ids text[] not null default '{}',
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
-- Notions : la base stable du programme ; une flashcard est rattachée à une ou plusieurs notions
create table public.pf_notions (
  id text primary key,
  owner_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
-- Rattachement flashcard / notion, à part : la flashcard n'est pas modifiée (elle peut avoir un autre auteur)
create table public.pf_card_notions (
  id text primary key,
  owner_id uuid not null,
  notion_id text not null,
  card_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.pf_card_notions (card_id);
create index on public.pf_card_notions (notion_id);
-- Flashcards rédigées en attente de validation : invisibles de tous sauf de l'administrateur
create table public.card_drafts (
  id text primary key,
  owner_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
-- Visiteurs : créés uniquement par le serveur à l'inscription
create table public.visitors (
  id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
-- Deck et historique des visiteurs (séparés de ceux des élèves)
create table public.pf_deck (
  id text primary key,
  visitor_id uuid not null references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.pf_deck (visitor_id);
create table public.pf_reviews (
  id text primary key,
  visitor_id uuid not null references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.pf_reviews (visitor_id);
-- Messages privés entre un visiteur et le professeur
create table public.pf_messages (
  id text primary key,
  visitor_id uuid not null references auth.users on delete cascade,
  author_id uuid not null,
  data jsonb not null check (length(data->>'text') <= 2000),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.pf_messages (visitor_id);

do $$
declare t text;
begin
  foreach t in array array['pf_chapters','pf_notions','pf_card_notions','card_drafts','visitors','pf_deck','pf_reviews','pf_messages'] loop
    execute format('create trigger touch before insert or update on public.%I for each row execute function public.touch()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('create policy demo_readonly_ins on public.%I as restrictive for insert to authenticated with check (not public.is_demo_session())', t);
    execute format('create policy demo_readonly_upd on public.%I as restrictive for update to authenticated using (not public.is_demo_session())', t);
    execute format('create policy demo_readonly_del on public.%I as restrictive for delete to authenticated using (not public.is_demo_session())', t);
  end loop;
end $$;
create policy demo_readonly_ins on public.pf_admins as restrictive for insert to authenticated with check (not public.is_demo_session());
create policy demo_readonly_upd on public.pf_admins as restrictive for update to authenticated using (not public.is_demo_session());
create policy demo_readonly_del on public.pf_admins as restrictive for delete to authenticated using (not public.is_demo_session());

-- Lecture sans compte : uniquement ce qui est publié
grant select on public.pf_chapters, public.pf_notions, public.pf_card_notions to anon;

create function public.pf_notion_is_public(notion text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from pf_chapters c where c.published and not c.deleted and notion = any (c.notion_ids))
$$;
grant execute on function public.pf_notion_is_public(text) to anon, authenticated;

create function public.pf_card_is_public(card text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from pf_card_notions l
    join pf_chapters c on l.notion_id = any (c.notion_ids) and c.published and not c.deleted
    where l.card_id = card and not l.deleted
  )
$$;
grant execute on function public.pf_card_is_public(text) to authenticated;

create function public.pf_media_is_public(file text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from pf_card_notions l
    join pf_chapters c on l.notion_id = any (c.notion_ids) and c.published and not c.deleted
    join cards k on k.id = l.card_id and not k.deleted
    where not l.deleted
      and ((k.data->>'front') like '%media:' || file || '%' or (k.data->>'back') like '%media:' || file || '%')
  )
$$;
grant execute on function public.pf_media_is_public(text) to authenticated;

create policy pf_ch_read on public.pf_chapters for select using (published and not deleted or public.is_pf_admin());
create policy pf_ch_ins on public.pf_chapters for insert with check (public.is_pf_admin() and owner_id = auth.uid());
create policy pf_ch_upd on public.pf_chapters for update using (public.is_pf_admin());
create policy pf_no_read on public.pf_notions for select using (public.pf_notion_is_public(id) or public.is_pf_admin());
create policy pf_no_ins on public.pf_notions for insert with check (public.is_pf_admin() and owner_id = auth.uid());
create policy pf_no_upd on public.pf_notions for update using (public.is_pf_admin());
create policy pf_cn_read on public.pf_card_notions for select using (public.pf_notion_is_public(notion_id) and not deleted or public.is_pf_admin());
create policy pf_cn_ins on public.pf_card_notions for insert with check (public.is_pf_admin() and owner_id = auth.uid());
create policy pf_cn_upd on public.pf_card_notions for update using (public.is_pf_admin());
create policy cd_all on public.card_drafts for all using (public.is_pf_admin()) with check (public.is_pf_admin());

-- Visiteur : lit et corrige sa fiche ; seul le serveur la crée
create policy v_read on public.visitors for select using (id = auth.uid() or public.is_pf_admin());
create policy v_upd on public.visitors for update using (id = auth.uid()) with check (id = auth.uid());
create policy pd_read on public.pf_deck for select using (visitor_id = auth.uid() or public.is_pf_admin());
create policy pd_ins on public.pf_deck for insert with check (visitor_id = auth.uid());
create policy pd_upd on public.pf_deck for update using (visitor_id = auth.uid());
create policy pr_read on public.pf_reviews for select using (visitor_id = auth.uid() or public.is_pf_admin());
create policy pr_ins on public.pf_reviews for insert with check (visitor_id = auth.uid());
create policy pr_upd on public.pf_reviews for update using (visitor_id = auth.uid());
create policy pm_read on public.pf_messages for select using (visitor_id = auth.uid() or public.is_pf_admin());
create policy pm_ins on public.pf_messages for insert with check (
  author_id = auth.uid() and (visitor_id = auth.uid() or public.is_pf_admin())
);
create policy pm_upd on public.pf_messages for update using (visitor_id = auth.uid() or public.is_pf_admin());

-- Le contenu pédagogique n'est plus lisible par « tout compte connecté » :
-- membres de FoxBox, et flashcards des chapitres publiés pour les visiteurs
drop policy c_read on public.cards;
create policy c_read on public.cards for select using ((select public.is_foxbox_member()) or public.pf_card_is_public(id));
drop policy u_read on public.units;
create policy u_read on public.units for select using ((select public.is_foxbox_member()));
drop policy uc_read on public.unit_cards;
create policy uc_read on public.unit_cards for select using ((select public.is_foxbox_member()));
drop policy cards_read on storage.objects;
create policy cards_read on storage.objects for select using (
  bucket_id = 'cards' and auth.uid() is not null and ((select public.is_foxbox_member()) or public.pf_media_is_public(name))
);
drop policy docs_read on storage.objects;
create policy docs_read on storage.objects for select using (bucket_id = 'docs' and (select public.is_foxbox_member()));

-- Images des chapitres : publiques
insert into storage.buckets (id, name, public) values ('physifox', 'physifox', true);
create policy pf_img_read on storage.objects for select using (bucket_id = 'physifox');
create policy pf_img_ins on storage.objects for insert with check (bucket_id = 'physifox' and public.is_pf_admin());
create policy pf_img_upd on storage.objects for update using (bucket_id = 'physifox' and public.is_pf_admin());
create policy pf_img_del on storage.objects for delete using (bucket_id = 'physifox' and public.is_pf_admin());

-- Inscription : fiche professeur pour les adresses autorisées, fiche visiteur pour une inscription Physifox
create or replace function public.on_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if exists (select 1 from allowed_teachers where lower(email) = lower(new.email)) then
    insert into teachers (id, data) values (
      new.id,
      jsonb_build_object('id', new.id, 'name', coalesce(m->>'name', split_part(new.email, '@', 1)),
                         'login', new.email, 'password', '')
    );
  elsif m->>'pf_visitor' = 'true' then
    insert into visitors (id, data) values (
      new.id,
      jsonb_build_object('id', new.id, 'email', lower(new.email), 'pseudo', left(coalesce(m->>'pseudo', 'Visiteur'), 40),
                         'classe', left(m->>'classe', 40), 'school', left(m->>'school', 80), 'country', left(m->>'country', 60),
                         'createdAt', (extract(epoch from now()) * 1000)::bigint)
    );
  end if;
  return new;
end $$;

-- Suppression de son compte par le visiteur (ses données partent avec lui) ; jamais pour un membre de FoxBox
create function public.pf_delete_my_account() returns void language plpgsql security definer set search_path = public as $$
begin
  if public.is_demo_session() then raise exception 'Démo : rien n’est enregistré.'; end if;
  if not exists (select 1 from visitors where id = auth.uid()) then raise exception 'Compte non concerné'; end if;
  delete from pf_messages where author_id = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.pf_delete_my_account() from public, anon;
grant execute on function public.pf_delete_my_account() to authenticated;
