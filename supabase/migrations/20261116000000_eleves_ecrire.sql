-- Messagerie : un élève n'écrit à un professeur que s'il le suit en soutien, ou si la classe a la case
-- « Les élèves peuvent m'écrire » (groups.data->>'studentsCanWrite'). Les parents peuvent toujours écrire.
-- Restent permis à tout élève : ses réponses au sujet d'une copie (evaluationId) et l'accusé d'écoute
-- d'un mémo vocal du professeur (heardOf).
create or replace function public.can_write_about(teacher uuid, student uuid) returns boolean language sql stable security definer set search_path = public as $$
  select (teacher = auth.uid() and student = any (array(select public.my_student_ids())))
      or (student = any (array(select public.my_children()))
          and exists (select 1 from memberships m join groups g on g.id = m.group_id
                      where m.student_id = student and teacher = any (g.teacher_ids) and not m.deleted and not g.deleted))
      or (student = auth.uid()
          and exists (select 1 from memberships m join groups g on g.id = m.group_id
                      where m.student_id = student and teacher = any (g.teacher_ids) and not m.deleted and not g.deleted
                        and (g.data->>'kind' = 'soutien' or coalesce((g.data->>'studentsCanWrite')::boolean, false))))
$$;

-- Réponse au sujet d'une copie, accusé d'écoute : permis à l'élève d'un des groupes du professeur
create or replace function public.can_reply_about(teacher uuid, student uuid) returns boolean language sql stable security definer set search_path = public as $$
  select student = auth.uid()
     and exists (select 1 from memberships m join groups g on g.id = m.group_id
                 where m.student_id = student and teacher = any (g.teacher_ids) and not m.deleted and not g.deleted)
$$;

drop policy msg_insert on public.messages;
create policy msg_insert on public.messages for insert
  with check (author_id = auth.uid() and (
    public.can_write_about(teacher_id, student_id)
    or ((data ? 'evaluationId' or data ? 'heardOf') and public.can_reply_about(teacher_id, student_id))));
