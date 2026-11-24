-- Taskmanageri "Käimasolevad projektid": vaba nimekiri, TaskZeni projektidest sõltumatu.
-- Jooksuta TaskManager/FocusLoop Supabase projekti SQL editoris.

create table public.taskmanager_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  -- Lohistamise järjekord, väiksem ees.
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index taskmanager_projects_user_id_idx on public.taskmanager_projects (user_id);

alter table public.taskmanager_projects enable row level security;

create policy "Users manage own taskmanager_projects"
  on public.taskmanager_projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
