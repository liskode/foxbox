-- Soutien en groupe : fil de discussion commun au professeur et aux élèves d'un groupe (fil « groupe »).
-- Un message de groupe porte l'identifiant du groupe dans student_id ; il est lu et écrit par les membres du groupe
-- (élèves et professeur), pas par les parents.
alter table public.messages drop constraint if exists messages_thread_check;
alter table public.messages add constraint messages_thread_check check (thread in ('eleve', 'parents', 'groupe'));

create policy msg_group_read on public.messages for select
  using (thread = 'groupe' and student_id::text = any (array(select public.my_group_ids())));
create policy msg_group_insert on public.messages for insert
  with check (thread = 'groupe' and author_id = auth.uid() and student_id::text = any (array(select public.my_group_ids())));

-- Pièces jointes du fil de groupe : msg/<groupe>/groupe/<fichier>
create or replace function public.can_see_thread_path(path text) returns boolean language sql stable security definer set search_path = public as $$
  select split_part(path, '/', 1) = 'msg' and (
       (split_part(path, '/', 3) = 'groupe' and split_part(path, '/', 2) = any (array(select public.my_group_ids())))
    or (split_part(path, '/', 3) <> 'groupe' and (
         split_part(path, '/', 2)::uuid = any (array(select public.my_student_ids()))
      or (split_part(path, '/', 3) in ('eleve', 'tous') and split_part(path, '/', 2)::uuid = auth.uid())
      or (split_part(path, '/', 3) in ('parents', 'tous') and split_part(path, '/', 2)::uuid = any (array(select public.my_children()))))))
$$;
