-- Messages : une conversation par élève, chaque message a ses destinataires (élève et/ou un ou plusieurs parents).
-- Chacun ne lit que les messages qu'il a écrits ou qui lui sont adressés ; le professeur lit toute la conversation.
alter table public.messages add column recipient_ids uuid[] not null default '{}';

-- Anciens messages : fil « eleve » → l'élève ; fil « parents » → tous ses parents
update public.messages m set recipient_ids = case
  when m.thread = 'eleve' then array[m.student_id]
  else coalesce((select array_agg(p.id) from public.parents p where m.student_id = any (p.student_ids) and not p.deleted), '{}')
end;
update public.messages set data = data || jsonb_build_object('recipients', to_jsonb(recipient_ids));
create index on public.messages using gin (recipient_ids);

-- Peut écrire dans la conversation d'un élève : son professeur, l'élève lui-même, ses parents
create function public.can_write_about(teacher uuid, student uuid) returns boolean language sql stable security definer set search_path = public as $$
  select (teacher = auth.uid() and student = any (array(select public.my_student_ids())))
      or student = auth.uid()
      or student = any (array(select public.my_children()))
$$;

drop policy msg_read on public.messages;
drop policy msg_insert on public.messages;
create policy msg_read on public.messages for select using (
  (teacher_id = auth.uid() and student_id = any (array(select public.my_student_ids())))
  or author_id = auth.uid()
  or auth.uid() = any (recipient_ids));
create policy msg_insert on public.messages for insert
  with check (author_id = auth.uid() and public.can_write_about(teacher_id, student_id));

-- Pièces jointes : msg/<élève>/eleve (élève), /parents (parents), /tous (élève et parents)
create or replace function public.can_see_thread_path(path text) returns boolean language sql stable security definer set search_path = public as $$
  select split_part(path, '/', 1) = 'msg' and (
       split_part(path, '/', 2)::uuid = any (array(select public.my_student_ids()))
    or (split_part(path, '/', 3) in ('eleve', 'tous') and split_part(path, '/', 2)::uuid = auth.uid())
    or (split_part(path, '/', 3) in ('parents', 'tous') and split_part(path, '/', 2)::uuid = any (array(select public.my_children()))))
$$;
