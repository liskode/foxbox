-- Révisions de l'élève : bandeau du bas des flashcards à la couleur du niveau d'introduction.
-- L'élève ne lit pas la fiche de son professeur ; cette fonction lui renvoie seulement les couleurs des niveaux
-- (rien de privé) du professeur d'une de ses classes. Lecture seule : rien à refuser en démo.
create function public.my_teacher_level_colors() returns jsonb
language sql stable security definer set search_path = public as $$
  select t.data->'levelColors'
  from memberships m
  join groups g on g.id = m.group_id and not g.deleted
  join teachers t on t.id = any (g.teacher_ids) and not t.deleted
  where m.student_id = auth.uid() and not m.deleted and t.data ? 'levelColors'
  limit 1
$$;
revoke execute on function public.my_teacher_level_colors() from public, anon;
grant execute on function public.my_teacher_level_colors() to authenticated;
