# databob Resource Manager — UI/UX Specification

This document describes the visual design and behavior of the databob Resource Manager. Use this as the source of truth when building the frontend. **Do not refer to any existing implementation** — build from this spec.

---

## Design System

### Colors

| Token              | Hex        | Usage |
|--------------------|------------|-------|
| `primary`          | `#4CBAD4`  | Brand color, primary buttons, active states |
| `primary-light`    | `#E0F4FA`  | Hover backgrounds, subtle highlights |
| `primary-bg`       | `#EFF6FA`  | Page background |
| `success`          | `#5BC68A`  | Green — fully staffed, ≥80% utilization |
| `success-bg`       | `#EAFAF0`  | Green backgrounds |
| `success-border`   | `#C3EEDA`  | Green borders |
| `warning`          | `#F5A623`  | Orange — potential status, 50–79% utilization |
| `warning-bg`       | `#FFF6E8`  | Orange backgrounds |
| `danger`           | `#E8636F`  | Red — overallocation, <50% utilization |
| `danger-bg`        | `#FDE8EA`  | Red backgrounds |
| `text`             | `#2C3E50`  | Primary text |
| `text-mid`         | `#6B8A9E`  | Secondary text |
| `text-light`       | `#A0BCC9`  | Tertiary text, placeholders |
| `border`           | `#D8E8EF`  | Card borders |
| `border-light`     | `#E8F0F5`  | Subtle dividers |

### Domain Colors (for role categorization)

| Domain  | Color     | Background | Roles |
|---------|-----------|------------|-------|
| Data    | `#3B82F6` | `#EBF2FF`  | FE, BE, PM |
| Web     | `#F97316` | `#FFF3E8`  | FE, BE, PM |
| General | `#8B5CF6` | `#F1ECFE`  | Agent, DevOps, Sales, AI Engineer, Consultant, PM |

### Accent Colors (used to tint different customers so they're visually distinct)

Cycle through: `#6366f1`, `#0ea5e9`, `#10b981`, `#f59e0b`, `#ef4444`, `#8b5cf6`, `#ec4899`. The Nth customer gets the Nth color (mod length).

### Typography

- **UI font:** `DM Sans` (Google Fonts), weights 400/500/600/700/800
- **Data/numbers font:** `DM Mono` (Google Fonts), weights 400/500
- Use DM Mono for anything numerical: percentages, FTE values, month labels, dates

### Spacing & Radii

- Card border radius: `12px`
- Small radius (buttons, inputs, pills): `8px`
- Pill/capsule radius: `20px` for buttons, `14px` for outer corners of assignment bars
- Card shadow: `0 2px 8px rgba(76, 186, 212, 0.08)`

### Constants

- Column width in planner grid: `82px`
- Left label column width: `270px`
- Assignment bar height: `28px`
- Row height (needs): `42px` minimum

---

## Data Model

```
Organization (tenant boundary)
├── Customer
│   ├── name: string
│   ├── status: "realised" | "potential"
│   └── Project[]
│       ├── name: string
│       ├── startMonth: "YYYY-MM"
│       ├── endMonth: "YYYY-MM"
│       ├── status: "realised" | "potential"
│       └── Need[]
│           ├── domain: "Data" | "Web" | "General"
│           ├── role: string
│           ├── seniority: "Junior" | "Medior" | "Senior" | "Senior Principal"
│           ├── label: string (optional, e.g. "Lead FE")
│           ├── startMonth: "YYYY-MM" (optional override within project range)
│           ├── endMonth: "YYYY-MM" (optional override within project range)
│           ├── monthAllocations: { "YYYY-MM": number }  // FTE needed per month
│           ├── status: "realised" | "potential"
│           └── Assignment[]
│               ├── resourceId
│               └── monthAllocations: { "YYYY-MM": number }  // FTE allocated per month
└── Resource
    ├── name: string
    ├── capacity: number (0.1–1.0 FTE)
    ├── userId: string?            // optional link to a login User (self-service)
    ├── externalWorkId: string?    // Jira accountId when matched for actual-hours sync
    ├── plannedAbsences: { "YYYY-MM": days }  // planned days off per month (planner; 1 d = 8 h)
    └── roles: [{ domain, role, seniority }]  // a resource can have multiple roles
```

Seniority short forms (for compact display): `Junior→Jr`, `Medior→Mid`, `Senior→Sr`, `Senior Principal→SP`.

**Integration models (actual hours).** `JiraConnection` (per-org Jira/Tempo config, **encrypted** tokens), `JiraAccount` (cached Jira users for the matching dropdown), `JiraWorkItem` (Jira epic/project → customer/project mapping, or a `workType` classification: `client | internal | absence` — the mapping table has **Internal work** and **Absences** bucket rows; non-client items never carry a customer/project), and `Worklog` (one synced Tempo entry → resolved `{ resourceId?, customerId?, projectId?, workType }`, `month: "YYYY-MM"`, `seconds`). Absence hours are excluded from per-person actuals. A person is "matched" once `Resource.externalWorkId` is set. See `CLAUDE.md` → *Data model notes* for the read endpoints.

### Key Computed Values

- **Resource utilization (rU):** For each resource, for each month, sum of all `monthAllocations[month]` from all assignments. Used as the base number for utilization.
- **Realised resource utilization (rURealised):** Same as above, but only counts assignments whose need, project, AND customer all have `status === "realised"`. Used for dashboard stats.
- **Need fulfillment (nF):** For each need, for each month, sum of `monthAllocations[month]` from all assignments on that need.
- **Need OK:** A need is "green" (fully staffed) when for every month in its active range, `nF[need][month] >= need.monthAllocations[month]`.
- **Project OK:** A project is "green" when it has ≥1 need and every need is OK.
- **Customer OK:** A customer is "green" when it has ≥1 project and every project is OK.

### Utilization Color Thresholds

- `>100%` → **red** (overallocation)
- `≥80%` → **green** (healthy)
- `50–79%` → **orange** (underutilized)
- `<50%` → **red** (problem)
- `0%` → neutral gray, show as "—"

---

## Application Structure

Two main tabs in the header: **Planner** and **Dashboard**. User can switch between them.

Header also contains:
- Logo + "databob" wordmark on left
- Tabs in the middle/right
- Org switcher dropdown (for multi-tenant)
- User menu

---

## Planner View

### Layout

Two-column layout below the header:
- **Left sidebar (260px wide):** Resource pool
- **Right area (flex-1):** Toolbar on top + timeline grid below

### Resource Pool (Left Sidebar)

White background with a thin right border separating it from the grid.

**Top section** (padded, with bottom border):
1. **Header row:** "Team" title (bold 15px) + "+ Add" pill button on the right that opens the New Resource modal.
2. **Held resource banner** (only when a resource is selected):
   - Gradient background from `primary-light` to white
   - 2px primary border
   - Shows: circular avatar (36px, primary background, white initials), bold name, "Click a month cell to assign" subtitle
   - Row of role badges below
   - "✕ Deselect" pill button at the bottom to clear selection
3. **Filters** — three rows of pill-shaped toggle buttons:
   - "Domain" → All, Data, Web, General
   - "Role" → All, then roles matching the selected domain (or all roles if domain = All)
   - "Seniority" → All, Jr, Mid, Sr, SP
   - Each filter label is tiny uppercase (10px text-light)
   - Active pill has primary background + white text; inactive has white background + text-mid

**Resource list** (scrollable, padding 12px):
- Each resource is a card with 12px border-radius:
  - 36px circular avatar with domain-colored background and initials
  - Name (13px, text, font-weight 600)
  - Row of role badges (RBadge component)
  - Mini progress bar showing utilization across the visible time range
  - Average available FTE on the right
- When selected: 2px colored border (primary), gradient background, subtle colored shadow, checkmark badge in corner
- When fully booked: 40% opacity, "full" text instead of available, not clickable
- Hover reveals edit/delete buttons in the top-right corner
- **Planned days off:** utilization/free numbers use **effective capacity** (capacity − planned absence; 1 day = 8 h). A slate **"N d off" chip** appears when the person has days off in the window; a person fully away shows **"off"** instead of a free number. A calendar icon button (always visible with a chip, hover-revealed otherwise; editors only) opens the **days-off popover**: one row per visible month with a number input (step 0.5), an "all" toggle (≈ whole month), the resulting effective FTE, and Save/Cancel. Saving sends only changed months (server merges per month; 0 clears).

### Planner Toolbar

Horizontal bar at top of right area, sticky on scroll.

Contains (left to right):
- **"+ Customer"** primary pill button (opens New Customer modal)
- **"+ Project"** blue pill button (shown only when customers exist; opens New Project modal)
- Spacer pushing the rest to the right
- **Time range start** month input
- Arrow "→"
- **Time range end** month input
- **M/Q/Y toggle** — pill-shaped segmented control for month/quarter/year aggregation

### Planner Grid

Two-part layout:
- **Left: Label column (270px, sticky left)** — Contains customer/project/need labels
- **Right: Grid columns (flex-1)** — Contains the timeline cells and bars

#### Column Headers (Sticky Top)

- Height 36px, 2px bottom border
- One column per aggregation unit (month, quarter, or year)
- Each column 82px wide
- Font: 10px DM Mono, font-weight 700
- Current month column shows a **"Today" pill badge** at the bottom (small, primary background, white text, 8px rounded)
- Fully-staffed columns have a tiny green dot indicator in the top-right corner
- Header text color: green if fully staffed, primary if current month, text-mid otherwise

#### Row Types

The grid renders rows in a flattened order by iterating through customers:
```
for each customer:
  Customer label + Customer grid row
  for each project of that customer:
    Project label + Project grid row
    for each need of that project:
      Need label + Need grid row (with cells and assignment bars)
    (if no needs: Empty project placeholder row)
```

##### Customer Row (40px tall)

**Left label:**
- Background: green if customer OK, orange if potential, or accent-color-tinted otherwise
- Left border: 4px colored strip (green/orange/accent)
- Padding: 14px
- Content: small status dot (green/accent/orange) + customer name (14px bold) + project count on right + "POTENTIAL" badge if applicable + hover-reveal edit/delete buttons

**Grid row:**
- Same background tint as the label
- No content in cells, just decorative

##### Project Row (34px tall)

**Left label:**
- Indented 28px from the left
- Background: green tint if project OK
- Left border: 4px (muted green / muted orange / muted accent)
- 70% opacity if customer or project is potential
- Content: green dot if OK + project name (12px, font-weight 600, text-mid, truncated) + start month (9px DM Mono) + "POTENTIAL" badge if applicable + "+" button to add need + hover edit/delete

**Grid row:**
- Highlights only the columns within the project's date range
- Green tint if project OK, otherwise very subtle accent tint

##### Need Row (minimum 42px tall, grows with stacked bars)

**Left label:**
- Indented 42px from the left
- Background: light green tint if need OK
- Left border: 4px strip (muted green / muted orange / transparent)
- 65% opacity if any parent is potential
- Content: green dot if OK + domain/role/seniority badge + optional need label text + "POTENTIAL" badge + hover edit/delete

**Grid row:** This is where the actual planning happens. See next section.

##### Empty Project Placeholder (30px tall)

- Indented 42px
- Shows italic "No needs yet" text in text-light

#### Need Cells

Each grid cell in a need row is 82px wide. Cells can be in several states:

1. **Outside project range:** Transparent, no interaction
2. **Inside project range but outside need range:** Very subtle gray background
3. **Inside need range, has FTE demand, not yet filled:** White background, shows "filled/needed" text in a small pill at the bottom (e.g., "0.5/1.0")
4. **Fully filled:** Green background, "filled/needed" pill in green
5. **Hoverable for placement (when a resource is held and matches the need):** Light primary-tint background, cursor changes to "cell"
6. **Can't place (resource doesn't match, or no capacity):** 40% opacity

**Filled/needed pill:** Small text (9px DM Mono), background white, 1px border, colored by status.

Clicking a hoverable cell opens the FTE popover.

#### Assignment Bars (The Key Visual)

When a resource is assigned to a need, a **segmented rounded capsule bar** appears on top of the need row's cells, positioned at the month(s) where FTE > 0.

**Visual style:**
- Semi-transparent colored fill (domain color + 22 alpha)
- 2px solid border (domain color + 55 alpha)
- Border radius: **14px on outer edges, 4px on inner edges** between segments
- Subtle colored shadow: `0 2px 8px domainColor15`
- Height: 28px
- Padding: 4px on left (if first segment), 6px on right (if last segment)

**First segment content (left to right):**
- Resize handle (invisible, 8px wide, ew-resize cursor) extending slightly past the left edge
- **Avatar circle**: 22px, domain-colored background, white bold initials, small drop shadow
- Resource's first name (truncated with ellipsis if long) in domain color
- Pushed to the right: small FTE badge (e.g., "0.5") on a subtle background pill

**Middle segments:**
- No avatar or name
- Just flex spacer + FTE badge

**Last segment extras (in addition to middle content):**
- "×" delete button (red-tinted, no background)
- Right resize handle (8px wide, ew-resize, with a small visual grip mark)

**Segmentation logic:**
A single assignment is displayed as one bar if all its active months have the same FTE value. If the FTE varies month-to-month, the bar is split into segments — one per contiguous group of months with the same FTE. Segments touch each other with 4px inner radius so they look connected, while the outer corners of the overall bar keep the 14px rounded capsule shape.

**Example:** If an assignment has Jan=0.5, Feb=0.5, Mar=0.8, Apr=0.8, May=0.5 — it renders as three segments: [Jan–Feb @ 0.5] [Mar–Apr @ 0.8] [May @ 0.5], visually connected.

**Stacking:** If multiple resources are assigned to the same need, their bars stack vertically within the need row. The row grows to accommodate them (BH + 4px gap per bar, minimum 42px tall overall).

**Click behavior:** Clicking a segment opens the FTE popover to edit that segment's value.

**Drag behavior:** Dragging the left or right resize handles extends/contracts the bar across columns, automatically distributing FTE to new months based on the reference FTE of the existing segment.

**Absence & overload marks on bars:** a month where the person has planned days off gets a **slate hatched strip** along the bar's bottom edge (tooltip: "N d planned off — click to adjust or substitute"). The **red overload dot** in a month's top-right corner fires when the person's total allocation exceeds their **effective** capacity (capacity − planned absence) — so a fully-off month flags any allocation, cueing a substitution.

---

## FTE Popover

A small floating popup that appears near the clicked cell or bar segment.

**Structure:**
- White card, rounded 12px, bordered, shadowed
- Label: "FTE (max X.X)" where X.X is the maximum allowed value (remaining need capacity minus other assignments on this resource for this month)
- Number input: step 0.1, min 0, max from label
- "Set" primary button to confirm
- "×" secondary button to cancel
- Keyboard shortcuts: **Enter** to save, **Escape** to cancel
- Auto-focuses the input on open and selects all text

**Position:** Below and slightly to the right of the clicked element.

**Behavior on save:**
- If opened from a cell (placement flow) and an assignment already exists for that resource + need → updates the existing assignment's monthAllocations[month].
- If opened from a cell and no assignment exists → creates a new assignment with zeros everywhere and the FTE in this one month.
- If opened from a bar segment (edit flow) → updates that month's FTE in the existing assignment.

The bar-edit variant also offers **Remove** (delete the whole assignment) and **Substitute…** (open the substitution popover below).

---

## Substitute Popover

Opened from a bar's FTE popover — covers both the short-leave/rebalance case ("take 40h of September off my plate") and the long-leave workflow ("someone else takes over from here").

**Structure:**
- Header: "Substitute" + the original person's name and the need's role
- **"Month"** select, defaulting to the clicked month (options = the months the person actually holds)
- **Scope toggle** (segmented): **"Only Sep '26"** (default) vs **"Sep '26 → end"**
- **"Hand over"** amount — twin inputs in **FTE** and **h/mo** (kept in sync), defaulting to the person's full allocation for the selected month; a "split" chip appears when the amount is partial. Below, a summary line: "Sep '26 · hands over 0.50 of 1.00 FTE · Nikola keeps 0.50" (single month) or "Sep '26 – Dec '26 · 4 months · avg 1.00 FTE" (range; "up to X FTE each" when partial)
- Candidate list (top 6): role-matched people (same matching rule as placement), each with avatar, name, **free effective capacity** over the handed months ("+0.8 free", amber when less than the handover needs), "N d off" note, "already on this need" note, "knows <customer>" badge, and a **Hand over** button
- Footer: **"No substitute — leave Sep '26 open"** (or "just reduce …" when partial)

**Behavior:** Hand over subtracts the amount from the original person's month(s) — capped per month at what they hold — and re-creates it on the substitute's assignment for the same need (merged on top of anything they already hold there; substitute is written first so a failure can't leave the need uncovered). A partial amount splits the month between the two bars; a full amount leaves a gap/truncation exactly as before. "No substitute" just subtracts, so the need reopens (dashed amber "open" run). Either way it's a single undoable action ("Nikola → Milan for Sep '26" / "… from Sep '26").

---

## Modals (Forms)

All modals share the same shell:
- Dark translucent backdrop (rgba(44,62,80,0.25)) with backdrop blur
- White card, 16px rounded, shadowed, bordered
- Header: title (18px bold) + close "×" button (primary-light background)
- Form fields using the `Field` wrapper (label + input)
- Footer: "Cancel" secondary button + "Save" primary button, right-aligned

### Customer Form
Fields: Name, Status (realised/potential picker).

### Project Form
Fields: Name, Customer dropdown, Start month, End month (side-by-side), Status.

### Resource Form (wide modal)
Fields: Name, FTE Capacity (number), Roles (using Role Picker).

**Role Picker** is a multi-row editor:
- Each row: Domain dropdown / Role dropdown / Seniority dropdown / "×" remove button
- Changing the domain resets the role to the first available role for that domain
- "+ Add Role" button at the bottom adds a new row
- Must have at least one row; the remove button is hidden when only one row exists

### Need Form (wide modal)
Fields:
- Domain / Role / Seniority (three dropdowns in a row)
- Label (text input, optional)
- Time Range (two month inputs, clamped to project's range)
- FTE per month (range slider 0.1–2.0, step 0.1, with label showing current value)
- Status

On save, builds a `monthAllocations` object with the FTE value for each month in range (or keeps existing values for pre-filled months if editing).

### Status Picker

A small two-button toggle:
- **Realised** (green when active)
- **Potential** (orange when active)
- Active button has colored background + 2px colored border
- Inactive button has white background + gray border + light text
- Capitalized labels

---

## Dashboard View

Centered content, max-width ~1100px, padding 20–24px.

### Stats Cards (4 across)

Grid of 4 KPI cards:
1. **Projects** — count of realised projects that end in the current month or later (blue, 📋)
2. **Team** — total resource count (green, 👥)
3. **Realised Utilization** — current month's total realised FTE / total capacity, as a percentage (orange, 📊)
4. **Unfilled** — count of (need, month) pairs where realised demand > filled (red, ⚠️)

**Card layout:**
- White, 12px rounded, bordered, shadowed
- Icon square on the left (44px, tinted background)
- Number on the right (24px, bold, colored, DM Mono)
- Label below number (10px uppercase, tracked, text-light)

### Sub-Tabs

Below the stats cards, a tab bar with two tabs:
1. **🏢 Client Overview**
2. **👤 Resource Capacity**

Tab styling: rounded top corners, primary color + 2px bottom border when active, text-mid when inactive.

### Client Overview (Sub-tab 1)

A table showing customer staffing over time.

**Header row:** "Client / Project" label + one column per month in the time range.

**Body:** For each customer, renders a customer row followed (if expanded) by project rows.

#### Customer Row
- **Clickable** to toggle expand/collapse of its project rows
- **▶ arrow icon** on the left (rotates 90° when expanded, CSS transition 0.2s)
- 28px rounded square avatar with customer's first letter (white on accent color background; orange if potential)
- Customer name (bold, 13px) + "POTENTIAL" badge if applicable
- Subtitle: "N projects" (or "N projects · click to expand" when collapsed)
- Background: light green tint if all projects are OK, orange tint if potential, otherwise faint accent tint
- Per-month cells: each shows the aggregated % staffed (filled FTE / needed FTE across all needs on that month for this customer), colored by utilization threshold

#### Project Row (only shown when parent customer is expanded)
- Indented 36px from the left
- 65% opacity if project or customer is potential
- Green dot if project is OK
- Project name (bold, 12px, text-mid) + "POTENTIAL" badge if applicable
- Start/end range in tiny DM Mono below
- **Assigned team chips** under the project info: small colored pills showing each team member assigned to this project's needs (initials + first name)
- Per-month cells: % staffed, colored by threshold, "—" outside project range

### Resource Capacity (Sub-tab 2)

Two sections:

#### Domain Cards (3 across)
One card per domain (Data, Web, General):
- 10px colored square + domain name (13px bold) + person count on the right
- Thin progress bar showing current-month realised utilization
- Percentage next to the bar (colored by threshold)
- Subtitle: "X.X / Y.Y FTE (realised)" in tiny DM Mono

#### Capacity Heatmap Table
Similar structure to the client overview, but one row per resource.

Columns: Name | Roles | one column per month

**Resource row:**
- **Clickable** to open the resource profile modal
- 24px circular avatar with initials (domain-colored background)
- Resource name + "X% avg" underneath (colored by threshold)
- Row of role badges
- Per-month cells: realised utilization percentage, colored by threshold, background also tinted
- If a month has additional "potential" FTE beyond the realised amount, show "+X%p" in small orange text below the realised percentage

### Resource Profile Modal

Opens when a resource row is clicked on the dashboard.

**Structure:**
- Wide modal (560–700px)
- **Header section** (with gradient background matching domain):
  - Large 52px circular avatar (domain color background, white initials)
  - Resource name (20px bold)
  - Row of role badges
  - "Capacity: X FTE" in tiny DM Mono

- **Monthly Utilization section:**
  - Small label "Monthly Utilization"
  - Row of small colored blocks, one per month:
    - 50px wide, padded
    - Background tinted by threshold
    - Month label on top (tiny, DM Mono, text-light)
    - Percentage below (12px bold, colored by threshold)

- **Assigned To section:**
  - Lists all customers this resource is assigned to
  - Each customer is a bordered card (orange border if potential):
    - Customer name header
    - Inside, one block per project the resource works on:
      - Project name
      - **Engagement range** (NOT project's full date range — the earliest to latest month this specific resource has any allocation on this project)
      - **Total FTE** (sum of all months across all assignments on this project for this resource)
      - "POTENTIAL" badge if project is potential
      - Inside each project, one line per need-assignment:
        - Need role badge
        - "POTENTIAL" badge if need is potential
        - Month range of the resource's active engagement on this specific assignment (earliest to latest month with FTE > 0)
        - Average FTE across active months (right-aligned, bold primary)
  - If resource has no assignments, shows a "Not assigned yet" placeholder

---

## Badges & Indicators

### Role Badge (RBadge)

Small inline-flex pill showing a role:
- Padding 2px 8px (or 1px 5px small)
- Domain background color at full opacity, domain text color
- Contents:
  - Domain abbreviation (first 3 letters, half opacity)
  - Role name
  - Seniority short form (e.g., "Jr"), prefixed with "·", at 40% opacity (if provided)
- 6px rounded, DM Mono, nowrap

### Status Badge

Orange "POTENTIAL" pill:
- Only rendered when status === "potential"
- Small: 7px text "POT"
- Normal: 9px text "POTENTIAL"
- Background: orange-bg, 1px orange-border (44 alpha), 4px rounded, DM Mono, bold

### Hover Buttons

Edit (✎) and delete (✕) icon buttons that are hidden by default and appear on row hover.
- Implementation: opacity 0 by default, opacity 1 on parent `.hr:hover`
- Each button: small square with tinted background and colored icon
- Edit: primary-light background, primary icon
- Delete: danger-bg background, danger icon
- Sizes: 26px default, 22px medium, 20px small, 18px smallest

---

## Multi-Tenant Behavior

### Authentication

- Signup flow: email + password + name + organization name (creates user + org + owner membership in one step)
- Login flow: email + password → JWT containing `userId` and `orgId`
- JWT stored in localStorage, sent as `Authorization: Bearer <token>` on every API request
- Protected routes redirect to `/login` if no valid token

### Organization Context

- Users can belong to multiple organizations
- Header contains an organization switcher dropdown
- Switching org re-fetches all data (the API uses the orgId from the JWT, so switching issues a new JWT)
- Current org and member role are available via a context hook

### Member Roles

| Role    | Permissions |
|---------|-------------|
| Owner   | Full access + delete org + billing |
| Admin   | Full CRUD + invite/remove members |
| Member  | Full CRUD |
| Viewer  | Read-only (no create/edit/delete buttons visible) |

Role-based UI: viewers do not see "+ Customer", "+ Project", "+ Add" buttons, hover edit/delete buttons, or form modals.

### Settings Page

Accessible to owners and admins:
- Organization name (editable)
- Members list with role dropdowns (owners/admins can change member roles)
- Remove member action
- Add member by email (adds an existing account directly, or creates a pending invite with a role)
- Pending invites list with revoke — and, when the Teams bot is configured, an **Invite over Teams** action per pending invite / not-yet-linked member (installs the databob app and DMs a sign-in link); the same action is offered right after adding someone

---

## Interaction Patterns

### Planner: Place a resource on a need

1. User clicks a resource card in the pool → it becomes "held" (highlighted banner appears). Cells in needs the held person can't fill (domain/role/seniority mismatch via `resourceMatchesNeed`) aren't placeable.
2. User clicks a cell in a matching need row → the person is **auto-filled** into that need's still-open months (capacity- and gap-aware, `buildAutoFill`) — no popover. If the person is **already** on the need for some months, the click **extends** them into the remaining open months instead of doing nothing (only positive fills are applied, so existing months and anyone else's are never overwritten).
3. The person keeps placing on other needs, or clicks "Deselect" / the same resource again to stop. (Dragging across a need's cells "paints" a custom range instead of auto-filling.)

> With **no** held resource, clicking a cell opens the FTE popover to edit that need's per-month requirement.

### Planner: Edit existing assignment

1. User clicks a segment of an existing assignment bar → FTE popover opens
2. User edits the FTE and confirms → that month's FTE is updated
3. Bar may split into additional segments if the new FTE differs from neighbors

### Planner: Resize a bar

Resize is **per-segment**: every free edge has its own handle — the bar's outer ends, the start of a second engagement after a gap, **and** an edge that runs off the visible window (shown with a `‹`/`›` continuation marker).

1. User presses an edge handle of a segment.
2. User drags horizontally → that segment **follows the cursor live** (grows or shrinks; a small "N mo" badge inside the bar shows the resulting duration). It can extend into adjacent months that still have room (and belong to the need) but never crosses the neighbouring segment or a month someone else fills.
3. New months get the segment's FTE; removed months are set to 0. For a clipped (off-window) edge the drag operates on the **full** segment, so trimming the visible start removes the hidden off-screen months too.
4. Mouse up → assignment is saved (undoable).

### Planner: Delete an assignment

1. User clicks the "×" button on the right end of an assignment bar → assignment is deleted immediately (no confirmation)

### Dashboard: Drill into a resource

1. User clicks a resource row in the Resource Capacity heatmap → Resource Profile modal opens
2. Modal shows monthly utilization + grouped assignments by customer/project/need
3. User can see engagement ranges (not full project ranges)

### Dashboard: Expand/collapse customers

1. User clicks a customer row in Client Overview → projects appear/disappear beneath it
2. Each customer's collapsed state is tracked independently
3. Default is expanded for all customers

---

## Empty States

- **No customers:** Planner grid shows "Create a customer to start planning" centered with a calendar emoji
- **No resources in filtered list:** "No matches" or "Add team members"
- **Project with no needs:** Shows "No needs yet" placeholder row in the planner
- **Resource not assigned:** "Not assigned yet" message in the profile modal
- **No customers on dashboard:** "No customers yet"

---

## Keyboard Shortcuts (Minimum)

- **Enter** in FTE popover → save
- **Escape** in FTE popover → cancel
- **Escape** in any modal → close

---

## Actual Hours, Cockpits & Plan-vs-Actual (Tempo/Jira)

The app pulls **actual logged hours** from Tempo/Jira to compare against the plan.

- **Settings → Integrations.** Admins connect Jira/Tempo (tokens stored encrypted, never echoed back), map Jira projects/epics → customers/projects, and **match people**: each person's `externalWorkId` is set to their Jira `accountId` via a searchable dropdown. A nightly/manual sync pulls Tempo worklogs (by created/updated date so edits update in place, not duplicate) into per-month actual hours per person/customer/project.
- **Planned vs actual chart** (`PlannedVsActualChart`): grouped monthly bars, planned (teal) vs actual (green). Planned FTE converts to hours via `MONTHLY_HOURS_PER_FTE` (≈173.33). It appears on the home dashboard utilization view and inside both cockpits, and runs a few months into the **future** so the plan ahead is visible.
- **Dashboard utilization.** With synced hours, the chart draws a teal **planned line** (realised allocations of matched people ÷ matched capacity) against **stacked monthly bars** of logged hours — client, unmapped, internal, absences — on the same % scale; the tooltip lists raw hours per bucket. Without actuals it falls back to the realised/planned lines. The "Actual vs potential" KPI counts **only matched people** (`externalWorkId` set) over matched capacity; with nothing synced it falls back to realised-plan utilization.
- **Insights heatmaps (Client Staffing, People Capacity) compare plan and actuals as bullet cells** — each month is a tiny bullet: a soft accent **track** sized to the plan with a **tick** at its target, the logged Tempo hours as a solid green **fill**, and a small mono `act/plan` label underneath (a hover tooltip carries needed/planned/actual/Δ). Deviation is geometry — the fill reaching the tick is on plan. The tick turns **red** when the plan itself needs attention (client: understaffed vs need; person: over 100% capacity); an amber fill over a dashed baseline flags **unplanned work**; the current month's fill is grey (still logging). Lengths normalize per row (client rows floor at 1 FTE, people rows anchor at 100% capacity). Rows with no synced hours get no actual layer, project rows only count hours mapped to that project (the customer row is authoritative), and the Client-Staffing actual layer hides while a team filter is active (hours aren't team-attributable). An **"Actual vs plan"** KPI card summarises the completed window months (logged hours ÷ realised planned hours over matched people). On **People Capacity** the fill is **stacked by work type** (green = client, violet = internal; slate = absences), an **Hours filter** switches the actual lens (all work / client / internal / absences), and **clicking a person's row expands a per-client drill-down**: plan-vs-logged hours per customer, Internal work / Absences bucket rows, and one row per **unmapped Jira project** (by its Jira name/key, flagged "not mapped" — map or classify it in Settings → Integrations). Clicking the name still opens the profile. Mapping edits re-attribute already-synced hours immediately, so reclassifying a Jira project as absences moves its history too.

### Cockpits (1:1 review & PM review)

Both cockpits share a **general-first, click-to-filter** shape:

1. The **general** section is filled first (the 1:1 meeting recap; the whole-customer recap).
2. The per-item cards — **per-project** in the 1:1, **per-person** in the PM review — render **greyed/de-emphasised until clicked**.
3. Clicking a card **focuses** it (full opacity + ring, with an "unfocus" affordance) and **filters the right-hand context** — recent entries, client signals, and the planned-vs-actual chart — down to that project's **customer** (1:1) or that **person** (PM review). A chip shows the active filter and clears it.

## Notes on Behavior

- **Same resource on same need = one assignment.** When placing, if an assignment already exists for that resource+need combo, update the existing one's `monthAllocations[month]` rather than creating a duplicate. This is enforced at the database level via a unique constraint.
- **Bars render real gaps.** A person who works a need, stops for a month (covered by someone else), then returns shows as **two separate rounded pills with a gap** — never one bar bridged across the empty month. Each gap-separated run is independently resizable.
- **Bars only render for months with FTE > 0.** If a month has 0 FTE, it's not part of the bar. This is why segments exist — a bar can have "holes".
- **Potential items affect the UI but not realised stats.** Dashboard "Realised Utilization" excludes assignments whose need/project/customer chain contains any potential item. But the full `rU` is still shown in the planner, just with the potential items in reduced opacity.
- **Time aggregation (M/Q/Y) changes the grid's column granularity.** In quarter mode, each column represents 3 months and the filled/needed display averages across those months. Bars still track per-month data internally.
- **The "Today" indicator** is a small pill badge at the bottom of the current month's column header.
- **Green cascade:** When all needs in a project are fully staffed, the project label and grid row turn green. When all projects in a customer are fully staffed, the customer label and grid row turn green. When all months of a column are fully staffed across all needs, the column header turns green with a dot.
