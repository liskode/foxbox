-- Documents des séances (PDF) : déposés par les professeurs, téléchargeables par tous les comptes connectés
insert into storage.buckets (id, name, public, file_size_limit) values ('docs', 'docs', false, 52428800);
create policy docs_read on storage.objects for select using (bucket_id = 'docs' and auth.uid() is not null);
create policy docs_write on storage.objects for insert with check (bucket_id = 'docs' and public.is_teacher());
create policy docs_update on storage.objects for update using (bucket_id = 'docs' and owner_id = auth.uid()::text);
create policy docs_delete on storage.objects for delete using (bucket_id = 'docs' and owner_id = auth.uid()::text);
