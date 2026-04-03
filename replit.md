# WhatsApp Campaign Operations Dashboard

## Overview

A production-oriented WhatsApp campaign operations MVP dashboard with three core modules: Campaigns, Contacts, and Tracking. Built as a pnpm workspace monorepo with Node.js/Express backend, PostgreSQL+Drizzle ORM, React+Vite frontend.

## Architecture

- **Frontend**: React + Vite at `/` (port via `PORT` env var) — `artifacts/dashboard`
- **Backend**: Node.js + Express API at `/api/*` — `artifacts/api-server`
- **Database**: PostgreSQL + Drizzle ORM — `lib/db`
- **API Spec**: OpenAPI 3.1 — `lib/api-spec/openapi.yaml`
- **API Client**: Generated React Query hooks — `lib/api-client-react`
- **Zod Schemas**: Generated from OpenAPI — `lib/api-zod`

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild
- **Frontend routing**: Wouter
- **Component library**: shadcn/ui + Radix UI + TailwindCSS v4
- **State/data**: TanStack React Query

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Pages

- `/` — Dashboard overview (stats, recent campaigns, recent failures)
- `/campaigns` — Campaign list with status filter + quick actions
- `/campaigns/new` — 3-step campaign creation wizard
- `/campaigns/:id` — Campaign detail with contact report + pause/resume/cancel
- `/contacts` — Contacts table with search, filter, inline add/edit/delete
- `/contacts/import` — CSV import flow (upload → column mapping → result)
- `/tracking` — Message tracking with status stat bar + filter/search
- `/tracking/messages/:id` — Message detail + event timeline + retry
- `/settings/providers` — WhatsApp provider configuration

## Database Tables

`contacts`, `contact_lists`, `contact_list_members`, `imports`, `import_rows`, `campaigns`, `campaign_contacts`, `messages`, `message_events`, `provider_configs`

## Mock Provider

Simulates WhatsApp delivery: sent → delivered → read, ~10% failures. Ready to swap with Green API or Evolution API. Config in `/settings/providers`.

## Seed Data

50 contacts (Brazilian phone numbers), 3 contact lists, 5 campaigns (completed/running/draft), 67 messages with event logs.
