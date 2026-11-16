# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sports CRM platform for managing athletes, teams, rosters, awards, and email communications. Built on Next.js App Router with Supabase backend. Originally forked from Vercel's Platforms Starter Kit but heavily customized for sports/athletic management with multi-tenancy via account-based isolation.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run typecheck    # tsc, ignoring generated .next types
npm run lint         # ESLint (app, components, lib)
npm test             # Vitest unit tests (lib/**/*.test.ts)
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
- **Roles**: per account, in `account_members`: `owner` > `admin` > `manager` > `member`. Check with `supabase.rpc("has_account_role", { p_account_id, p_min_role })` or `requireAccountAdminApi()`. The old `profiles.role` (`admin` | `general`) is legacy and must not be used for access; `lib/legacy-role-guard.test.ts` enforces this.

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

## Money

Two units are in use. Never convert between them by hand.

- **Dollars** (numeric): `invoices.amount`, `payments.amount`,
  `rosters.custom_amount`, and `fees.amount` (whole dollars).
- **Integer cents**: `events.fee_amount`, every `*_cents` column,
  `accounts.application_fee_flat`, and every amount sent to or received
  from Stripe.
- `accounts.application_fee` is a percent, not money.

Rules:
- Convert and format only with `lib/money.ts` (`dollarsToCents`,
  `centsToDollars`, `centsToDecimalString`, `formatCents`, `formatDollars`).
  `lib/money-guard.test.ts` fails the build on a bare `/ 100` or `* 100`.
- Name variables after their unit: `amountCents`, `totalDollars`.
- New money columns are integer cents and end in `_cents`.
- Writing a Stripe amount into `invoices` or `payments` always goes through
  `centsToDollars`.

## Code Style
- TypeScript strict mode
- Omit semicolons
- Prefer interfaces over types, avoid enums
- Functional components only; favor React Server Components, minimize `"use client"`
- Use `function` keyword for declarations
- Early returns over nested conditionals
- Tailwind CSS with mobile-first responsive design
