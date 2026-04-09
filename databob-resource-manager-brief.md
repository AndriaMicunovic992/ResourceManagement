# databob Resource Manager — Design & Functionality Brief

## Overview
A **resource planning tool** for databob.ch — a consultancy that needs to allocate team members across multiple clients and projects over time. Think of it as a Gantt-chart-meets-resource-planner: a timeline grid where you assign people to project roles, track capacity, and see at a glance what's covered and what's not.

---

## Core Concepts

### Data Hierarchy
```
Customer (e.g. "Acme Corp")
  └── Project (e.g. "Website Redesign", Mar '26 → Dec '26)
        └── Need (e.g. "Web/FE/Senior", Apr '26 → Sep '26, 1.0 FTE/month)
              └── Assignment (e.g. "John → 0.5 FTE in Apr-Jun, 0.8 FTE in Jul-Sep")
```

### Role System (3 levels)
**Domain → Role → Seniority**

| Domain   | Roles                                                        |
|----------|--------------------------------------------------------------|
| Data     | FE, BE, PM                                                   |
| Web      | FE, BE, PM                                                   |
| General  | Agent, DevOps, Sales, AI Engineer, Consultant, Product Manager |

**Seniority levels:** Junior, Medior, Senior, Senior Principal

### Resources (Team Members)
- Each person has a **name**, **FTE capacity** (0.1–1.0), and **one or more roles** (domain/role/seniority combos)
- Example: "Jane Smith" — 1.0 FTE — Web/FE/Senior + Data/FE/Medior
- A person can fill any need matching any of their roles
- Their total allocation across all assignments cannot exceed their FTE capacity in any given month

### Needs (Project Requirements)
- Each need belongs to a project but has its **own time range** (can start/end independently within the project's range)
- Specifies: domain, role, seniority, FTE per month, optional label
- Example: "We need 1.0 FTE of a Web/FE/Senior from April to September"
- Multiple resources can partially fill the same need (e.g. two people at 0.5 each)

### Assignments (Resource ↔ Need)
- Links a resource to a need with **per-month FTE values**
- The same resource on the same need = **one assignment**, but FTE can differ per month
- Example: John assigned 0.5 FTE in Apr-Jun, then 0.8 FTE in Jul-Sep (shown as connected segments)

---

## Layout

### Screen Structure
```
┌──────────────────────────────────────────────────────────┐
│  HEADER — logo, app name, tab switcher (Planner | Dashboard)  │
├────────────┬─────────────────────────────────────────────┤
│            │  TOOLBAR — [+Customer] [+Project] | time     │
│  RESOURCE  │  range pickers | M/Q/Y aggregation toggle    │
│   POOL     ├─────────────────────────────────────────────┤
│  (sidebar) │  TIMELINE GRID                               │
│            │  ┌──────┬──────┬──────┬──────┬──────┐       │
│  - filters │  │Labels│Mar'26│Apr'26│May'26│Jun'26│ ...   │
│  - chips   │  ├──────┼──────┼──────┼──────┼──────┤       │
│            │  │Cust  │      │      │      │      │       │
│            │  │ Proj │  ██  │  ██  │  ██  │      │       │
│            │  │  Need│[bars]│[bars]│[bars]│      │       │
│            │  │  Need│      │[bars]│[bars]│[bars]│       │
│            │  └──────┴──────┴──────┴──────┴──────┘       │
└────────────┴─────────────────────────────────────────────┘
```

### Resource Pool (Left Sidebar, ~250px)
- **Header:** "Resources" + "+ Add" button
- **Held resource indicator:** When a resource is selected/held, show a highlighted card with their name, roles, and a cancel button
- **3-layer cascading filter:**
  - Domain: All | Data | Web | General (pill buttons)
  - Role: All | FE | BE | PM | ... (updates based on domain)
  - Seniority: All | Jr | Mid | Sr | SP
- **Resource chips:** Cards showing:
  - Avatar circle with initials (colored by primary domain)
  - Name
  - Role badges (small, colored by domain)
  - Availability text ("0.7 avg free" or "fully allocated")
  - Hover → reveal edit ✎ and delete ✕ buttons
  - Fully allocated resources: grayed out, not selectable
  - Selected resource: highlighted border + checkmark

### Timeline Grid (Main Area)

#### Toolbar
- "+ Customer" and "+ Project" buttons
- Time range: two month pickers (start → end)
- Aggregation toggle: M (month) | Q (quarter) | Y (year)

#### Column Headers
- Show month names (e.g. "Mar '26"), quarter labels ("Q1 '26"), or year labels ("'26")
- **Current period** highlighted with accent color
- **Fully allocated column** turns green (when all needs in that column are filled)

#### Row Types (left label column, sticky)
1. **Customer row** — colored left border + dot, bold name, edit/delete on hover
2. **Project row** — indented, shows name + date range, "+Need" button, edit/delete on hover
3. **Need row** — further indented, shows role badge + label + date range, edit/delete on hover
4. **Empty project row** — "No needs yet" placeholder

#### Grid Cells (per need row × column)
- **Active cell** (need has requirement in this month): white background, shows "filled/needed" at bottom (e.g. "0.5/1.0")
- **Filled cell** (filled ≥ needed): green background, green text
- **Placeable cell** (held resource matches + has capacity): subtle blue highlight, cursor: cell
- **Out-of-range cell**: transparent/gray

#### Allocation Bars (overlaid on need rows)
- **One row per resource-need assignment** — multiple assignments on same need stack vertically
- **Segmented bars**: when FTE differs across months, show as connected rectangles with different FTE labels
  - First segment: shows initials + name + FTE value
  - Subsequent segments: just FTE value
  - Segments connected with subtle divider line, rounded corners only on outer edges
- **Resize handles**: left and right edges of the full bar are draggable to expand/shrink across months
- **Click bar**: opens FTE popover to edit that segment's value
- **Delete button** (×) on the last segment
- Colors match the need's domain color

#### FTE Popover
- Small floating card appearing below the clicked cell/bar
- Shows "FTE Allocation (max X.X)"
- Number input (step 0.1) + "Set" button + close button
- Enter to confirm, Escape to cancel

---

## Interaction Flow

### Assigning a Resource
1. **Click** a resource chip in the pool → it becomes "held" (highlighted)
2. **Click** a grid cell on a matching need row → FTE popover appears
3. **Type** the FTE amount (e.g. 0.5) → click "Set"
4. Bar appears in that cell
5. **Click another month** on the same need → existing assignment is updated (same row, new segment if FTE differs)
6. **Drag** the right edge of the bar to expand to more months (copies the FTE value)
7. **Click** the bar to edit FTE for a specific month

### Partial Allocation Example
- Need: 1.0 FTE Web/FE/Senior for 6 months
- Assign John at 0.5 FTE → bar shows [J John 0.5] across months
- Assign Sam at 0.5 FTE → second bar stacks below: [S Sam 0.5]
- Both bars on the same need row, cells show "1.0/1.0" in green

### Variable FTE Example
- John assigned 0.5 in Mar-Apr, then 1.0 in May-Jun
- Single row shows: `[J John  0.5][1.0]` — two connected segments

---

## Green Status System
Fills propagate upward:

| Level    | Green when...                                           |
|----------|--------------------------------------------------------|
| Cell     | filled FTE ≥ needed FTE for that month                 |
| Need     | ALL months in the need's range are green               |
| Project  | ALL needs under the project are green                  |
| Customer | ALL projects under the customer are green              |
| Column   | ALL needs across all projects are filled for that period |

Green is shown via:
- Green background tint
- Green left border
- Green dot indicator next to the name
- Green column header text and background

---

## Dashboard Tab
Simple overview with:
- **4 stat cards**: Active Projects, Team Size, Avg Utilization %, Unfilled Slots
- **Capacity Heatmap**: table with resources as rows, months as columns, showing utilization % per cell (color-coded: green <80%, orange 80-100%, red >100%)

---

## Modal Forms
All entities are editable via modal forms:

- **Customer**: name
- **Project**: name, customer (dropdown), start month, end month
- **Resource**: name, FTE capacity (0.1-1.0), roles (multi-row picker: domain/role/seniority, can add/remove rows)
- **Need**: domain/role/seniority (3 dropdowns), label, time range (start/end month within project range), FTE per month (slider)

---

## Design Language
Current implementation uses a **parkBob-inspired sky blue** palette:
- **Primary**: `#4CBAD4` (sky blue) — header, buttons, accents
- **Background**: `#EFF6FA` (very light blue-gray)
- **Cards**: `#FFFFFF` with `#D8E8EF` borders
- **Green**: `#5BC68A` with `#EAFAF0` background
- **Orange**: `#F5A623` for warnings
- **Red**: `#E8636F` for deletions/errors
- **Shadows**: subtle blue-tinted (`rgba(76,186,212,0.08)`)
- **Radius**: 12px cards, 8px inputs/buttons, 6px small elements
- **Typography**: DM Sans (UI), DM Mono (numbers/data)
- **Hover patterns**: edit/delete buttons appear on hover with 0.2s fade

---

## Technical Notes
- Built as a single React component (JSX artifact)
- Persistent storage via `window.storage` API (key-value, JSON)
- No external state management — useState + useMemo + useCallback
- No HTML5 drag-and-drop (unreliable in sandboxed iframes) — uses click-to-select + click-to-place + mousedown/mousemove for resize
- All data backward-compatible (old resources with `.category` auto-migrate to `.roles` array)
- Time aggregation: raw data always stored per-month, Q/Y views compute averages for display
