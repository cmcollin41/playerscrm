# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sports CRM platform for managing athletes, teams, rosters, awards, and email communications. Built on Next.js App Router with Supabase backend. Originally forked from Vercel's Platforms Starter Kit but heavily customized for sports/athletic management with multi-tenancy via account-based isolation.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint via Next.js
npm run format       # Check formatting (Prettier)
npm run format:write # Fix formatting
```

Node >= 22.x required.

## Architecture

### Stack
- **Next.js 16** (App Router, React Server Components)
- **Supabase** (PostgreSQL, Auth, RLS)
- **Resend** for email (React Email templates)
- **Stripe** for payments
- **Tailwind CSS** + shadcn/ui (Radix primitives)

### Route Groups
- `app/(auth)/login/` — Login/signup with Supabase Auth (email/password)
- `app/(dashboard)/` — Protected routes: people, teams, settings, invoices, emails
- `app/home/` — Public-facing pages and portal
- `app/api/` — API routes including webhooks (Stripe, email), public API, admin ops

### Data Layer
- **Server fetchers**: `lib/fetchers/server.ts` — uses Supabase server client
- **Client fetchers**: `lib/fetchers/client.ts` — uses browser client
- **Auth helpers**: `lib/auth.ts` — `getUserProfile()`, `isAdmin()`, `requireAuth()`, `requireAdmin()`
- **User roles**: `admin` | `general`

### Multi-tenancy
All data is scoped to an `account_id`. RLS policies enforce tenant isolation. The user's profile links to an account, and most tables have `account_id` foreign keys.

### Key Domain Tables
`accounts`, `profiles`, `people`, `teams`, `rosters`, `roster_awards`, `team_awards`, `seasons`, `lists`, `broadcasts`, `emails`, `senders`, `sender_domains`

Types are auto-generated in `types/schema.types.ts`.

## Supabase Conventions

### Migrations
- Location: `supabase/migrations/`
- Naming: `YYYYMMDDHHmmss_short_description.sql` (UTC)
- All SQL in lowercase
- Always enable RLS on new tables, even if public
- Separate RLS policies per operation (select, insert, update, delete) and per role (anon, authenticated) — never use `FOR ALL`
- Use `(select auth.uid())` (wrapped in select) in policies for performance
- Always specify roles with `TO` clause

### Auth (SSR)
- Two client utilities: `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server)
- Middleware in `lib/supabase/middleware.ts` handles token refresh
- **Never** use deprecated `@supabase/auth-helpers-nextjs` or the old `cookies: { get, set, remove }` pattern
- Use the `@supabase/ssr` `createServerClient`/`createBrowserClient` with `getAll`/`setAll` cookie methods

## Code Style
- TypeScript strict mode
- Omit semicolons
- Prefer interfaces over types, avoid enums
- Functional components only; favor React Server Components, minimize `"use client"`
- Use `function` keyword for declarations
- Early returns over nested conditionals
- Tailwind CSS with mobile-first responsive design
