-- Un professeur doit pouvoir « voir » la classe qu'il est en train de créer (nécessaire à l'enregistrement).
drop policy g_read on public.groups;
create policy g_read on public.groups for select
  using (auth.uid() = any (teacher_ids) or id = any (array(select public.my_group_ids())));
