// Real details for every Smartworld application — About text, owner department, stack, dates, docs,
// release history and open items. Applied by Service.fillDetails() (once automatically, or from Settings).
// Rules: no passwords / keys in here; unknown dates are left blank rather than guessed.
import type { AppStatus, DocKind, Priority } from "./types";

export interface DetailDoc { kind: DocKind; title: string; content: string }
export interface DetailRelease { version: string; date: string; title: string; notes: string }
export interface DetailTask { title: string; priority?: Priority; done?: boolean; notes?: string }
export interface AppDetails {
  names: string[];
  codes?: string[];
  tagline: string;
  description: string;
  department: string;
  category?: string;
  techStack?: string[];
  status?: AppStatus;
  priority?: Priority;
  version?: string;
  startDate?: string; // "" = unknown (clears a placeholder date)
  goLiveDate?: string;
  url?: string;
  environments?: { label: string; url: string }[];
  docs?: DetailDoc[];
  releases?: DetailRelease[];
  tasks?: { group: string; items: DetailTask[] };
}

/* ------------------------------------------------------------------ in-house ------------------------------------------------------------------ */

const INHOUSE: AppDetails[] = [
  {
    names: ["SmartDesk"], codes: ["SMARTDESK"],
    tagline: "Employee portal — one place for every workplace service at Smartworld",
    description: "SmartDesk is the internal employee portal for all Smartworld staff. Employees sign in with their employee code (no Microsoft 365 login) and find company information, the employee directory, attendance, the photo gallery and workplace services in one place. Search is internal-only — it answers from SmartDesk's own data, with no external or paid search API.\n\nThe employee master comes from HR's Excel, refreshed every month; employee codes that appear in attendance but are missing from the list are included too. Attendance is read from the attendance SQL Server on 192.168.66.33; everything else lives in the app database on 192.168.66.28.",
    department: "All employees (owner: HR)", category: "Employee portal", status: "uat", priority: "high",
    techStack: ["React", "Node.js", "Express", "SQL Server"],
    url: "http://192.168.66.28:92", environments: [{ label: "Office Wi-Fi", url: "http://www.smartdesk.com:92" }],
    docs: [
      { kind: "overview", title: "SmartDesk — overview & architecture", content: `## What it is
The Smartworld employee portal: company information, directory, attendance, gallery and workplace services in one place.

## Who uses it
Every employee. Sign-in is by **employee code** only.

## Architecture
| Part | Where |
|---|---|
| Web app | 192.168.66.28, port **92** (office Wi-Fi: \`www.smartdesk.com:92\`) |
| App database | SQL Server on **192.168.66.28** |
| Attendance | SQL Server on **192.168.66.33** (read-only) |
| Employee master | HR's monthly Excel |
| Gallery photos | Shared folder on .28 that HR updates |

## Data refresh
- HR replaces the employee Excel each month; SmartDesk picks it up without a rebuild.
- Attendance codes not in the master are still listed.
- Search is internal-only.

## Repository
\`aviverma007/smartdesk_final_live\`` },
      { kind: "manual", title: "SmartDesk — user guide", content: `## Signing in
1. Open **www.smartdesk.com:92** on the office network.
2. Enter your **employee code**.

## What you can do
- **Directory** — find colleagues by name, department or code.
- **Attendance** — see your own attendance.
- **Gallery** — company photos and events.
- **Search** — the box at the top searches everything inside SmartDesk.

## Leave
Leave is handled in the separate HR employee portal, not in SmartDesk.

## Help
Raise a ticket on the IT helpdesk (ServiceDesk Plus) with "SmartDesk" in the subject.` },
    ],
    tasks: { group: "Go-live", items: [
      { title: "Final walkthrough meeting with the team", priority: "high" },
      { title: "HR go-ahead for launch", priority: "critical" },
      { title: "Shared folder on .28 for HR (gallery photos + employee Excel)", priority: "medium" },
    ] },
  },
  {
    names: ["Smart Leasing", "Leasing SWD"], codes: ["LEASING_SWD"],
    tagline: "Commercial leasing & billing for Gems-2, Sector-89 Gurugram",
    description: "Smart Leasing runs commercial leasing and billing for Gems-2 (Adhikaansh Realtors), Sector-89 Gurugram — 90 leasable units across blocks 06, 08 and 09. It covers the full lease lifecycle: customer and broker masters, a step-by-step lease wizard, rent escalation, invoicing (classic Tax Invoice and e-invoice formats, GST bifurcation, HSN/SAC 997212, TDS clause, bank details, pool billing), credit and debit notes, the tenant ledger, collections and a document vault per lease.\n\nVersion 4 brought an ERP-style design: a drill-down page per record with full logs, and maker–checker approvals on invoices, leases, collections and credit notes (single checker, approvers set by role profile). E-mail goes out from noreply-dms@smartworlddevelopers.com; dunning reminders never send automatically — every reminder is reviewed and confirmed by hand.",
    department: "Leasing & Finance", category: "Finance & billing", status: "live", priority: "critical",
    techStack: ["React 18", "Vite", "Node.js", "Express", "SQL Server 2022"],
    startDate: "", goLiveDate: "2026-10-27", version: "4.0",
    url: "http://192.168.66.28:96", environments: [{ label: "Domain", url: "http://smartleasing.com:96" }],
    docs: [
      { kind: "overview", title: "Smart Leasing — overview & architecture", content: `## What it is
Commercial leasing and billing platform for **Gems-2, Sector-89 Gurugram** (Adhikaansh Realtors) — 90 units in blocks 06, 08, 09.

## Modules
- **Masters** — customers, brokers, units
- **Leases** — step wizard, lifecycle stages, rent escalation (RCD-based), per-lease alert toggles
- **Billing** — Tax Invoice / e-invoice formats, GST bifurcation, HSN/SAC 997212, TDS clause, pool billing
- **Credit & debit notes**, **tenant ledger**, **collections**
- **Document vault** per lease
- **Approvals** — maker–checker on invoices, leases, collections and credit notes
- **12 Excel reports** for Finance

## Architecture
| Part | Where |
|---|---|
| Frontend | React 18 + Vite, **port 96** on 192.168.66.28 (\`smartleasing.com:96\`) |
| Backend | Node/Express, **port 5096** |
| Database | SQL Server 2022 Express on **192.168.66.28** (SmartDeskApp, \`leasing\` schema) — moved from .33 on 31-Oct-2026 |
| Mail | noreply-dms@smartworlddevelopers.com (SMTP) |

## Rules
- Dunning reminders are **never** sent automatically — always a review popup with manual confirm.
- Stays on port 96.

## Repository
\`aviverma007/Leasing_swd\`` },
      { kind: "manual", title: "Smart Leasing — user guide", content: `## Everyday flow
1. **Masters** — add the customer (and broker, if any).
2. **New lease** — follow the wizard: unit → customer → terms → rent & escalation → documents.
3. **Approval** — the checker approves the lease.
4. **Invoices** — generate the month's invoices; the generator lists any lease it skipped and why.
5. **Collections** — record receipts against invoices; approve.
6. **Credit / debit notes** when amounts change.

## Reports
Twelve Excel reports for Finance, from the Reports menu.

## Reminders
Dunning reminders open a review window first — nothing is e-mailed until you confirm.

## Help
IT helpdesk ticket with "Leasing" in the subject.` },
    ],
    releases: [
      { version: "3.0", date: "2026-10-15", title: "End-to-end rebuild", notes: "Separate Customer and Broker masters, lease lifecycle stages with a step-wizard lease form, credit/debit notes, tenant ledger, per-lease document vault, rent escalation." },
      { version: "4.0", date: "2026-10-27", title: "ERP-style revamp", notes: "Drill-down page per record with full logs; maker–checker approvals on invoices, leases, collections and credit notes; approvers by role profile. Go-live mail and user walkthrough on 27-10-2026." },
      { version: "4.1", date: "2026-11-07", title: "E-mail live", notes: "SMTP mail from noreply-dms@smartworlddevelopers.com." },
    ],
    tasks: { group: "Enhancements from 06-Nov review", items: [
      { title: "Dunning reminders (review + manual confirm)", priority: "high" },
      { title: "Per-unit rate", priority: "medium" },
      { title: "RCD-based rent start and escalation", priority: "high" },
      { title: "Revenue tiers (to 50 / 50–70 / 70+)", priority: "medium" },
      { title: "Negotiated MG + revenue billing for multi-store brands", priority: "medium" },
      { title: "Investor payouts", priority: "medium" },
      { title: "Lease deed reading from scanned PDFs (OCR)", priority: "low" },
    ] },
  },
  {
    names: ["Sales & Leasing Dashboard", "Analytics Dashboard", "DASHBOARD_SWD"], codes: ["DASHBOARD_SWD"],
    tagline: "Management dashboard — sales, CRM cases, cost and PR-to-PO in one place",
    description: "The Smartworld management dashboard. It brings together sales (bookings, inventory, collections, channel partners, digital leads, footfall), CRM case management with MIS reports, cost and budget control from SAP (ZALR budgets, non-project spend, vendor ageing) and the live PR-to-PO purchase journey.\n\nBusiness data is uploaded from Excel exports every week, alongside live feeds (PR-to-PO from the SAP OData service, collections). Logins are role-based, so each team sees only its sections. An Android app (\"SWD Analytics\") wraps the same live server.",
    department: "Management / Sales", category: "Analytics", status: "live", priority: "high",
    techStack: ["React 19", "TypeScript", "Vite", "Tailwind v4", "Zustand", "Framer Motion", "Capacitor"],
    url: "http://192.168.66.28:3000", environments: [{ label: "Domain", url: "http://swdashboard.com:3000" }],
    docs: [
      { kind: "overview", title: "Dashboard — overview & data sources", content: `## Sections
- **Sales** — bookings, collections, inventory, channel partners, digital leads, footfall
- **Case Management** — open/closed cases, ageing & TAT, category, project, daily complaints register, MIS (TL / RM / inclusion–exclusion)
- **Cost** — non-project FY-26 spend, budget control, vendor ageing
- **PR to PO** — live purchase journey from SAP

## Data
| Feed | Source | Refresh |
|---|---|---|
| Bookings, inventory, footfall | Excel exports | weekly upload |
| Cases | SFDC export | weekly upload |
| Cost | SAP exports (Item Wise, Summary, Total Actual) | each refresh |
| PR to PO | SAP OData \`ZMM_PURCHASE_DASHBOARD_SRV\` via VendorGlobe API Sync | live |

## Deployment
192.168.66.28 port **3000**. The repo holds source only — after every \`git pull\` run \`npm install\` and \`npm run build\`.

## Definitions
- Total = INVR units; Available includes blocked units (Sold + Available = Total).
- Channel-partner bookings with a blank CP name are **Direct**.

## Repository
\`aviverma007/DASHBOARD_SWD\`` },
      { kind: "manual", title: "Dashboard — user guide", content: `## Signing in
Use the login IT gave your team — each login sees only its own sections.

## Using filters
Filters sit in the navy banner at the top of each page; most are multi-select with search. Click any bar or card to drill into the records behind it.

## Mobile
Install **SWD Analytics** on Android, or add the site to your home screen.` },
    ],
    tasks: { group: "Open items", items: [
      { title: "Collection, CRM and Projects modules", priority: "high" },
      { title: "Cost dashboard completion and validation", priority: "high" },
      { title: "Response-summary report (within 24h / no response) — needs SFDC export with First Response Time", priority: "medium" },
      { title: "Live SFDC feed — waiting for Connected App key/secret", priority: "medium" },
      { title: "Chatbot in the dashboard", priority: "low" },
      { title: "Dashboard on the office TV screen", priority: "low" },
      { title: "Android APK build", priority: "low" },
    ] },
  },
  {
    names: ["Cheque Register"], codes: ["CHEQUE_REG"],
    tagline: "Track cheques received, deposited and cleared",
    description: "Cheque Register records every cheque the company receives and follows it through deposit and clearance, so Accounts always knows what is in hand, what is with the bank and what has bounced. It went live together with Smart Leasing, with a go-live mail and a user walkthrough on 27-10-2026.",
    department: "Accounts", category: "Finance & billing", status: "live", priority: "medium",
    techStack: ["React", "Node.js", "SQL Server"], goLiveDate: "2026-10-27",
    docs: [{ kind: "manual", title: "Cheque Register — user guide", content: `## Recording a cheque
1. **New cheque** — party, cheque number, bank, date, amount.
2. When it goes to the bank, mark it **Deposited** with the deposit date.
3. Mark it **Cleared** (or **Bounced**, with the reason) when the bank confirms.

## Finding cheques
Filter by status, party, bank or date range; export the list to Excel.

## Help
IT helpdesk ticket with "Cheque Register" in the subject.` }],
  },
  {
    names: ["MC Review (NFA)", "MC Review"], codes: ["MC_REVIEW"],
    tagline: "Four-page NFA review and approval portal for the Management Committee",
    description: "MC Review is the portal for reviewing NFAs (notes for approval) before the Management Committee. It pulls purchase requisitions and NFAs from the QMS mirror, lets reviewers fill the four review pages, marks items for presentation to the MC, and produces the PDF pack.\n\nA backend rewrite fixed the main freeze (the QMS adapter re-downloading a 5 MB+ window on every request), PDF output and the HybridJson/FieldsJson split. The QMS mirror synced 13,654 records on first boot, with 12 covering indexes for speed. Original Order Value maps to Amount_Including_Tax; PR Budget maps to PR_Budget (₹ → lacs), falling back to NFA_Budget.",
    department: "Management / Procurement", category: "Workflow", status: "live", priority: "high",
    techStack: ["React 19", "Node.js", "Express", "SQL Server"],
    docs: [
      { kind: "technical", title: "MC Review — technical notes", content: `## Server
2023-DT1, port **5094**.

## Key modules
\`qmsSync.js\`, \`qmsAdapter.js\`, \`fields.js\`, \`pdfBuilder.js\` (Unicode font, row-height measurement, page headers/numbers), \`pdfStore.js\`, \`routes/pdf.js\`.

## Data mapping
- Original Order Value → \`Amount_Including_Tax\`
- PR Budget → \`PR_Budget\` (₹ → lacs), fallback \`NFA_Budget\`

## Repository
\`aviverma007/MC_Review\`` },
      { kind: "manual", title: "MC Review — user guide", content: `## Reviewing an NFA
1. Find the NFA by number or PR in the list.
2. Fill the four review pages.
3. Tick **Present to MC** for items going to the committee.
4. **Lock** when done, then download the PDF.

## Help
IT helpdesk ticket mentioning the NFA number.` },
    ],
    releases: [{ version: "2.0", date: "2026-09-05", title: "Backend rewrite", notes: "27 files rewritten: PDF route auth fix, PDF output path, QMS adapter caching (main freeze fix), HybridJson/FieldsJson unification, Present-to-MC at lock, date handling. 12 covering indexes; QMS mirror of 13,654 records." }],
  },
  {
    names: ["HR Careers Portal", "HR Pre-Onboarding"], codes: ["PREONBOARDING"],
    tagline: "Careers, referrals and pre-onboarding with a 9-gate approval flow",
    description: "The HR careers portal: employees refer candidates and apply internally, and HR runs every referral through a strict 9-gate flow — CV received → CV approved → interview scheduled → interview cleared → HOD approved → fitment confirmed → mail sent → documents submitted → onboarding ready.\n\nThere are five roles (Employee, HR, Interviewer, HOD, Candidate). Candidates sign in with a Gmail OTP after HR invites them and upload their documents (5 MB per file, 25 MB per request). It replaces the earlier Pre_Onboarding_SWD pipeline.",
    department: "Human Resources", category: "HR", status: "uat", priority: "medium",
    techStack: ["React 19", "Vite", "Tailwind v4", "Framer Motion", "Flask", "SQL Server"],
    docs: [
      { kind: "overview", title: "HR Careers Portal — the 9-gate flow", content: `| # | Gate | Who |
|---|---|---|
| 1 | CV received | Employee / HR |
| 2 | CV approved | HR |
| 3 | Interview scheduled | HR |
| 4 | Interview cleared | Interviewer |
| 5 | HOD approved | HOD |
| 6 | Fitment confirmed | HR |
| 7 | Mail sent | HR |
| 8 | Documents submitted | Candidate |
| 9 | Onboarding ready | HR |

## Architecture
React 19 frontend, Flask + JWT backend, SQL Server database **HR_PREONBOARDING** on 192.168.66.33. Files stored in the database (5 MB per file, 25 MB per request).` },
      { kind: "manual", title: "HR Careers Portal — user guide", content: `## Employees
Open a job, click **Refer** or **Apply**, attach the CV.

## HR
Move each candidate through the gates from the pipeline board; the next person is notified.

## Candidates
Use the invitation e-mail, sign in with the Gmail OTP and upload your documents.` },
    ],
    tasks: { group: "UAT", items: [
      { title: "First UAT with HR", done: true },
      { title: "Changes from the first UAT", done: true },
      { title: "Second UAT with HR", priority: "high" },
    ] },
  },
  {
    names: ["QMS SAP PR Sync", "QMS PR Sync"], codes: ["QMS_SAP_PR"],
    tagline: "Syncs SAP purchase requisitions into the QMS PR reporting database",
    description: "A background service that pulls purchase requisition data from the SAP landscapes (DS4 / QS4 / PS4 via SM59 destinations) into the QMS_PR_Report SQL Server database. It was rewritten from an insert-every-45-seconds design (29.6 million rows, the 10 GB SQL Express cap and failed writes) to an upsert on the primary key — one row per PR / EPR number — shrinking the database from about 10 GB to 4 MB.",
    department: "Procurement", category: "Integration", status: "maintenance", priority: "medium",
    techStack: ["Python", "Flask", "Waitress", "SQL Server", "SAP RFC", "NSSM"],
    url: "http://192.168.66.34:5002",
    docs: [{ kind: "technical", title: "QMS SAP PR Sync — runbook", content: `## Where it runs
Server 34 — **192.168.66.34:5002**; database **QMS_PR_Report** on 192.168.66.33.

## Service
Windows service under **NSSM** (AppThrottle, auto-restart); Waitress with 8 threads and a 200-connection limit.

## Logs
- \`app\\service_stdout.log\`
- \`app\\service_stderr.log\`
- \`app\\access.log\` (rotating)

## Known issue
Intermittent \`NIECONN_REFUSED\` from SAP Quality/Development is a network-path problem (NAT/HA firewall egress), not the app. Escalation note sent to network.` }],
    releases: [{ version: "2.0", date: "2026-09-05", title: "Upsert rewrite", notes: "Upsert on PR_No / EPR_No instead of insert-every-45s (DB 10 GB → 4 MB); Waitress instead of the Flask dev server; rotating access log; NSSM auto-restart; RUNBOOK.md." }],
  },
  {
    names: ["VendorGlobe API Sync", "PR/NFA API Sync"], codes: ["VENDORGLOBE"],
    tagline: "VendorGlobe PR & NFA-TAT APIs → SQL Server → SAP, plus the live PR-to-PO feed",
    description: "Pulls the two VendorGlobe APIs (SAP PR report and PR-to-NFA TAT report) into SQL Server with no duplicates, so SAP can read them. It also serves browser report pages and powers the dashboard's PR-to-PO journey: purchase orders and requisitions come live from SAP's OData service (ZMM_PURCHASE_DASHBOARD_SRV) into the PR2PO database on .28.\n\nRuns as the Windows service VendorGlobeAPI (Waitress, port 5002) on 192.168.66.28, next to its SQL Server databases VendorGlobe_PR and PR2PO.",
    department: "Procurement", category: "Integration", status: "live", priority: "high",
    techStack: ["Python 3.12", "Flask", "Waitress", "SQL Server 2022", "SAP OData", "NSSM"],
    url: "http://192.168.66.28:5002", environments: [{ label: "NFA TAT report", url: "http://192.168.66.28:5002/nfatat" }],
    docs: [{ kind: "technical", title: "VendorGlobe API Sync — architecture", content: `## Feeds
| Feed | Source | Target |
|---|---|---|
| PR report | VendorGlobe \`SapPrReport.php\` | \`VendorGlobe_PR.PRReportHistory\` (key PR_No) |
| PR → NFA TAT | VendorGlobe \`SapPrNFATatReport.php\` | \`VendorGlobe_PR.PRNFATatReportHistory\` (key EPR_No) |
| POs / PRs | SAP OData \`ZMM_PURCHASE_DASHBOARD_SRV\` (filter on Badat) | \`PR2PO\` |

## Endpoints
- \`/\`, \`/nfatat\`, \`/nfatat/returned\` — report pages (read from SQL)
- \`/api/data\`, \`/nfatat/data\` — live passthroughs for SAP
- \`/pr2po/data\`, \`/pr2po/health\` — dashboard feed
- \`/health\`

## Notes
- Badat is the true PR creation date (Erdat is the refresh date).
- SAP prod PS4 = 192.168.26.31; \`vhsmwps4ci\` is in the hosts file on .28.

## Repository
\`aviverma007/VendorGlobe_API\` — deployed at \`C:\\VendorGlobe_API\`.` }],
    tasks: { group: "Open items", items: [
      { title: "SAP Z table for NFA TAT data, loaded by an SM36 background job", priority: "high" },
      { title: "SM59 cutover from 192.168.66.34", priority: "medium" },
      { title: "SFDC case delta sync (waiting for endpoint and field list)", priority: "medium" },
    ] },
  },
  {
    names: ["M3M One", "M3M_1.O", "M3M_One"], codes: ["M3M_ONE"],
    tagline: "In-house rebuild of the vendor-built M3M project governance app",
    description: "M3M_1.O is the in-house rebuild of the \"BCG – M3M\" project governance admin that an outside vendor built, so the company no longer depends on that vendor. The first phase recreates every page and feature with the same look; the SQL Server backend (database M3M_1O on .28, kept separate because it holds confidential data) is connected next.\n\nExisting project data is migrated from each project's DPR PDF, portfolio by portfolio — M3M Noida first, then Gurgaon and Smartworld.",
    department: "Projects", category: "Project governance", status: "development", priority: "critical",
    techStack: ["React", "TypeScript", "SQL Server"], startDate: "2026-10-01",
    docs: [{ kind: "overview", title: "M3M_1.O — plan", content: `## Goal
Replace the vendor app (m3m-phase-one-admin.applore.in) with an in-house copy and end the vendor contract.

## Phases
1. Exact-look React rebuild of all pages and features
2. SQL Server backend (**M3M_1O** on 192.168.66.28 — separate, confidential)
3. Data migration from DPR PDFs: M3M Noida → Gurgaon → Smartworld
4. Demo to the company owner, then cut-over

## Repository
\`aviverma007/M3M_1.O\`` }],
    tasks: { group: "Rebuild", items: [
      { title: "Rebuild all pages with the same look", priority: "critical" },
      { title: "Build the SQL Server backend and connect it", priority: "high" },
      { title: "Migrate M3M Noida projects from DPR PDFs", priority: "high" },
      { title: "Migrate Gurgaon and Smartworld portfolios", priority: "medium" },
      { title: "Demo to the company owner", priority: "high" },
    ] },
  },
  {
    names: ["Document Flow"], codes: ["DOC_FLOW"],
    tagline: "SAP FI/SD document-type mapping and document-flow viewer",
    description: "Document Flow maps SAP FI/SD document types — customer demands, receipts, vendor invoices and payments — and shows how documents connect, so Finance can follow a transaction from start to end. Development is complete and it is waiting for approval to go live.",
    department: "Finance", category: "SAP", status: "uat", priority: "medium",
    techStack: ["React", "SAP FI/SD"],
    docs: [{ kind: "overview", title: "Document Flow — document types", content: `Document types are classified as:
- **Customer demand**
- **Receipt**
- **Vendor invoice**
- **Payment**

The mapping comes from the SAP FI/SD document-type sheet (\`DOC_TYPES.xlsx\`).` }],
    tasks: { group: "Go-live", items: [{ title: "Approval to go live", priority: "high" }] },
  },
  {
    names: ["MIS Company", "Complaint MIS", "MIS_Copmany"], codes: ["MIS_COMPANY"],
    tagline: "One complaint MIS for M3M, Smartworld and NoBrokerHood",
    description: "A single complaint MIS covering the three companies — M3M, Smartworld and NBH (NoBrokerHood). One login opens a home page to pick the company; each company's original MIS app runs unchanged behind the gateway. Data comes from an Excel per company (data/m3m, data/smartworld, data/nbh) that is replaced to refresh — no rebuild needed.",
    department: "CRM", category: "Analytics", priority: "medium",
    techStack: ["Python", "FastAPI"],
    docs: [{ kind: "manual", title: "Complaint MIS — refreshing data", content: `1. Export the latest complaints to Excel for the company.
2. Replace the file in \`data/m3m\`, \`data/smartworld\` or \`data/nbh\`.
3. Reload the page — the MIS picks up the new data.` }],
  },
  {
    names: ["IT Manager"], codes: ["IT_MANAGER"],
    tagline: "Portfolio manager for every application — landscape, usage, tickets, docs and rights",
    description: "IT Manager lists every application Smartworld runs — the apps built in-house and the licensed vendor software. For each one it shows the licence landscape (seats, active users, % in use), live usage from the tracking script, helpdesk tickets from ServiceDesk Plus, the people using it, progress via task checklists, documents and user manuals, releases, screenshots, access rights and a full audit log.",
    department: "IT", category: "IT operations", status: "live", priority: "high",
    techStack: ["React 19", "TypeScript", "Vite", "Tailwind v4", "Node.js", "Express", "Playwright"],
    startDate: "2026-11-15", goLiveDate: "2026-11-18",
    docs: [{ kind: "technical", title: "IT Manager — running it", content: `## Server
192.168.66.28, port **4000**. Update with \`git pull\`, \`npm run build\`, \`npm start\`.

## Configuration (.env)
- \`SDP_*\` — ServiceDesk Plus ticket sync
- \`PORT\`, \`DATA_DIR\`, \`CAPTURE_ON_START\`

## Data
\`server/data/db.json\` (a \`.bak\` copy is kept on every start). Logos live in \`server/logos\`.

## Repository
\`aviverma007/IT_MANAGER\`` }],
  },
];

/* ------------------------------------------------------------------ vendor apps ------------------------------------------------------------------ */

const V = (names: string[], tagline: string, description: string, department: string, uses: string[], extra: Partial<AppDetails> = {}): AppDetails => ({
  names, tagline, description, department, ...extra,
  docs: [{ kind: "overview", title: `${names[0]} — overview`, content: `## What it is\n${description}\n\n## Used for\n${uses.map((u) => `- ${u}`).join("\n")}\n\n## Who uses it\n${department}\n\n## Getting access\nRaise a request on the IT helpdesk (ServiceDesk Plus) with "${names[0]}" in the subject. Licences are assigned by IT.\n\n## Support\nFirst line: IT helpdesk. Product issues are escalated to the vendor by IT.` }],
});

const VENDOR: AppDetails[] = [
  V(["SAP"], "S/4HANA ERP — finance, sales, materials and projects", "SAP S/4HANA is Smartworld's core ERP: finance and controlling (FI/CO), sales and distribution (SD), materials management and procurement (MM) and project systems (PS). Purchase requisitions, purchase orders, vendor and customer invoices, budgets per WBS and all accounting run here.", "Finance, Accounts, Procurement, Sales, Projects", ["General ledger, payables and receivables (FI)", "Customer orders and billing (SD)", "Purchase requisitions, POs and goods receipt (MM)", "WBS budgets and project costs (PS)"], { techStack: ["SAP S/4HANA"] }),
  V(["Tally", "Tally Prime"], "Accounting for group entities kept outside SAP", "TallyPrime is the accounting package used for the group companies whose books are not on SAP — vouchers, ledgers, GST returns and statutory reports.", "Accounts", ["Day-to-day vouchers and ledgers", "GST and TDS reporting", "Trial balance and financial statements"]),
  V(["Tally TS Client"], "Tally on Terminal Server — remote access to Tally", "Tally accessed through a terminal-server (remote desktop) client, so accounts staff at different sites work on the same Tally company data.", "Accounts", ["Working on central Tally data from other sites", "Shared access without copying data files"]),
  V(["Salesforce", "SFDC"], "CRM — leads, bookings and customer cases", "Salesforce is the CRM for sales and customer relations: leads and enquiries, site visits, bookings, and customer cases (complaints and service requests) with their TAT and resolution.", "Sales, CRM", ["Lead and enquiry management", "Site-visit and booking tracking", "Customer case management (feeds the dashboard's Case Management)"]),
  V(["4QT"], "Real-estate ERP / CRM", "4QT (4th Quarter Technologies) is a cloud real-estate ERP covering real-estate CRM, construction ERP, commercial lease management and facilities management.", "Sales, CRM", ["Real-estate sales CRM", "Post-sales and customer accounts"]),
  V(["Knowlarity"], "Cloud telephony — IVR, call routing and recording", "Knowlarity provides cloud telephony: virtual numbers, IVR, call routing to the sales team, call recording and call analytics.", "Sales, CRM", ["Inbound sales calls and IVR", "Call recording and analytics"]),
  V(["Reloy"], "Referral and loyalty marketing for real estate", "Reloy runs customer referral and loyalty programmes for real-estate developers — existing customers refer new buyers and earn rewards.", "Marketing, CRM", ["Customer referral campaigns", "Loyalty rewards and engagement"]),
  V(["Engati"], "Chatbots and WhatsApp marketing", "Engati is a conversational-AI platform used for website chatbots and WhatsApp campaigns that capture and qualify leads.", "Marketing", ["Website chatbot", "WhatsApp campaigns and lead capture"]),
  V(["Brevo", "Sendinblue"], "E-mail and SMS campaigns", "Brevo (formerly Sendinblue) sends marketing e-mail and SMS campaigns and transactional messages, with contact lists and campaign reports.", "Marketing", ["E-mail newsletters and campaigns", "SMS campaigns", "Campaign reports"]),
  V(["Novade"], "Construction field management — quality, safety, progress", "Novade is a construction field-management platform: site inspections and checklists, quality and safety, snag lists, daily site reports and progress tracking on mobile.", "Projects, Construction", ["Quality and safety inspections", "Snags and punch lists", "Daily progress reports from site"]),
  V(["Visilean"], "Lean construction planning", "VisiLean is a lean construction planning tool — look-ahead plans, weekly work plans, constraints and PPC (percent plan complete), linked to the BIM model.", "Projects, Planning", ["Look-ahead and weekly work plans", "Constraint tracking", "PPC reporting"]),
  V(["BIM 360"], "Autodesk BIM collaboration", "Autodesk BIM 360 (Construction Cloud) is where design teams share models and drawings, review them, and manage RFIs and issues.", "Design, Projects", ["Model and drawing sharing", "Design review and issues", "RFIs"]),
  V(["AutoCAD"], "2D/3D drafting", "Autodesk AutoCAD is the drafting tool for architectural and services drawings.", "Design, Projects", ["Architectural and services drawings", "Drawing revisions"]),
  V(["SketchUp"], "3D modelling", "SketchUp is used for quick 3D massing and design models and presentations.", "Design", ["Concept and massing models", "Design presentations"]),
  V(["Tekla"], "Structural BIM modelling and detailing", "Tekla Structures is used for detailed structural BIM — steel and concrete modelling, reinforcement detailing and fabrication drawings.", "Design (Structures)", ["Structural models", "Rebar and steel detailing"]),
  V(["MSP", "Microsoft Project"], "Microsoft Project — project schedules", "Microsoft Project is used to build and track project schedules: tasks, durations, dependencies, milestones and baselines.", "Projects, Planning", ["Master and site schedules", "Milestone and baseline tracking"]),
  V(["Microsoft 365", "M365"], "Outlook, Teams, OneDrive, SharePoint and Office", "Microsoft 365 is the company's e-mail and collaboration suite: Outlook mail, Teams chat and meetings, OneDrive and SharePoint file storage, and Word, Excel and PowerPoint.", "All employees", ["E-mail (Outlook)", "Chat and meetings (Teams)", "Files (OneDrive, SharePoint)", "Office apps"]),
  V(["Adobe CC", "Adobe"], "Adobe Creative Cloud", "Adobe Creative Cloud gives the design and marketing teams Photoshop, Illustrator, InDesign and the rest of the Adobe apps.", "Marketing, Design", ["Brochures and creatives", "Image editing", "Print and digital layouts"]),
  V(["Photoshop"], "Image editing", "Adobe Photoshop for image editing, renders touch-up and marketing creatives.", "Marketing, Design", ["Render and photo editing", "Social and print creatives"]),
  V(["Acrobat Pro"], "PDF editing and e-signatures", "Adobe Acrobat Pro creates, edits, combines and signs PDFs.", "All departments", ["Editing and combining PDFs", "Signing and sending documents"]),
  V(["Claude"], "AI assistant (Anthropic)", "Claude is Anthropic's AI assistant, used for drafting, analysis, summarising documents and coding help.", "IT and business teams", ["Drafting and summarising", "Data and document analysis", "Coding help"]),
  V(["ChatGPT"], "AI assistant (OpenAI)", "ChatGPT is OpenAI's AI assistant, used for drafting, research and analysis.", "Business teams", ["Drafting and research", "Analysis"]),
  V(["Copilot", "Microsoft Copilot"], "AI assistant in Microsoft 365", "Microsoft Copilot works inside Outlook, Teams, Word, Excel and PowerPoint — summarising mail and meetings, drafting documents and analysing spreadsheets.", "Microsoft 365 users", ["Meeting and mail summaries", "Drafting in Word and PowerPoint", "Excel analysis"]),
  V(["Adrenalin", "Adrenaline"], "HRMS — employee records, attendance and payroll", "Adrenalin is the HRMS: employee master, attendance and leave, payroll and payslips, and employee self-service.", "Human Resources, all employees", ["Employee master", "Attendance and leave", "Payroll and payslips", "Employee self-service"]),
  V(["Ma Foi", "Mafoi"], "HR statutory compliance and payroll services", "Ma Foi provides HR services — payroll outsourcing and statutory labour-law compliance (registers, returns and filings).", "Human Resources", ["Statutory compliance (PF, ESI, labour laws)", "Payroll processing support"]),
  V(["Complinity"], "Compliance management", "Complinity tracks statutory and regulatory compliances — what is due, who owns it, and proof of filing — with reminders and reports.", "Legal, Compliance", ["Compliance calendar and reminders", "Ownership and proof of compliance", "Compliance reports"]),
  V(["ManageEngine", "ServiceDesk Plus", "Manage Engine"], "IT helpdesk — ServiceDesk Plus Cloud", "ManageEngine ServiceDesk Plus Cloud is the IT helpdesk where employees raise requests and incidents and IT tracks them to closure. IT Manager reads these tickets to show issues per application.", "IT, all employees", ["Raising IT requests and incidents", "Ticket assignment and SLAs", "Ticket reports (synced into IT Manager)"], { url: "https://sdpondemand.manageengine.com/app/itdesk" }),
  V(["ITS"], "Invoice Tracking System", "ITS — Invoice Tracking System — follows vendor invoices from receipt through checking and approval to payment, so Accounts and Projects can see where each invoice is.", "Accounts, Projects", ["Invoice inward and tracking", "Approval status", "Payment follow-up"]),
  V(["Power BI", "PowerBI"], "Microsoft Power BI reports", "Microsoft Power BI is used for interactive business reports and dashboards shared across teams.", "Management, analysts", ["Business dashboards", "Shared reports"]),
  V(["VendorGlobe"], "Vendor and purchase-requisition portal", "VendorGlobe is the vendor-facing procurement portal for purchase requisitions and the NFA approval workflow. Its PR and NFA-TAT reports are pulled into SQL Server by the in-house VendorGlobe API Sync service.", "Procurement", ["Purchase requisitions", "NFA approvals and TAT", "Vendor collaboration"]),
  V(["Computex"], "IT application (details to be added)", "Computex is one of the IT applications in the Smartworld landscape. Add its purpose, users and access process here.", "IT", ["To be documented"]),
  V(["Dhruva"], "ERP & Finance application (details to be added)", "Dhruva is part of the ERP & Finance landscape. Add its purpose, users and access process here.", "Finance", ["To be documented"]),
  V(["Vista"], "ERP & Finance application (details to be added)", "Vista is part of the ERP & Finance landscape. Add its purpose, users and access process here.", "Finance", ["To be documented"]),
  V(["Rubix"], "ERP & Finance application (details to be added)", "Rubix is part of the ERP & Finance landscape. Add its purpose, users and access process here.", "Finance", ["To be documented"]),
];

export const APP_DETAILS: AppDetails[] = [...INHOUSE, ...VENDOR];

export function detailsFor(app: { name: string; code: string; source?: string }) {
  const n = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const name = n(app.name);
  return APP_DETAILS.find((d) => d.names.some((x) => n(x) === name))
    ?? (app.source !== "vendor" ? APP_DETAILS.find((d) => d.codes?.some((c) => n(c) === n(app.code))) : undefined);
}
