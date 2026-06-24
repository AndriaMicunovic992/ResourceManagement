# databob Resource Manager

A multi-tenant **resource-planning and people-management** web app for [databob.ch](https://databob.ch), a consultancy that allocates team members across client projects over time.

It began as a Gantt-style resource planner — a timeline grid where you assign people to project "needs" and see at a glance what's covered — and has grown into a broader team-ops platform covering skills, 1:1s, activity journaling, and a structured performance-evaluation workflow.

---

## Features

- **Planner** — a month-by-month timeline grid. Allocate people (resources) to project *needs* with per-month FTE, drag to resize allocations (per-segment, with real gaps when someone else covers a month), and watch coverage roll up green from cell → need → project → customer.
- **Dashboard & Insights** — utilization stats (planned · actual · potential), free-capacity view, and heatmaps for clients and people.
- **People** — per-person pages with tabs for overview, allocation, skills, 1:1 meetings, activity log, and performance.
- **Customers** — customer detail pages with access-gated tabs (overview, projects, people, activity, performance).
- **1:1 & PM-review cockpits** — focused review surfaces: fill the general recap, then click a project/person to filter the recent activity, signals, and planned-vs-actual chart to it.
- **Skills** — an org-wide skills matrix and per-person skill levels.
- **Performance** — an evaluation workflow (draft → employee/responsible submit → finalize) with immutable category snapshots and weighted scoring.
- **Jira/Tempo integration** — sync **actual logged hours** and compare them against the plan (planned-vs-actual charts on the dashboard and in the cockpits). People are matched to Jira accounts; tokens are stored encrypted.
- **Multi-tenant & role-aware** — every record is scoped to an organization; four roles (owner / admin / member / viewer) control what each user can see and edit.

---

## Tech stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 18, Vite, Tailwind CSS, React Router, Context API (no external state lib) |
| Backend  | Node.js, Fastify, TypeScript, run via `tsx` |
| Database | PostgreSQL via Prisma ORM |
| Auth     | JWT (`@fastify/jwt`) + bcrypt password hashing |
| Deploy   | Multi-stage Docker image on Railway |

The production server serves both the API (under `/api`) **and** the built React SPA from one container, so the whole app ships as a single image.

---

## Repository layout

```
ResourceManagement/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── features/        # Feature folders (planner, dashboard, people, customers, skills, …)
│       ├── components/      # Reusable UI (ui/, forms/, badges/, popovers/)
│       ├── contexts/        # Auth, Org, Visibility, Data providers
│       ├── layouts/         # App shell, header, nav
│       └── lib/             # api client, constants, date/grid/status utils
├── server/                  # Fastify + TypeScript backend
│   ├── prisma/
│   │   ├── schema.prisma    # Data model
│   │   └── migrations/      # SQL migrations (0001 … 0021)
│   └── src/
│       ├── routes/          # HTTP endpoints (thin)
│       ├── services/        # Business logic
│       ├── schemas/         # Zod request validation
│       ├── plugins/         # cors, jwt, auth, errorHandler
│       ├── middleware/      # requireRole
│       ├── utils/           # months, password, errors
│       └── db/              # Prisma client + seed
├── Dockerfile               # Multi-stage build (client → server static)
├── docker-compose.yml       # Local Postgres + server
├── railway.toml             # Railway deploy config
└── package.json             # Root scripts (run client + server together)
```

---

## Getting started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (use the bundled `docker-compose.yml` for local dev)

### 1. Install dependencies

```bash
npm install                 # root (concurrently)
npm install --prefix client
npm install --prefix server
```

### 2. Configure the server environment

```bash
cp server/.env.example server/.env
```

```ini
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/databob?schema=public"
JWT_SECRET="change-this-to-a-random-64-char-string-in-production"
PORT=3000
CORS_ORIGIN="http://localhost:5173"
```

### 3. Start Postgres and set up the database

```bash
docker compose up -d db                 # starts Postgres on :5432
npm run db:migrate --prefix server      # apply migrations
npm run db:seed --prefix server         # optional: load demo data
```

### 4. Run the app (client + server together)

```bash
npm run dev
```

- Client: **http://localhost:5173** (Vite proxies `/api` → `:3000`)
- Server: **http://localhost:3000**

### Demo login

After seeding:

```
email:    demo@databob.ch
password: demo123
```

This creates the `databob` org (you join as **owner**) with a sample CH Media customer, two projects, four people, and assignments.

---

## NPM scripts

Run from the repository root:

| Script              | What it does |
|---------------------|--------------|
| `npm run dev`       | Runs server + client concurrently |
| `npm run dev:server`| Server only (`tsx watch`) |
| `npm run dev:client`| Client only (Vite) |
| `npm run build`     | Builds the client, then runs `prisma generate` |
| `npm start`         | Starts the production server (serves API + built SPA) |

Inside `server/`:

| Script               | What it does |
|----------------------|--------------|
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed`    | Reset + reseed demo data |

---

## Data model

All entities are scoped to an `Organization`.

```
Organization
 ├── Customer ──► Project ──► Need ──► Assignment ──► Resource (person)
 ├── Resource (people, with ResourceRole[] = Domain/Role/Seniority; optional login + Jira match)
 ├── Team, PersonManager                  # org structure & management graph
 ├── Skill / PersonSkill                   # skills matrix
 ├── OneOnOne, Log, CustomerReview, …      # 1:1 notes, activity/review journal
 ├── Evaluation                            # review workflow with category snapshots & scores
 └── JiraConnection, JiraAccount, Worklog  # Jira/Tempo integration & synced actual hours
```

- **Needs** and **Assignments** store per-month FTE as a JSON map keyed by `"YYYY-MM"` (e.g. `{ "2026-04": 0.5, "2026-05": 1.0 }`). One Assignment per `(need, resource)`.
- **Roles** are a three-level system: **Domain** (Data / Web / General) → **Role** (FE, BE, PM, …) → **Seniority** (Junior / Medior / Senior / Senior Principal).
- **Actual hours**: `Worklog` rows (synced from Tempo) hold per-month logged hours per person/customer/project; a person is matched when `Resource.externalWorkId` holds their Jira account id.

---

## Roles & access

| Role         | Can see | Can edit |
|--------------|---------|----------|
| **owner/admin** | Everything in the org | Everything |
| **member**   | Themselves, people they manage (direct or via team), and people/projects rolling up through customers/projects they're responsible for | Within their scope |
| **viewer**   | Only themselves | Read-only |

Access is enforced server-side: a record you can't see returns **404** (it simply doesn't exist for you), while a privileged action you're not allowed to take returns **403**.

---

## Deployment

The `Dockerfile` builds the client, installs production server deps, runs `prisma generate`, copies the client `dist/` into the server's `public/`, and serves everything from one Node process. `railway.toml` points Railway at the Dockerfile and health-checks `/api/health`.

Required production environment variables: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`.
