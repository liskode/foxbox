-- Séquence 434 v2 : nouvelle mise en page N&B (logo 4ÈME) des documents, le 19/11/2026.
-- Remplace le fichier (mediaId, taille) des documents PC-4e-434-* dans la séquence, les séances 4341-4343,
-- le modèle de DS et le DS de la 4A. Les anciens fichiers restent dans le stockage.
begin;
create temp table map(code text, mid text, size int) on commit drop;
insert into map values
  ('PC-4e-434-DC','doc-d10aac52-9bb0-4c19-8ee0-c0fe4cbc6bb1',48052),
  ('PC-4e-434-DS','doc-41dab1cb-736a-4254-8f8a-acfb6f834f5e',45102),
  ('PC-4e-434-DSA','doc-7148a9fa-ff16-4b84-bb83-4a312162e871',46070),
  ('PC-4e-434-G','doc-d65893ec-965b-4ba9-8937-77106d064890',47903),
  ('PC-4e-434-M','doc-f4604b7e-f63b-46c3-b5b4-a8e577835882',45718),
  ('PC-4e-434-R','doc-00e713e4-4581-4685-8e41-0b88715f4e8d',40688),
  ('PC-4e-434-S1','doc-1cedf707-63c6-4af2-82fb-4aba768ce815',47044),
  ('PC-4e-434-S1A','doc-8adedd1e-c4e8-4ba7-8436-4f2a8a44a8fd',48583),
  ('PC-4e-434-S2','doc-6a67ebd1-d79d-477f-8812-2ae94aa33204',52465),
  ('PC-4e-434-S2A','doc-6928c858-4eff-4611-b709-48519656cc11',52344),
  ('PC-4e-434-S3','doc-7f7331f6-b11c-4918-9095-f1092acbd4ab',49830),
  ('PC-4e-434-S3A','doc-e44e7e1f-0039-42ff-9831-fb9f510243b2',47907);
update public.units u set data=jsonb_set(u.data,'{documents}',(select jsonb_agg(case when m.code is null then d
          else jsonb_set(jsonb_set(d,'{mediaId}',to_jsonb(m.mid)),'{size}',to_jsonb(m.size)) end order by o)
   from jsonb_array_elements(u.data->'documents') with ordinality as x(d,o)
   left join map m on split_part(d->>'name',' ',1)=m.code))
 where u.id in ('e26c62b0-1f40-4637-8973-f51767cb35b1','d98e16b5-1d8a-41cd-b5b3-06b82e5bd29c','04acb485-ccf8-4c45-9209-24b226f7b645','d72eab70-b9f3-4b34-a19c-7733465d8b9a');
update public.evaluations e set data=jsonb_set(e.data,'{documents}',(select jsonb_agg(case when m.code is null then d
          else jsonb_set(jsonb_set(d,'{mediaId}',to_jsonb(m.mid)),'{size}',to_jsonb(m.size)) end order by o)
   from jsonb_array_elements(e.data->'documents') with ordinality as x(d,o)
   left join map m on split_part(d->>'name',' ',1)=m.code))
 where e.id in ('dcaadbb0-e17c-4f6b-b1d6-358b74d08310','54c64642-f929-40b4-937a-0520b75ea1f7');
commit;
