// User manuals for the in-house applications. The server turns these into illustrated PDFs:
// it opens the app in Edge, signs in (login typed by the user, never stored), captures each section's
// screen, and lays out cover → contents → sections (steps + screenshot) → help.
// `shot.path` opens a page (relative to the app link); `shot.click` clicks menu items by their visible text.

export interface ManualShot { path?: string; click?: string[]; wait?: number }
export interface ManualSection { title: string; text?: string; steps?: string[]; tips?: string[]; shot?: ManualShot }
export interface Manual {
  names: string[];
  codes?: string[];
  audience: string;
  intro: string;
  /** shown before sign-in sections: what the reader needs */
  before?: string[];
  loginNote?: string;
  sections: ManualSection[];
  faq?: { q: string; a: string }[];
}

const SIGN_IN = (how: string): ManualSection => ({ title: "Signing in", text: how, shot: { path: "" } });

export const MANUALS: Manual[] = [
  {
    names: ["SmartDesk"], codes: ["SMARTDESK"], audience: "All Smartworld employees",
    intro: "SmartDesk is the Smartworld employee portal: the home page for company news, the employee directory, live attendance, policies, the holiday calendar, dashboards and handy tools.",
    before: ["Be on the office network (Wi-Fi or LAN).", "Know your employee code."],
    loginNote: "Use an employee code that can see the whole portal (an admin code also shows Access Control).",
    sections: [
      SIGN_IN("Open www.smartdesk.com:92 and sign in with your employee code."),
      { title: "Home", text: "The Home page shows highlights, new joiners, birthdays, announcements and the quick-access ticker.", steps: ["After signing in you land on Home.", "Scroll for highlights, new joiners and announcements.", "Use the ticker at the top for quick links to other company systems."], shot: { click: ["Home"] } },
      { title: "Employee Directory", text: "Find any colleague.", steps: ["Click Employee Directory in the menu.", "Type a name, employee code, department, designation or location in the search box.", "Click a person to see their card with contact details and reporting line."], shot: { click: ["Employee Directory"] } },
      { title: "Live Attendance", text: "See today's attendance as it happens.", steps: ["Click Live Attendance.", "Filter by department or location.", "Search for an employee to see their in-time."], shot: { click: ["Live Attendance"] } },
      { title: "Policies", text: "All company policies in one place.", steps: ["Click Policies.", "Choose HR, Admin or IT policies.", "Open a policy to read or download it."], shot: { click: ["Policies"] } },
      { title: "Holiday Calendar", steps: ["Click Holiday Calendar.", "See every holiday of the year and the next upcoming one."], shot: { click: ["Holiday Calendar"] } },
      { title: "Dashboard", text: "Company reports (Power BI) in one place.", steps: ["Click Dashboard.", "Pick a report — Sales, PO, QMS, Attendance, Cost and more.", "Use the report's own filters; click full-screen for a bigger view."], shot: { click: ["Dashboard"] } },
      { title: "Tools", text: "Handy file tools, such as converting files between formats.", steps: ["Click Tools.", "Choose the tool you need and upload your file.", "Download the result."], shot: { click: ["Tools"] } },
      { title: "Search and the assistant", steps: ["Use the search box at the top to look through everything in SmartDesk.", "Ask the SmartDesk assistant simple questions — holidays, policies, people, dashboards."], tips: ["Leave is applied in the HR employee portal (Adrenalin), not in SmartDesk."] },
      { title: "Access Control (admins)", text: "Admins decide who can see which parts of SmartDesk.", steps: ["Click Access Control (shown to admins only).", "Find the employee or role.", "Tick the sections they may open and save."], shot: { click: ["Access Control"] } },
    ],
    faq: [{ q: "I can't find a new joiner.", a: "HR refreshes the employee list monthly. Ask HR if the person is still missing after the refresh." }],
  },
  {
    names: ["Smart Leasing", "Leasing SWD"], codes: ["LEASING_SWD"], audience: "Leasing team, Finance and approvers",
    intro: "Smart Leasing runs commercial leasing and billing for Gems-2, Sector-89 Gurugram — units, customers and brands, leases, invoices and credit notes, collections and ledgers, investor payouts and reports — with maker–checker approvals on important records.",
    before: ["Your Smart Leasing login (given by the admin).", "Your role decides which menu items you see."],
    loginNote: "Use an admin login so every module appears in the manual.",
    sections: [
      SIGN_IN("Open smartleasing.com:96 and sign in with your username and password."),
      { title: "Dashboard", text: "Occupancy, billing and collections at a glance.", steps: ["After signing in you land on the Dashboard.", "See occupied and vacant units, this month's billing, collections and dues.", "Click a card to open the records behind it."], shot: { click: ["Dashboard"] } },
      { title: "Projects, blocks and inventory", steps: ["Open Inventory to see every unit with its block, area and status.", "Filter by block or status (vacant / leased).", "Click a unit to see its lease history."], shot: { click: ["Inventory"] } },
      { title: "Units & Customers", text: "The customer master — every tenant company, once.", steps: ["Click Units & Customers.", "Click New to add a customer (company, GSTIN, PAN, contacts, address).", "Save — the customer can now be used on leases."], shot: { click: ["Units & Customers"] } },
      { title: "Brands & Brokers", steps: ["Click Brands & Brokers.", "Add the brand that will trade from the unit and, if a broker was involved, the broker with their brokerage terms."], shot: { click: ["Brands & Brokers"] } },
      { title: "Creating a lease", text: "Leases are created with a step-by-step form.", steps: ["Click Leases, then New lease.", "Step 1 — pick the unit(s).", "Step 2 — pick the customer, brand and broker.", "Step 3 — enter the terms: start date (rent commencement), lock-in, tenure and deposits.", "Step 4 — enter rent per sq ft or per unit, CAM and escalation (percentage and frequency).", "Step 5 — attach the signed deed and other documents.", "Submit — the lease goes to the approver."], tips: ["A lease is billable only after it is approved."], shot: { click: ["Leases"] } },
      { title: "Approvals", text: "Leases, invoices, collections and credit notes need a second person's approval.", steps: ["Approvers see a count of items waiting for them.", "Open the item, check it, and click Approve — or Reject with a reason.", "Every record keeps a full history of who did what and when."] },
      { title: "Invoices & credit notes", steps: ["Click Invoices & Credit Notes.", "Click Generate for the month — invoices are created for every billable lease.", "If a lease is skipped, the list shows the reason (for example: lease not approved, rent not started).", "Open an invoice to view or download the Tax Invoice / e-invoice PDF.", "To correct an invoice, raise a credit note against it."], shot: { click: ["Invoices & Credit Notes"] } },
      { title: "Collections & ledger", steps: ["Click Collections & Ledger.", "Click New collection, pick the customer and the invoices being paid, enter the amount, mode (cheque / NEFT / RTGS), reference and date.", "Save — the approver confirms it.", "Open a customer's ledger to see invoices, receipts and balance."], tips: ["Payment reminders always open a review window — nothing is e-mailed until you confirm."], shot: { click: ["Collections & Ledger"] } },
      { title: "Revenue share sales", steps: ["Click Sales (Rev share).", "Enter each brand's monthly sales for revenue-share leases.", "Billing picks these up when invoices are generated."], shot: { click: ["Sales (Rev share)"] } },
      { title: "Investors and disbursement", steps: ["Investor Units lists which investor owns which unit.", "Disbursement calculates each investor's share of rent for the month; review and confirm."], shot: { click: ["Investor Units"] } },
      { title: "Reports", text: "Twelve ready-made Excel reports for Finance.", steps: ["Click Reports.", "Choose the report and the period.", "Click Export to download it in Excel."], shot: { click: ["Reports"] } },
      { title: "Users & role profiles (admins)", steps: ["Click Users & Role Profiles.", "Create a role, tick the modules it may open and whether it can approve.", "Add users and give each a role."], shot: { click: ["Users & Role Profiles"] } },
    ],
    faq: [
      { q: "Why wasn't an invoice created for a lease?", a: "The invoice list shows the reason for every skipped lease — usually the lease isn't approved yet or rent hasn't started." },
      { q: "Can I delete a record?", a: "Deletions go to Pending Deletions and need an approver." },
    ],
  },
  {
    names: ["Sales & Leasing Dashboard", "Analytics Dashboard", "DASHBOARD_SWD"], codes: ["DASHBOARD_SWD"], audience: "Management, Sales, CRM and Finance",
    intro: "The management dashboard shows sales, collections, inventory, channel partners, leads, footfall, customer cases, cost and the PR-to-PO purchase journey — with drill-down to the records behind every number.",
    before: ["Your team's dashboard login."],
    loginNote: "Use a login that can see all sections.",
    sections: [
      SIGN_IN("Open swdashboard.com:3000 and sign in with your team login. Each login sees only its own sections."),
      { title: "Overview", text: "The headline numbers for the business.", steps: ["After signing in, open Overview.", "Read the KPI cards at the top.", "Click any card or chart to see the records behind it."], shot: { path: "/overview" } },
      { title: "Using filters", steps: ["Filters are in the dark banner at the top of every page.", "Most filters let you pick several values and have a search box.", "Click Reset to clear all filters."] },
      { title: "Bookings", steps: ["Open Bookings.", "Choose the period with the pills (month / quarter / year).", "See bookings by project, channel partner and sales person; click a bar to drill down."], shot: { path: "/bookings" } },
      { title: "Collections", steps: ["Open Collections.", "See collected vs due, with and without tax.", "Click a project to see its customers."], shot: { path: "/collections" } },
      { title: "Inventory", steps: ["Open Inventory.", "See total, sold and available units by project and type.", "Available includes blocked units."], shot: { path: "/inventory" } },
      { title: "Channel partners", steps: ["Open Channel Partners.", "See the leaderboard, active and inactive partners.", "Bookings without a partner count as Direct."], shot: { path: "/channel-partners" } },
      { title: "Digital leads and footfall", steps: ["Digital Leads shows enquiries by source and campaign.", "Gallery Footfall shows site visits and their conversion."], shot: { path: "/digital-leads" } },
      { title: "Case Management", text: "Customer complaints and service requests.", steps: ["Open Case Management.", "Switch between Overall, Open and Closed.", "Use the TAT and HNI toggles; see ageing, categories, projects and the daily complaints register.", "MIS reports show pending cases by team leader and RM."], shot: { path: "/case-management" } },
      { title: "Cost", steps: ["Open Cost.", "Non-Project spend shows budget, ordered and delivered by department.", "Vendor Ageing shows what is due to vendors by age bucket."], shot: { path: "/cost" } },
      { title: "PR to PO", text: "Where each purchase requisition is on its way to a purchase order.", steps: ["Open PR to PO.", "See each PR's stage, how long it has taken, and who it is with.", "Click a PR to see its full journey."], shot: { path: "/pr-to-po" } },
      { title: "On your phone", steps: ["Install SWD Analytics on Android, or open the dashboard in your phone's browser and choose Add to Home screen."] },
    ],
  },
  {
    names: ["Cheque Register"], codes: ["CHEQUE_REG"], audience: "Accounts",
    intro: "Cheque Register records every cheque the company receives and follows it through deposit to clearance, so Accounts always knows what's in hand, what's with the bank and what needs follow-up.",
    sections: [
      SIGN_IN("Open the Cheque Register link and sign in with your login."),
      { title: "The cheque list", steps: ["The home screen lists all cheques with their status.", "Filter by status (received, deposited, cleared, bounced), party, bank or date."], shot: { path: "" } },
      { title: "Recording a new cheque", steps: ["Click New cheque.", "Enter the party, cheque number, bank, cheque date and amount.", "Save — the cheque appears as Received."] },
      { title: "Deposit and clearance", steps: ["When the cheque goes to the bank, open it and mark it Deposited with the deposit date.", "When the bank confirms, mark it Cleared — or Bounced, with the reason."] },
      { title: "Exporting", steps: ["Apply the filters you need.", "Click Export to download the list in Excel."] },
    ],
  },
  {
    names: ["MC Review (NFA)", "MC Review"], codes: ["MC_REVIEW"], audience: "NFA creators, reviewers, the MC secretariat",
    intro: "MC Review runs the Management Committee review of NFAs (Notes for Approval) in four pages: NFA Entry → Pre-meeting Review → MC Meeting → Order Numbering, and publishes the MC pack as a PDF.",
    loginNote: "Use a login that can see all four pages.",
    sections: [
      SIGN_IN("Open the MC Review link and sign in with your username and password."),
      { title: "Page 1 — NFA Entry", text: "Bring NFAs into the review.", steps: ["Click Page 1 — NFA Entry.", "Search the QMS list by NFA or PR number.", "Pick the NFA — PR budget, order values and creator fill in automatically.", "Complete the remaining fields (reason, validation of rates, vendor and PQ) and save."], shot: { click: ["Page 1 — NFA Entry"] } },
      { title: "Page 2 — Pre-meeting Review", steps: ["Click Page 2 — Pre-meeting Review.", "Review each NFA and add comments.", "Tick Present to MC for items going to the committee."], shot: { click: ["Page 2 — Pre-meeting Review"] } },
      { title: "Page 3 — MC Meeting", steps: ["Click Page 3 — MC Meeting.", "During the meeting, record each item's decision: Approved, Hold, Rejected or Undecided, with MC comments.", "Lock the meeting when done — the PDF pack is published from the locked snapshot."], shot: { click: ["Page 3 — MC Meeting"] } },
      { title: "Page 4 — Order Numbering", steps: ["Click Page 4 — Order Numbering.", "Assign order numbers to approved items in the standard format.", "Save."], shot: { click: ["Page 4 — Order Numbering"] } },
      { title: "Downloading the MC pack", steps: ["Use the PDF buttons to download the meeting pack.", "The PDF shows every NFA with values, decisions and the approved / hold / rejected counts."] },
    ],
  },
  {
    names: ["HR Careers Portal", "HR Pre-Onboarding"], codes: ["PREONBOARDING"], audience: "Employees, HR, interviewers, HODs and candidates",
    intro: "The HR Careers Portal shows open positions, lets employees refer friends and apply internally, and moves every candidate through nine clear steps from CV to onboarding. Candidates upload their own joining documents.",
    loginNote: "Use an HR login so the pipeline and dashboard appear.",
    sections: [
      SIGN_IN("Open the careers portal link and sign in with your User ID and password. Candidates sign in with the one-time code sent to their Gmail."),
      { title: "Open positions", steps: ["Open Open Positions.", "Read the job details.", "Click Refer to refer a friend, or Apply to apply yourself, and attach the CV."], shot: { path: "/jobs" } },
      { title: "My referrals", steps: ["Open My Referrals.", "See every person you referred and which step they're at."], shot: { path: "/my-referrals" } },
      { title: "HR dashboard and candidate pipeline", text: "HR moves each candidate through nine steps.", steps: ["Open the Candidate Pipeline.", "Each column is a step: CV received → CV approved → interview scheduled → interview cleared → HOD approved → fitment confirmed → offer mail sent → documents submitted → ready to onboard.", "Open a candidate and move them to the next step; the next person is notified."], shot: { path: "/pipeline" } },
      { title: "Interviews", steps: ["Interviewers see their candidates in the Interviewer Workspace.", "Record the interview mode (in-person, telephonic, video) and the result."] },
      { title: "Candidate documents", steps: ["Candidates open the link in their invitation, sign in with the Gmail code, fill in personal details and upload documents (up to 5 MB each).", "HR checks them under Candidate Documents."], shot: { path: "/documents" } },
    ],
  },
  {
    names: ["M3M One", "M3M_1.O", "M3M_One"], codes: ["M3M_ONE"], audience: "Projects and governance teams",
    intro: "M3M_1.O is the project-governance application for the M3M portfolio — dashboards, project governance by department, design chapters and briefs, comparisons, roles and audit logs.",
    loginNote: "Use a login with access to all portfolios.",
    sections: [
      SIGN_IN("Open the M3M_1.O link and sign in. Then choose the location and the portfolio you want to work in."),
      { title: "Dashboard", steps: ["After choosing a portfolio you land on the Dashboard.", "See the projects in the portfolio and their status."], shot: { path: "/dashboard" } },
      { title: "Portfolio", steps: ["Open Portfolio.", "See every project with its key figures; click a project to open it."], shot: { path: "/dashboard/portfolio" } },
      { title: "Project governance", text: "Each department has its own governance view — Business Development, Land, Liaison, Structure, MEP and more.", steps: ["Open Project Governance.", "Pick the department tab.", "Update the items for your department and save."], shot: { path: "/project-governance" } },
      { title: "Design brief and chapters", steps: ["Open Design Brief for the project's design chapters — project details, facade, landscape & amenities, MEP, common areas, ID specifications, approvals, phasing plan and more.", "Open a chapter, fill in the details and save.", "Use Export configuration to choose what goes into the exported brief."] },
      { title: "Compare projects", steps: ["Open Compare.", "Pick two or more projects to see their details side by side."] },
      { title: "Roles & access control (admins)", steps: ["Open Roles & Access Control.", "Set which roles can see and edit each section."], shot: { path: "/dashboard/roles-access-control" } },
      { title: "Audit logs", steps: ["Open Audit Logs to see who changed what and when."], shot: { path: "/dashboard/audit-logs" } },
    ],
  },
  {
    names: ["Document Flow"], codes: ["DOC_FLOW"], audience: "Storekeeper (admin), transferrer (courier) and employees",
    intro: "Document Flow tracks where every physical customer document is — in the storage room or with a named employee. Documents move only through an approved issue/return flow, with a transferrer carrying them, and a document is locked while it is out of storage.",
    before: ["Your Document Flow login. Your role (admin, transferrer or employee) decides what you can do."],
    loginNote: "Use an admin (storekeeper) login.",
    sections: [
      SIGN_IN("Open the Document Flow link and sign in with your username and password."),
      { title: "Finding a document", steps: ["Search by file number, customer name, tower or flat.", "The status shows whether it is in storage, in transit or with an employee."], shot: { path: "" } },
      { title: "Requesting a document (employee)", steps: ["Find the document and click Request to take.", "Confirm in the pop-up.", "The storekeeper is notified."] },
      { title: "Approving the issue (admin)", steps: ["Open Notifications (the bell shows how many items wait for you).", "Approve or Reject the request with a reason.", "Approved documents wait for the transferrer to pick them up."] },
      { title: "Carrying the document (transferrer)", steps: ["Click Accept when you pick the document up — it is now In transit.", "Click Dropped when you hand it over."] },
      { title: "Receiving (employee)", steps: ["Click Received when the document reaches you. It now shows With employee."] },
      { title: "Returning to storage", steps: ["Employee: click Return to storage.", "Transferrer: Accept on pick-up, Dropped at the storage room.", "Admin: click Received — the document is back In storage and can be requested again."] },
    ],
    faq: [{ q: "Why can't I request a document?", a: "It is out of storage. A document is locked until it is fully back in the storage room." }],
  },
  {
    names: ["MIS Company", "Complaint MIS", "MIS_Copmany"], codes: ["MIS_COMPANY"], audience: "CRM teams of M3M, Smartworld and NoBrokerHood",
    intro: "One link for the complaint MIS of all three companies — M3M, Smartworld and NoBrokerHood. Sign in once, choose the company, and use its MIS exactly as before.",
    sections: [
      SIGN_IN("Open the Complaint MIS link and sign in."),
      { title: "Choosing a company", steps: ["On the home page, click M3M, Smartworld or NoBrokerHood.", "Switch any time with the Home chip at the bottom-right of every page."], shot: { path: "" } },
      { title: "Using the MIS", steps: ["Use the tabs for the summary, ageing, categories and detailed lists.", "Open the filter drawer to narrow by project, category, status or date.", "Export any report to Excel or PDF."] },
      { title: "Refreshing the data", steps: ["Send the latest complaints export to IT — or replace the company's Excel in its data folder.", "Reload the page to see the new data."] },
    ],
  },
  {
    names: ["VendorGlobe API Sync", "PR/NFA API Sync"], codes: ["VENDORGLOBE"], audience: "Procurement",
    intro: "Two report pages show the latest purchase requisitions and NFA approval times from VendorGlobe. The same data feeds SAP and the management dashboard's PR-to-PO tracker.",
    sections: [
      { title: "PR report", steps: ["Open the PR report link.", "Search by PR number, project or date.", "See each requisition's details and status."], shot: { path: "" } },
      { title: "NFA TAT report", text: "How long each NFA spent at every step.", steps: ["Open NFA TAT report.", "See the time with the validator and at every approval level, and who it's pending with now.", "Use the date range to narrow the list."], shot: { path: "/nfatat" } },
      { title: "Returned NFAs", steps: ["Open the Returned view to see NFAs sent back, with the reason."], shot: { path: "/nfatat/returned" } },
    ],
  },
  {
    names: ["QMS SAP PR Sync", "QMS PR Sync"], codes: ["QMS_SAP_PR"], audience: "Procurement",
    intro: "QMS SAP PR Sync works in the background to keep the QMS purchase-requisition report up to date from SAP. There is nothing to open or click.",
    sections: [
      { title: "What you'll notice", steps: ["New and changed PRs from SAP appear in the QMS PR report within minutes.", "If the QMS PR report looks out of date, raise a ticket with IT."] },
    ],
  },
  {
    names: ["IT Manager"], codes: ["IT_MANAGER"], audience: "IT team and application owners",
    intro: "IT Manager lists every application Smartworld uses — built in-house or licensed — with its users and licences, usage, helpdesk tickets, tasks, documents, releases and access rights.",
    loginNote: "Use an admin login.",
    sections: [
      SIGN_IN("Open IT Manager on port 4000 and sign in with your username and password."),
      { title: "Dashboard", steps: ["The dashboard shows applications, active users, open tickets and licence seats used.", "The Live applications card scrolls through every app; hover to pause.", "Usage by application, issues, licences to review, task calendar and team workload follow below."], shot: { path: "/#/" } },
      { title: "Applications", steps: ["Open Applications.", "Switch between Grouped, Cards and List at the top of the landscape.", "Hover a card to see seats used, active users and open tickets; click it to open the app's page."], shot: { path: "/#/apps" } },
      { title: "An application's page", steps: ["Overview shows the about text, owner, dates and usage.", "Tabs: Screens, Tasks, Usage, Users, Tickets, Docs & manual, Releases, Files, Access, Activity."] },
      { title: "All tasks", steps: ["Open All tasks to see every app's tasks by app or by due date.", "Click a task to edit it; click a column title to open the whole column."], shot: { path: "/#/tasks" } },
      { title: "Tickets", steps: ["Open Tickets for helpdesk tickets from ServiceDesk Plus.", "Tag untagged tickets to the right app, or use Tag unmatched tickets fast."], shot: { path: "/#/tickets" } },
      { title: "Users & rights (admins)", steps: ["Open Users & rights to add people and set their role.", "Per-app edit/view rights are on each app's Access tab."], shot: { path: "/#/users" } },
    ],
  },
];

export function manualFor(app: { name: string; code: string }) {
  const n = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return MANUALS.find((m) => m.names.some((x) => n(x) === n(app.name))) ?? MANUALS.find((m) => m.codes?.some((c) => n(c) === n(app.code)));
}
