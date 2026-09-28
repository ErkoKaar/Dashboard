-- Kalendri-taski (Google Calendari sündmus märkega dashboardTask) tehtud-olek.
-- Rida tekib ainult siis, kui toimumiskord märgitakse tehtuks; linnukese eemaldamine kustutab rea.
-- Jooksuta TaskManager/FocusLoop Supabase projekti SQL editoris.

alter table public.tasks add column calendar_event_id text;

-- Upsert onConflict "calendar_event_id,date" vajab täis- (mitte osalist) unikaalset indeksit.
-- NULL-id on unikaalsuse mõttes erinevad, nii et tavalisi taske see ei piira.
create unique index tasks_calendar_event_date_key on public.tasks (calendar_event_id, date);
