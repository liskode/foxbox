-- Évaluations corrigées par critères (onglet Correction)

-- Définition de l'évaluation (critères, barème, classes, réglages) : propre à son auteur
create table public.evaluations (
  id text primary key,
  owner_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- Résultat complet d'un élève (niveaux par critère, appréciation) : professeurs uniquement
create table public.results (
  id text primary key, -- evaluationId|studentId
  student_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- Ce que l'élève a le droit de voir, selon les réglages de l'évaluation (note, appréciation, détail)
create table public.result_shares (
  id text primary key,
  student_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- Journal des messages aux parents : privé, comme les notes
create table public.parent_messages (
  id text primary key,
  teacher_id uuid not null,
  student_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

do $$
declare t text;
begin
  foreach t in array array['evaluations','results','result_shares','parent_messages'] loop
    execute format('create trigger touch before insert or update on public.%I for each row execute function public.touch()', t);
    execute format('create index on public.%I (updated_at)', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
create index on public.results (student_id);
create index on public.result_shares (student_id);

create policy ev_all on public.evaluations for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.is_teacher());

create policy res_all on public.results for all
  using (public.is_teacher() and student_id = any (array(select public.my_student_ids())))
  with check (public.is_teacher() and student_id = any (array(select public.my_student_ids())));

create policy sh_teacher on public.result_shares for all
  using (public.is_teacher() and student_id = any (array(select public.my_student_ids())))
  with check (public.is_teacher() and student_id = any (array(select public.my_student_ids())));
create policy sh_student on public.result_shares for select using (student_id = auth.uid());

create policy pm_all on public.parent_messages for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid() and student_id = any (array(select public.my_student_ids())));

-- Un critère raté peut remettre en boîte 1 les cartes liées : le professeur peut écrire la progression de ses élèves
create policy sc_teacher_insert on public.student_cards for insert
  with check (public.is_teacher() and student_id = any (array(select public.my_student_ids())));
create policy sc_teacher_update on public.student_cards for update
  using (public.is_teacher() and student_id = any (array(select public.my_student_ids())));
