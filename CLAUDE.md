# CLAUDE.md

Guidance for Claude Code (and other agents) working in this repository.

## What this is

A multi-tenant resource-planning + people-management app for databob.ch. Monorepo:
**`client/`** (React 18 + Vite + Tailwind) and **`server/`** (Fastify + TypeScript + Prisma + PostgreSQL). The server serves the API under `/api` and, in production, the built SPA from the same process.

Two source-of-truth specs describe intended behavior: `UI-SPEC.md` (design tokens, data model, component behavior) and `CLAUDE-CODE-INSTRUCTIONS.md` (architecture, backend design, deployment). The original product brief is `databob-resource-manager-brief.md`. Consult these when a change touches design or domain rules.

## Delivery workflow

Per the maintainer's standing instruction: **finish each request by opening a PR and merging it to `main`.** Commit and push to the working branch, open a PR, **wait for CI to pass** (server typecheck + tests, client build), then merge (standard merge commit so the working branch stays in sync). Never merge red CI — fix and re-push instead. Call out anything that hits production hard (e.g. a new Prisma migration) in the merge summary so it's visible, not silent.

## Commands

```bash
# Dev (from repo root) — runs server + client together
npm run dev                 # client :5173 (proxies /api → :3000), server :3000
npm run dev:server          # server only (tsx watch)
npm run dev:client          # client only

# Database (from server/)
docker compose up -d db                 # local Postgres on :5432 (run from repo root)
npm run db:migrate --prefix server      # prisma migrate dev
npm run db:seed --prefix server         # reset + reseed demo data

# Build / prod
npm run build               # client build, then prisma generate
npm start                   # production server (API + built SPA)
```

Demo credentials after seeding: `demo@databob.ch` / `demo123`.

Tests run with **Vitest** (`npm test --prefix server`) and on CI (`.github/workflows/ci.yml`: server typecheck + tests, client build). There is **no linter** configured. Also verify behavior by running the app. After changing `schema.prisma`, you must create a migration (`db:migrate`) and `prisma generate` (covered by `npm run build`).

**Verifying UI changes.** The fast static checks are `npm run build --prefix client` (Vite) + `npm run typecheck --prefix server` + `npm test --prefix server`. But many planner/cockpit bugs only surface at runtime, so for anything visual or interactive, **run the app and look**. Bring up `npm run dev`, sign in with the demo creds, and drive the page — a headless browser works well: log in by POSTing `/api/auth/login` and stashing the token in `localStorage['databob_token']`, then navigate **in-app** (deep-linking a visibility-gated page can race the org load). Seed realistic edge cases (allocation gaps, off-window/clipped bars, people on multiple customers) rather than trusting the happy path.

## Request lifecycle (server)

Every `/api` request (except `/api/auth/login`, `/api/auth/signup`, `/api/health`) goes through `plugins/auth.ts`:

1. **`onRequest` hook** — verifies the JWT, looks up the `OrgMember`, and sets `req.userId`, `req.orgId`, `req.role`. Missing token → 401; no membership in that org → 403.
2. **`preHandler` hook** — computes `req.visibility` (a `VisibilityScope`) via `services/visibility.service.ts`. Every handler can safely read `req.visibility.*`.

The **JWT carries `{ userId, orgId }`** — the active org is baked into the token. Switching orgs (`POST /api/orgs/switch`) mints a **new token** and the client does a full `window.location.reload()`. There is no `x-org-id` header.

**Sign-in paths** (both mint the same internal JWT, so visibility/org logic is auth-agnostic): local email/password (`/api/auth/login`, gated by `ALLOW_LOCAL_AUTH`) and Microsoft Entra SSO (`/api/auth/microsoft/*`, active only when the `ENTRA_*` env vars are set; single-tenant, invite-first provisioning via the `Invite` model). **Impersonation** ("view as"): admin-only `/api/auth/impersonate` mints a short-lived token with an `imp` claim (the real admin id); the auth hook computes visibility for the target user but **blocks all writes** while `imp` is set. The client stashes the admin token and shows a banner. Runtime config is centralized in `server/src/config.ts`.

Layering per domain: **`routes/` (thin HTTP) → `services/` (logic) → `schemas/` (Zod validation)**. Errors are thrown as typed classes from `utils/errors.ts` (`NotFoundError`, `ForbiddenError`, `BadRequestError`, …) and turned into HTTP responses by `plugins/errorHandler.ts`.

## Access-control model — read before touching read endpoints

Roles: `owner` > `admin` > `member` > `viewer` (`isAdmin` = owner or admin). Two enforcement mechanisms, used together:

- **`requireRole(minRole)`** (`middleware/requireRole.ts`) — coarse gate by role level. Returns **403**.
- **Visibility asserts** (`visibility.service.ts`) — `assertCanViewPerson/Customer/Project`. A record outside your scope returns **404, not 403** ("visibility == existence"). Preserve this convention — don't leak existence by switching to 403.

Scope rules (non-admin):
- **member** sees: self + directly/team-managed people + people/projects/customers they're responsible for (and people assigned to those projects).
- **viewer** sees: only themselves. Viewers are bounced to their own person page client-side and use dedicated `/me/*` endpoints (e.g. `/me/allocations`) so we don't widen their scope just to render names.

`assertAdmin(scope)` guards admin-only mutations (customer/project/need/assignment writes). `assertNoViewerResources(...)` prevents assigning a viewer as a **manager**. The **responsible person** of a customer/project is any org **User** (`Customer.responsibleUserId` / `Project.responsibleUserId`, not a Resource) — so an account manager who isn't a staffable person can own a customer; `assertResponsibleUserAllowed(...)` rejects non-members and viewers. Responsibility-based visibility/reminders match `req.userId` against `responsibleUserId`.

When adding an endpoint that returns or mutates org data: **filter by `req.orgId`**, then apply the appropriate visibility assert or `requireRole`.

## Data model notes (`server/prisma/schema.prisma`)

- **Everything is org-scoped** — almost every model has an `orgId` and an `@@index([orgId])`. New queries must filter by org.
- **Per-month FTE** lives in the `monthAllocations` JSON field on both `Need` and `Assignment`, keyed by `"YYYY-MM"` strings (e.g. `{ "2026-04": 0.5 }`). Month math is in `server/src/utils/months.ts` (e.g. `monthRange`). Project/Need `startMonth`/`endMonth` are also `"YYYY-MM"` strings, not dates.
- **Roles** are the 3-level Domain → Role → Seniority system (`ResourceRole`). Constants mirror in `client/src/lib/constants.js` (`DOMAINS`, `SENIORITIES`).
- **Evaluations** snapshot their categories (`EvaluationCategorySnapshot`) so finalized reviews stay stable even if `PerformanceLogCategory` rows later change. Respect the `draft → submitted → finalized` state machine in `services/evaluation.service.ts`.
- One Resource per (org, user) — a `Resource` is a person and may optionally link to a login `User` via `userId`.
- **RBAC (in progress).** `Role` is a per-org named permission matrix (`server/src/lib/permissions.ts` is the source of truth: segments × `{scope: none|own|team|all, create, edit, delete}`). The four system roles are seeded per org (`role.service.ts ensureSystemRoles`); `OrgMember.role` references a role by `key`, and admins can add custom roles (Settings → Roles & permissions). The auth hook resolves the role per request → `req.roleLevel` + `req.permissions`. Each segment is `{ view, scope: own|team|all, create, edit, delete }`: **`view` is the read gate, `scope` the reach, and create/edit/delete are writes (all require view)**. Mutation routes are gated by `requirePermission(segment, action)`; **list endpoints return `[]` when the role lacks `view`** (`canView`), and the client hides nav for no-view areas (`canViewArea`). `requireRole` uses the role's `level`, and tier-visibility (per-record) still tiers off the level (owner/admin → all, member → team, viewer → own). Owner & admin matrices are locked at full access to prevent lock-out.
- **`Log.resourceId` is nullable.** A null `resourceId` (with `customerId` set) is a **general / whole-customer review entry** — it isn't about one person and rolls into the evaluation of *every* person working on that customer/project (see the `resourceId: null` branch in `evaluation.service.ts` and `createGeneralCustomerLog`).
- **Integrations (Jira/Tempo) → actual hours.** `JiraConnection` holds per-org Jira/Tempo config with **encrypted** tokens (AES-256-GCM, `utils/crypto.ts` — never return token plaintext). `JiraAccount` caches Jira users; a person is **"matched"** when `Resource.externalWorkId` holds their Jira `accountId`. Synced Tempo worklogs land in `Worklog` (one row per `tempoWorklogId`, **idempotent upsert** so re-syncs don't duplicate), each resolved to `{ resourceId?, customerId?, projectId? }` + the Jira issue/epic; `month` is a `"YYYY-MM"` string. `services/integration.service.ts` owns the sync (`syncHours`) and the read aggregations; `JiraWorkItem` maps Jira epics/projects → customers/projects. The **actuals read endpoints** (visibility-scoped, not admin-only) are `GET /integration/tempo/actuals` (one customer+month → per person), `/actuals/monthly` (per person/month), `/actuals/monthly-by-customer`, `/actuals/resource-by-customer` (one person → by customer), `/actuals/customer-by-resource` (one customer → by person). **FTE↔hours** uses `MONTHLY_HOURS_PER_FTE` (≈173.33, `client/src/lib/constants.js`).

## Frontend conventions (`client/src/`)

- **Contexts** wrap the app in this order (see `App.jsx`): `AuthProvider` → `OrgProvider` → `VisibilityProvider` → `DataProvider`. `DataProvider` bulk-loads core collections once per org and exposes optimistic CRUD helpers (`useData()`); it reloads when `currentOrg` changes.
- **Routing is role-aware.** `LandingRedirect` sends admins to `/planner`, members to `/people`, viewers to their own profile. Mirror server visibility in the UI; don't show controls a role can't use (`useOrg().canEdit`, `useVisibility()`).
- **API client** is `client/src/lib/api.js` — one flat `api` object; add new endpoints there. Token is stored in `localStorage` under `databob_token`.
- **Feature-folder structure** under `features/` (planner, dashboard, people, customers, skills, journal, settings). Shared primitives in `components/ui`, forms in `components/forms`.
- **Design tokens & grid constants** are centralized in `client/src/lib/constants.js` (domain colors, column width `CW`, label width `LW`, bar/row heights, FTE↔hours conversion). Reuse them rather than hard-coding.
- Plain `.jsx` + Tailwind; no TypeScript on the client.

## Planner mechanics (`client/src/features/planner/`)

The planner grid is the most intricate surface — read this before touching it.

- **An Assignment is one row per `(needId, resourceId)`** (DB `@@unique`). Per-month FTE lives in its `monthAllocations` JSON. All writes go through `POST /assignments` → `assignment.service.upsertMonth`, which **merges** the given months into the existing row. Never create a second row for the same pair.
- **Held resource + click on a need cell** (`PlannerView.handleCellClick`) auto-fills the need's still-open months for that person via `buildAutoFill` (capacity- and gap-aware). If the person is **already** on the need (earlier months), it **extends** them into the remaining open months — applying only positive fills so existing months (and anyone else's) are never wiped. Placement is gated by `resourceMatchesNeed` (domain/role/seniority); a role-mismatched cell isn't clickable.
- **Bars render as segments.** `buildSegments` (`lib/gridUtils.js`) splits a person's allocations into runs, breaking on a **gap** (a zero/absent month — e.g. someone else covers it) or an **FTE change**. `AssignmentBar` places each segment at its true month offset (gaps render as **real gaps**, never bridged) and clips to the visible window (`‹`/`›` continuation markers when a bar runs off-screen).
- **Resize is per-segment.** Every free edge — including the start of a post-gap segment and a clipped off-window edge — gets its own handle. Dragging previews **live** (the bar follows the cursor, with an "N mo" badge), operates on the **full** segment incl. off-screen months, and never crosses a neighbouring segment or a month with no capacity.
- **Grid geometry** (`CW`, `LW`, bar/row heights) lives in `client/src/lib/constants.js`. Need-row heights are computed centrally in `PlannerGrid` so labels and bars stay aligned.

## Cockpits & plan-vs-actual analytics

- **Two cockpits, same shape:** the **1:1** (`features/people/cockpit/OneOnOneCockpit.jsx`) and the **PM review** (`features/customers/review/CustomerReviewCockpit.jsx`). Each leads with a **general** section; the per-item cards (per-project in the 1:1, per-person in the PM review) are **greyed until clicked**. Clicking one focuses it and **filters the right-hand context** — recent entries, client signals, and the planned-vs-actual chart — to that project's customer (1:1) or that person (PM review).
- **Planned vs actual** = planned FTE→hours (via `MONTHLY_HOURS_PER_FTE`) from allocations vs. synced Tempo hours, drawn by the shared `components/ui/PlannedVsActualChart.jsx`. Cockpit charts run a few months into the **future** so the plan ahead is visible.
- **Where actuals show:** cockpit charts and the home dashboard's utilization line/KPI. The **Insights** Client-Staffing and People-Capacity heatmaps are **plan-only** by design — keep them that way (actuals belong on the cockpit charts).
- **Dashboard actual utilization counts only matched people** (`Resource.externalWorkId` set), over *matched* capacity, so the rate isn't diluted by untracked people. The "Actual vs potential" KPI compares actual to potential over those same matched people; it falls back to realised-plan utilization when no actuals are synced.

## Gotchas

- **ESM with `.js` specifiers.** The server is `"type": "module"` and run through `tsx`. TypeScript files import each other using `.js` extensions (e.g. `import { routes } from './routes/index.js'`). Match this — a `.ts` extension or extensionless import will break at runtime.
- **Org switch reloads the page** — state isn't preserved across switches by design.
- **Two entry points by design.** Dev runs `src/index.ts` (no migrations — run `db:migrate` yourself). Production (`npm start` *and* the Docker image) runs `src/start.ts`, which resolves `DATABASE_URL` and runs `prisma migrate deploy` before booting `index.ts`. Keep them in sync.
- Visibility is recomputed every request and must **not** be cached across requests (responsibilities/team membership change).
- **Client `VisibilityProvider` stays `loading` until the org resolves.** It reports `loading: true` while `OrgContext` is still fetching the org, so a deep-link / refresh of a visibility-gated page (e.g. a PM-review cockpit) doesn't briefly see an *empty* scope and bounce the user to a fallback. Don't "optimize" it to settle early.

## Where things live (quick map)

| Need to… | Look in |
|----------|---------|
| Add/modify an API endpoint | `server/src/routes/*.routes.ts` (+ matching `services/`, `schemas/`) |
| Change who can see/do what | `server/src/services/visibility.service.ts`, `middleware/requireRole.ts` |
| Change the data model | `server/src/prisma/schema.prisma` → new migration |
| Touch the planner grid | `client/src/features/planner/` (bars/resize: `grid/bars/`, segment math: `lib/gridUtils.js`) |
| Touch dashboards/heatmaps | `client/src/features/dashboard/` (home: `client/src/features/home/`) |
| Person/customer detail pages | `client/src/features/people/`, `client/src/features/customers/` |
| 1:1 / PM-review cockpits | `client/src/features/people/cockpit/`, `client/src/features/customers/review/` |
| Jira/Tempo sync & actual hours | `server/src/services/integration.service.ts`, `routes/integration.routes.ts`; UI in Settings → Integrations |
| Wire a new API call client-side | `client/src/lib/api.js` |
| Shared colors/sizes/role lists | `client/src/lib/constants.js` |
