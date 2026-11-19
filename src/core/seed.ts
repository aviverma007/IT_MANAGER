// Sample data so a fresh install has something to look at. Settings → Data lets an admin clear it.
import type { App, AppStatus, DB, Doc, Release, Task, TaskGroup, Tone, UsageEntry, UserRecord, Launch, LogEntry, Priority } from "./types";
import { hashPassword, newSalt } from "./crypto";
import { addDays, nowIso, rng, uid, ymd } from "./util";
import { manualTemplate, technicalTemplate } from "./templates";
import { IT_MANAGER_SCREENS } from "./seed-screens";
import type { Screenshot } from "./types";

export function emptyDb(): DB {
  return { version: 1, users: [], sessions: [], apps: [], groups: [], tasks: [], usage: [], launches: [], docs: [], releases: [], attachments: [], screenshots: [], tracking: [], favorites: [], logs: [] };
}

async function makeUser(p: Pick<UserRecord, "username" | "name" | "email" | "role" | "title" | "department" | "bio" | "tone">, password: string): Promise<UserRecord> {
  const salt = newSalt();
  return { ...p, id: uid(), avatar: "", active: true, createdAt: nowIso(), lastLoginAt: null, salt, passwordHash: await hashPassword(password, salt) };
}

/** Empty database with a single administrator (admin / admin123). */
export async function freshDb(): Promise<DB> {
  const db = emptyDb();
  db.users.push(await makeUser({ username: "admin", name: "Administrator", email: "", role: "admin", title: "IT Administrator", department: "IT", bio: "", tone: 1 }, "admin123"));
  return db;
}

interface SeedApp {
  name: string; code: string; tagline: string; category: string; department: string; status: AppStatus; priority: Priority;
  techStack: string[]; version: string; tone: Tone; base: number; months: number;
  url?: string; envs?: { label: string; url: string }[];
}

const APPS: SeedApp[] = [
  { name: "SmartDesk", code: "SMARTDESK", tagline: "Internal employee portal — one place for every workplace service", category: "Employee portal", department: "All employees", status: "uat", priority: "high", techStack: ["React", "Node.js", "SQL Server"], version: "2.4.0", tone: 1, base: 210, months: 14 , url: "http://192.168.66.28:92", envs: [{ label: "Office Wi-Fi", url: "http://www.smartdesk.com:92" }] },
  { name: "Smart Leasing", code: "LEASING_SWD", tagline: "Commercial leasing & billing platform for Gems-2, Sector-89", category: "Finance & billing", department: "Leasing", status: "live", priority: "critical", techStack: ["React", "Flask", "SQL Server"], version: "1.6.2", tone: 2, base: 85, months: 9 , url: "http://192.168.66.28:96", envs: [{ label: "Domain", url: "http://smartleasing.com:96" }] },
  { name: "Sales & Leasing Dashboard", code: "DASHBOARD_SWD", tagline: "Live sales and leasing KPIs for management", category: "Analytics", department: "Sales", status: "live", priority: "high", techStack: ["React", "Node.js", "Recharts"], version: "3.1.0", tone: 3, base: 120, months: 11 , url: "http://192.168.66.28:3000", envs: [{ label: "Domain", url: "http://swdashboard.com:3000" }] },
  { name: "Cheque Register", code: "CHEQUE_REG", tagline: "Track cheques received, deposited and cleared", category: "Finance & billing", department: "Accounts", status: "live", priority: "medium", techStack: ["React", "Node.js", "SQL Server"], version: "1.0.3", tone: 4, base: 40, months: 2 },
  { name: "MC Review (NFA)", code: "MC_REVIEW", tagline: "Four-page NFA approval workflow portal", category: "Workflow", department: "Management", status: "uat", priority: "high", techStack: ["React", "Node.js", "SQL Server"], version: "0.9.0", tone: 5, base: 0, months: 0 },
  { name: "HR Careers Portal", code: "PREONBOARDING", tagline: "Careers, referrals and pre-onboarding with a 9-gate approval flow", category: "HR", department: "Human Resources", status: "testing", priority: "medium", techStack: ["React", "Flask", "SQL Server"], version: "0.8.1", tone: 1, base: 0, months: 0 },
  { name: "QMS SAP PR Sync", code: "QMS_SAP_PR", tagline: "Syncs SAP purchase requisitions into the QMS reporting database", category: "Integration", department: "Procurement", status: "maintenance", priority: "medium", techStack: ["Python", "Flask", "SAP", "SQL Server"], version: "1.2.0", tone: 2, base: 30, months: 8 , url: "http://192.168.66.34:5002" },
  { name: "VendorGlobe API Sync", code: "VENDORGLOBE", tagline: "Two SAP PR APIs into SQL Server, picked up by SAP", category: "Integration", department: "Procurement", status: "development", priority: "high", techStack: ["Python", "REST API", "SQL Server", "SAP"], version: "0.4.0", tone: 3, base: 0, months: 0 , url: "http://192.168.66.28:5002", envs: [{ label: "NFA TAT report", url: "http://192.168.66.28:5002/nfatat" }] },
  { name: "M3M One", code: "M3M_ONE", tagline: "In-house rebuild of the vendor project-governance app", category: "Project governance", department: "Projects", status: "development", priority: "critical", techStack: ["React", "Node.js", "SQL Server"], version: "0.3.0", tone: 4, base: 0, months: 0 },
  { name: "Document Flow", code: "DOC_FLOW", tagline: "SAP FI/SD document-type mapping and flow viewer", category: "SAP", department: "Finance", status: "uat", priority: "medium", techStack: ["React", "SAP FI/SD"], version: "1.0.0-rc", tone: 5, base: 0, months: 0 },
  { name: "MIS Company", code: "MIS_COMPANY", tagline: "Single gateway serving the M3M / SW / NBH MIS apps", category: "Analytics", department: "Management", status: "live", priority: "medium", techStack: ["Python", "Excel"], version: "4.0.0", tone: 1, base: 55, months: 3 },
  { name: "Asset Tracker", code: "ASSET_TRK", tagline: "Laptops, licences and AMC renewals for the IT team", category: "IT operations", department: "IT", status: "planning", priority: "low", techStack: ["React", "Node.js"], version: "", tone: 2, base: 0, months: 0 },
];

const GROUPS: [string, [string, Priority][]][] = [
  ["Planning & requirements", [["Requirement workshops with business", "high"], ["Sign off scope & timelines", "high"], ["Finalise data sources and SAP touch-points", "medium"]]],
  ["Design", [["Wireframes for main screens", "medium"], ["Database schema", "high"], ["Roles & access matrix", "medium"]]],
  ["Development", [["Set up repository & CI", "low"], ["Authentication & roles", "high"], ["Core entry forms", "high"], ["Reports & Excel export", "medium"], ["Audit logging", "medium"]]],
  ["Testing & UAT", [["Internal QA pass", "high"], ["UAT with key users", "critical"], ["Fix UAT observations", "high"]]],
  ["Go-live & handover", [["Production deployment", "critical"], ["User manual published", "medium"], ["Training session", "medium"], ["Hypercare — 2 weeks", "low"]]],
];

const DONE_BY_STATUS: Record<AppStatus, number> = { planning: 2, development: 8, testing: 12, uat: 14, live: 18, maintenance: 18, "on-hold": 5, retired: 18 };
const PEOPLE = ["Anirudh Verma", "Priya Sharma", "Rahul Mehta", ""];

export async function sampleDb(): Promise<DB> {
  const db = emptyDb();
  const admin = await makeUser({ username: "admin", name: "Anirudh Verma", email: "anirudh.verma@smartworlddevelopers.com", role: "admin", title: "IT Developer", department: "IT", bio: "Builds and runs the internal application portfolio — full-stack, data and infra.", tone: 1 }, "admin123");
  const editor = await makeUser({ username: "priya", name: "Priya Sharma", email: "priya.sharma@example.com", role: "editor", title: "Business Analyst", department: "IT", bio: "Writes the requirements and the user manuals. Runs UAT with the business.", tone: 3 }, "editor123");
  const viewer = await makeUser({ username: "rahul", name: "Rahul Mehta", email: "rahul.mehta@example.com", role: "viewer", title: "Finance Manager", department: "Accounts", bio: "Key user for the finance apps. Signs off UAT for billing.", tone: 4 }, "viewer123");
  const nisha = await makeUser({ username: "nisha", name: "Nisha Kapoor", email: "nisha.kapoor@example.com", role: "editor", title: "HR Business Partner", department: "Human Resources", bio: "Owns the careers portal process and referral programme.", tone: 5 }, "editor123");
  db.users.push(admin, editor, viewer, nisha);

  const today = ymd();
  const random = rng(20261117);
  APPS.forEach((s, ai) => {
    const created = new Date(Date.now() - (60 + ai * 23) * 864e5).toISOString();
    const app: App = {
      id: uid(), name: s.name, code: s.code, tagline: s.tagline,
      description: `${s.tagline}. Built and maintained in-house by the IT team for the ${s.department} team.`,
      category: s.category, department: s.department, status: s.status, priority: s.priority, url: s.url ?? "",
      environments: s.envs ?? [], techStack: s.techStack,
      ownerId: s.department === "Human Resources" ? nisha.id : admin.id, version: s.version, cover: "", coverShotId: null, seats: 0, activeUsersManual: 0, hosting: "on-prem", source: "in-house", vendor: "", tone: s.tone,
      startDate: addDays(today, -(90 + ai * 30)), goLiveDate: ["live", "maintenance"].includes(s.status) ? addDays(today, -(s.months * 30)) : addDays(today, 20 + ai * 9),
      visibility: s.code === "M3M_ONE" ? "restricted" : "public",
      acl: s.code === "M3M_ONE" ? { [editor.id]: "edit" } : s.department === "Accounts" || s.code === "LEASING_SWD" ? { [viewer.id]: "view" } : {},
      createdAt: created, updatedAt: created, createdBy: admin.id,
    };
    db.apps.push(app);

    // headings + tasks
    let n = 0;
    const doneCount = DONE_BY_STATUS[s.status];
    GROUPS.forEach(([title, tasks], gi) => {
      const group: TaskGroup = { id: uid(), appId: app.id, title, order: gi, createdAt: created };
      db.groups.push(group);
      tasks.forEach(([t, priority], ti) => {
        const done = n < doneCount;
        const offset = (n - doneCount) * 4 + 3;
        const task: Task = {
          id: uid(), appId: app.id, groupId: group.id, title: t, notes: "", done, doneAt: done ? new Date(Date.now() - (30 - n) * 864e5).toISOString() : null,
          doneBy: done ? admin.name : null, assignee: PEOPLE[(ai + n) % PEOPLE.length]!, dueDate: done ? "" : addDays(today, offset), priority, order: ti, createdAt: created,
        };
        db.tasks.push(task);
        n++;
      });
    });

    // docs
    const docs: Doc[] = [
      { id: uid(), appId: app.id, kind: "manual", title: "User manual", content: manualTemplate(app), order: 0, updatedAt: created, updatedBy: editor.name },
      { id: uid(), appId: app.id, kind: "technical", title: "Technical notes", content: technicalTemplate(app), order: 1, updatedAt: created, updatedBy: admin.name },
    ];
    db.docs.push(...docs);

    // releases
    if (s.version) {
      const [major = 1, minor = 0] = s.version.split(".").map((x) => parseInt(x, 10) || 0);
      const releases: Release[] = [
        { id: uid(), appId: app.id, version: s.version, date: addDays(today, -6 - ai), title: "Current release", notes: "- Performance improvements\n- Fixed reported issues\n- Updated Excel export", createdAt: created },
        { id: uid(), appId: app.id, version: `${major}.${Math.max(0, minor - 1)}.0`, date: addDays(today, -40 - ai * 3), title: "Feature update", notes: "- New filters on reports\n- Role-based menu", createdAt: created },
      ];
      db.releases.push(...releases);
    }

    // usage for running apps: 75 days of history with weekday rhythm and gentle growth
    if (s.base > 0) {
      for (let d = 74; d >= 0; d--) {
        const date = addDays(today, -d);
        const day = new Date(date + "T00:00:00").getDay();
        const weekend = day === 0 ? 0.15 : day === 6 ? 0.45 : 1;
        const growth = 1 + (74 - d) * 0.004;
        const sessions = Math.round(s.base * weekend * growth * (0.85 + random() * 0.3));
        const entry: UsageEntry = {
          id: uid(), appId: app.id, date, sessions, activeUsers: Math.max(1, Math.round(sessions * (0.42 + random() * 0.12))),
          transactions: Math.round(sessions * (2.2 + random() * 1.5)), avgMinutes: Math.round((6 + random() * 9) * 10) / 10, notes: "", source: "import", createdAt: created,
        };
        db.usage.push(entry);
      }
      for (let k = 0; k < Math.round(s.base / 6); k++) {
        const launch: Launch = { id: uid(), appId: app.id, userId: [admin, editor, viewer, nisha][k % 4]!.id, at: new Date(Date.now() - random() * 29 * 864e5).toISOString() };
        db.launches.push(launch);
      }
    }
  });

  // IT Manager itself — the one sample app that ships with real screenshots, to show what the Screens tab looks like.
  {
    const created = nowIso();
    const app: App = {
      id: uid(), name: "IT Manager", code: "IT_MANAGER", tagline: "Portfolio manager for every internal application — progress, usage, docs, rights and audit",
      description: "One place to list every application the IT team builds or runs: checklist-driven progress, usage tracking, user manuals, release history, real screenshots, per-person access rights and a full audit log.",
      category: "IT operations", department: "IT", status: "uat", priority: "high", url: "", environments: [],
      techStack: ["React", "TypeScript", "Tailwind", "Node.js", "Express"], ownerId: admin.id, version: "1.1.0", cover: "", coverShotId: null, seats: 0, activeUsersManual: 0, hosting: "on-prem", source: "in-house", vendor: "", tone: 1,
      startDate: addDays(today, -1), goLiveDate: addDays(today, 14), visibility: "public", acl: {}, createdAt: created, updatedAt: created, createdBy: admin.id,
    };
    db.apps.push(app);
    const shots: Screenshot[] = IT_MANAGER_SCREENS.map((x, i) => ({ id: uid(), appId: app.id, ...x, source: "capture" as const, url: "http://localhost:4000/", order: i, createdAt: created, createdBy: admin.name }));
    db.screenshots.push(...shots);
    app.coverShotId = shots[1]?.id ?? shots[0]?.id ?? null;
    let n = 0;
    GROUPS.forEach(([title, tasks], gi) => {
      const group: TaskGroup = { id: uid(), appId: app.id, title, order: gi, createdAt: created };
      db.groups.push(group);
      tasks.forEach(([t, priority], ti) => {
        const done = n++ < 14;
        db.tasks.push({ id: uid(), appId: app.id, groupId: group.id, title: t, notes: "", done, doneAt: done ? created : null, doneBy: done ? admin.name : null, assignee: done ? "" : admin.name, dueDate: done ? "" : addDays(today, 3 + ti * 3), priority, order: ti, createdAt: created });
      });
    });
    const img = (i: number) => (shots[i] ? `![${shots[i]!.caption}](shot:${shots[i]!.id})` : "");
    const manual = manualTemplate(app).replace("## 3. Screens at a glance", `## 3. Screens at a glance\n${img(1)}\n\n${img(2)}\n\n${img(3)}\n\n${img(4)}\n`);
    db.docs.push({ id: uid(), appId: app.id, kind: "manual", title: "User manual", content: manual, order: 0, updatedAt: created, updatedBy: admin.name });
    db.releases.push({ id: uid(), appId: app.id, version: "1.1.0", date: today, title: "Real screenshots", notes: "- Screens tab: upload, paste or capture from the live link\n- Screenshots used as covers everywhere", createdAt: created });
  }

  db.favorites.push({ userId: admin.id, appId: db.apps[0]!.id }, { userId: admin.id, appId: db.apps[1]!.id }, { userId: admin.id, appId: db.apps[8]!.id });

  // a little history so the audit log isn't empty
  const history: [UserRecord, string, string, number, string][] = [
    [admin, "create", "app", 8, "Added application M3M One"],
    [editor, "update", "doc", 1, "Edited document \"User manual\""],
    [admin, "status", "app", 4, "Moved MC Review (NFA) from testing to uat"],
    [viewer, "open", "app", 1, "Rahul Mehta opened Smart Leasing"],
    [admin, "complete", "task", 7, "Completed \"Authentication & roles\""],
    [nisha, "update", "app", 5, "Updated HR Careers Portal (tagline)"],
    [admin, "access", "app", 8, "Changed access rights on M3M One"],
    [admin, "import", "usage", 0, "Imported usage data into SmartDesk"],
  ];
  history.forEach(([u, action, entity, ai, summary], i) => {
    const app = db.apps[ai]!;
    const entry: LogEntry = { id: uid(), at: new Date(Date.now() - (i + 1) * 3.7 * 3600e3).toISOString(), userId: u.id, userName: u.name, action, entity, entityId: app.id, appId: app.id, appName: app.name, summary, changes: [] };
    db.logs.push(entry);
  });
  return db;
}
