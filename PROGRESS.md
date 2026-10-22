# GYMBASE progress

Read this first in each session instead of rescanning the repo.

## Done

- Stage 1: Next.js 16 (App Router, TS), Prisma 6 + Postgres, Auth.js v5 (credentials, JWT), Tailwind 4, zod, vitest.
- `prisma/schema.prisma` covers all 10 modules (tenancy, members, plans/memberships, check-ins, leads, payments/invoices/cash closing, reminders, staff/PT/commissions, SaaS subscription).
- Auth: login by gym slug + email + password (`/login`). `src/proxy.ts` redirects unauthenticated requests.
- Tenancy: `requireTenant(permission?)` in `src/server/tenant.ts` returns `{ userId, gymId, role }`; every query must use that `gymId`. Roles/permissions in `src/lib/rbac.ts`.
- Staff invites: `inviteStaff` / `acceptInvite` server actions in `src/server/staff.ts` (no UI yet).
- Seed (`npm run db:seed`): gym `demo`, logins `owner@demo.gym`, `reception@demo.gym`, `trainer@demo.gym`, password `password123`. 6 members (one expired, one with dues), 4 plans, 3 leads.

- Stage 2, Members: `/members` (search by name/phone/code/email, paginated, membership status), `/members/new`, `/members/[id]` (photo, emergency contact, documents, timestamped notes, dues, recent check-ins, membership history), `/members/[id]/edit`. Server actions in `src/server/members.ts`, zod schemas + phone normalisation in `src/lib/members.ts`, shared UI in `src/components/ui.tsx`.
- Uploads (photo, documents) are stored as `StoredFile` bytes in Postgres and served by `/api/files/[id]`, which checks the session's gymId. Limits: photo 2 MB, document 4 MB (server-action body limit 4.5 MB, Vercel's cap).
- Member codes come from an atomic `Gym.memberSeq` counter (`GB-0001`…). Free-form `Member.notes` stays on the profile; `MemberNote` is the dated log with author.

- Stage 3, Plans & memberships: `/plans` (owner: create/edit/retire plans; `Plan.active` gates assignment). Member profile gets a Membership panel: start plan, renew (chains from current end date via `renewedFromId`), upgrade (old one CANCELLED with `cancelReason`, pro-rata credit becomes `discountPaise` on the new one), freeze/unfreeze (`frozenDays` extends `endDate`), cancel with reason. Every new membership raises an Invoice (`Gym.invoiceSeq`, `Gym.gstPercent`) with `paidPaise` 0, so dues appear until Payments collects them. Logic + zod in `src/lib/memberships.ts`, actions in `src/server/plans.ts` / `src/server/memberships.ts`.
- Auto-expiry: `expireMemberships()` runs on member page loads and daily from `/api/cron/expire` (Vercel cron in `vercel.json`, guarded by `CRON_SECRET`).

## Next

Asked by the owner on 2026-10-22, to land in their modules:
- Payments (module 6): a "Defaulters" screen on the main nav: member name, last plan, days since dues started, amount.
- Inquiries (module 5): filter leads by source, including WhatsApp and Instagram (add to `LeadSource` enum alongside walk-in/phone/web).

1. Modules 4 to 10 in the order of the build prompt.
2. Invite accept page (`/invite/[token]`) and staff list in settings.

## Decisions

- Single `User` table per gym with a `Role`; a member who logs in gets a `User` with role MEMBER linked via `Member.userId`.
- Money is integer paise. GST stored per invoice (`gstPercent`, `gstPaise`).
- Each gym is identified at login by its `slug` (no subdomains yet).
- Prisma 6 chosen over 8 (rc) for stability. shadcn/ui deferred until a module needs real components; plain Tailwind so far.
- Files in Postgres rather than S3/Blob to keep the stack to Vercel + Neon; swap `storeFile` in `src/server/members.ts` for object storage if the DB grows.
- Phones stored as E.164; `normalizePhone` assumes +91 for bare 10-digit numbers.
- `Membership.renewedFromId` chains renewals and upgrades; freeze extends `endDate` by `frozenDays`.
- Editing a plan never changes existing memberships (they keep their own `pricePaise`); retire a plan instead of deleting it.
- Form checkboxes use a hidden `off` input before the checkbox; server actions read `formData.getAll(name).includes("on")`.

## Setup

```
cp .env.example .env   # set DATABASE_URL, AUTH_SECRET
npm install
npm run db:migrate
npm run db:seed
npm run dev
```
