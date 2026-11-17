update public.units set data = jsonb_set(data, '{documents}', '[{"mediaId": "doc-070ea379-4dec-45d8-985f-feebbf2359c8", "name": "MAT-1re-022-C Cercle trigonométrique et radian.pdf", "size": 104103}, {"mediaId": "doc-e1ace6a2-5a8a-4102-85ab-38195b50bbbd", "name": "MAT-1re-022-E Cercle trigonométrique et radian.pdf", "size": 86694}]'::jsonb)
where id = '266ea801-1b25-5eab-ac40-e8d62e870979' and data->'documents'->0->>'mediaId' = 'doc-5be3b4e9-e2d8-4199-9add-923f26a03c9d';
select data->'documents' as docs from public.units where id = '266ea801-1b25-5eab-ac40-e8d62e870979';
