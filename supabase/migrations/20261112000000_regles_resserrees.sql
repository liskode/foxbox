-- Règles d'accès resserrées (revue du 10/11/2026).
-- Les colonnes qui décident de « qui voit quoi » ne peuvent plus être choisies librement par un élève ou un parent.
-- Les écritures du serveur (fonctions avec la clé d'administration) ne sont pas concernées.

create function public.is_client_write() returns boolean language sql stable as $$
  select coalesce(auth.role(), '') in ('authenticated', 'anon')
$$;

-- 1. Compte parent : la liste des enfants est fixée par le serveur ; le parent ne règle que ses préférences
create function public.parents_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_client_write() then new.student_ids := old.student_ids; end if;
  return new;
end $$;
create trigger guard before update on public.parents for each row execute function public.parents_guard();

-- 2. Messages : le professeur indiqué doit être un professeur de l'élève ; les destinataires sont limités
-- à ce professeur, à l'élève et à ses parents ; une fois envoyé, un message ne change plus de conversation
-- ni de destinataires (seul son texte peut être corrigé).
create or replace function public.can_write_about(teacher uuid, student uuid) returns boolean language sql stable security definer set search_path = public as $$
  select (teacher = auth.uid() and student = any (array(select public.my_student_ids())))
      or ((student = auth.uid() or student = any (array(select public.my_children())))
          and exists (select 1 from memberships m join groups g on g.id = m.group_id
                      where m.student_id = student and teacher = any (g.teacher_ids) and not m.deleted and not g.deleted))
$$;

create function public.messages_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_client_write() then return new; end if;
  if tg_op = 'UPDATE' then
    new.teacher_id := old.teacher_id;
    new.student_id := old.student_id;
    new.thread := old.thread;
    new.author_id := old.author_id;
    new.recipient_ids := old.recipient_ids;
  elsif new.thread = 'groupe' then
    new.recipient_ids := '{}';
  else
    new.recipient_ids := array(
      select r from unnest(new.recipient_ids) r
      where r = new.teacher_id or r = new.student_id
         or r in (select p.id from parents p where new.student_id = any (p.student_ids)));
  end if;
  return new;
end $$;
create trigger guard before insert or update on public.messages for each row execute function public.messages_guard();

-- 5. Journal des connexions : chacun ne note une connexion que pour lui-même (élève) ou pour ses enfants (parent)
create function public.visits_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_client_write() then
    new.student_ids := array(
      select s from unnest(new.student_ids) s
      where s = auth.uid() or s in (select unnest(p.student_ids) from parents p where p.id = auth.uid() and not p.deleted));
  end if;
  return new;
end $$;
create trigger guard before insert or update on public.visits for each row execute function public.visits_guard();
