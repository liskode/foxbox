-- Communication : messagerie ouverte aux classes (élèves et parents) et rendez-vous parents-professeurs.
--
-- Rencontres (meetings) : le professeur donne des plages (un ou plusieurs jours) et une durée de rendez-vous ;
-- les parents des élèves des classes concernées réservent un créneau libre (un par enfant), le changent ou l'annulent.
-- Un parent ne voit jamais qui a pris les autres créneaux : seulement qu'ils sont pris (fonction meeting_taken_slots).
-- Les réservations des parents passent par book_meeting_slot / cancel_meeting_slot (vérification et réservation
-- en une seule fois : deux familles ne peuvent pas obtenir le même créneau).

create table public.meetings (
  id text primary key,
  teacher_id uuid not null,
  group_ids text[] not null default '{}',
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.meetings (teacher_id);

create table public.meeting_bookings (
  id text primary key, -- rencontre|élève : un rendez-vous par élève et par rencontre
  meeting_id text not null,
  teacher_id uuid not null,
  student_id uuid not null,
  slot text not null, -- AAAA-MM-JJTHH:MM (heure locale)
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.meeting_bookings (meeting_id);
create index on public.meeting_bookings (student_id);
create unique index meeting_bookings_slot on public.meeting_bookings (meeting_id, slot) where not deleted;

do $$
declare t text;
begin
  foreach t in array array['meetings','meeting_bookings'] loop
    execute format('create trigger touch before insert or update on public.%I for each row execute function public.touch()', t);
    execute format('create index on public.%I (updated_at)', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    -- Démo en lecture seule
    execute format('create policy demo_readonly_ins on public.%I as restrictive for insert to authenticated with check (not public.is_demo_session())', t);
    execute format('create policy demo_readonly_upd on public.%I as restrictive for update to authenticated using (not public.is_demo_session())', t);
    execute format('create policy demo_readonly_del on public.%I as restrictive for delete to authenticated using (not public.is_demo_session())', t);
  end loop;
end $$;

-- Groupes (classes et soutien, non archivés) des enfants du parent connecté
create function public.my_children_group_ids() returns setof text language sql stable security definer set search_path = public as $$
  select g.id from groups g join memberships m on m.group_id = g.id
  where m.student_id = any (array(select public.my_children())) and not m.deleted and not g.deleted
    and not coalesce((g.data->>'archived')::boolean, false)
$$;
grant execute on function public.my_children_group_ids() to authenticated;

-- Classes et professeurs des enfants du parent connecté (messagerie, rendez-vous) : enfant, groupe, professeur, nom, matière
-- (les parents ne lisent pas les classes elles-mêmes : plans de classe, sous-groupes… restent privés)
create function public.my_children_teachers() returns table (student_id uuid, group_id text, teacher_id uuid, teacher_name text, subject text)
language sql stable security definer set search_path = public as $$
  select distinct m.student_id, g.id, t.id, t.data->>'name', g.data->>'subject'
  from memberships m
  join groups g on g.id = m.group_id
  cross join lateral unnest(g.teacher_ids) as tid
  join teachers t on t.id = tid
  where m.student_id = any (array(select public.my_children())) and not m.deleted and not g.deleted
    and not coalesce((g.data->>'archived')::boolean, false)
$$;
grant execute on function public.my_children_teachers() to authenticated;

-- Rencontres : écrites par le professeur, lues par lui et par les parents des classes concernées
create policy mt_teacher_read on public.meetings for select using (teacher_id = auth.uid());
create policy mt_teacher_ins on public.meetings for insert with check (teacher_id = auth.uid());
create policy mt_teacher_upd on public.meetings for update using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy mt_parent on public.meetings for select using (group_ids && array(select public.my_children_group_ids()));

-- Rendez-vous : le professeur voit et gère ceux de ses rencontres (il peut aussi inscrire une famille) ;
-- un parent ne lit que ceux de ses enfants
create policy mb_teacher_read on public.meeting_bookings for select using (teacher_id = auth.uid());
create policy mb_teacher_ins on public.meeting_bookings for insert
  with check (teacher_id = auth.uid() and student_id = any (array(select public.my_student_ids())));
create policy mb_teacher_upd on public.meeting_bookings for update using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy mb_parent on public.meeting_bookings for select using (student_id = any (array(select public.my_children())));

-- Le créneau fait-il partie d'une plage de la rencontre (début aligné sur la durée, fin avant la fin de la plage) ?
create function public.meeting_slot_ok(m jsonb, slot text) returns boolean language sql immutable as $$
  select length(slot) = 16 and exists (
    select 1 from jsonb_array_elements(m->'ranges') r
    where r->>'date' = left(slot, 10)
      and substr(slot, 12, 5)::time >= (r->>'start')::time
      and substr(slot, 12, 5)::time + make_interval(mins => (m->>'duration')::int) <= (r->>'end')::time
      and mod((extract(epoch from substr(slot, 12, 5)::time - (r->>'start')::time) / 60)::int, (m->>'duration')::int) = 0)
$$;

-- Créneaux déjà pris (sans dire par qui), pour le professeur et les parents concernés
create function public.meeting_taken_slots(p_meeting text) returns setof text language sql stable security definer set search_path = public as $$
  select b.slot from meeting_bookings b join meetings m on m.id = b.meeting_id
  where b.meeting_id = p_meeting and not b.deleted and not m.deleted
    and (m.teacher_id = auth.uid() or m.group_ids && array(select public.my_children_group_ids()))
$$;
grant execute on function public.meeting_taken_slots(text) to authenticated;

-- Réservation (ou changement de créneau) par un parent. Réponse : ok, pris, ferme, passe, creneau, interdit, introuvable, demo
create function public.book_meeting_slot(p_meeting text, p_student uuid, p_slot text) returns text
language plpgsql security definer set search_path = public as $$
declare
  m record;
  v_parent jsonb;
  v_student jsonb;
  v_id text := p_meeting || '|' || p_student;
begin
  if public.is_demo_session() then return 'demo'; end if;
  if not (p_student = any (array(select public.my_children()))) then return 'interdit'; end if;
  select * into m from meetings where id = p_meeting and not deleted;
  if not found then return 'introuvable'; end if;
  if not exists (select 1 from memberships where student_id = p_student and group_id = any (m.group_ids) and not deleted) then return 'interdit'; end if;
  if m.data->>'closesOn' is not null and (now() at time zone 'Europe/Paris')::date > (m.data->>'closesOn')::date then return 'ferme'; end if;
  if not public.meeting_slot_ok(m.data, p_slot) then return 'creneau'; end if;
  if p_slot::timestamp < (now() at time zone 'Europe/Paris') then return 'passe'; end if;
  select data into v_parent from parents where id = auth.uid();
  select data into v_student from students where id = p_student;
  insert into meeting_bookings (id, meeting_id, teacher_id, student_id, slot, data, deleted)
  values (v_id, p_meeting, m.teacher_id, p_student, p_slot, jsonb_build_object(
    'id', v_id, 'meetingId', p_meeting, 'teacherId', m.teacher_id, 'studentId', p_student, 'slot', p_slot,
    'parentId', auth.uid(), 'parentName', v_parent->>'name',
    'studentName', trim(coalesce(v_student->>'firstName', '') || ' ' || coalesce(v_student->>'lastName', '')),
    'bookedBy', 'parent', 'createdAt', (extract(epoch from now()) * 1000)::bigint), false)
  on conflict (id) do update set slot = excluded.slot, data = excluded.data, deleted = false;
  return 'ok';
exception when unique_violation then
  return 'pris';
end $$;
grant execute on function public.book_meeting_slot(text, uuid, text) to authenticated;

-- Annulation par un parent
create function public.cancel_meeting_slot(p_meeting text, p_student uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if public.is_demo_session() then return 'demo'; end if;
  if not (p_student = any (array(select public.my_children()))) then return 'interdit'; end if;
  update meeting_bookings set deleted = true where id = p_meeting || '|' || p_student;
  return 'ok';
end $$;
grant execute on function public.cancel_meeting_slot(text, uuid) to authenticated;
