-- Élèves d'un professeur donné (utilisé par la fonction serveur, qui agit avec la clé d'administration)
create function public.my_student_ids_for(teacher uuid) returns setof uuid language sql stable security definer set search_path = public as $$
  select m.student_id from memberships m join groups g on g.id = m.group_id
  where teacher = any (g.teacher_ids) and not m.deleted and not g.deleted
$$;
revoke execute on function public.my_student_ids_for(uuid) from anon, authenticated;
