# databob Resource Manager — Claude Code Build Instructions

## ⚠️ CRITICAL: Do NOT Read the Existing .jsx File

**There is an existing `databob-resource-manager.jsx` prototype. DO NOT read it, import it, or reference it in any way.**

**Why this matters:** Previous attempts to share this file with Claude Code caused a sub-agent to spawn and burn the entire context budget mechanically porting the 1200-line single-file prototype. The file exists only because it had to fit in Claude's artifact sandbox — it uses inline styles, `function(){}` syntax for sandbox compatibility, and deeply nested JSX that all need to be thrown away anyway.

**Do not:**
- Read or open `databob-resource-manager.jsx`
- Spawn a sub-agent to "adapt" or "port" it
- Ask the user to share it
- Copy any code from it even if you see it

**Instead, build fresh from these two specs:**
1. **This file (`CLAUDE-CODE-INSTRUCTIONS.md`)** — architecture, folder structure, backend design, deployment
2. **`UI-SPEC.md`** — visual design tokens, data model, component behavior, layouts

These two documents contain **everything** you need. They describe what to build and how to structure it, without dictating the implementation details that would bias you toward the anti-patterns in the prototype. Building from specs results in cleaner, smaller, more maintainable code than porting the prototype would.

**If you find yourself wanting to look at the existing implementation for any reason, stop and re-read the spec instead.** The spec is intentionally complete so you never need the source file.

---

## Overview

Build a **multi-tenant resource planning web application** for databob.ch. This is a Gantt-style resource planner where consultancy teams allocate people across client projects over time.

**Stack:**
- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Fastify (or Express)
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** Clerk (or Auth.js/NextAuth) for multi-tenant auth
- **Deployment:** Railway (Dockerfile-based)

---

## 1. Project Setup

```bash
# Create the project
mkdir databob-resource-manager && cd databob-resource-manager

# Initialize frontend
npm create vite@latest client -- --template react
cd client && npm install && cd ..

# Initialize backend
mkdir server && cd server
npm init -y
npm install fastify @fastify/cors @fastify/jwt @prisma/client
npm install -D prisma typescript @types/node tsx
npx prisma init
cd ..
```

Create a monorepo structure:
```
databob-resource-manager/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx         # Root component
│   │   ├── api.js          # API client functions
│   │   ├── auth.js         # Auth context/hooks
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/                 # Fastify backend
│   ├── src/
│   │   ├── index.ts        # Server entry
│   │   ├── routes/
│   │   │   ├── customers.ts
│   │   │   ├── projects.ts
│   │   │   ├── resources.ts
│   │   │   ├── needs.ts
│   │   │   └── assignments.ts
│   │   ├── middleware/
│   │   │   └── auth.ts     # JWT + tenant isolation
│   │   └── utils/
│   │       └── tenant.ts   # Multi-tenant helpers
│   ├── prisma/
│   │   └── schema.prisma
│   ├── tsconfig.json
│   └── package.json
├── Dockerfile
├── docker-compose.yml      # Local dev with Postgres
├── railway.toml
└── README.md
```

---

## 2. Database Schema (Prisma)

Create `server/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Multi-tenant: every entity belongs to an organization
model Organization {
  id        String     @id @default(cuid())
  name      String
  slug      String     @unique
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  members   OrgMember[]
  customers Customer[]
  projects  Project[]
  resources Resource[]
  needs     Need[]
  assignments Assignment[]
}

model User {
  id        String     @id @default(cuid())
  email     String     @unique
  name      String
  avatar    String?
  createdAt DateTime   @default(now())

  memberships OrgMember[]
}

model OrgMember {
  id     String @id @default(cuid())
  role   String @default("member") // "owner", "admin", "member", "viewer"
  
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  orgId  String
  org    Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([userId, orgId])
}

model Customer {
  id        String   @id @default(cuid())
  name      String
  status    String   @default("realised") // "realised" | "potential"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  orgId     String
  org       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  projects  Project[]

  @@index([orgId])
}

model Project {
  id         String   @id @default(cuid())
  name       String
  startMonth String   // "2026-01" format
  endMonth   String   // "2026-12" format
  status     String   @default("realised") // "realised" | "potential"
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  customerId String
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  
  orgId      String
  org        Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  needs      Need[]

  @@index([orgId])
  @@index([customerId])
}

model Resource {
  id        String   @id @default(cuid())
  name      String
  capacity  Float    @default(1.0) // FTE capacity 0.1-1.0
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  orgId     String
  org       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  roles     ResourceRole[]
  assignments Assignment[]

  @@index([orgId])
}

model ResourceRole {
  id        String @id @default(cuid())
  domain    String // "Data", "Web", "General"
  role      String // "FE", "BE", "PM", etc.
  seniority String // "Junior", "Medior", "Senior", "Senior Principal"

  resourceId String
  resource   Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)

  @@index([resourceId])
}

model Need {
  id              String   @id @default(cuid())
  domain          String   @default("Web")
  role            String   @default("FE")
  seniority       String   @default("Medior")
  label           String?
  startMonth      String?  // Override within project range
  endMonth        String?  // Override within project range
  status          String   @default("realised") // "realised" | "potential"
  monthAllocations Json    @default("{}") // { "2026-01": 1.0, "2026-02": 1.0, ... }
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  orgId     String
  org       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  assignments Assignment[]

  @@index([orgId])
  @@index([projectId])
}

model Assignment {
  id              String   @id @default(cuid())
  monthAllocations Json    @default("{}") // { "2026-03": 0.5, "2026-04": 0.8, ... }
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  needId     String
  need       Need     @relation(fields: [needId], references: [id], onDelete: Cascade)
  
  resourceId String
  resource   Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)
  
  orgId      String
  org        Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([needId, resourceId]) // One assignment per resource per need
  @@index([orgId])
  @@index([needId])
  @@index([resourceId])
}
```

Run:
```bash
cd server
npx prisma migrate dev --name init
npx prisma generate
```

---

## 3. Backend Architecture

### ⚠️ Same Rules as Frontend

- ❌ **Do NOT** put all routes in one `index.ts` file
- ❌ **Do NOT** let any single file exceed ~150 lines
- ❌ **Do NOT** put business logic inside route handlers — extract to services
- ❌ **Do NOT** trust any `orgId` coming from the client (body, query, or params)
- ✅ **DO** decompose into the folder structure below
- ✅ **DO** keep routes thin (parse → call service → return)
- ✅ **DO** put business logic in services, data access in repositories
- ✅ **DO** apply auth middleware globally so every route is protected by default
- ✅ **DO** derive `orgId` ONLY from the JWT, never from the request body

### Target Folder Structure

```
server/
├── src/
│   ├── index.ts                     # Entry point: app setup, plugin registration, listen (~60 lines)
│   ├── app.ts                       # Build Fastify instance, register plugins/routes (~80 lines)
│   ├── config.ts                    # Load env vars, validate with zod (~40 lines)
│   │
│   ├── db/
│   │   ├── prisma.ts                # Prisma client singleton (~15 lines)
│   │   └── seed.ts                  # Dev seed script (~100 lines)
│   │
│   ├── plugins/                     # Fastify plugins (registered in app.ts)
│   │   ├── cors.ts                  # CORS config (~20 lines)
│   │   ├── jwt.ts                   # JWT plugin setup (~20 lines)
│   │   ├── auth.ts                  # decorateRequest with userId, orgId (~50 lines)
│   │   ├── errorHandler.ts          # Centralized error formatting (~40 lines)
│   │   └── staticFiles.ts           # Serve React build in production (~25 lines)
│   │
│   ├── middleware/
│   │   ├── requireAuth.ts           # Reject if no valid JWT (~30 lines)
│   │   ├── requireRole.ts           # Reject if user lacks role (owner/admin) (~25 lines)
│   │   └── validateBody.ts          # zod schema validation helper (~20 lines)
│   │
│   ├── routes/                      # Thin HTTP handlers, one file per resource
│   │   ├── index.ts                 # Combine all route modules (~30 lines)
│   │   ├── auth.routes.ts           # signup, login, me, logout (~80 lines)
│   │   ├── org.routes.ts            # create org, list user's orgs, switch org (~70 lines)
│   │   ├── member.routes.ts         # list, invite, update role, remove (~90 lines)
│   │   ├── invite.routes.ts         # accept invite, list pending invites (~60 lines)
│   │   ├── customer.routes.ts       # GET/POST/PUT/DELETE /customers (~80 lines)
│   │   ├── project.routes.ts        # GET/POST/PUT/DELETE /projects (~80 lines)
│   │   ├── resource.routes.ts       # GET/POST/PUT/DELETE /resources (with roles) (~100 lines)
│   │   ├── need.routes.ts           # GET/POST/PUT/DELETE /needs (~90 lines)
│   │   ├── assignment.routes.ts     # GET/POST (upsert)/PUT/DELETE /assignments (~100 lines)
│   │   └── dashboard.routes.ts      # GET /stats, GET /heatmap (~60 lines)
│   │
│   ├── services/                    # Business logic, database operations
│   │   ├── auth.service.ts          # hashPassword, verifyPassword, createSession (~80 lines)
│   │   ├── org.service.ts           # createOrg, listUserOrgs, getUserRoleInOrg (~70 lines)
│   │   ├── member.service.ts        # invite, accept, updateRole, remove (~100 lines)
│   │   ├── customer.service.ts      # CRUD with tenant isolation (~80 lines)
│   │   ├── project.service.ts       # CRUD with tenant isolation (~80 lines)
│   │   ├── resource.service.ts      # CRUD including nested ResourceRole records (~120 lines)
│   │   ├── need.service.ts          # CRUD + monthAllocations merge logic (~100 lines)
│   │   ├── assignment.service.ts    # Upsert logic, per-month FTE updates (~120 lines)
│   │   └── dashboard.service.ts     # Aggregations for stats + heatmap (~100 lines)
│   │
│   ├── schemas/                     # Zod schemas for request validation
│   │   ├── auth.schema.ts           # SignupInput, LoginInput (~30 lines)
│   │   ├── org.schema.ts            # CreateOrgInput, UpdateOrgInput (~25 lines)
│   │   ├── member.schema.ts         # InviteMemberInput, UpdateRoleInput (~30 lines)
│   │   ├── customer.schema.ts       # CreateCustomerInput, UpdateCustomerInput (~25 lines)
│   │   ├── project.schema.ts        # (~30 lines)
│   │   ├── resource.schema.ts       # with nested roles array (~40 lines)
│   │   ├── need.schema.ts           # with monthAllocations object (~35 lines)
│   │   └── assignment.schema.ts     # single-month upsert payload (~30 lines)
│   │
│   ├── types/
│   │   ├── fastify.d.ts             # Type augmentation: request.userId, request.orgId, request.role
│   │   └── index.ts                 # Shared types (Role, MonthAllocations, etc.)
│   │
│   ├── utils/
│   │   ├── password.ts              # bcrypt wrapper (~20 lines)
│   │   ├── jwt.ts                   # sign/verify helpers (~30 lines)
│   │   ├── errors.ts                # Custom error classes (NotFoundError, ForbiddenError, etc.) (~40 lines)
│   │   └── logger.ts                # pino wrapper (~20 lines)
│   │
│   └── __tests__/                   # Vitest tests
│       ├── auth.test.ts
│       ├── tenant-isolation.test.ts # CRITICAL: verify no cross-tenant leaks
│       ├── customer.test.ts
│       ├── assignment.test.ts
│       └── dashboard.test.ts
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── .env.example
├── tsconfig.json
├── package.json
└── Dockerfile (or at repo root)
```

### Layered Architecture

```
┌──────────────────────────────────────────────────────┐
│  HTTP Layer — routes/                                 │
│  • Parse request, call service, return response      │
│  • Thin, no business logic                            │
└────────────────┬─────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────┐
│  Validation Layer — schemas/                          │
│  • Zod schemas validate request bodies                │
│  • Reject malformed input before it reaches services  │
└────────────────┬─────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────┐
│  Service Layer — services/                            │
│  • Business logic, orchestration, permission checks   │
│  • Enforces tenant isolation (always takes orgId)     │
│  • Calls Prisma directly (no separate repository)     │
└────────────────┬─────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────┐
│  Data Layer — Prisma                                  │
│  • Schema defines cascade deletes                     │
│  • Every query includes orgId in WHERE clause         │
└──────────────────────────────────────────────────────┘
```

### Multi-Tenant Isolation: The Golden Rule

**Every database query must filter by `orgId`, and that `orgId` must come from the authenticated JWT — never from the request body, URL params, or query string.**

The pattern:

```typescript
// services/customer.service.ts
export const customerService = {
  async list(orgId: string) {
    return prisma.customer.findMany({
      where: { orgId },  // ✅ tenant isolation
      orderBy: { createdAt: 'asc' },
    });
  },

  async getById(orgId: string, id: string) {
    const customer = await prisma.customer.findFirst({
      where: { id, orgId },  // ✅ must match BOTH id AND orgId
    });
    if (!customer) throw new NotFoundError('Customer not found');
    return customer;
  },

  async create(orgId: string, data: CreateCustomerInput) {
    return prisma.customer.create({
      data: { ...data, orgId },  // ✅ orgId from JWT, not from data
    });
  },

  async update(orgId: string, id: string, data: UpdateCustomerInput) {
    // Verify ownership first
    await this.getById(orgId, id);  // throws 404 if not owned
    return prisma.customer.update({ where: { id }, data });
  },

  async delete(orgId: string, id: string) {
    await this.getById(orgId, id);
    return prisma.customer.delete({ where: { id } });
  },
};
```

And the corresponding thin route handler:

```typescript
// routes/customer.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { customerService } from '../services/customer.service';
import { createCustomerSchema, updateCustomerSchema } from '../schemas/customer.schema';

export const customerRoutes: FastifyPluginAsync = async (app) => {
  app.get('/customers', async (req) => {
    return customerService.list(req.orgId);  // orgId from JWT via auth plugin
  });

  app.post('/customers', async (req) => {
    const data = createCustomerSchema.parse(req.body);
    return customerService.create(req.orgId, data);
  });

  app.put<{ Params: { id: string } }>('/customers/:id', async (req) => {
    const data = updateCustomerSchema.parse(req.body);
    return customerService.update(req.orgId, req.params.id, data);
  });

  app.delete<{ Params: { id: string } }>('/customers/:id', async (req, reply) => {
    await customerService.delete(req.orgId, req.params.id);
    return reply.status(204).send();
  });
};
```

### Auth Plugin (the critical middleware)

```typescript
// plugins/auth.ts
import fp from 'fastify-plugin';
import { prisma } from '../db/prisma';

export default fp(async (app) => {
  // Make request.userId and request.orgId available everywhere
  app.decorateRequest('userId', '');
  app.decorateRequest('orgId', '');
  app.decorateRequest('role', '');

  app.addHook('onRequest', async (req, reply) => {
    // Skip auth for public routes
    if (req.url.startsWith('/api/auth/login') ||
        req.url.startsWith('/api/auth/signup') ||
        !req.url.startsWith('/api/')) return;

    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return reply.status(401).send({ error: 'Unauthorized' });

      const decoded = app.jwt.verify<{ userId: string; orgId: string }>(token);

      // Verify the user still belongs to this org (important for revocation)
      const membership = await prisma.orgMember.findUnique({
        where: { userId_orgId: { userId: decoded.userId, orgId: decoded.orgId } },
      });
      if (!membership) return reply.status(403).send({ error: 'No access to this org' });

      req.userId = decoded.userId;
      req.orgId = decoded.orgId;
      req.role = membership.role;
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });
});
```

The auth check runs on every `/api/*` request automatically. Individual route handlers don't need to remember to add it.

### Role-Based Access Control

Add a `requireRole` middleware for routes that need elevated permissions:

```typescript
// middleware/requireRole.ts
import { FastifyRequest, FastifyReply } from 'fastify';

type Role = 'owner' | 'admin' | 'member' | 'viewer';
const ROLE_LEVEL: Record<Role, number> = { viewer: 1, member: 2, admin: 3, owner: 4 };

export function requireRole(minRole: Role) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const userLevel = ROLE_LEVEL[req.role as Role] ?? 0;
    const requiredLevel = ROLE_LEVEL[minRole];
    if (userLevel < requiredLevel) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }
  };
}
```

Use it on specific routes:

```typescript
// routes/member.routes.ts
app.post('/members/invite',
  { preHandler: requireRole('admin') },
  async (req) => memberService.invite(req.orgId, req.body)
);

app.delete('/org',
  { preHandler: requireRole('owner') },
  async (req) => orgService.delete(req.orgId)
);
```

Mutation routes (`POST`, `PUT`, `DELETE`) on customers/projects/resources/needs/assignments should require at least `member`. `GET` routes are available to `viewer` and above.

### Validation with Zod

```typescript
// schemas/customer.schema.ts
import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(100),
  status: z.enum(['realised', 'potential']).default('realised'),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
```

Routes call `.parse()` which throws on invalid input; the central error handler catches ZodErrors and returns `400 Bad Request` with field-level messages.

### Central Error Handler

```typescript
// plugins/errorHandler.ts
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { NotFoundError, ForbiddenError, UnauthorizedError } from '../utils/errors';

export default fp(async (app) => {
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Validation failed', issues: error.issues });
    }
    if (error instanceof NotFoundError) return reply.status(404).send({ error: error.message });
    if (error instanceof ForbiddenError) return reply.status(403).send({ error: error.message });
    if (error instanceof UnauthorizedError) return reply.status(401).send({ error: error.message });

    req.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  });
});
```

### The Assignment Upsert (tricky part)

The assignment endpoint is the one place where the business logic is non-trivial. Placing a resource on a need where they're already assigned should **update** the existing assignment's `monthAllocations`, not create a duplicate row. The `@@unique([needId, resourceId])` constraint enforces this at the DB level, but the service must handle both create and update paths and merge monthAllocations correctly.

```typescript
// services/assignment.service.ts
export const assignmentService = {
  async upsertMonth(orgId: string, input: { needId: string; resourceId: string; month: string; fte: number }) {
    // Verify need and resource belong to this org
    const need = await prisma.need.findFirst({ where: { id: input.needId, orgId } });
    const resource = await prisma.resource.findFirst({ where: { id: input.resourceId, orgId } });
    if (!need || !resource) throw new NotFoundError('Need or resource not found');

    const existing = await prisma.assignment.findUnique({
      where: { needId_resourceId: { needId: input.needId, resourceId: input.resourceId } },
    });

    if (existing) {
      // Merge: update single month in existing monthAllocations JSON
      const merged = { ...(existing.monthAllocations as Record<string, number>), [input.month]: input.fte };
      return prisma.assignment.update({
        where: { id: existing.id },
        data: { monthAllocations: merged },
      });
    }

    // Create new assignment with all months zeroed except the one being set
    const need2 = await prisma.need.findUnique({ where: { id: input.needId }, include: { project: true } });
    const months = monthRange(need.startMonth ?? need2!.project.startMonth, need.endMonth ?? need2!.project.endMonth);
    const monthAllocations: Record<string, number> = {};
    months.forEach(m => { monthAllocations[m] = 0; });
    monthAllocations[input.month] = input.fte;

    return prisma.assignment.create({
      data: {
        needId: input.needId,
        resourceId: input.resourceId,
        orgId,
        monthAllocations,
      },
    });
  },
};
```

### API Route Summary

```
# Auth (public)
POST   /api/auth/signup              # Create user + first org (returns JWT)
POST   /api/auth/login               # Returns JWT
GET    /api/auth/me                  # Current user + org + role (requires JWT)

# Orgs
GET    /api/orgs                     # List user's orgs (requires JWT)
POST   /api/orgs                     # Create new org (user becomes owner)
POST   /api/orgs/switch              # Switch active org → returns new JWT
PATCH  /api/org                      # Update current org (admin+)
DELETE /api/org                      # Delete current org (owner only)

# Members
GET    /api/members                  # List members of current org
POST   /api/members/invite           # Invite by email (admin+)
PATCH  /api/members/:id              # Update role (admin+)
DELETE /api/members/:id              # Remove from org (admin+)

# Invites
GET    /api/invites                  # List pending invites for current user
POST   /api/invites/:token/accept    # Accept invite

# Entities (all scoped to current org, all require member+)
GET    /api/customers
POST   /api/customers
PATCH  /api/customers/:id
DELETE /api/customers/:id

GET    /api/projects
GET    /api/projects?customerId=X
POST   /api/projects
PATCH  /api/projects/:id
DELETE /api/projects/:id

GET    /api/resources
POST   /api/resources                # Includes roles array
PATCH  /api/resources/:id
DELETE /api/resources/:id

GET    /api/needs
GET    /api/needs?projectId=X
POST   /api/needs
PATCH  /api/needs/:id
DELETE /api/needs/:id

GET    /api/assignments
POST   /api/assignments               # Upsert+merge: { needId, resourceId, (month|months[]|monthAllocations{}), fte }
PATCH  /api/assignments/:id
DELETE /api/assignments/:id

# Dashboard
GET    /api/dashboard/stats           # Aggregated KPIs for current org
GET    /api/dashboard/heatmap         # Per-resource utilization by month

# Integrations — Jira/Tempo (admin to configure; actuals reads are visibility-scoped)
GET/PUT /api/integration/jira         # Connection config (tokens never returned)
POST   /api/integration/jira/test | /refresh | /jira/accounts
POST   /api/integration/tempo/sync    # Pull Tempo worklogs → actual hours
GET    /api/integration/tempo/actuals[/monthly | /monthly-by-customer
        | /resource-by-customer | /customer-by-resource]
```

> This lists the **core** routes only. People-management & integration features add many more
> (`/people/:id/{logs,oneonones,career,followups,evaluations}`, `/customers/:id/{reviews,signals,activity}`,
> `/me/*`, `/log-categories`, `/roles`, …). The **routes directory is the source of truth**:
> `server/src/routes/*.routes.ts` (and the flat `api` object in `client/src/lib/api.js`).

### Tenant Isolation Tests (Critical)

Write dedicated tests in `__tests__/tenant-isolation.test.ts` that verify:

1. User A in Org 1 cannot see Org 2's customers (even with Org 2's customer ID)
2. User A in Org 1 cannot update Org 2's customer (should 404)
3. User A in Org 1 cannot delete Org 2's customer (should 404)
4. Creating a customer with an `orgId` in the body is **ignored** — always uses JWT orgId
5. Switching orgs returns a new JWT and the old one still only accesses the old org
6. A removed member can no longer access the org (auth plugin checks membership on every request)

These tests are the security boundary. They must pass before deploy.

---

## 4. Frontend Architecture

### ⚠️ CRITICAL: DO NOT BUILD A SINGLE APP.JSX FILE ⚠️

Build the frontend as a properly decomposed multi-file React project from day one. Do not start with a big file and plan to split it later — decompose it **as you build**.

**Rules for the production frontend:**
- ❌ **Do NOT** put all your code into `App.jsx`
- ❌ **Do NOT** put more than one component per file
- ❌ **Do NOT** let any single file exceed ~150 lines
- ❌ **Do NOT** inline sub-components as `function X()` inside another component
- ❌ **Do NOT** use inline `style={{}}` props — use Tailwind classes
- ✅ **DO** decompose into ~95 small files using the structure below
- ✅ **DO** extract any piece of JSX that's conceptually distinct into its own file
- ✅ **DO** use Context for shared state, not prop drilling
- ✅ **DO** put pure utilities in `lib/`, hooks in `hooks/`, components in `components/` or `features/`

If you find yourself writing a component longer than 150 lines, **stop and split it immediately.**

### Target Folder Structure

Every file listed below should exist as a separate file. This is not a suggestion — it's the required structure.

```
client/
├── src/
│   ├── main.jsx                      # Entry point, mounts App + providers
│   ├── App.jsx                       # Top-level routing + auth gate (~50 lines MAX)
│   ├── index.css                     # Tailwind imports + global styles
│   │
│   ├── lib/                          # Pure utilities, no React, no JSX
│   │   ├── api.js                    # API client (fetch wrapper)
│   │   ├── auth.js                   # Token storage, JWT helpers
│   │   ├── constants.js              # Theme tokens, DOMAINS, SENIORITIES, MONTHS
│   │   ├── dateUtils.js              # monthRange, formatMonth, currentMonth, addMonths
│   │   ├── resourceUtils.js          # getRoles, resourceMatchesNeed, resourcePrimaryDomain
│   │   ├── statusUtils.js            # isRealised, isPotential, utilColor, utilBg
│   │   ├── gridUtils.js              # buildSegments (for bar splitting), buildRows
│   │   └── ids.js                    # uid, initials helpers
│   │
│   ├── hooks/                        # Custom React hooks (one per file)
│   │   ├── useAuth.js                # Consumes AuthContext
│   │   ├── useOrg.js                 # Consumes OrgContext
│   │   ├── useData.js                # Consumes DataContext
│   │   ├── useComputed.js            # Memoized rU, nF, rURealised
│   │   ├── useBarResize.js           # Mouse-drag resize logic for assignment bars
│   │   ├── useHeldResource.js        # State for currently-selected resource
│   │   └── useTimeRange.js           # Time range + aggregation state
│   │
│   ├── contexts/                     # One context per file, each exports Provider + hook
│   │   ├── AuthContext.jsx           # User, token, login, logout, signup
│   │   ├── OrgContext.jsx            # Current org, user role, org list, switchOrg
│   │   └── DataContext.jsx           # All entities + all CRUD functions
│   │
│   ├── components/                   # Reusable, domain-unaware or lightly domain-aware
│   │   ├── ui/                       # Generic UI primitives
│   │   │   ├── Modal.jsx             # (~40 lines)
│   │   │   ├── Field.jsx             # Form field wrapper with label (~15 lines)
│   │   │   ├── Button.jsx            # Primary/secondary button variants (~25 lines)
│   │   │   ├── HoverButtons.jsx      # Edit/delete buttons shown on hover (~30 lines)
│   │   │   ├── StatusBadge.jsx       # "POTENTIAL" orange badge (~15 lines)
│   │   │   ├── StatusPicker.jsx      # Realised/Potential toggle (~25 lines)
│   │   │   ├── Avatar.jsx            # Circular avatar with initials (~20 lines)
│   │   │   ├── ProgressBar.jsx       # Thin utilization progress bar (~15 lines)
│   │   │   ├── EmptyState.jsx        # "No data" placeholder (~20 lines)
│   │   │   └── LoadingSpinner.jsx    # (~10 lines)
│   │   │
│   │   ├── badges/
│   │   │   └── RoleBadge.jsx         # Domain/Role/Seniority pill (~30 lines)
│   │   │
│   │   ├── forms/
│   │   │   ├── CustomerForm.jsx      # (~50 lines)
│   │   │   ├── ProjectForm.jsx       # (~70 lines)
│   │   │   ├── ResourceForm.jsx      # (~60 lines)
│   │   │   ├── NeedForm.jsx          # (~100 lines)
│   │   │   └── RolePicker.jsx        # Multi-row role selector used in ResourceForm (~60 lines)
│   │   │
│   │   └── popovers/
│   │       └── FtePopover.jsx        # FTE entry popup (~40 lines)
│   │
│   ├── features/                     # Feature-specific, can import from components/
│   │   ├── planner/
│   │   │   ├── PlannerView.jsx       # Top-level page, composes the below (~60 lines)
│   │   │   │
│   │   │   ├── pool/                 # Resource pool sub-folder
│   │   │   │   ├── ResourcePool.jsx         # Container (~50 lines)
│   │   │   │   ├── ResourcePoolHeader.jsx   # "Team" title + Add button (~25 lines)
│   │   │   │   ├── HeldResourceBanner.jsx   # Blue banner showing selected resource (~40 lines)
│   │   │   │   ├── ResourceFilters.jsx      # Domain/Role/Seniority pills (~50 lines)
│   │   │   │   ├── ResourceFilterRow.jsx    # One row of filter pills (~20 lines)
│   │   │   │   ├── ResourceList.jsx         # Filtered list (~30 lines)
│   │   │   │   └── ResourceCard.jsx         # Single resource chip (~80 lines)
│   │   │   │
│   │   │   ├── toolbar/
│   │   │   │   ├── PlannerToolbar.jsx       # Toolbar container (~40 lines)
│   │   │   │   ├── TimeRangePicker.jsx      # Two month inputs + arrow (~30 lines)
│   │   │   │   └── AggregationToggle.jsx    # M/Q/Y pill toggle (~25 lines)
│   │   │   │
│   │   │   └── grid/
│   │   │       ├── PlannerGrid.jsx          # Composes labels + grid columns (~80 lines)
│   │   │       ├── GridHeader.jsx           # Sticky month column headers row (~40 lines)
│   │   │       ├── GridHeaderCell.jsx       # Single month column header (~30 lines)
│   │   │       │
│   │   │       ├── labels/                  # Left-side labels (sticky)
│   │   │       │   ├── LabelColumn.jsx      # Container for all labels (~30 lines)
│   │   │       │   ├── CustomerLabel.jsx    # Customer row label (~40 lines)
│   │   │       │   ├── ProjectLabel.jsx     # Project row label (~50 lines)
│   │   │       │   ├── NeedLabel.jsx        # Need row label with role badge (~50 lines)
│   │   │       │   └── EmptyProjectLabel.jsx # "No needs" placeholder (~15 lines)
│   │   │       │
│   │   │       ├── rows/                    # Right-side grid rows
│   │   │       │   ├── GridBody.jsx         # Maps over rows, renders the right ones (~40 lines)
│   │   │       │   ├── CustomerGridRow.jsx  # Customer-level grid row (decorative) (~25 lines)
│   │   │       │   ├── ProjectGridRow.jsx   # Project-level grid row (decorative) (~25 lines)
│   │   │       │   └── NeedGridRow.jsx      # Need-level grid row with cells + bars (~80 lines)
│   │   │       │
│   │   │       ├── cells/
│   │   │       │   ├── NeedCell.jsx         # Single clickable cell with filled/needed text (~50 lines)
│   │   │       │   └── EmptyCell.jsx        # Non-interactive placeholder cell (~15 lines)
│   │   │       │
│   │   │       └── bars/
│   │   │           ├── AssignmentBar.jsx    # Container that handles segmentation (~60 lines)
│   │   │           ├── AssignmentSegment.jsx # One rounded capsule segment (~80 lines)
│   │   │           ├── BarAvatar.jsx        # Avatar circle on first segment (~15 lines)
│   │   │           └── ResizeHandle.jsx     # Drag edge for resize (~25 lines)
│   │   │
│   │   ├── dashboard/
│   │   │   ├── DashboardView.jsx            # Top-level page (~40 lines)
│   │   │   │
│   │   │   ├── stats/
│   │   │   │   ├── StatsCards.jsx           # Container for 4 KPI cards (~40 lines)
│   │   │   │   └── StatCard.jsx             # Single KPI card (~30 lines)
│   │   │   │
│   │   │   ├── tabs/
│   │   │   │   └── DashboardTabs.jsx        # Sub-tab switcher (~30 lines)
│   │   │   │
│   │   │   ├── clients/
│   │   │   │   ├── ClientHeatmap.jsx        # Full client heatmap view (~50 lines)
│   │   │   │   ├── ClientHeatmapHeader.jsx  # Table header row (~20 lines)
│   │   │   │   ├── CustomerHeatmapRow.jsx   # Customer row (clickable, collapsible) (~60 lines)
│   │   │   │   ├── ProjectHeatmapRow.jsx    # Project row under customer (~70 lines)
│   │   │   │   ├── HeatmapCell.jsx          # Percentage cell with color (~25 lines)
│   │   │   │   └── AssignedTeamChips.jsx    # Small team chips under project (~30 lines)
│   │   │   │
│   │   │   ├── resources/
│   │   │   │   ├── ResourceCapacity.jsx     # Container (~40 lines)
│   │   │   │   ├── DomainCards.jsx          # 3 domain summary cards (~30 lines)
│   │   │   │   ├── DomainCard.jsx           # Single domain card (~40 lines)
│   │   │   │   ├── ResourceHeatmap.jsx      # Resource capacity table (~50 lines)
│   │   │   │   ├── ResourceHeatmapRow.jsx   # Single resource row (clickable) (~60 lines)
│   │   │   │   └── ResourceUtilCell.jsx     # Cell showing realised % + potential overflow (~30 lines)
│   │   │   │
│   │   │   └── profile/
│   │   │       ├── ResourceProfile.jsx      # Modal container (~50 lines)
│   │   │       ├── ProfileHeader.jsx        # Avatar + name + roles (~30 lines)
│   │   │       ├── ProfileUtilization.jsx   # Monthly util bars (~40 lines)
│   │   │       ├── ProfileAssignments.jsx   # Grouped assignments list (~40 lines)
│   │   │       ├── ProfileCustomerGroup.jsx # Customer group in assignments (~30 lines)
│   │   │       ├── ProfileProjectGroup.jsx  # Project group with engagement range (~50 lines)
│   │   │       └── ProfileAssignmentItem.jsx # Single assignment line (~40 lines)
│   │   │
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx                # (~70 lines)
│   │   │   ├── SignupPage.jsx               # (~90 lines — user + org creation)
│   │   │   └── ProtectedRoute.jsx           # (~20 lines)
│   │   │
│   │   └── settings/
│   │       ├── SettingsView.jsx             # Settings layout with sub-routes (~40 lines)
│   │       ├── OrgSettings.jsx              # Org name, delete org (~50 lines)
│   │       ├── MembersList.jsx              # Table of current members (~60 lines)
│   │       ├── MemberRow.jsx                # Single member row with role dropdown (~50 lines)
│   │       ├── InviteMember.jsx             # Invite form (~50 lines)
│   │       └── InviteList.jsx               # Pending invites (~40 lines)
│   │
│   └── layouts/
│       ├── AppLayout.jsx                    # Header + Outlet for routes (~30 lines)
│       ├── Header.jsx                       # Top bar container (~40 lines)
│       ├── HeaderLogo.jsx                   # Logo + app name (~20 lines)
│       ├── HeaderTabs.jsx                   # Planner/Dashboard tabs (~30 lines)
│       ├── OrgSwitcher.jsx                  # Dropdown to switch orgs (~50 lines)
│       └── UserMenu.jsx                     # User avatar + logout dropdown (~40 lines)
│
├── public/
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

**Total: ~95 component files + ~10 utility files.** Yes, this is intentional. Small focused files are easier to read, test, and maintain than one gigantic file.

### Why This Many Files?

A naive implementation of the planner grid would inline all of these concerns into one massive component:
- Customer label logic
- Project label logic  
- Need label logic
- Customer grid row logic
- Project grid row logic
- Need grid row logic with cells AND bars
- Bar segmentation logic
- Resize handles

**Each of these is a separate concern.** Each should be its own file that can be:
- Read in one screen without scrolling
- Modified without fear of breaking unrelated things
- Tested in isolation
- Reused if needed

Resist the temptation to "just get it working first and split it later." Splitting later never happens, and even if it did, the cognitive cost of reasoning about a 1000-line component while building it is far higher than the cost of creating files as you go.

### Architectural Principles

**1. Separation of concerns**
- `lib/` = pure JS, no React, easily testable
- `hooks/` = React state and effects, no JSX
- `components/ui/` = generic, reusable primitives that know nothing about the domain
- `components/forms/` and `popovers/` = domain-aware but reusable
- `features/` = pages and feature-specific components, can use anything

**2. State management**
- Use **React Context** for global state (Auth, Org, Data)
- Don't reach for Redux/Zustand unless complexity demands it — Context is fine for this app
- Each context provider lives in its own file with both the provider component and the consumer hook

**3. Data flow**
- `DataContext` provides `customers`, `projects`, `resources`, `needs`, `assignments` arrays
- `DataContext` also exposes CRUD functions: `addCustomer`, `updateCustomer`, `deleteCustomer`, etc.
- All CRUD functions call the API (`api.js`) and update local state on success
- Computed values (`rU`, `nF`, `rURealised`) live in `useComputed` hook, return memoized objects
- Components consume via `const { customers, addCustomer } = useData();`

**4. Component sizing**
- No component should exceed ~150 lines
- If a component is doing 3+ things, split it into sub-components
- Pass data down via props, lift state up only when needed

**5. File naming**
- Components: `PascalCase.jsx`
- Hooks: `useThing.js` (camelCase, prefixed with `use`)
- Utilities: `camelCase.js`
- One default export per file, named exports for sub-utilities

### Tailwind CSS Setup

Use Tailwind classes for all styling. Do not use inline `style={{}}` props except for truly dynamic values (e.g., computed `left` positions for absolutely-positioned bars).

```bash
cd client
npm install -D tailwindcss@latest postcss autoprefixer
npx tailwindcss init -p
```

`tailwind.config.js`:
```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#4CBAD4', light: '#E0F4FA', bg: '#EFF6FA' },
        success: { DEFAULT: '#5BC68A', bg: '#EAFAF0', border: '#C3EEDA' },
        warning: { DEFAULT: '#F5A623', bg: '#FFF6E8' },
        danger:  { DEFAULT: '#E8636F', bg: '#FDE8EA' },
        text: { DEFAULT: '#2C3E50', mid: '#6B8A9E', light: '#A0BCC9' },
        border: { DEFAULT: '#D8E8EF', light: '#E8F0F5' },
      },
      fontFamily: {
        sans: ["'DM Sans'", 'sans-serif'],
        mono: ["'DM Mono'", 'monospace'],
      },
      boxShadow: {
        card: '0 2px 8px rgba(76,186,212,0.08)',
      },
    },
  },
};
```

`src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

body { font-family: 'DM Sans', sans-serif; }

@layer components {
  .btn-primary {
    @apply px-5 py-2 bg-primary text-white rounded-full font-bold text-xs cursor-pointer shadow-card hover:opacity-90 transition;
  }
  .btn-secondary {
    @apply px-5 py-2 bg-white text-text-mid border border-border rounded-full font-semibold text-xs cursor-pointer hover:bg-primary-bg transition;
  }
}
```

Example component using Tailwind:
```jsx
<div className="bg-white border border-border rounded-xl p-5">
  {children}
</div>
```

### Example: Decomposed Components

**`src/lib/constants.js`** (pure constants):
```js
export const DOMAINS = {
  Data:    { color: '#3B82F6', bg: '#EBF2FF', roles: ['FE', 'BE', 'PM'] },
  Web:     { color: '#F97316', bg: '#FFF3E8', roles: ['FE', 'BE', 'PM'] },
  General: { color: '#8B5CF6', bg: '#F1ECFE', roles: ['Agent', 'DevOps', 'Sales', 'AI Engineer', 'Consultant', 'PM'] },
};
export const SENIORITIES = ['Junior', 'Medior', 'Senior', 'Senior Principal'];
export const SENIORITY_SHORT = { Junior: 'Jr', Medior: 'Mid', Senior: 'Sr', 'Senior Principal': 'SP' };
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const ACCENT_COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
export const CW = 82;  // Column width
export const LW = 270; // Label width
export const BH = 28;  // Bar height
export const RH = 42;  // Row height
```

**`src/lib/dateUtils.js`**:
```js
import { MONTHS } from './constants';

export function monthRange(start, end) {
  if (!start || !end) return [];
  const out = [];
  const cur = new Date(start + '-01');
  const endDate = new Date(end + '-01');
  while (cur <= endDate) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

export function formatMonth(m) {
  if (!m) return '?';
  const [y, mo] = m.split('-');
  return `${MONTHS[parseInt(mo) - 1]} '${y.slice(2)}`;
}

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(m, n) {
  const d = new Date(m + '-01');
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
```

**`src/components/ui/Modal.jsx`**:
```jsx
export default function Modal({ title, onClose, wide, children }) {
  return (
    <div
      className="fixed inset-0 bg-text/25 backdrop-blur-sm flex items-center justify-center z-[2000]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-2xl p-7 max-h-[85vh] overflow-y-auto shadow-2xl border border-border ${wide ? 'min-w-[560px] max-w-[700px]' : 'min-w-[380px] max-w-[480px]'}`}
      >
        <div className="flex justify-between mb-5">
          <h3 className="m-0 text-lg font-bold text-text">{title}</h3>
          <button
            onClick={onClose}
            className="bg-primary-light border-0 w-7 h-7 rounded-lg text-primary text-sm cursor-pointer flex items-center justify-center"
          >×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

**`src/contexts/DataContext.jsx`**:
```jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useOrg } from './OrgContext';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { currentOrg } = useOrg();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [resources, setResources] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [assignments, setAssignments] = useState([]);

  // Reload when org changes
  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    Promise.all([
      api.getCustomers(),
      api.getProjects(),
      api.getResources(),
      api.getNeeds(),
      api.getAssignments(),
    ]).then(([c, p, r, n, a]) => {
      setCustomers(c);
      setProjects(p);
      setResources(r);
      setNeeds(n);
      setAssignments(a);
      setLoading(false);
    });
  }, [currentOrg]);

  // CRUD functions
  const addCustomer = useCallback(async (data) => {
    const created = await api.createCustomer(data);
    setCustomers((prev) => [...prev, created]);
    return created;
  }, []);

  const updateCustomer = useCallback(async (id, data) => {
    const updated = await api.updateCustomer(id, data);
    setCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  }, []);

  const deleteCustomer = useCallback(async (id) => {
    await api.deleteCustomer(id);
    // Cascade locally
    const projIds = projects.filter((p) => p.customerId === id).map((p) => p.id);
    const needIds = needs.filter((n) => projIds.includes(n.projectId)).map((n) => n.id);
    setAssignments((prev) => prev.filter((a) => !needIds.includes(a.needId)));
    setNeeds((prev) => prev.filter((n) => !projIds.includes(n.projectId)));
    setProjects((prev) => prev.filter((p) => p.customerId !== id));
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }, [projects, needs]);

  // ...similar for projects, resources, needs, assignments

  const value = {
    loading,
    customers, projects, resources, needs, assignments,
    addCustomer, updateCustomer, deleteCustomer,
    // ...all other CRUD functions
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
```

**`src/features/planner/PlannerView.jsx`** — top-level page, just composes:
```jsx
import { useState } from 'react';
import ResourcePool from './ResourcePool';
import PlannerToolbar from './PlannerToolbar';
import PlannerGrid from './PlannerGrid';
import FtePopover from '../../components/popovers/FtePopover';
import { useData } from '../../contexts/DataContext';

export default function PlannerView() {
  const { customers } = useData();
  const [heldResource, setHeldResource] = useState(null);
  const [popover, setPopover] = useState(null);
  const [timeRange, setTimeRange] = useState({ start: currentMonth(), end: addMonths(currentMonth(), 11) });
  const [aggregation, setAggregation] = useState('month');

  return (
    <div className="flex h-[calc(100vh-52px)] bg-[#FAFBFD]">
      <ResourcePool
        heldResource={heldResource}
        onHold={setHeldResource}
      />
      <div className="flex-1 overflow-auto" onClick={() => setPopover(null)}>
        <PlannerToolbar
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          aggregation={aggregation}
          onAggregationChange={setAggregation}
        />
        {customers.length === 0 ? (
          <EmptyState />
        ) : (
          <PlannerGrid
            heldResource={heldResource}
            timeRange={timeRange}
            aggregation={aggregation}
            onOpenPopover={setPopover}
          />
        )}
      </div>
      {popover && <FtePopover {...popover} onClose={() => setPopover(null)} />}
    </div>
  );
}
```

### Routing

Use **React Router v6**:

```bash
cd client
npm install react-router-dom
```

**`src/App.jsx`**:
```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { OrgProvider } from './contexts/OrgContext';
import { DataProvider } from './contexts/DataContext';
import ProtectedRoute from './features/auth/ProtectedRoute';
import LoginPage from './features/auth/LoginPage';
import SignupPage from './features/auth/SignupPage';
import AppLayout from './layouts/AppLayout';
import PlannerView from './features/planner/PlannerView';
import DashboardView from './features/dashboard/DashboardView';
import SettingsView from './features/settings/SettingsView';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route element={<ProtectedRoute><OrgProvider><DataProvider><AppLayout /></DataProvider></OrgProvider></ProtectedRoute>}>
            <Route path="/" element={<Navigate to="/planner" replace />} />
            <Route path="/planner" element={<PlannerView />} />
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/settings/*" element={<SettingsView />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

### Build Order (Bottom-Up)

Build the frontend from the leaves up — pure utilities first, then primitives, then compose larger features from them:

1. **Constants & utilities** → `lib/constants.js`, `lib/dateUtils.js`, `lib/resourceUtils.js`, `lib/statusUtils.js`, `lib/gridUtils.js`, `lib/ids.js`
2. **API client** → `lib/api.js`
3. **Contexts** → `AuthContext`, `OrgContext`, `DataContext` (each in its own file with provider + hook)
4. **UI primitives** → `Modal`, `Field`, `Button`, `HoverButtons`, `StatusBadge`, `StatusPicker`, `Avatar`, `ProgressBar`, `EmptyState`, `LoadingSpinner`, `RoleBadge`
5. **Forms & popovers** → `CustomerForm`, `ProjectForm`, `ResourceForm`, `NeedForm`, `RolePicker`, `FtePopover`
6. **Planner pieces** (leaves first) → `ResizeHandle`, `BarAvatar`, `AssignmentSegment`, `AssignmentBar`, `EmptyCell`, `NeedCell`, then row components, then label components, then `PlannerGrid`, then `ResourcePool`, then `PlannerView`
7. **Dashboard pieces** → `StatCard`, `StatsCards`, `HeatmapCell`, `AssignedTeamChips`, `ProjectHeatmapRow`, `CustomerHeatmapRow`, `ClientHeatmap`, `DomainCard`, `DomainCards`, `ResourceUtilCell`, `ResourceHeatmapRow`, `ResourceHeatmap`, `ProfileAssignmentItem`, `ProfileProjectGroup`, `ProfileCustomerGroup`, `ProfileAssignments`, `ProfileUtilization`, `ProfileHeader`, `ResourceProfile`, `DashboardView`
8. **Layout & routing** → `Header` and its pieces, `AppLayout`, `App.jsx` with React Router

**Rule of thumb:** A new component should be created whenever:
- A piece of JSX is used in 2+ places
- A piece of JSX has its own state/effects
- A piece of JSX is conceptually distinct (e.g. "the toolbar" vs "the grid")
- The parent component would exceed 150 lines

### Storage Layer

Create `client/src/api.js`:

```javascript
const API = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('databob_token');
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + getToken(),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Customers
  getCustomers: () => apiFetch('/customers'),
  createCustomer: (data) => apiFetch('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id, data) => apiFetch('/customers/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id) => apiFetch('/customers/' + id, { method: 'DELETE' }),

  // Projects
  getProjects: () => apiFetch('/projects'),
  createProject: (data) => apiFetch('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id, data) => apiFetch('/projects/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id) => apiFetch('/projects/' + id, { method: 'DELETE' }),

  // Resources
  getResources: () => apiFetch('/resources'),
  createResource: (data) => apiFetch('/resources', { method: 'POST', body: JSON.stringify(data) }),
  updateResource: (id, data) => apiFetch('/resources/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  deleteResource: (id) => apiFetch('/resources/' + id, { method: 'DELETE' }),

  // Needs
  getNeeds: () => apiFetch('/needs'),
  createNeed: (data) => apiFetch('/needs', { method: 'POST', body: JSON.stringify(data) }),
  updateNeed: (id, data) => apiFetch('/needs/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNeed: (id) => apiFetch('/needs/' + id, { method: 'DELETE' }),

  // Assignments
  getAssignments: () => apiFetch('/assignments'),
  upsertAssignment: (data) => apiFetch('/assignments', { method: 'POST', body: JSON.stringify(data) }),
  updateAssignment: (id, data) => apiFetch('/assignments/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAssignment: (id) => apiFetch('/assignments/' + id, { method: 'DELETE' }),

  // Auth
  login: (email, password) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signup: (data) => apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
};
```

### Modify App.jsx data loading:

Replace the `useEffect` load block:

```jsx
// OLD (window.storage):
// useEffect(function() {
//   (async function() {
//     var c = await ldS("db-customers", []);
//     ...
//   })();
// }, []);

// NEW (API):
useEffect(function() {
  (async function() {
    try {
      var [c, p, r, n, a] = await Promise.all([
        api.getCustomers(),
        api.getProjects(),
        api.getResources(),
        api.getNeeds(),
        api.getAssignments(),
      ]);
      setCusts(c);
      setProjs(p);
      setRess(r);
      setNeeds(n);
      setAsgns(a);
    } catch (e) {
      console.error('Load failed:', e);
    }
    setOk(true);
  })();
}, []);
```

Replace the save `useEffect` blocks — remove them entirely. Instead, modify each CRUD function to call the API and update local state on success:

```jsx
// OLD:
// function addCust(d) { setCusts(function(p) { return p.concat([{ id: uid(), ...d }]); }); }

// NEW:
async function addCust(d) {
  var created = await api.createCustomer(d);
  setCusts(function(p) { return p.concat([created]); });
}

async function updCust(id, d) {
  var updated = await api.updateCustomer(id, d);
  setCusts(function(p) { return p.map(function(c) { return c.id === id ? updated : c; }); });
}

async function delCust(id) {
  if (!confirm("Delete?")) return;
  await api.deleteCustomer(id);
  setCusts(function(c) { return c.filter(function(x) { return x.id !== id; }); });
  // Also remove from local state
  var pIds = projs.filter(function(p) { return p.customerId === id; }).map(function(p) { return p.id; });
  setProjs(function(p) { return p.filter(function(x) { return x.customerId !== id; }); });
  setNeeds(function(n) { return n.filter(function(x) { return pIds.indexOf(x.projectId) < 0; }); });
  // assignments cascade on server
  setAsgns(function(a) { return a.filter(function(x) {
    return !needs.some(function(n) { return n.projectId && pIds.indexOf(n.projectId) >= 0 && n.id === x.needId; });
  }); });
}
```

Do the same pattern for projects, resources, needs, assignments.

For assignments specifically, the `doPlace` function should use upsert:

```jsx
async function doPlace(fte) {
  if (!pop || pop.type !== "place" || !held) { setPop(null); return; }
  var result = await api.upsertAssignment({
    needId: pop.needId,
    resourceId: held,
    month: pop.mo,
    fte: Math.round(fte * 10) / 10,
  });
  // Reload assignments or update local state
  var newAsgns = await api.getAssignments();
  setAsgns(newAsgns);
  setPop(null);
}
```

---

## 5. Multi-Tenant Features

### Organization Switcher

Add an org switcher in the header. Users can belong to multiple orgs (e.g., a freelancer working with multiple consultancies).

```jsx
// In header, after logo
{currentOrg && (
  <select value={currentOrg.id} onChange={switchOrg} style={...}>
    {userOrgs.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
  </select>
)}
```

When switching org, re-fetch all data from the API with the new org context.

### Invite Members

Add a Settings page where org owners/admins can:
- Invite users by email
- Set roles (admin, member, viewer)
- Remove members
- Viewers get read-only access (no edit/delete buttons)

### Role-Based Access

```
owner  → full access + billing + delete org
admin  → full CRUD + invite/remove members
member → full CRUD
viewer → read-only (no create/edit/delete buttons)
```

In the frontend, wrap mutation buttons:

```jsx
var canEdit = currentMember.role !== 'viewer';

{canEdit && <button onClick={...}>+ Customer</button>}
{canEdit && <HoverBtns onEdit={...} onDelete={...} />}
```

---

## 6. Deployment (Railway)

### Dockerfile (root):

```dockerfile
# Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# Build backend
FROM node:20-alpine AS backend-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ .
RUN npx prisma generate
RUN npx tsx --tsconfig tsconfig.json src/index.ts || true

# Production
FROM node:20-alpine
WORKDIR /app

COPY server/package*.json ./
RUN npm ci --production
COPY server/ .
RUN npx prisma generate
COPY --from=frontend-build /app/client/dist ./public

EXPOSE 3000
CMD ["npx", "tsx", "src/index.ts"]
```

### railway.toml:

```toml
[build]
builder = "dockerfile"

[deploy]
healthcheckPath = "/api/health"
restartPolicyType = "on_failure"
```

### Railway Setup:

1. Create a new project on railway.com
2. Add a PostgreSQL database service (Railway provides this built-in)
3. Add your app service (from GitHub repo)
4. Set environment variables:
   - `DATABASE_URL` → auto-linked from Postgres service
   - `JWT_SECRET` → generate a random 64-char string
   - `CORS_ORIGIN` → your frontend URL (or `*` for dev)
   - `PORT` → 3000
5. Deploy — Railway auto-builds from Dockerfile
6. Generate domain under Settings → Networking

### Server serves frontend:

In `server/src/index.ts`, serve the built React app as static files:

```typescript
import path from 'path';
import fastifyStatic from '@fastify/static';

// Serve React build
app.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'public'),
  prefix: '/',
});

// SPA fallback — serve index.html for non-API routes
app.setNotFoundHandler(async (request, reply) => {
  if (request.url.startsWith('/api/')) {
    return reply.status(404).send({ error: 'Not found' });
  }
  return reply.sendFile('index.html');
});
```

---

## 7. Reference: Current App Features

The following features must be implemented (full details in `UI-SPEC.md`):

### Planner Tab
- **Resource pool** (left sidebar): 3-layer filter (Domain → Role → Seniority), click to select, capacity display with progress bars
- **Timeline grid**: sticky month headers, M/Q/Y aggregation toggle, time range pickers
- **Row hierarchy**: Customer → Project → Need → (empty project placeholder)
- **Click-to-place**: select resource → click grid cell → FTE popover → set allocation
- **Same resource, same need**: updates existing assignment (no duplicates), different FTE per month shown as connected segmented bars
- **Segmented bars**: rounded capsule shape, avatar circles, FTE badge per segment. A break in a person's allocation (a month someone else covers) renders as a **real gap between two pills**, never a bridged bar (`buildSegments`).
- **Per-segment resize**: every free edge has its own handle (outer ends, the start of a post-gap segment, **and** an off-window/clipped edge). Dragging previews live with an "N mo" badge and operates on the full segment (incl. off-screen months).
- **Green cascade**: filled cells → filled needs → filled projects → filled customers → filled columns
- **Status field**: "realised" / "potential" on customers, projects, needs — potential shown with orange badges, reduced opacity
- **FTE popover**: number input with max cap, Enter to confirm, Escape to cancel

### Dashboard Tab (home `/` + Insights `/dashboard`)
- **Home stats cards**: Active Projects, "Actual vs potential" (or Realised Utilization fallback), Unfilled Slots, By-domain donut
- **Utilization chart**: planned · actual · potential lines over the year. The **actual** line counts only Jira-**matched** people (`externalWorkId`) over matched capacity.
- **"Your people" rail**: people you manage, falling back to the org's people for admins who manage no one
- **Insights sub-tabs**: Client Overview | People Capacity | Free Capacity — the Client-Staffing and People-Capacity heatmaps render **bullet cells** (plan track + target tick, logged-hours fill, `act/plan` label, tooltip with Δ; red tick = understaffed/over-capacity, amber fill = unplanned work, grey = month in progress); Free Capacity stays plan-only (it looks forward)
- **Resource profile modal**: avatar, roles, monthly utilization bars, assigned-to list grouped by customer/project with engagement time ranges
- **Color thresholds**: ≥80% green, 50-79% orange, <50% red

### People, customers & cockpits
- **People**: list + per-person detail (overview, allocation, skills, activity journal, **1:1s**, performance/evaluations). Admins can delete a person from the edit dialog.
- **1:1 cockpit** & **PM review cockpit**: both lead with a **general** recap; per-project (1:1) / per-person (PM) cards are **greyed until clicked**, and clicking one **focuses** it and filters the right-hand context (recent entries, signals, planned-vs-actual chart) to that customer / person.
- **Evaluations**: `draft → submitted → finalized` with snapshotted categories; whole-customer (`resourceId: null`) review entries roll into everyone on the customer.

### Integrations & actual hours (Settings → Integrations)
- Connect Jira/Tempo (encrypted tokens), map Jira projects/epics → customers/projects, and **match people** (`Resource.externalWorkId` = Jira accountId).
- Sync pulls Tempo worklogs → `Worklog` rows (idempotent by `tempoWorklogId`), aggregated into monthly **actual hours** per person/customer/project.
- Actual hours feed the **planned-vs-actual** charts (cockpits + dashboard). Endpoints: `GET /integration/tempo/actuals[/monthly | /monthly-by-customer | /resource-by-customer | /customer-by-resource]` (all visibility-scoped). FTE→hours via `MONTHLY_HOURS_PER_FTE`.

### Design Language
- Primary color: `#4CBAD4` (sky blue)
- Background: `#EFF6FA` / `#FAFBFD`
- Cards: white with `#D8E8EF` borders
- Green: `#5BC68A`, Orange: `#F5A623`, Red: `#E8636F`
- Typography: DM Sans (UI), DM Mono (numbers/data)
- Rounded pill buttons (border-radius 20px), capsule bars (border-radius 14px)
- Hover-reveal edit/delete buttons
- "Today" badge on current month column

### Data Model
```
Organization (tenant boundary)
  └── Customer (name, status, responsibleUserId?)
        └── Project (name, startMonth, endMonth, status, responsibleUserId?)
              └── Need (domain, role, seniority, label, startMonth, endMonth, monthAllocations{}, status)
                    └── Assignment (resourceId, monthAllocations{})   // @@unique([needId, resourceId])
  └── Resource (name, capacity, roles[{domain, role, seniority}], userId?, externalWorkId?)
  └── (people-mgmt) OneOnOne, Log, FollowUp, CareerEntry, ClientSignal, CustomerReview,
        Evaluation (+ category snapshots), Role/permission matrix, Invite
  └── (integrations) JiraConnection (encrypted tokens), JiraAccount, JiraWorkItem, Worklog
```
`Resource.externalWorkId` = Jira accountId (set when "matched"); `Resource.userId` = optional login link. Per-month FTE in `monthAllocations` is keyed by `"YYYY-MM"`. Full schema: `server/prisma/schema.prisma`; conventions in `CLAUDE.md`.

### Role System
| Domain  | Roles |
|---------|-------|
| Data    | FE, BE, PM |
| Web     | FE, BE, PM |
| General | Agent, DevOps, Sales, AI Engineer, Consultant, PM |

Seniorities: Junior, Medior, Senior, Senior Principal

---

## 8. Order of Implementation

Follow this order when building with Claude Code:

### Phase 1: Foundation
1. **Set up project structure** — monorepo with `client/` (Vite + React + Tailwind + React Router) and `server/` (Fastify + Prisma + TypeScript)
2. **Configure Tailwind** — `tailwind.config.js` with the design tokens, `index.css` with `@tailwind` imports and custom component classes
3. **Database schema** — Prisma schema with multi-tenant `orgId` on every entity, run migrations
4. **Backend auth** — Signup/login routes, JWT generation, auth middleware that injects `userId` and `orgId`
5. **Backend CRUD** — One route file per entity (`customers.ts`, `projects.ts`, etc.), every query filtered by `orgId`

### Phase 2: Frontend Foundation
6. **`lib/` files** — Pure utilities: `constants.js`, `dateUtils.js`, `resourceUtils.js`, `statusUtils.js`, `gridUtils.js`, `ids.js`
7. **`lib/api.js`** — Fetch wrapper with auth header injection, methods for every API endpoint
8. **Auth context** — `AuthContext.jsx` with login/logout/signup, token storage, current user
9. **Auth pages** — `LoginPage.jsx`, `SignupPage.jsx`, `ProtectedRoute.jsx`
10. **Routing** — `App.jsx` with React Router, protected routes wrapping the app shell
11. **Layout** — `AppLayout.jsx` with `Header.jsx` (logo, tabs, org switcher, user menu)

### Phase 3: Data Layer
12. **`OrgContext`** — Current org, user's role in that org, list of orgs they belong to, switcher function
13. **`DataContext`** — All entity arrays + CRUD functions that call the API and update local state
14. **`useComputed` hook** — Memoized `rU`, `nF`, `rURealised` derived from context data

### Phase 4: UI Primitives
15. **`components/ui/`** — Build the small reusable pieces first: `Modal`, `Field`, `Button`, `HoverButtons`, `Avatar`, `StatusBadge`, `StatusPicker`
16. **`components/badges/RoleBadge.jsx`** — Domain/Role/Seniority badge
17. **`components/forms/`** — `CustomerForm`, `ProjectForm`, `ResourceForm` (with `RolePicker`), `NeedForm`
18. **`components/popovers/FtePopover.jsx`** — The FTE entry popup

### Phase 5: Planner (most complex — take your time)
19. **Pool sub-folder** — `ResourcePool`, `ResourcePoolHeader`, `HeldResourceBanner`, `ResourceFilters`, `ResourceFilterRow`, `ResourceList`, `ResourceCard`
20. **Toolbar sub-folder** — `PlannerToolbar`, `TimeRangePicker`, `AggregationToggle`
21. **Grid utilities** — `lib/gridUtils.js` with `buildRows()` (flattening customer→project→need tree) and `buildSegments()` (splitting bars by FTE change)
22. **Grid header** — `GridHeader`, `GridHeaderCell` (with Today badge logic)
23. **Grid labels** — `LabelColumn`, `CustomerLabel`, `ProjectLabel`, `NeedLabel`, `EmptyProjectLabel`
24. **Grid body rows** — `GridBody`, `CustomerGridRow`, `ProjectGridRow`, `NeedGridRow`
25. **Grid cells** — `NeedCell`, `EmptyCell`
26. **Assignment bars** — `AssignmentBar` (orchestrator), `AssignmentSegment` (single capsule), `BarAvatar`, `ResizeHandle`
27. **`useBarResize` hook** — Extract the mousemove/mouseup resize logic
28. **`PlannerGrid.jsx`** — Compose labels + grid columns with sticky positioning
29. **`PlannerView.jsx`** — Top-level, wires everything together

### Phase 6: Dashboard
30. **Stats** — `StatsCards` + `StatCard`
31. **Tabs** — `DashboardTabs`
32. **Client heatmap** — `ClientHeatmap`, `ClientHeatmapHeader`, `CustomerHeatmapRow` (with collapse state), `ProjectHeatmapRow`, `HeatmapCell`, `AssignedTeamChips`
33. **Resource capacity** — `ResourceCapacity`, `DomainCards`, `DomainCard`, `ResourceHeatmap`, `ResourceHeatmapRow`, `ResourceUtilCell`
34. **Resource profile modal** — `ResourceProfile`, `ProfileHeader`, `ProfileUtilization`, `ProfileAssignments`, `ProfileCustomerGroup`, `ProfileProjectGroup`, `ProfileAssignmentItem`
35. **`DashboardView.jsx`** — Top-level composition

### Phase 7: Multi-Tenant
36. **Header pieces** — `HeaderLogo`, `HeaderTabs`, `OrgSwitcher`, `UserMenu`
37. **`features/settings/`** — `SettingsView`, `OrgSettings`, `MembersList`, `MemberRow`, `InviteMember`, `InviteList`
38. **Role-based UI** — Pass `canEdit` down from context, hide mutation buttons for viewers
39. **Backend invite flow** — Email invite endpoint, accept link, join org

### Phase 8: Production
40. **Test locally** — `docker-compose up` (Postgres + server + client dev with Vite proxy)
41. **Dockerfile** — Multi-stage build (frontend → backend → production image)
42. **Deploy to Railway** — Add Postgres service, link `DATABASE_URL`, set `JWT_SECRET`, deploy
43. **Generate domain** — Railway Settings → Networking → Generate Domain
44. **Polish** — Loading skeletons, error toasts, optimistic updates, keyboard shortcuts

---

## 9. Important Notes

- **The source of truth for visual design and behavior is `UI-SPEC.md`.** Read that document, not any implementation file. The spec contains all colors, spacing, layouts, and interactions you need.
- **Do not use the existing `databob-resource-manager.jsx` file as a reference.** See the warning at the top of this document for why.
- **Use Tailwind classes for styling.** Avoid inline `style={{}}` props except for truly dynamic values like computed bar positions.
- **Use modern JavaScript.** Arrow functions, destructuring, optional chaining, `async/await` — all welcome.
- **Every database query MUST filter by orgId.** This is the security boundary. Never expose data across tenants.
- **Assignments use upsert** — when placing a resource on a need where they're already assigned, update the existing assignment rather than creating a new one. The backend handles this via `@@unique([needId, resourceId])`.
- **monthAllocations is a JSON column** — stored as `{ "2026-01": 0.5, "2026-02": 0.8 }`. The frontend sends partial updates (single month), the backend merges them.
- **Status field** affects dashboard calculations — "potential" items are excluded from realised utilization stats but still shown in the UI with orange styling.
- **No component over 150 lines.** If you find yourself writing a component that long, stop and split it.
- **One default export per file.** Use named exports for sub-utilities only.

