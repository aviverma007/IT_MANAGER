import { motion } from "motion/react";
import { BookOpen } from "lucide-react";
import { GlassCard } from "@/components/ui/bits";
import { Markdown, tocOf } from "@/components/app/markdown";
import { Button } from "@/components/ui/button";
import { download } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const GUIDE = `# IT Manager — User Guide

IT Manager is the single place to list every application the IT team builds or runs, track how far along each one is, see how much it is used, and keep its documentation, files and release history together — with access rights and a full audit trail.

## 1. Signing in
1. Open IT Manager and sign in with your username (or email) and password.
2. Your **role** decides what you can do:

| Role | Can do |
| --- | --- |
| **Admin** | Everything: all apps, users & rights, backups, restore |
| **Editor** | Add applications; edit public apps and any app where they have *edit* rights |
| **Viewer** | Read-only, except apps where they are granted *edit* |

3. Change your password any time in **Settings → Password**.

## 2. Getting around
- **Sidebar** — Dashboard, Applications, Team, Audit logs, this guide, Users & rights (admins) and Settings. Pinned apps appear under *Pinned*.
- **Search** — press **Ctrl + K** (⌘ K on Mac) anywhere to jump to any app or page.
- **Theme** — the moon/sun button switches dark and light mode.

## 3. Dashboard
- **KPI cards** — number of applications, average progress, sessions in the last 30 days (with trend) and team size.
- **App wall** — your pinned and most-used apps hang on a picture rail. Move the mouse along the rail to light one up, click it to lift it and see its label, then use **Open app page** or **Launch**.
- **Usage trend, status donut, most used, due soon and recent activity** — click any item to jump to it.

## 4. Applications
### 4.1 Adding an application
**Manually:** click **New application**, fill in the *Basics*, *Links & stack* and *Look & access* tabs, then **Create application**. Tick *Start with a standard task checklist* to get the four standard headings with tasks.

**From a file:** on the Applications page click **Import**, then
1. drop an Excel / CSV / TSV / ODS / JSON file, or paste rows copied from Excel;
2. check the column mapping (IT Manager guesses it for you) and the preview;
3. click **Import** — existing apps are matched by *code* or *name* and updated, new ones are created.

Download ready-made templates in **Settings → Import templates**.

### 4.2 Views and filters
- **Grid**, **List** and **Board** views. In Board view, drag a card to another column to change its status.
- Filter by status chips, category, *Mine & pinned*, or search by name, code, stack or owner.
- **Export** downloads the current list to Excel.

### 4.3 Opening an application
Click **Open app** on a card or on the app page. Every open is recorded as a *launch* and counts in the usage figures. Extra links (UAT, admin panel…) appear next to it. The badge in the header shows whether the link is reachable.

## 5. The application page
| Tab | What it is for |
| --- | --- |
| **Overview** | Description, key dates, progress per heading, next tasks, usage summary |
| **Tasks** | Headings with task checklists — ticking tasks drives the progress % |
| **Usage** | Daily active users, sessions, transactions, average minutes — chart and table |
| **Docs & manual** | User manual, technical notes, FAQ — written in Markdown |
| **Releases** | Version history with change notes |
| **Files** | Any file: PDFs, Word, Excel, screenshots, scripts (8 MB each) |
| **Access** | Who can view or edit this application |
| **Activity** | Every change to this application |

### 5.1 Tasks and progress
- **Add heading** creates a section (e.g. *Development*, *UAT*). Double-click a heading to rename it.
- Type in the box at the bottom of a heading and press **Enter** to add a task.
- Tick the **checkbox** to complete a task. Progress is *completed tasks ÷ all tasks*.
- Click a task to set assignee, due date, priority, notes, or move it under another heading. Overdue tasks turn red.
- **Import** tasks from Excel with columns *Heading, Task, Done, Assignee, Due date, Priority, Notes*.

### 5.2 Usage
- **Log usage** adds one day's figures. Saving the same date again updates it.
- **Import** loads many days at once from Excel/CSV/JSON. On the app page every row goes to that app; from a multi-app sheet include an *Application* column (code or name).
- Usage from launches through IT Manager is counted automatically.

### 5.3 Documentation and user manuals
- **New document from template** creates a *User manual* with sections for getting started, screens, step-by-step tasks, roles and FAQ — fill in the blanks.
- **Import** converts **.docx**, **.md**, **.html** or **.txt** to an editable document.
- The editor has *Write*, *Split* and *Preview* modes. Headings build the “On this page” menu.
- **Print / PDF** prints the document (choose *Save as PDF*); **.md** downloads it.

### 5.4 Releases
Record each deployment with version, date, title and notes. Tick *Set as current version* to update the app's version.

### 5.5 Access rights
- **Visibility: Everyone** — all users can see it; editors can edit, viewers can view.
- **Visibility: Restricted** — only admins, the owner and people listed with view/edit.
- Per person choose **Default**, **View** or **Edit**. The right-hand badge shows what they will actually get.

## 6. Team
Every user appears as a badge on a lanyard rail. Hover to bring a badge forward, pull it down, and click to flip it for their bio and contact links. Below are cards with role, apps owned and average progress.

## 7. Audit logs
Every sign-in, change, import, upload, access change and app launch is logged with who, when and what. Filter by user, application, action, type and dates; click a row to see **before → after** values; **Export to Excel** for audits. Non-admins see logs for the applications they can access.

## 8. Users & rights (admins)
- **Add user** with a temporary password and role.
- Change role, **deactivate** (blocks sign-in, keeps history), **reset password** or delete.
- At least one active admin is always kept.

## 9. Settings
- **Profile** — name, title, department, bio, photo and badge colour.
- **Data (admins)** — download a full backup, restore one, reload sample data or start fresh.

## 10. Good practice
- Give every app an **owner**, a **link** and a **user manual** before go-live.
- Log usage at least weekly (or import the month's export) so trends stay meaningful.
- Download a backup before big imports or restores.
`;

export default function GuidePage() {
  const toc = tocOf(GUIDE);
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="hidden lg:block">
        <GlassCard className="sticky top-24 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><BookOpen className="size-4 text-primary" />Contents</div>
          <nav className="flex max-h-[70vh] flex-col gap-0.5 overflow-y-auto">
            {toc.map((h, i) => (
              <a key={i} href={`#${h.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                className={cn("truncate rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground", h.level === 3 && "pl-5")}>{h.text}</a>
            ))}
          </nav>
        </GlassCard>
      </aside>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard className="p-6 md:p-10">
          <div className="mb-4 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => download("IT-Manager-User-Guide.md", GUIDE, "text/markdown")}>Download .md</Button>
            <Button size="sm" variant="ghost" onClick={() => window.print()}>Print / PDF</Button>
          </div>
          <div className="print-area mx-auto max-w-3xl"><Markdown source={GUIDE} /></div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
