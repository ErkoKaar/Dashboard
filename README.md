# Dashboard

Personal dashboard aggregating data from four sources: FinanceTracker, TaskManager + FocusLoop, EstHoop, and GitHub contributions.

## Tech stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- TanStack Query (React Query) for data fetching/caching
- @supabase/supabase-js for the two Supabase-backed data sources
- ESLint + Prettier

## Project structure

```
app/
  api/github/route.ts   Server-side route that calls the GitHub GraphQL API (token stays server-side)
  page.tsx               Dashboard home page
components/
  widgets/                One component per data source: GithubWidget, FinanceWidget, TasksWidget, FocusLoopWidget, EstHoopWidget
  ui/                     Reusable UI primitives: Card, Button, Skeleton
lib/
  supabase/               financeClient.ts and tasksClient.ts — separate Supabase clients for the two projects
  queries/                React Query hooks per data source (currently placeholder logic, see TODOs)
providers/
  QueryProvider.tsx       QueryClientProvider wrapper, mounted in app/layout.tsx
```

## Data sources

1. **FinanceTracker** — separate Supabase project, read + write (expenses/income)
2. **TaskManager + FocusLoop** — separate Supabase project, read + write (tasks)
3. **EstHoop** — FastAPI backend on Render, read-only public GET endpoint
4. **GitHub contributions** — GitHub GraphQL API, called only from `app/api/github/route.ts` so the token never reaches the browser

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

Structural skeleton only — data-fetching logic, UI design, and authentication are not implemented yet (see `TODO` comments throughout `lib/queries` and `app/api/github/route.ts`).
