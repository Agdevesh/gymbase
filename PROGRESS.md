# GYMBASE progress

Read this first in each session instead of rescanning the repo.

## Done

- Stage 1: Next.js 16 (App Router, TS), Prisma 6 + Postgres, Auth.js v5 (credentials, JWT), Tailwind 4, zod, vitest.
- `prisma/schema.prisma` covers all 10 modules (tenancy, members, plans/memberships, check-ins, leads, payments/invoices/cash closing, reminders, staff/PT/commissions, SaaS subscription).
- Auth: login by gym slug + email + password (`/login`). `src/proxy.ts` redirects unauthenticated requests.
- Tenancy: `requireTenant(permission?)` in `src/server/tenant.ts` returns `{ userId, gymId, role }`; every query must use that `gymId`. Roles/permissions in `src/lib/rbac.ts`.
- Staff invites: `inviteStaff` / `acceptInvite` server actions in `src/server/staff.ts` (no UI yet).
- Seed (`npm run db:seed`): gym `demo`, logins `owner@demo.gym`, `reception@demo.gym`, `trainer@demo.gym`, password `password123`. 6 members (one expired, one with dues), 4 plans, 3 leads.

## Next

1. Module 2, Members: list/search, create/edit, photo and document upload, member detail page.
2. Module 3, Plans & memberships.
3. Modules 4 to 10 in the order of the build prompt.
4. Invite accept page (`/invite/[token]`) and staff list in settings.

## Decisions

- Single `User` table per gym with a `Role`; a member who logs in gets a `User` with role MEMBER linked via `Member.userId`.
- Money is integer paise. GST stored per invoice (`gstPercent`, `gstPaise`).
- Each gym is identified at login by its `slug` (no subdomains yet).
- Prisma 6 chosen over 8 (rc) for stability. shadcn/ui deferred until a module needs real components; plain Tailwind so far.
- `Membership.renewedFromId` chains renewals; freeze extends `endDate` by `frozenDays`.

## Setup

```
cp .env.example .env   # set DATABASE_URL, AUTH_SECRET
npm install
npm run db:migrate
npm run db:seed
npm run dev
```
