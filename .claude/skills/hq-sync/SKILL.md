---
name: hq-sync
description: Dashboardi tänaste ja tulevaste taskide ühesuunaline sünkroon Severun HQ artifacti (Erko taskide alla). Kasuta, kui kasutaja kirjutab /hq-sync või "sünkrooni taskid". Loeb Supabase'i skriptiga scripts/hq-tasks.mjs ja kirjutab artifacti ArtifactData batch'iga; dashboardi koodi ega artifacti HTML-i ei muuda.
---

# /hq-sync

Artifact: `https://claude.ai/artifact/EowUsfo4tHxY38hyZvyB2B?sk=9ANsHjovtehNYcFuQDUuEw`, kollektsioon `tasks`.
Meie dokumendid: id `dash-t-<tasks.id>` (päevatask) või `dash-p-<project_tasks.id>` (tähtajaga projekti-task), väli `source: "dashboard"`, `owner: "Erko"`. Skoop: avatud taskid kuupäevaga täna või hiljem; möödunud kuupäevaga tegemata taskid HQ-sse ei lähe ja kustuvad sealt järgmisel sünkroonil. Dashboard on tõe allikas: pealkiri ja `due` tulevad sealt, dashboardis tehtud → HQ-s `Done`, dashboardist kustutatud → HQ-st kustub. HQ-s suletud taski tagasi ei avata. Supabase'i ei kirjutata.

Sammud:

1. Olemasolevad: `ArtifactData` action `query`, collection `tasks`, query `{"where": [["source","==","dashboard"]], "limit": 1000}`. Kirjuta vastuse dokumendiread (üks JSON objekt rea kohta, kujul `{"id","data","version"}`) muutmata kujul faili `<scratchpad>/hq.jsonl`. Null dokumenti → faili ei tee.
2. `node scripts/hq-tasks.mjs <scratchpad>/hq.jsonl <scratchpad>/hq-out` (esimesel korral ilma hq.jsonl-ita). Skript trükib, mida muudab, ja kirjutab `hq-out/writes-N.json`. "Midagi muuta pole" → vasta sellega ja lõpeta.
3. Iga trükitud `writes-N.json` kohta `ArtifactData` action `batch`, `writes` = faili sisu täpselt. Versioonikonflikt (keegi muutis vahepeal) → korda sammust 1.
4. Vasta skripti kokkuvõttega: lisatud / uuendatud / tehtud / kustutatud pealkirjadega. Ei muud.

Vead: skript ütleb, kui `.env.local`-is puudub `TASKS_SUPABASE_SERVICE_ROLE_KEY` (TaskManager Supabase → Project Settings → API → service_role). HTTP 401/403 → võti on vale või anon-võti.
