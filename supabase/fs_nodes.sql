-- File system widget: failid ja kaustad puuna.
-- Jooksuta TaskManager/FocusLoop Supabase projekti SQL editoris.

create table public.fs_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- null = juurkaust. Kausta kustutamine kustutab kõik alamad.
  parent_id uuid references public.fs_nodes (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 255),
  type text not null check (type in ('file', 'folder')),
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Samas kaustas ei tohi olla kahte sama nimega sõlme (ka juurkaustas, kus parent_id on null).
-- `nulls not distinct` vajab Postgres 15+ (Supabase vaikimisi on uuem).
create unique index fs_nodes_unique_name_per_parent
  on public.fs_nodes (user_id, parent_id, name) nulls not distinct;

create index fs_nodes_user_id_idx on public.fs_nodes (user_id);

alter table public.fs_nodes enable row level security;

create policy "Users manage own fs_nodes"
  on public.fs_nodes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
