-- Comparaison en texte : évite une erreur de conversion sur des noms de fichiers qui ne sont pas des identifiants.
create or replace function public.my_student_ids_text() returns setof text language sql stable security definer set search_path = public as $$
  select student_id::text from public.my_student_ids() as student_id
$$;

drop policy photos_read on storage.objects;
drop policy photos_write on storage.objects;
drop policy photos_update on storage.objects;
drop policy photos_delete on storage.objects;

create policy photos_read on storage.objects for select using (
  bucket_id = 'photos' and (
    split_part(name, '/', 1) = auth.uid()::text
    or split_part(name, '/', 1) = any (array(select public.my_student_ids_text()))
  ));
create policy photos_write on storage.objects for insert with check (
  bucket_id = 'photos' and split_part(name, '/', 1) = any (array(select public.my_student_ids_text())));
create policy photos_update on storage.objects for update using (
  bucket_id = 'photos' and split_part(name, '/', 1) = any (array(select public.my_student_ids_text())));
create policy photos_delete on storage.objects for delete using (
  bucket_id = 'photos' and split_part(name, '/', 1) = any (array(select public.my_student_ids_text())));
