-- Projekti-taski kuupäev: sel päeval ilmub task ka Today's Tasks alla.
-- Jooksuta TaskManager/FocusLoop Supabase projekti SQL editoris.

alter table public.project_tasks add column due_date date;

-- Today's Tasks pärib iga päev ühe kuupäeva kaupa; enamikul taskidest kuupäeva pole.
create index project_tasks_due_date_idx on public.project_tasks (due_date)
  where due_date is not null;
