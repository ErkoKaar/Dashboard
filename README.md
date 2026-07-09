# Dashboard

Personal dashboard aggregating data from five sources: FinanceTracker, TaskManager + FocusLoop, EstHoop, GitHub contributions, and Spotify.

## Tech stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- TanStack Query (React Query) for data fetching/caching
- @supabase/supabase-js for the two Supabase-backed data sources
- ESLint + Prettier

## Project structure

```
app/
  api/github/route.ts    Server-side route that calls the GitHub GraphQL API (token stays server-side)
  api/spotify/*           now-playing/top/control routes calling the Spotify Web API (token stays server-side)
  page.tsx                Dashboard home page
components/
  widgets/                One component per data source: GithubWidget, FinanceWidget, TasksWidget, FocusLoopWidget, EstHoopWidget, SpotifyWidget
  ui/                     Reusable UI primitives: Card, Button, Skeleton
lib/
  supabase/               financeClient.ts and tasksClient.ts — separate Supabase clients for the two projects
  spotify/                token.ts — shared Spotify access-token refresh helper
  queries/                React Query hooks per data source (currently placeholder logic, see TODOs)
providers/
  QueryProvider.tsx       QueryClientProvider wrapper, mounted in app/layout.tsx
```

## Data sources

1. **FinanceTracker** — separate Supabase project, read + write (expenses/income)
2. **TaskManager + FocusLoop** — separate Supabase project, read + write (tasks)
3. **EstHoop** — FastAPI backend on Render ([github.com/ErkoKaar/EstHoop](https://github.com/ErkoKaar/EstHoop)), read-only public GET endpoint (`/national-team/games`), called directly from the client like Weather/Chess.com
4. **GitHub contributions** — GitHub GraphQL API, called only from `app/api/github/route.ts` so the token never reaches the browser
5. **Spotify** — Spotify Web API (now playing, top tracks/artists, playback control), called only from `app/api/spotify/*` so the token never reaches the browser

## Getting started

1. Copy the env example and fill in the values:

   ```bash
   cp .env.local.example .env.local
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Status

All five data sources are implemented (auth, data-fetching, and UI).
