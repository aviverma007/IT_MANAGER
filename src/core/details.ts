// Real details for every Smartworld application — About text, owner department, stack, dates, docs,
// release history and open items. Applied by Service.fillDetails() (once automatically, or from Settings).
// Written from the user's point of view — no servers, databases or code. Unknown dates are left blank rather than guessed.
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

const HELP = (app: string) => `## Need help?\nRaise a ticket on the IT helpdesk with "${app}" in the subject, or speak to the IT team.`;

const INHOUSE: AppDetails[] = [
  {
    names: ["SmartDesk"], codes: ["SMARTDESK"],
    tagline: "Your employee portal — everything about working at Smartworld in one place",
    description: "SmartDesk is the home page for every Smartworld employee. Find colleagues in the directory, check your attendance, see company news and photos, and reach workplace services — all in one place. You sign in with just your employee code, and the search box finds anything inside SmartDesk.\n\nHR keeps the employee list and photo gallery up to date every month, so new joiners appear automatically.",
    department: "All employees", category: "Employee portal", status: "uat", priority: "high",
    url: "http://192.168.66.28:92", environments: [{ label: "Office Wi-Fi", url: "http://www.smartdesk.com:92" }],
    docs: [{ kind: "manual", title: "SmartDesk — user guide", content: `## Signing in
1. Open **www.smartdesk.com:92** while on the office network.
2. Enter your **employee code**. That's it — no password or Microsoft login needed.

## What you can do
- **Directory** — search colleagues by name, department or employee code.
- **Attendance** — see your own attendance.
- **Gallery** — company photos and events.
- **Search** — the box at the top looks through everything in SmartDesk.

## Leave
Leave is applied in the HR employee portal, not in SmartDesk.

${HELP("SmartDesk")}` }],
    tasks: { group: "Before launch", items: [
      { title: "Walkthrough session with the team", priority: "high" },
      { title: "HR go-ahead for launch", priority: "critical" },
    ] },
  },
  {
    names: ["Smart Leasing", "Leasing SWD"], codes: ["LEASING_SWD"],
    tagline: "Commercial leasing & billing for Gems-2, Sector-89 Gurugram",
    description: "Smart Leasing handles everything for the commercial units at Gems-2, Sector-89 Gurugram — from signing a lease to collecting the rent. Add customers and brokers, create leases with a simple step-by-step form, and the app works out rent, escalations and GST for you.\n\nEvery month it generates tax invoices and e-invoices, and keeps each tenant's ledger, receipts, credit and debit notes and lease documents together. Important records (leases, invoices, collections, credit notes) are checked and approved by a second person before they're final. Payment reminders are never sent on their own — you always review and confirm them first. Finance gets twelve ready-made Excel reports.",
    department: "Leasing & Finance", category: "Finance & billing", status: "live", priority: "critical",
    goLiveDate: "2026-10-27", version: "4.1",
    url: "http://192.168.66.28:96", environments: [{ label: "Domain", url: "http://smartleasing.com:96" }],
    docs: [{ kind: "manual", title: "Smart Leasing — user guide", content: `## Signing in
Open **smartleasing.com:96** on the office network and sign in with the login IT gave you.

## Everyday flow
1. **Customers & brokers** — add the tenant (and broker, if any) once.
2. **New lease** — follow the steps: unit → customer → terms → rent & escalation → documents.
3. **Approval** — the approver checks and approves the lease.
4. **Invoices** — generate the month's invoices in one click. If a lease is skipped, the app tells you why.
5. **Collections** — record payments against invoices; the approver confirms them.
6. **Credit / debit notes** — raise them when an amount needs correcting.

## Tenant ledger & documents
Open any lease to see its full history, ledger and stored documents.

## Reminders
Payment reminders open a review window first — nothing is e-mailed until you confirm.

## Reports
Twelve Excel reports for Finance are under **Reports**.

${HELP("Leasing")}` }],
    releases: [
      { version: "3.0", date: "2026-10-15", title: "Complete rebuild", notes: "Separate customer and broker lists, step-by-step lease form, credit and debit notes, tenant ledger, document storage per lease and rent escalation." },
      { version: "4.0", date: "2026-10-27", title: "Approvals and full history", notes: "Every record has its own page with full history. Leases, invoices, collections and credit notes now need a second person's approval. Launched to users with a walkthrough on 27 Oct." },
      { version: "4.1", date: "2026-11-07", title: "E-mail from the app", notes: "Invoices and reminders can now be e-mailed directly from Smart Leasing." },
    ],
    tasks: { group: "Coming next (agreed in the 06-Nov review)", items: [
      { title: "Payment reminders with review before sending", priority: "high" },
      { title: "Rate per unit", priority: "medium" },
      { title: "Rent start and escalation from the rent commencement date", priority: "high" },
      { title: "Revenue-share tiers", priority: "medium" },
      { title: "Minimum guarantee + revenue billing for multi-store brands", priority: "medium" },
      { title: "Investor payouts", priority: "medium" },
      { title: "Read lease details from scanned deeds", priority: "low" },
    ] },
  },
  {
    names: ["Sales & Leasing Dashboard", "Analytics Dashboard", "DASHBOARD_SWD"], codes: ["DASHBOARD_SWD"],
    tagline: "Management dashboard — sales, customer cases, cost and purchasing at a glance",
    description: "The management dashboard shows how the business is doing on one screen. See bookings, collections, inventory, channel partners, leads and site footfall; follow customer complaints with their ageing and TAT; track spend against budget; and watch purchase requisitions move to purchase orders.\n\nClick any chart to see the records behind it. Each team signs in with its own login and sees only its own sections. It also works on Android as the SWD Analytics app.",
    department: "Management / Sales", category: "Analytics", status: "live", priority: "high",
    url: "http://192.168.66.28:3000", environments: [{ label: "Domain", url: "http://swdashboard.com:3000" }],
    docs: [{ kind: "manual", title: "Dashboard — user guide", content: `## Signing in
Open **swdashboard.com:3000** and use your team's login — you'll see only the sections for your team.

## Sections
- **Sales** — bookings, collections, inventory, channel partners, digital leads, footfall
- **Case Management** — open and closed complaints, ageing & TAT, categories, daily register, MIS reports
- **Cost** — spend against budget, vendor ageing
- **PR to PO** — where each purchase requisition is in its journey to a purchase order

## Tips
- Filters are in the dark banner at the top of each page; most let you pick several values.
- Click any bar, card or slice to open the records behind it.
- "Available" units include blocked units. Bookings with no channel partner count as **Direct**.

## On your phone
Install **SWD Analytics** on Android, or add the site to your home screen.

${HELP("Dashboard")}` }],
    tasks: { group: "Coming next", items: [
      { title: "Collection, CRM and Projects sections", priority: "high" },
      { title: "Cost dashboard — final version", priority: "high" },
      { title: "Complaint response report (answered within 24 hours / not answered)", priority: "medium" },
      { title: "Chatbot to ask questions about the data", priority: "low" },
      { title: "Dashboard on the office TV screen", priority: "low" },
    ] },
  },
  {
    names: ["Cheque Register"], codes: ["CHEQUE_REG"],
    tagline: "Track every cheque from receipt to clearance",
    description: "Cheque Register keeps a list of every cheque the company receives and follows it until the money is in. Record the cheque when it arrives, mark it when it goes to the bank, and mark it cleared or bounced — so Accounts always knows what's in hand, what's with the bank and what needs follow-up.",
    department: "Accounts", category: "Finance & billing", status: "live", priority: "medium", goLiveDate: "2026-10-27",
    docs: [{ kind: "manual", title: "Cheque Register — user guide", content: `## Recording a cheque
1. Click **New cheque** and fill in the party, cheque number, bank, date and amount.
2. When it goes to the bank, mark it **Deposited** with the deposit date.
3. When the bank confirms, mark it **Cleared** — or **Bounced**, with the reason.

## Finding cheques
Filter by status, party, bank or date, and export the list to Excel.

${HELP("Cheque Register")}` }],
  },
  {
    names: ["MC Review (NFA)", "MC Review"], codes: ["MC_REVIEW"],
    tagline: "Review NFAs and prepare the Management Committee pack",
    description: "MC Review is where NFAs (notes for approval) are reviewed before they go to the Management Committee. Each NFA comes in with its purchase requisition, order value and budget already filled. Reviewers complete the four review pages, pick which items go to the committee, and download the meeting pack as a PDF.",
    department: "Management / Procurement", category: "Workflow", status: "live", priority: "high",
    docs: [{ kind: "manual", title: "MC Review — user guide", content: `## Reviewing an NFA
1. Find the NFA by its number or PR number.
2. Check the details already filled in — order value and budget come in automatically.
3. Complete the four review pages.
4. Tick **Present to MC** for items going to the committee.
5. **Lock** the review when you're done.

## The MC pack
Download the PDF pack for the meeting from the NFA list.

${HELP("MC Review")}` }],
    releases: [{ version: "2.0", date: "2026-09-05", title: "Faster and more reliable", notes: "Pages load much faster, PDFs download correctly, and the Present-to-MC tick is kept when a review is locked." }],
  },
  {
    names: ["HR Careers Portal", "HR Pre-Onboarding"], codes: ["PREONBOARDING"],
    tagline: "Refer friends, apply internally, and onboard new joiners",
    description: "The HR Careers Portal lets employees see open jobs, refer friends and apply internally. HR moves each candidate through nine clear steps — from CV received, interview and HOD approval, to offer mail, documents and onboarding — so everyone can see exactly where a candidate is.\n\nCandidates get an invitation e-mail, sign in with a one-time code sent to their Gmail, and upload their joining documents themselves.",
    department: "Human Resources", category: "HR", status: "uat", priority: "medium",
    docs: [{ kind: "manual", title: "HR Careers Portal — user guide", content: `## For employees
Open a job and click **Refer** or **Apply**, then attach the CV.

## For HR, interviewers and HODs
Each candidate moves through nine steps:

| # | Step | Done by |
|---|---|---|
| 1 | CV received | Employee / HR |
| 2 | CV approved | HR |
| 3 | Interview scheduled | HR |
| 4 | Interview cleared | Interviewer |
| 5 | HOD approved | HOD |
| 6 | Fitment confirmed | HR |
| 7 | Offer mail sent | HR |
| 8 | Documents submitted | Candidate |
| 9 | Ready to onboard | HR |

The next person is notified at each step.

## For candidates
Use the link in your invitation e-mail, sign in with the code sent to your Gmail, and upload your documents (up to 5 MB each).

${HELP("HR Careers Portal")}` }],
    tasks: { group: "Testing with HR", items: [
      { title: "First round of testing with HR", done: true },
      { title: "Changes from the first round", done: true },
      { title: "Second round of testing with HR", priority: "high" },
    ] },
  },
  {
    names: ["QMS SAP PR Sync", "QMS PR Sync"], codes: ["QMS_SAP_PR"],
    tagline: "Keeps the QMS purchase-requisition report up to date from SAP",
    description: "QMS SAP PR Sync works in the background so the QMS purchase-requisition report always shows the latest PRs from SAP. There's nothing to open or click — if the QMS PR report looks out of date, tell the IT team.",
    department: "Procurement", category: "Integration", status: "maintenance", priority: "medium",
    url: "http://192.168.66.34:5002",
  },
  {
    names: ["VendorGlobe API Sync", "PR/NFA API Sync"], codes: ["VENDORGLOBE"],
    tagline: "PR and NFA status reports from VendorGlobe, and the PR-to-PO tracker",
    description: "VendorGlobe API Sync brings purchase requisitions and NFA approval times from VendorGlobe into Smartworld's own systems, so SAP and the management dashboard always have the latest status. It also gives you two simple report pages — PR report and NFA TAT (how long each NFA took at every approval level) — and feeds the dashboard's PR-to-PO journey.",
    department: "Procurement", category: "Integration", status: "live", priority: "high",
    url: "http://192.168.66.28:5002", environments: [{ label: "NFA TAT report", url: "http://192.168.66.28:5002/nfatat" }],
    docs: [{ kind: "manual", title: "PR & NFA reports — user guide", content: `## PR report
Open the link and search by PR number, project or date to see each requisition's status.

## NFA TAT report
Open **NFA TAT report** to see how long each NFA spent with the validator and at every approval level, and who it is pending with now. The **Returned** view lists NFAs sent back.

## In the dashboard
The **PR to PO** section of the management dashboard uses this data to show each requisition's journey to a purchase order.

${HELP("PR / NFA reports")}` }],
  },
  {
    names: ["M3M One", "M3M_1.O", "M3M_One"], codes: ["M3M_ONE"],
    tagline: "Project governance for the M3M portfolio — built in-house",
    description: "M3M_1.O is Smartworld's own version of the M3M project-governance app, built in-house to replace the outside vendor's app. It shows the same pages and works the same way, so teams don't have to learn anything new. Project data is being brought over portfolio by portfolio — M3M Noida first, then Gurgaon and Smartworld.",
    department: "Projects", category: "Project governance", status: "development", priority: "critical", startDate: "2026-10-01",
    tasks: { group: "Rollout", items: [
      { title: "All pages ready with the same look", priority: "critical" },
      { title: "M3M Noida projects moved over", priority: "high" },
      { title: "Gurgaon and Smartworld portfolios moved over", priority: "medium" },
      { title: "Demo to the management", priority: "high" },
    ] },
  },
  {
    names: ["Document Flow"], codes: ["DOC_FLOW"],
    tagline: "Follow any SAP finance document from start to finish",
    description: "Document Flow shows how SAP finance documents connect — a customer demand, its receipt, the vendor invoice and the payment — so Finance can follow any transaction end to end and see what each document type means. It's ready and waiting for approval to go live.",
    department: "Finance", category: "SAP", status: "uat", priority: "medium",
    tasks: { group: "Go-live", items: [{ title: "Approval to go live", priority: "high" }] },
  },
  {
    names: ["MIS Company", "Complaint MIS", "MIS_Copmany"], codes: ["MIS_COMPANY"],
    tagline: "One complaint MIS for M3M, Smartworld and NoBrokerHood",
    description: "One link for the complaint MIS of all three companies — M3M, Smartworld and NoBrokerHood. Sign in once, pick the company, and you get its familiar MIS reports exactly as before. Data is refreshed from each company's latest complaints export.",
    department: "CRM", category: "Analytics", priority: "medium",
    docs: [{ kind: "manual", title: "Complaint MIS — user guide", content: `## Using it
1. Open the link and sign in.
2. Choose **M3M**, **Smartworld** or **NoBrokerHood**.
3. Use the reports as before.

## Refreshing data
Send the latest complaints export to IT, or replace the company's Excel in its data folder.

${HELP("Complaint MIS")}` }],
  },
  {
    names: ["IT Manager"], codes: ["IT_MANAGER"],
    tagline: "Every Smartworld application in one place — usage, tickets, users and docs",
    description: "IT Manager lists every application Smartworld uses — the ones IT builds and the licensed software. For each app you can see how many people use it and how many licences are in use, its open helpdesk tickets, who its users are, what's being worked on, and its user guide — and open the app in one click.",
    department: "IT", category: "IT operations", status: "live", priority: "high", startDate: "2026-11-15", goLiveDate: "2026-11-18",
    docs: [{ kind: "manual", title: "IT Manager — user guide", content: `## Finding an app
Use the search (Ctrl K) or the **Applications** page. Switch between **Grouped**, **Cards** and **List**.

## On each app
- **Open** launches the app.
- Hover a card to see seats used, active users and open tickets.
- The app page has its overview, user guide, tasks, users and tickets.

${HELP("IT Manager")}` }],
  },
];

/** Doc titles from the first, technical version of these details — removed when the user-friendly version is applied. */
export const RETIRED_DOC_TITLES = [
  "SmartDesk — overview & architecture", "Smart Leasing — overview & architecture", "Dashboard — overview & data sources",
  "MC Review — technical notes", "HR Careers Portal — the 9-gate flow", "QMS SAP PR Sync — runbook",
  "VendorGlobe API Sync — architecture", "M3M_1.O — plan", "Document Flow — document types", "Complaint MIS — refreshing data", "IT Manager — running it",
];
/** Technical task titles from the first version — removed along with them (only while still open). */
export const RETIRED_TASK_TITLES = [
  "Final walkthrough meeting with the team", "Shared folder on .28 for HR (gallery photos + employee Excel)",
  "Dunning reminders (review + manual confirm)", "Per-unit rate", "RCD-based rent start and escalation", "Revenue tiers (to 50 / 50–70 / 70+)",
  "Negotiated MG + revenue billing for multi-store brands", "Lease deed reading from scanned PDFs (OCR)",
  "Collection, CRM and Projects modules", "Cost dashboard completion and validation",
  "Response-summary report (within 24h / no response) — needs SFDC export with First Response Time", "Live SFDC feed — waiting for Connected App key/secret",
  "Chatbot in the dashboard", "Android APK build", "Second UAT with HR", "First UAT with HR", "Changes from the first UAT",
  "SAP Z table for NFA TAT data, loaded by an SM36 background job", "SM59 cutover from 192.168.66.34", "SFDC case delta sync (waiting for endpoint and field list)",
  "Rebuild all pages with the same look", "Build the SQL Server backend and connect it", "Migrate M3M Noida projects from DPR PDFs",
  "Migrate Gurgaon and Smartworld portfolios", "Demo to the company owner",
  "Investor payouts", "HR go-ahead for launch", "Dashboard on the office TV screen",
];

/* ------------------------------------------------------------------ vendor apps ------------------------------------------------------------------ */

const V = (names: string[], tagline: string, description: string, department: string, uses: string[], extra: Partial<AppDetails> = {}): AppDetails => ({
  names, tagline, description, department, ...extra,
  docs: [{ kind: "overview", title: `${names[0]} — overview`, content: `## What it is\n${description}\n\n## Used for\n${uses.map((u) => `- ${u}`).join("\n")}\n\n## Who uses it\n${department}\n\n## Getting access\nRaise a request on the IT helpdesk (ServiceDesk Plus) with "${names[0]}" in the subject. Licences are assigned by IT.\n\n## Need help?\nRaise a ticket on the IT helpdesk — IT will contact the vendor if needed.` }],
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
  V(["ManageEngine", "ServiceDesk Plus", "Manage Engine"], "IT helpdesk — ServiceDesk Plus Cloud", "ManageEngine ServiceDesk Plus Cloud is the IT helpdesk where employees raise requests and incidents and IT tracks them to closure. Tickets mentioning an application also show up on that app in IT Manager.", "IT, all employees", ["Raising IT requests and incidents", "Ticket assignment and SLAs", "Ticket reports (synced into IT Manager)"], { url: "https://sdpondemand.manageengine.com/app/itdesk" }),
  V(["ITS"], "Invoice Tracking System", "ITS — Invoice Tracking System — follows vendor invoices from receipt through checking and approval to payment, so Accounts and Projects can see where each invoice is.", "Accounts, Projects", ["Invoice inward and tracking", "Approval status", "Payment follow-up"]),
  V(["Power BI", "PowerBI"], "Microsoft Power BI reports", "Microsoft Power BI is used for interactive business reports and dashboards shared across teams.", "Management, analysts", ["Business dashboards", "Shared reports"]),
  V(["VendorGlobe"], "Vendor and purchase-requisition portal", "VendorGlobe is the vendor-facing procurement portal for purchase requisitions and the NFA approval workflow. Its PR and NFA reports also appear in Smartworld's own PR & NFA reports and the management dashboard.", "Procurement", ["Purchase requisitions", "NFA approvals and TAT", "Vendor collaboration"]),
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
