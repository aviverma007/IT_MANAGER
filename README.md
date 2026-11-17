# IT Manager

An application-portfolio manager for the IT team. List every application you build or run, track progress with heading → task checklists, measure usage, keep a user manual and technical docs for each app, control **edit / view rights per person**, and keep a full **audit log** of every change.

![stack](https://img.shields.io/badge/React_19-TypeScript-3178c6) ![ui](https://img.shields.io/badge/Tailwind_v4-shadcn_structure-38bdf8) ![api](https://img.shields.io/badge/Express_5-Node_22-339933)

## Features

| Area | What you get |
| --- | --- |
| **Dashboard** | KPI cards, animated *App wall* (picture-rail gallery of pinned & most-used apps), usage trend, status donut, most-used apps, tasks due in 14 days, recent activity, quick launch |
| **Applications** | Grid / List / Kanban board (drag to change status), filters, search, sort, pin, Excel export, **import from .xlsx/.xls/.csv/.tsv/.ods/.json or pasted rows** with automatic column mapping |
| **App page** | Hero with link health-check, *Open app* (counted as a launch), extra environment links, repo link |
| **Tasks** | Headings with checklists, animated checkboxes, inline add (Enter), assignee, due date, priority, notes, reorder, move between headings, overdue highlighting, completion burst, import / export |
| **Usage** | Daily active users, sessions, transactions, avg minutes — form or bulk import (single app or multi-app sheet), charts (30d / 90d / 1y / all), trend vs previous 30 days, launches via IT Manager |
| **Docs & manual** | Markdown documents per app (User manual, Overview, Technical, FAQ…), templates, split-view editor with live preview, table of contents, import **.docx / .md / .html / .txt**, download .md, print / save as PDF |
| **Screens** | Real screenshots of each app — **capture from the live link** on the server (Edge/Chrome, optional one-time sign-in, extra pages, desktop/laptop/tablet/mobile sizes, full-page), upload, drag-drop or **paste with Ctrl+V**. Starred screenshot is the cover on cards, the app wall and the page header; lightbox with swipe; insert screenshots into user manuals |
| **Releases** | Version timeline with change notes; can set the app's current version |
| **Files** | Drag-and-drop any file (≤ 8 MB) — preview images/PDF/text, download, delete |
| **Access** | Visibility (everyone / restricted) + per-person *default / view / edit*, showing each person's effective right |
| **Audit logs** | Every sign-in, change, import, upload, access change and app launch — filters, before → after diff, Excel export |
| **Team** | Lanyard-rail of user badges (flip for bio & contact) + cards with role, apps owned, avg progress |
| **Users & rights** | Admin: create users, change role, deactivate, reset password, delete |
| **Settings** | Profile (photo, bio, badge colour), password, dark/light theme, import templates, backup / restore / reload sample / start fresh |
| **Extras** | Ctrl/⌘ K command palette, user guide page, toasts, confirm dialogs, responsive mobile layout, reduced-motion support |

### Roles

| Role | Rights |
| --- | --- |
| **admin** | Everything, including users, backups and access on every app |
| **editor** | Create apps; edit public apps and any app where granted *edit* |
| **viewer** | Read-only, except apps where granted *edit* |

A restricted app is visible only to admins, its owner and people listed in its Access tab.

## Getting started

```bash
npm install
npm run dev          # API on :4000 + Vite on :5173 (open http://localhost:5173)
```

Production (one process serves the UI and the API):

```bash
npm run build
PORT=4000 npm start  # http://localhost:4000
```

Sample sign-ins (change them in **Users & rights** before going live):

| User | Password | Role |
| --- | --- | --- |
| `admin` | `admin123` | admin |
| `priya` | `editor123` | editor |
| `rahul` | `viewer123` | viewer |

Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `4000` | API / web port |
| `DATA_DIR` | `server/data` | Where `db.json` (and `db.json.bak`) live |
| `SEED` | `true` | `false` → first start is empty with only `admin / admin123` |
| `CAPTURE_BROWSER` | *(auto)* | Path to `msedge.exe` / `chrome.exe` for screenshot capture. By default the server uses the installed Edge, then Chrome |

### Screenshots of your applications

* **Capture all at once:** Applications → **Capture screenshots** opens every app that has a link and no screenshot yet, on the server, and saves what users see.
* **Per app:** Screens tab → **Capture from link**. Tick *Sign in before capturing* to get past a login page (credentials are used once and never stored), and list extra pages (`/dashboard`, `/reports`) to capture inside the same session.
* Setting or changing an app's link captures a screenshot automatically if it has none.
* For screens a script can't reach, snip with **Win + Shift + S** and press **Ctrl + V** on the Screens tab, or drag files in.

The server must be able to reach the app's link (same network / VPN). Screenshots are served from `/api/shot/:id` and stored with the rest of the data.

Run as a service on Windows/Linux with PM2: `pm2 start "npm start" --name it-manager`.

### Offline demo build

`npm run build:demo` produces **one self-contained file**, `dist-demo/index.html`. The same business logic runs inside the browser and stores data in `localStorage` — useful for previews and demos without a server.

## Architecture

```
src/
  core/            ← shared, framework-free business logic (used by server AND demo build)
    types.ts         data model
    service.ts       every API method, permission checks, audit logging, summaries
    seed.ts          sample portfolio
    templates.ts     user-manual / technical-notes markdown templates
  api/             ← client: HTTP transport (server) or in-browser transport (demo)
  components/ui/   ← shadcn-style primitives + team-lanyard-rail.tsx + picture-rail-gallery.tsx
  components/app/  ← shell, app form, import wizard, markdown, activity feed, app tabs
  pages/           ← dashboard, apps, app-detail, team, logs, users, settings, guide, login
server/index.ts    ← Express 5: POST /api/<method>, /api/apps.ping (link health), static dist/
scripts/api-test.ts← end-to-end API test (40 checks)
```

* API style: `POST /api/<method>` with `Authorization: Bearer <token>`; e.g. `apps.list`, `tasks.update`, `usage.import`, `logs.list`.
* Storage: a single JSON document written atomically. `Store` is an interface (`load` / `save`) so it can be swapped for SQL Server later without touching the business logic.
* Passwords: PBKDF2-SHA256 (120k iterations, per-user salt). Sessions expire after 7 days.

## Testing

```bash
DATA_DIR=/tmp/itm SEED=true PORT=4000 npm start &
API=http://localhost:4000 npm run test:api   # 40 checks: auth, rights, progress, imports, files, logs, users
npm run typecheck
```

## Import formats

Templates: **Settings → Import templates**. Column names are matched loosely (e.g. *App Name*, *Stage*, *Prod URL* are recognised), and you can re-map any column before importing.

* **Applications**: Name*, Code, Tagline, Description, Status, Category, Department, Link, Repository, Version, Tech stack, Owner (username/name/email), Priority, Start date, Go-live date. Existing apps are matched by code or name and updated.
* **Tasks**: Heading, Task*, Done (yes/no/✓), Assignee, Due date, Priority, Notes.
* **Usage**: Application (code or name — not needed inside an app), Date*, Active users, Sessions, Transactions, Avg minutes, Notes. One row per app per day; re-importing a date updates it.

Dates accept `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY` and Excel serial numbers.

## Credits

`team-lanyard-rail` and `picture-rail-gallery` components from 21st.dev, used unchanged in `src/components/ui/`.
