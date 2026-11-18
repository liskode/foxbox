-- Co-enseignement : un professeur partage une classe (ou une séquence) avec un collègue,
-- en lecture seule ou avec le droit de modifier.
--
-- - Le premier professeur de la classe (teacher_ids[1]) en est le propriétaire : lui seul choisit
--   les co-enseignants et leur droit (colonne editor_ids = co-enseignants autorisés à modifier).
-- - Co-enseignant en lecture : voit la classe, ses élèves, la progression, les évaluations de la classe
--   et les résultats, sans rien pouvoir modifier.
-- - Co-enseignant en modification : peut aussi faire l'appel des séances « faites », corriger, modifier
--   les évaluations de la classe, les séquences et séances du niveau de la classe et leurs flashcards.
-- - Une séquence peut aussi être partagée seule en modification (units.editor_ids, sur la séquence).
-- - Les données privées (notes, aménagements, famille, absences, notes de classe, messages aux parents)
--   restent rangées par professeur (teacher_id = auth.uid()) : rien ne change pour elles.
-- Aucune nouvelle table : les grants et les règles restrictives de la démo existantes s'appliquent.

alter table public.groups add column editor_ids uuid[] not null default '{}';
alter table public.units add column editor_ids uuid[] not null default '{}';
alter table public.evaluations add column group_ids text[] not null default '{}';
update public.evaluations set group_ids = array(select jsonb_array_elements_text(coalesce(data->'groupIds', '[]'::jsonb)));

-- ---------- Fonctions d'aide ----------

-- Niveau d'une classe d'après son nom (« 4A_2627 » → 4e), comme levelOfName dans l'application
create function public.level_of_name(n text) returns text language sql immutable as $$
  select case
    when btrim(n) ~* '^(tle|tale|term)' or btrim(n) ~ '^T([^a-zà-ÿ]|$)' then 'Tle'
    when btrim(n) ~* '^(2|seconde)' then '2nde'
    when btrim(n) ~* '^(1|premi)' then '1re'
    when btrim(n) ~ '^\d' then substring(btrim(n) from '^(\d)') || 'e'
  end
$$;

-- Classes que l'utilisateur peut modifier : les siennes (premier professeur) et celles où il a le droit de modifier
create function public.my_editable_group_ids() returns setof text language sql stable security definer set search_path = public as $$
  select id from groups
  where not deleted and (teacher_ids[1] = auth.uid() or (auth.uid() = any (editor_ids) and auth.uid() = any (teacher_ids)))
$$;

create function public.my_editable_student_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select m.student_id from memberships m join groups g on g.id = m.group_id
  where not m.deleted and not g.deleted
    and (g.teacher_ids[1] = auth.uid() or (auth.uid() = any (g.editor_ids) and auth.uid() = any (g.teacher_ids)))
$$;

create function public.my_editable_student_ids_text() returns setof text language sql stable security definer set search_path = public as $$
  select s::text from public.my_editable_student_ids() as s
$$;

-- Séquence ou séance modifiable : la sienne, une séquence partagée en modification,
-- ou une séquence du niveau (et de la matière) d'une classe où l'on a le droit de modifier
create function public.can_edit_unit(unit text) returns boolean language sql stable security definer set search_path = public as $$
  with u as (select id, owner_id, data from units where id = unit),
       s as (select q.* from units q join u on q.id = coalesce(nullif(u.data->>'parentId', ''), u.id))
  select exists (select 1 from u where u.owner_id = auth.uid())
      or (public.is_teacher() and (
            exists (select 1 from s where auth.uid() = any (s.editor_ids))
         or exists (select 1 from s join groups g
                      on not g.deleted and coalesce(g.data->>'kind', '') <> 'soutien'
                     and auth.uid() = any (g.editor_ids) and auth.uid() = any (g.teacher_ids)
                     and public.level_of_name(g.data->>'name') = s.data->>'level'
                     and coalesce(nullif(g.data->>'subject', ''), 'Physique-Chimie') = coalesce(nullif(s.data->>'subject', ''), 'Physique-Chimie'))))
$$;

-- Ajout dans une séance : permis si elle est modifiable, ou si elle n'est pas encore en ligne (créée dans le même envoi)
create function public.can_add_to_unit(unit text) returns boolean language sql stable security definer set search_path = public as $$
  select public.can_edit_unit(unit) or not exists (select 1 from units where id = unit)
$$;

-- Flashcard modifiable : la sienne, ou présente dans une séquence / séance modifiable
create function public.can_edit_card(card text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from cards where id = card and owner_id = auth.uid())
      or exists (select 1 from unit_cards uc where uc.card_id = card and not uc.deleted and public.can_edit_unit(uc.unit_id))
$$;

revoke execute on function public.my_editable_group_ids() from public, anon;
revoke execute on function public.my_editable_student_ids() from public, anon;
revoke execute on function public.my_editable_student_ids_text() from public, anon;
revoke execute on function public.can_edit_unit(text) from public, anon;
revoke execute on function public.can_add_to_unit(text) from public, anon;
revoke execute on function public.can_edit_card(text) from public, anon;
grant execute on function public.my_editable_group_ids() to authenticated;
grant execute on function public.my_editable_student_ids() to authenticated;
grant execute on function public.my_editable_student_ids_text() to authenticated;
grant execute on function public.can_edit_unit(text) to authenticated;
grant execute on function public.can_add_to_unit(text) to authenticated;
grant execute on function public.can_edit_card(text) to authenticated;

-- ---------- Gardes : le propriétaire ne change jamais, seul lui choisit les co-enseignants ----------

create function public.groups_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_client_write() and old.teacher_ids[1] is distinct from auth.uid() then
    new.teacher_ids := old.teacher_ids;
    new.editor_ids := old.editor_ids;
    new.data := jsonb_set(jsonb_set(new.data, '{teacherIds}', coalesce(old.data->'teacherIds', to_jsonb(old.teacher_ids))),
                          '{editorIds}', coalesce(old.data->'editorIds', '[]'::jsonb));
  end if;
  return new;
end $$;
create trigger guard before update on public.groups for each row execute function public.groups_guard();

create function public.units_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_client_write() then
    new.owner_id := old.owner_id;
    if old.owner_id is distinct from auth.uid() then
      new.editor_ids := old.editor_ids;
      new.data := jsonb_set(new.data, '{editorIds}', coalesce(old.data->'editorIds', '[]'::jsonb));
    end if;
  end if;
  return new;
end $$;
create trigger guard before update on public.units for each row execute function public.units_guard();

create function public.keep_owner() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_client_write() then new.owner_id := old.owner_id; end if;
  return new;
end $$;
create trigger keep_owner before update on public.cards for each row execute function public.keep_owner();
create trigger keep_owner before update on public.unit_cards for each row execute function public.keep_owner();
create trigger keep_owner before update on public.evaluations for each row execute function public.keep_owner();

-- ---------- Classe, élèves, publications : modification réservée au propriétaire et aux co-enseignants autorisés ----------

drop policy g_update on public.groups;
create policy g_update on public.groups for update
  using (teacher_ids[1] = auth.uid() or (auth.uid() = any (editor_ids) and auth.uid() = any (teacher_ids)));

drop policy m_write on public.memberships;
drop policy m_update on public.memberships;
create policy m_write on public.memberships for insert with check (public.is_teacher() and group_id = any (array(select public.my_editable_group_ids())));
create policy m_update on public.memberships for update using (public.is_teacher() and group_id = any (array(select public.my_editable_group_ids())));

drop policy s_update on public.students;
create policy s_update on public.students for update
  using (id = auth.uid() or id = any (array(select public.my_editable_student_ids())));

drop policy p_insert on public.publications;
drop policy p_update on public.publications;
create policy p_insert on public.publications for insert with check (public.is_teacher() and group_id = any (array(select public.my_editable_group_ids())));
create policy p_update on public.publications for update using (public.is_teacher() and group_id = any (array(select public.my_editable_group_ids())));

-- Résultats : lus par tous les professeurs de l'élève, écrits par ceux qui peuvent modifier sa classe
drop policy res_all on public.results;
create policy res_read on public.results for select using (public.is_teacher() and student_id = any (array(select public.my_student_ids())));
create policy res_ins on public.results for insert with check (public.is_teacher() and student_id = any (array(select public.my_editable_student_ids())));
create policy res_upd on public.results for update using (public.is_teacher() and student_id = any (array(select public.my_editable_student_ids())));
create policy res_del on public.results for delete using (public.is_teacher() and student_id = any (array(select public.my_editable_student_ids())));

drop policy sh_teacher on public.result_shares;
create policy sh_read on public.result_shares for select using (public.is_teacher() and student_id = any (array(select public.my_student_ids())));
create policy sh_ins on public.result_shares for insert with check (public.is_teacher() and student_id = any (array(select public.my_editable_student_ids())));
create policy sh_upd on public.result_shares for update using (public.is_teacher() and student_id = any (array(select public.my_editable_student_ids())));
create policy sh_del on public.result_shares for delete using (public.is_teacher() and student_id = any (array(select public.my_editable_student_ids())));

drop policy sc_teacher_insert on public.student_cards;
drop policy sc_teacher_update on public.student_cards;
create policy sc_teacher_insert on public.student_cards for insert
  with check (public.is_teacher() and student_id = any (array(select public.my_editable_student_ids())));
create policy sc_teacher_update on public.student_cards for update
  using (public.is_teacher() and student_id = any (array(select public.my_editable_student_ids())));

-- Autocorrections des élèves : lues aussi par les co-enseignants de la classe de l'auteur de l'évaluation
create policy sc_coteacher on public.self_checks for select using (
  exists (select 1 from groups g join memberships m on m.group_id = g.id and not m.deleted
          where not g.deleted and m.student_id = self_checks.student_id
            and auth.uid() = any (g.teacher_ids) and self_checks.teacher_id = any (g.teacher_ids)));

-- Photos des élèves : modifiées seulement par qui peut modifier la classe
drop policy photos_write on storage.objects;
drop policy photos_update on storage.objects;
drop policy photos_delete on storage.objects;
create policy photos_write on storage.objects for insert with check (
  bucket_id = 'photos' and split_part(name, '/', 1) = any (array(select public.my_editable_student_ids_text())));
create policy photos_update on storage.objects for update using (
  bucket_id = 'photos' and split_part(name, '/', 1) = any (array(select public.my_editable_student_ids_text())));
create policy photos_delete on storage.objects for delete using (
  bucket_id = 'photos' and split_part(name, '/', 1) = any (array(select public.my_editable_student_ids_text())));

-- ---------- Séquences, séances, flashcards ----------

drop policy u_insert on public.units;
create policy u_insert on public.units for insert with check (
  public.is_teacher() and owner_id = auth.uid() and (nullif(data->>'parentId', '') is null or public.can_add_to_unit(data->>'parentId')));
create policy u_co_update on public.units for update using (public.can_edit_unit(id)) with check (public.can_edit_unit(id));

drop policy uc_insert on public.unit_cards;
create policy uc_insert on public.unit_cards for insert with check (public.is_teacher() and owner_id = auth.uid() and public.can_add_to_unit(unit_id));
create policy uc_co_update on public.unit_cards for update using (public.can_edit_unit(unit_id)) with check (public.can_edit_unit(unit_id));

create policy c_co_update on public.cards for update using (public.can_edit_card(id)) with check (public.can_edit_card(id));

-- ---------- Évaluations ----------

create policy ev_co_read on public.evaluations for select
  using (public.is_teacher() and group_ids && array(select public.my_teacher_group_ids()));
create policy ev_co_update on public.evaluations for update
  using (group_ids && array(select public.my_editable_group_ids()))
  with check (group_ids && array(select public.my_editable_group_ids()));

-- ---------- Fonction serveur « students » (clé d'administration) ----------
-- Comptes élèves (créer, renommer, nouveau mot de passe) : propriétaire ou co-enseignant autorisé à modifier.
-- Supprimer un élève ou la classe, gérer les comptes parents (famille, privée) : propriétaire seulement.
create function public.editable_student_ids_for(teacher uuid) returns setof uuid language sql stable security definer set search_path = public as $$
  select m.student_id from memberships m join groups g on g.id = m.group_id
  where not m.deleted and not g.deleted
    and (g.teacher_ids[1] = teacher or (teacher = any (g.editor_ids) and teacher = any (g.teacher_ids)))
$$;
create function public.owned_student_ids_for(teacher uuid) returns setof uuid language sql stable security definer set search_path = public as $$
  select m.student_id from memberships m join groups g on g.id = m.group_id
  where not m.deleted and not g.deleted and g.teacher_ids[1] = teacher
$$;
revoke execute on function public.editable_student_ids_for(uuid) from public, anon, authenticated;
revoke execute on function public.owned_student_ids_for(uuid) from public, anon, authenticated;

-- ---------- Invitation d'un collègue (Réglages de la classe) ----------
-- Un professeur autorise l'adresse d'un collègue : celui-ci peut alors créer son compte professeur.
create function public.invite_teacher(email text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() or public.is_demo_session() then raise exception 'Non autorisé'; end if;
  if email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Adresse e-mail invalide'; end if;
  insert into allowed_teachers (email) values (lower(btrim(email))) on conflict do nothing;
end $$;
revoke execute on function public.invite_teacher(text) from public, anon;
grant execute on function public.invite_teacher(text) to authenticated;
