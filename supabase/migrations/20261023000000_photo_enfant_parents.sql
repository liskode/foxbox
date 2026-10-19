-- Les parents voient la photo de leur enfant (à côté de ses messages) ; rien d'autre dans le dossier des photos.
create policy photos_parent on storage.objects for select using (
  bucket_id = 'photos' and split_part(name, '/', 1)::uuid = any (array(select public.my_children())));
