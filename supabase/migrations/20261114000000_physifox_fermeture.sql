-- Physifox : site public ouvert ou fermé (réglé par l'administrateur dans Réglages › Modules).
-- Fermé : chapitres, notions, flashcards et images ne sont plus lisibles que par l'administrateur.
create table public.pf_site (
  id int primary key check (id = 1),
  open boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.pf_site (id, open) values (1, false); -- fermé le 14/11/2026 : contenus à revoir

alter table public.pf_site enable row level security;
create policy pf_site_read on public.pf_site for select using (true);
create policy pf_site_upd on public.pf_site for update using (public.is_pf_admin()) with check (public.is_pf_admin());
create policy demo_readonly_ins on public.pf_site as restrictive for insert to authenticated with check (not public.is_demo_session());
create policy demo_readonly_upd on public.pf_site as restrictive for update to authenticated using (not public.is_demo_session());
create policy demo_readonly_del on public.pf_site as restrictive for delete to authenticated using (not public.is_demo_session());
grant select on public.pf_site to anon; -- exception Physifox : les visiteurs sans compte doivent savoir si le site est ouvert
grant select, insert, update, delete on public.pf_site to authenticated;
grant select, insert, update, delete on public.pf_site to service_role;

create function public.pf_site_open() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select open from pf_site where id = 1), true)
$$;
grant execute on function public.pf_site_open() to anon, authenticated;

create or replace function public.pf_notion_is_public(notion text) returns boolean language sql stable security definer set search_path = public as $$
  select pf_site_open() and exists (select 1 from pf_chapters c where c.published and not c.deleted and notion = any (c.notion_ids))
$$;

create or replace function public.pf_card_is_public(card text) returns boolean language sql stable security definer set search_path = public as $$
  select pf_site_open() and exists (
    select 1 from pf_card_notions l
    join pf_chapters c on l.notion_id = any (c.notion_ids) and c.published and not c.deleted
    where l.card_id = card and not l.deleted
  )
$$;

create or replace function public.pf_media_is_public(file text) returns boolean language sql stable security definer set search_path = public as $$
  select pf_site_open() and exists (
    select 1 from pf_card_notions l
    join pf_chapters c on l.notion_id = any (c.notion_ids) and c.published and not c.deleted
    join cards k on k.id = l.card_id and not k.deleted
    where not l.deleted
      and ((k.data->>'front') like '%media:' || file || '%' or (k.data->>'back') like '%media:' || file || '%')
  )
$$;

drop policy pf_ch_read on public.pf_chapters;
create policy pf_ch_read on public.pf_chapters for select using (published and not deleted and public.pf_site_open() or public.is_pf_admin());
