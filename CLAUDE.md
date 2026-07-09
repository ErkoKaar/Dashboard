# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Verification policy

Do not run verification steps on your own initiative — no dev server, no build, no lint/typecheck runs, no browser checks, no tests — unless the user explicitly asks for it in that turn. Make the code change and stop there; wait for the user to request a check.

# Planning policy

Before implementing any change, first present a short plan (what will change, which files, the approach) and wait for the user to explicitly confirm it. Do not start editing code until the user has approved the plan in that turn.

# Git policy

Never run `git commit` or `git push` on your own initiative. Only do so when the user explicitly asks for a commit or push in that turn — approval for one commit/push does not carry over to later changes.

# Long-chat summary policy

After 15 user messages have accumulated in a single chat, summarize everything done so far and all information a new chat would need to continue the work (decisions made, current state, outstanding steps), then advise the user to open a new chat.

# Code quality policy

Write code like a senior developer: think through edge cases, failure modes, and invalid inputs before considering the task done, not just the happy path.

## Commands

- `npm run dev` — start the dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — `next lint` (ESLint, config: `next/core-web-vitals` + `next/typescript`)
- `npm run format` — `prettier --write .` (Tailwind class sorting via `prettier-plugin-tailwindcss`)
- `npx tsc --noEmit` — type check (no dedicated script; there is no test suite in this project)

Before committing, prefer running lint, format, and `tsc --noEmit` — there is no CI configured, so these are the only automated checks.

## Architecture

This is a single-page personal dashboard (Next.js 14 App Router) that aggregates five independent data sources behind one login. There is effectively one route (`app/page.tsx`); everything else is composition of widgets.

**Dual-session auth.** `providers/AuthProvider.tsx` manages *two separate Supabase sessions concurrently* — one for the FinanceTracker Supabase project, one for the TaskManager/FocusLoop Supabase project. They are different Supabase projects with independent auth, so `signIn` takes an email plus two separate passwords and signs into both clients in parallel. `app/page.tsx` gates the whole dashboard behind *both* sessions being present (`if (!taskSession || !financeSession) return <LoginForm />`) — a single missing session is treated as logged out.

**Two Supabase clients, not one.** `lib/supabase/financeClient.ts` and `lib/supabase/tasksClient.ts` are separate singleton factories reading distinct env vars (`NEXT_PUBLIC_FINANCE_SUPABASE_*` / `NEXT_PUBLIC_TASKS_SUPABASE_*`). Never conflate them — finance data and tasks/habits/focus data live in physically different Supabase projects.

**Per-data-source layering.** Each data source follows the same three-layer split:
- `components/widgets/*Widget.tsx` — "use client" presentational component, owns local UI state (tabs, forms)
- `lib/queries/use*.ts` — TanStack Query hooks, owns fetching/caching/mutations, colocated with that source's TS types
- `components/ui/*` — shared, source-agnostic primitives (Card, Button, Input, Skeleton, TabButton, WidgetTitle, WeeklyChart, chartTheme)

The five data sources: **FinanceTracker** (Supabase, read+write expenses/income), **TaskManager + FocusLoop** (Supabase, read+write tasks/habits/focus sessions — one project, three widgets), **EstHoop** (FastAPI on Render, read-only, own repo at github.com/ErkoKaar/EstHoop — `GET {NEXT_PUBLIC_ESTHOOP_API_URL}/national-team/games` returns `{upcoming, recent}`; `upcoming[0]` is the next game, `recent[0]` the latest result), **GitHub contributions** (GraphQL API), **Spotify** (Web API — now playing, top tracks/artists, and playback control).

**Server-proxied APIs.** Any API requiring a secret is called only from `app/api/*` route handlers, never from the browser: `app/api/github/route.ts` (GitHub GraphQL, `GITHUB_TOKEN`), `app/api/calendar/route.ts` (Google Calendar, OAuth refresh-token flow with `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REFRESH_TOKEN`), `app/api/summary/route.ts` (Anthropic API, `ANTHROPIC_API_KEY`), `app/api/spotify/*` (Spotify Web API, OAuth refresh-token flow with `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`/`SPOTIFY_REFRESH_TOKEN` via `lib/spotify/token.ts` — split across `now-playing`, `top`, and `control` routes since now-playing polls frequently while top tracks/artists and playback control don't). Client hooks (`useGithubContributions`, `useCalendarEvents`, `useSpotifyNowPlaying`/`useSpotifyTop`/`useSpotifyControl`, the summary-generation call in `useDashboardSummary`) fetch these via the internal `/api/*` endpoint, not the third-party API directly. Weather (open-meteo), Chess.com, and EstHoop are public, unauthenticated APIs and are called directly from client-side query hooks — the EstHoop backend's CORS allowlist must include this dashboard's origin.

**Shared date math lives in `lib/date.ts`.** `getCurrentWeekDates`, `nextDate`, `toDayRange`, `getCurrentMonthRange` are used across query hooks and the calendar route for week/month range queries — reuse these instead of reimplementing date arithmetic (several hooks still duplicate a local `todayDate()` helper).

**Environment variables** (see `.env.local.example` for the full annotated list): `NEXT_PUBLIC_*` vars are safe for the client (two Supabase projects' URL+anon key, chess username, EstHoop API URL); everything else (`GITHUB_TOKEN`, `GOOGLE_CLIENT_*`, `ANTHROPIC_API_KEY`, `SPOTIFY_*`) is server-only and must only be read inside `app/api/*` route handlers. On Vercel these must be set in Project Settings → Environment Variables — `.env.local` is never read by Vercel.

**Styling.** Tailwind with the palette defined as CSS custom properties in `app/globals.css` `:root` and mapped into `tailwind.config.ts` (`theme.extend.colors`). Dark theme only, no light-mode toggle currently.
