// User manuals for the in-house applications. The server turns these into illustrated PDFs:
// it opens the app, signs in (login typed by the user, never stored), captures each section's screen,
// and lays out cover → contents → sections (steps + picture) → questions → help.
// `shot.path` opens a page (relative to the app link); `shot.click` clicks items by their visible text, in order;
// `shot.as` names the role a section is shown for (when a login for that role is available).

export interface ManualShot { path?: string; click?: string[]; wait?: number; as?: string }
export interface ManualSection { title: string; text?: string; steps?: string[]; tips?: string[]; shot?: ManualShot }
export interface Manual {
  names: string[];
  codes?: string[];
  audience: string;
  intro: string;
  /** what the reader needs before starting */
  before?: string[];
  /** who can do what */
  roles?: { role: string; can: string }[];
  loginNote?: string;
  sections: ManualSection[];
  faq?: { q: string; a: string }[];
  /** bump when the text changes so the bundled PDF is reloaded */
  version: number;
}

const SIGN_IN = (how: string, steps?: string[]): ManualSection => ({ title: "Signing in", text: how, steps, shot: { path: "" } });

export const MANUALS: Manual[] = [
  /* ------------------------------------------------------------------ SmartDesk ------------------------------------------------------------------ */
  {
    names: ["SmartDesk"], codes: ["SMARTDESK"], version: 2, audience: "All Smartworld employees, HR and IT",
    intro: "SmartDesk is the Smartworld employee portal. It brings together company highlights, the employee directory, live biometric attendance, policies, the holiday calendar, management dashboards, everyday file tools and the office TV screens — in one place, on the office network.",
    before: ["Be on the office network (Wi-Fi or LAN).", "Know your employee code — it is your SmartDesk login.", "Leave is still applied in the HR portal (Adrenalin). SmartDesk links to it."],
    roles: [
      { role: "Employee", can: "Home, directory, own attendance, policies, holidays, tools, search" },
      { role: "HR", can: "Everything an employee sees, plus all attendance, TV Display and announcements" },
      { role: "Manager / IT", can: "Team views and the tabs the admin has opened for them" },
      { role: "Admin", can: "Everything, plus Access Control and Settings" },
    ],
    loginNote: "Use the admin login so every tab appears in the manual.",
    sections: [
      SIGN_IN("Open www.smartdesk.com:92 in Chrome or Edge on the office network.", ["Type your employee code in the first box.", "Type your password.", "Press Enter or click Sign in.", "First time? You'll be asked to set your own password."]),
      { title: "Home", text: "Your starting page: company banner, the running ticker of quick links, celebrations, company news and today's office snapshot.", steps: ["After signing in you land on Home.", "Click any item in the ticker (HR portal, ServiceDesk, Salesforce, Power BI, QMS, Smart Leasing…) to open that system.", "Scroll for birthdays, work anniversaries, new joiners and star of the month.", "Company News shows the latest announcements from HR and Admin."], shot: { click: ["Home"] } },
      { title: "Employee Directory", text: "Find any colleague in seconds.", steps: ["Click Employee Directory in the left menu.", "Type a name, employee code, department, designation or location in the search box.", "Switch between card and list view.", "Click a person to see their designation, department, location, e-mail and phone."], tips: ["New joiners appear once HR updates the employee list in the shared folder."], shot: { click: ["Employee Directory"] } },
      { title: "Live Attendance", text: "Biometric punch-ins from every office and site, as they happen.", steps: ["Click Live Attendance.", "Employees see their own punches; HR and managers see everyone.", "Pick a date range and filter by department or site.", "Search for an employee to see in-time, out-time, hours and site.", "Click Export to download the view in Excel."], shot: { click: ["Live Attendance"] } },
      { title: "Policies", text: "All HR, Admin and IT policies in one place.", steps: ["Click Policies.", "Choose the policy group.", "Click a policy to read it, or download the PDF."], shot: { click: ["Policies"] } },
      { title: "Holiday Calendar", steps: ["Click Holiday Calendar.", "See every holiday of the year and a countdown to the next one."], shot: { click: ["Holiday Calendar"] } },
      { title: "Dashboard", text: "Management reports, for people who have been given access.", steps: ["Click Dashboard.", "Use the toggle to switch between the SmartDB preview and Power BI reports.", "Pick a report; use its own filters.", "Click full-screen for a bigger view."], shot: { click: ["Dashboard"] } },
      { title: "Tools", text: "Everyday file tools that run inside the office network — your files don't leave the company.", steps: ["Click Tools.", "File Converter: PDF ↔ Word, Excel, images and more.", "PDF Tools: split, merge, compress, watermark. PDF Editor: edit text, sign, highlight.", "Image Tools, Excel Tools, QR Generator and Calculators (GST, EMI, amount in words, land area).", "Upload your file, choose the option, then download the result."], shot: { click: ["Tools"] } },
      { title: "Smart Search (Ctrl + K)", text: "Ask SmartDesk a question in plain English. Answers come only from SmartDesk's own data and policy documents.", steps: ["Press Ctrl + K anywhere, or click the search box at the top.", "Ask, for example: \"How many casual leaves do I get?\", \"Who is in the IT team?\", \"When is the next holiday?\" or \"How many people are in office today?\"", "Click a result to open the page it came from."] },
      { title: "TV Display (HR)", text: "Run the office TV screens from your desk.", steps: ["Click TV Display.", "Add announcements, events, photos or videos; choose star(s) of the month.", "The live preview shows exactly what the TV will show.", "Save — every office TV updates by itself within a minute."], tips: ["Each TV just opens the SmartDesk TV link full-screen; no sign-in needed on the TV."], shot: { click: ["TV Display"] } },
      { title: "Access Control (admin)", text: "Decide which tabs each employee or shared login can see.", steps: ["Click Access Control.", "Pick a role (HR, IT, Manager) or search for an employee.", "Tick the tabs they may open and click Save.", "The change applies the next time they open SmartDesk."], shot: { click: ["Access Control"] } },
      { title: "Updating photos and the employee list (HR)", steps: ["Open the shared SmartDesk folder on the server.", "Gallery: drop photos into the Gallery folder — they appear on Home.", "Employee Data: replace the employee Excel with the latest one — the directory updates by itself.", "No restart or IT help is needed."] },
    ],
    faq: [
      { q: "I can't sign in.", a: "Check you are on the office network and typing your employee code. If you forgot your password, ask IT to reset it." },
      { q: "A new joiner is missing from the directory.", a: "HR updates the employee Excel monthly. Ask HR to drop the latest file into the shared folder." },
      { q: "Where do I apply for leave?", a: "In the HR portal (Adrenalin). Use the link in the Home ticker." },
    ],
  },

  /* ------------------------------------------------------------------ Smart Leasing ------------------------------------------------------------------ */
  {
    names: ["Smart Leasing", "Leasing SWD"], codes: ["LEASING_SWD"], version: 2, audience: "Leasing team, Finance, Accounts and approvers",
    intro: "Smart Leasing runs commercial leasing and billing for Gems-2, Sector-89 Gurugram — the masters (company, project, blocks, units, brands, customers, brokers), leases, GST invoices and credit/debit notes, collections with TDS and security deposits, dunning reminders, investor rent disbursement and the Finance reports and reconciliations. Important records go through maker–checker approval, and every record keeps a full history.",
    before: ["Your Smart Leasing login (e-mail and password) from the admin.", "Open it on the office network: smartleasing.com:96.", "Your role profile decides which menu items you see and whether you can approve."],
    roles: [
      { role: "Maker (Leasing / Accounts)", can: "Create and edit masters, leases, invoices, collections" },
      { role: "Checker (approver)", can: "Approve, hold or reject leases, invoices, collections and credit notes" },
      { role: "Finance", can: "Reports, reconciliations, disbursement" },
      { role: "Admin", can: "Users, role profiles, pending deletions, audit logs" },
    ],
    loginNote: "Use the admin login so every menu appears in the manual.",
    sections: [
      SIGN_IN("Open smartleasing.com:96 in Chrome or Edge.", ["Type your e-mail (username) and password.", "Click Sign in.", "If the page keeps loading, turn off ad-blockers for this site or try an Incognito window."]),
      { title: "Finding your way", text: "The left menu is grouped: Masters, Leasing & Billing, Rent Disbursement, Reports and Admin. Pop-ups after each save suggest the next step.", steps: ["Home shows shortcuts and what needs your attention.", "Click a menu item to open its list; click any row to open the record page with its full log.", "The bell shows items waiting for you."], shot: { click: ["Home"] } },
      { title: "Dashboard", text: "Occupancy, billing, collections and dues at a glance.", steps: ["Click Dashboard.", "Read the KPI cards: leased vs vacant area, this month's billing, collected, outstanding.", "Click a card or chart to see the records behind it."], shot: { click: ["Dashboard"] } },
      { title: "Inventory", steps: ["Click Inventory.", "See every unit with block, floor, area and status (vacant / leased / blocked).", "Filter by block or status; click a unit to see its lease history."], shot: { click: ["Inventory"] } },
      { title: "Masters", text: "Set up the building blocks once; leases pick them from lists.", steps: ["Company: the landlord company with GSTIN, PAN and bank details (printed on invoices).", "Projects → Block → Unit: the property tree.", "Customer: each tenant company once — GSTIN, PAN, contacts, billing address.", "Brand: the brand trading from the unit. Broker: brokers and their brokerage terms.", "Click New on any master, fill the form and Save."], tips: ["Fill GSTIN, PAN and bank details carefully — they print on every invoice."], shot: { click: ["Customer"] } },
      { title: "Creating a lease", text: "Leases are entered with a 7-step form.", steps: ["Click Leases, then New lease.", "Step 1 — Parties & Unit: customer, brand, broker and unit(s).", "Step 2 — Commercial Terms: rent per sq ft or per unit, revenue share, escalation (% and frequency).", "Step 3 — Approval (NFA): NFA reference and approved terms.", "Step 4 — Agreement & Key Dates: agreement date, rent commencement, lock-in, tenure.", "Step 5 — Deposits, CAM & Brokerage.", "Step 6 — Billing & Invoice Parties.", "Step 7 — Remarks & Documents: attach the signed deed and papers.", "Click Save — the lease goes to the checker for approval."], tips: ["A lease is billed only after it is approved and rent has started."], shot: { click: ["Leases"] } },
      { title: "Approvals", text: "Leases, invoices, collections and credit notes need a second person's approval (maker–checker).", steps: ["Click Approvals to see everything waiting for you.", "Open an item and check it.", "Click Approve, Hold, or Reject (with a reason). Use Comment to ask the maker a question.", "The maker is notified, and the record's log shows who did what and when."], shot: { click: ["Approvals"] } },
      { title: "Generating invoices", steps: ["Click Invoices.", "Click Generate invoices and choose the month.", "Invoices are created for every billable lease — running it twice never creates duplicates.", "Leases that were skipped are listed with the reason (e.g. not approved yet, rent not started).", "Open an invoice and click Tax Invoice to view, print or download it.", "To correct an invoice, raise a CN / DN (credit or debit note) against it."], shot: { click: ["Invoices"] } },
      { title: "Sales (revenue share)", steps: ["Click Sales (Rev share).", "Click Enter sales and type each brand's monthly sales.", "Revenue-share rent is worked out automatically when invoices are generated."], shot: { click: ["Sales (Rev share)"] } },
      { title: "Collections and security deposits", steps: ["Click Collections, then Capture collection — or click Collect on an invoice.", "Pick the customer and the invoices being paid.", "Enter the amount, TDS, mode (NEFT / RTGS / UPI / Cheque…), UTR or cheque number and date.", "Save — the checker confirms it.", "Use SD Adjust on an invoice to adjust it against the security deposit."], shot: { click: ["Collections"] } },
      { title: "Tenant ledger", steps: ["Click Tenant Ledger and pick a customer.", "See invoices, notes, receipts and the running balance.", "Export the ledger to Excel to share with the tenant."], shot: { click: ["Tenant Ledger"] } },
      { title: "Dunning (payment reminders)", text: "Reminders are never sent automatically.", steps: ["Click Dunning (Reminders).", "Review the overdue customers and amounts.", "Open the reminder, check the e-mail text, and confirm to send.", "Sent reminders are logged on the customer."], shot: { click: ["Dunning (Reminders)"] } },
      { title: "Rent disbursement to investors", steps: ["Investor Accounts: each investor's bank details.", "Investor Units: click Define investor unit to link investors to units and shares.", "Process Disbursement: choose the month and click Process — each investor's share is worked out.", "Click Export NEFT format to download the bank upload file."], shot: { click: ["Process Disbursement"] } },
      { title: "Reports and reconciliations", steps: ["Report Center (Excel): 12 ready-made Finance reports — choose one and the period, then download.", "GST Reconciliation, TDS Reconciliation and SD Reconciliation: match the books, month by month.", "Agreement Recon: checks billing against the agreed terms.", "CAM True-up: compare actual CAM with what was billed; click Raise true-up invoice if needed.", "Reports & SAP: summaries for posting in SAP."], shot: { click: ["Report Center (Excel)"] } },
      { title: "Admin", steps: ["Users: add people and give each a role profile.", "Role Profiles: tick the menus a role may open and whether it can approve; Save role.", "Pending Deletions: deletions wait here until an approver releases or rejects them.", "Audit Logs: every sign-in and change, searchable."], shot: { click: ["Role Profiles"] } },
    ],
    faq: [
      { q: "Why wasn't an invoice created for a lease?", a: "The list after Generate invoices shows the reason for every skipped lease — usually the lease isn't approved yet or rent hasn't started." },
      { q: "The GSTIN is blank on an invoice.", a: "Fill it on the Customer (tenant) or Company master, then reopen the invoice." },
      { q: "Can I delete a record?", a: "Deletions go to Pending Deletions and need an approver." },
    ],
  },

  /* ------------------------------------------------------------------ Dashboard ------------------------------------------------------------------ */
  {
    names: ["Sales & Leasing Dashboard", "Analytics Dashboard", "DASHBOARD_SWD", "SWD Analytics Dashboard"], codes: ["DASHBOARD_SWD"], version: 2, audience: "Management, Sales, CRM, Procurement and Finance",
    intro: "The Smart World analytics dashboard shows sales, inventory, customer care, procurement, cost and profit side by side — and every chart opens up to the records behind it. It is also available on Android (SmartDB) and can be shown on the office TV.",
    before: ["Your dashboard login from the admin. Each login sees only the sections it has been given."],
    roles: [
      { role: "Sales", can: "Sales and Inventory Tracker sections" },
      { role: "CRM", can: "Case Management, Loan Details, Collections" },
      { role: "Finance / P&L", can: "Collections, Cost, Profit vs Loss" },
      { role: "Admin", can: "Everything, plus Settings → User rights" },
    ],
    loginNote: "Use the admin login so every section appears in the manual.",
    sections: [
      SIGN_IN("Open the dashboard link (swdashboard.com:3000) in Chrome or Edge, or the SmartDB app on Android.", ["Type your login ID and password and click Sign in.", "If an admin reset your password, you'll be asked to set a new one."]),
      { title: "Home", text: "Your starting page, with shortcuts into every module and the date the data was last refreshed.", steps: ["The left menu is grouped: Sales, Inventory Tracker, CRM, Procurement, P&L and Workspace. Click a group to open it.", "Click Open business overview for the headline numbers.", "Click Ask SmartDB to ask a question in plain words."], shot: { path: "/" } },
      { title: "Filters and drill-down", steps: ["Filters sit in the dark banner at the top of every page; most let you pick several values and have a search box.", "Use the pills in the centre of the banner to switch period or view.", "Click any bar, card or row to open a drawer with the records behind it.", "Click Reset to clear filters; use ⛶ on a card to enlarge it."] },
      { title: "Business Overview", steps: ["Open Sales → Business Overview.", "See total, sold and available units (available includes blocked), bookings and collections across projects.", "Click a project to drill into towers and units."], shot: { path: "/overview" } },
      { title: "Bookings", steps: ["Open Sales → Bookings.", "Choose the period with the pills.", "See bookings by project, channel partner and sales person, and the collection KPI cards (excluding tax, with tax shown below).", "Click a project bar to drill down."], shot: { path: "/bookings" } },
      { title: "Channel partners, leads and footfall", steps: ["Channel Partners: leaderboard, rate ranges, active and inactive partners. Bookings with no partner count as Direct.", "Digital Leads: enquiries by source and campaign.", "Gallery Footfall: site visits and how many convert."], shot: { path: "/channel-partners" } },
      { title: "Inventory and projects", steps: ["Inventory Tracker → Inventory: units by project, tower and type, sold vs available.", "Projects and Project Tracker: progress of each project."], shot: { path: "/inventory" } },
      { title: "Case Management (CRM)", text: "Customer complaints and service requests.", steps: ["Open CRM → Case Management.", "Switch between Overall, Open and Closed.", "Use the TAT and HNI toggles and the eight banner filters.", "Sections: project-wise, daily complaints register, ageing & TAT, categories, MIS (team-leader and RM ageing), owner load and the full records list."], shot: { path: "/case-management" } },
      { title: "Collections and loans", steps: ["CRM → Collection and SAP Collection: collected vs due, by project and customer.", "Loan Details: home-loan status by customer and bank."], shot: { path: "/collections" } },
      { title: "Cost", steps: ["Open Procurement → Cost.", "Non-Project FY view: budget, ordered and delivered by department, plant and company; switch Excl / With GST.", "Vendor Ageing: amounts due to vendors by age bucket; click a vendor for the open items."], shot: { path: "/cost" } },
      { title: "PR to PO", text: "Where each purchase requisition is on its way to a purchase order.", steps: ["Open Procurement → PR to PO.", "See each PR's stage, how long it has taken, and who it is pending with.", "Click a PR to see its full journey: QMS approvals, NFA, SAP release and PO."], shot: { path: "/pr-to-po" } },
      { title: "Profit vs Loss and reports", steps: ["P&L → Profit vs Loss: project profitability.", "Workspace → Reports: download ready-made Excel reports.", "TV Preview: what the office TV shows. Notes: your own notes. Guide: help inside the app."], shot: { path: "/reports" } },
      { title: "User rights (admin)", steps: ["Open Workspace → Settings → User rights.", "Add a login, choose its role and tick the tabs it may open.", "Reset a password if someone is locked out — they set a new one at next sign-in."], shot: { path: "/settings" } },
      { title: "On your phone", steps: ["Install SmartDB on Android, or open the dashboard in your phone's browser and choose Add to Home screen.", "Sign in with the same login."] },
    ],
    faq: [{ q: "Numbers look old.", a: "The banner shows when data was last refreshed. Business data is updated weekly; PR to PO and collections update through the day." }],
  },

  /* ------------------------------------------------------------------ Cheque Register ------------------------------------------------------------------ */
  {
    names: ["Cheque Register"], codes: ["CHEQUE_REG"], version: 2, audience: "Accounts and Finance",
    intro: "Cheque Register records every cheque the company receives and follows it from receipt to deposit and clearance — so Accounts always knows which cheques are in hand, which are with the bank, and which need follow-up.",
    before: ["Your login from the admin.", "The cheque in hand (or its details)."],
    sections: [
      SIGN_IN("Open the Cheque Register link on the office network and sign in with your username and password."),
      { title: "The cheque list", steps: ["The home screen lists every cheque with party, number, bank, date, amount and status.", "Filter by status (received, post-dated, deposited, cleared, bounced), party, bank or date.", "Click a cheque to see its history."], shot: { path: "" } },
      { title: "Recording a cheque", steps: ["Click New cheque.", "Enter the party (customer or tenant), cheque number, bank and branch, cheque date and amount.", "Add the purpose or invoice reference.", "Save — it shows as Received (or Post-dated, if the date is in the future)."] },
      { title: "Depositing", steps: ["When cheques go to the bank, select them and mark Deposited with the deposit date and bank account.", "Post-dated cheques show a reminder when they become due."] },
      { title: "Clearance or bounce", steps: ["When the bank confirms, mark the cheque Cleared with the clearance date.", "If it is returned, mark it Bounced with the reason, so the customer can be followed up."] },
      { title: "Reports", steps: ["Apply the filters you need.", "Click Export to download the register in Excel for reconciliation."] },
    ],
    faq: [{ q: "Is this connected to Smart Leasing?", a: "Leasing collections paid by cheque record the cheque number on the receipt; the Cheque Register is the Accounts team's register of physical cheques." }],
  },

  /* ------------------------------------------------------------------ MC Review ------------------------------------------------------------------ */
  {
    names: ["MC Review (NFA)", "MC Review"], codes: ["MC_REVIEW"], version: 2, audience: "Contracts & Procurement, reviewers (MEP / Civil), the MC secretariat",
    intro: "MC Review runs the Management Committee review of NFAs (Notes for Approval) for Contracts & Procurement in four pages: NFA Entry → Pre-meeting Review → MC Meeting → Order Numbering. NFA details come straight from QMS, decisions are recorded in the meeting, and the signed-off MC pack is published as a PDF.",
    roles: [
      { role: "User (C&P)", can: "Page 1 entry and Page 4 order numbering; Page 2 view only" },
      { role: "Reviewer MEP / Civil", can: "Pages 2 and 3 for their own index" },
      { role: "Admin", can: "All pages, plus Manage Users" },
    ],
    loginNote: "Use the admin login so all four pages appear in the manual.",
    sections: [
      SIGN_IN("Open the MC Review link and sign in with your login ID and password."),
      { title: "Page 1 — NFA Entry", text: "Bring NFAs into a review date.", steps: ["Click Page 1 — NFA Entry.", "Type the NFA number, choose the Index (MEP & Procurement or Civil & Consultancy) and the Work Type.", "Click Fetch — project, vendor, values, PR budget and initiator fill in from QMS.", "Complete your fields: reason, rate validation, vendor PQ, initiated by; attach files.", "Tick the entry and click Submit to send it to Page 2.", "Entry Date View: choose Today or another date to see entries for that review."], tips: ["Yellow cells are values you changed — a later QMS refresh won't overwrite them."], shot: { click: ["Page 1 — NFA Entry"] } },
      { title: "Searching NFAs and history", steps: ["All NFAs (QMS): search the full QMS history by NFA, PR, project or vendor.", "NFA Search & History: type an NFA to see every review date, decision and published PDF it appeared in.", "Published PDFs: download any past MC pack."], shot: { click: ["Page 1 — NFA Entry", "All NFAs (QMS)"] } },
      { title: "Page 2 — Pre-meeting Review", steps: ["Click Page 2 — Pre-meeting Review.", "Choose the index and review date.", "Review each NFA, grouped by work type; add comments.", "Tick Present to MC for items going to the committee.", "Click Lock to freeze the agenda — this creates the version the meeting will use."], shot: { click: ["Page 2 — Pre-meeting Review"] } },
      { title: "Page 3 — MC Meeting", steps: ["Click Page 3 — MC Meeting and choose the index and date.", "For each NFA record the decision: Approved, Hold, Rejected or Undecided, with the MC comment.", "Click Publish when the meeting ends — the date closes and the MC pack PDF is created.", "Held items stay open and can come to a later meeting."], shot: { click: ["Page 3 — MC Meeting"] } },
      { title: "Page 4 — Order Numbering", steps: ["Click Page 4 — Order Numbering.", "Pick an approved NFA.", "Choose the order type (PO, SO, WO or LOA) — the order number is allocated automatically in the standard format.", "Save. Retired numbers are never reused."], shot: { click: ["Page 4 — Order Numbering"] } },
      { title: "Downloading the MC pack", steps: ["Use the PDF buttons on Page 3 or Published PDFs.", "The PDF lists every NFA with values, decisions, comments and the approved / hold / rejected counts, with page numbers."] },
      { title: "Manage Users (admin)", steps: ["Click Manage Users.", "Add a user with a login ID and role (user, revMEP, revCIV, admin).", "Reset a password or deactivate a user."], shot: { click: ["Manage Users"] } },
    ],
    faq: [{ q: "I can't find an old NFA.", a: "Use All NFAs (QMS) — it searches the complete QMS history, not just recent months." }],
  },

  /* ------------------------------------------------------------------ HR Careers ------------------------------------------------------------------ */
  {
    names: ["HR Careers Portal", "HR Pre-Onboarding"], codes: ["PREONBOARDING"], version: 2, audience: "Employees, HR, interviewers, HODs and selected candidates",
    intro: "The HR Careers Portal lists open positions, lets employees refer people with a CV, and moves every candidate through nine clear steps: CV received → CV approved → interview scheduled → interview cleared → HOD approved → fitment confirmed → offer mail sent → documents submitted → ready to onboard. Selected candidates upload their own joining documents.",
    roles: [
      { role: "Employee", can: "See jobs, refer with a CV, track own referrals" },
      { role: "HR", can: "Dashboard, jobs, pipeline, documents — moves candidates step by step" },
      { role: "Interviewer", can: "Review CVs, record interview results" },
      { role: "HOD", can: "Approve or reject candidates for their department" },
      { role: "Candidate", can: "Sign in with a Gmail code, fill details, upload documents" },
    ],
    loginNote: "Use an HR login so the dashboard and pipeline appear in the manual.",
    sections: [
      SIGN_IN("Open the careers portal link. Employees, HR, interviewers and HODs use the Employee / HR Sign in tab; selected candidates use the Selected Candidate tab.", ["Type your User ID and password and click Sign in.", "Candidates: type your Gmail address, then the code sent to it."]),
      { title: "Job openings and referring someone (employee)", steps: ["Open Job Openings.", "Read the role, location and experience needed.", "Click Refer, enter the person's details and attach the CV.", "Track them under My Referrals — the 9-dot flow shows where they are."], shot: { path: "/", as: "employee" } },
      { title: "HR dashboard", text: "What needs HR's attention today.", steps: ["After signing in, HR lands on the HR Dashboard.", "Cards show open positions, CVs with interviewers, interviews to schedule, approvals pending, mails to send and documents to verify.", "The table below lists each candidate with the 9-step flow and the next action button."], shot: { path: "/", as: "hr" } },
      { title: "Managing jobs (HR)", steps: ["Open Job Openings.", "Click New job, fill in title, department, location, experience and description.", "Close a job when it is filled."], shot: { path: "/jobs", as: "hr" } },
      { title: "Referral pipeline (HR)", steps: ["Open Referral Pipeline.", "Use the action button on each candidate to move them on: send the CV to the interviewer, schedule the interview (in-person, telephonic or video), send to HOD, confirm fitment, send the offer mail.", "Every step is recorded with who did it and when."], shot: { path: "/pipeline", as: "hr" } },
      { title: "Interviewer", steps: ["Interviewers see the CVs and interviews assigned to them.", "Approve or reject a CV with a comment.", "After the interview, fill in the evaluation form and the result."], shot: { path: "/", as: "interviewer" } },
      { title: "HOD approval", steps: ["HODs see candidates waiting for their approval.", "Open the candidate, read the CV and interview notes.", "Approve or reject with a comment."], shot: { path: "/", as: "hod" } },
      { title: "Candidate documents", steps: ["After the offer mail, the candidate signs in with their Gmail code, fills in personal details and uploads documents (up to 5 MB each).", "HR opens Candidate Documents to check each file and mark the candidate ready to onboard."], shot: { path: "/documents", as: "hr" } },
    ],
  },

  /* ------------------------------------------------------------------ M3M_1.O ------------------------------------------------------------------ */
  {
    names: ["M3M One", "M3M_1.O", "M3M_One", "M3M 1.O"], codes: ["M3M_ONE"], version: 2, audience: "Design, Business Development, Land, Liaison, Structure and MEP teams; admins",
    intro: "M3M_1.O is the project-governance application for the M3M and Smartworld portfolios. Each project has its key ratios with benchmark checks, design chapters, the departmental design brief, comparisons and a downloadable DPR — with roles, notifications and a full audit log.",
    roles: [
      { role: "Super Admin / General Admin", can: "All projects, roles and access, audit logs" },
      { role: "Design Admin", can: "Design modules, chapters and approvals" },
      { role: "Contributor", can: "Fill the modules and chapters assigned to their department" },
    ],
    loginNote: "Use a super-admin login.",
    sections: [
      SIGN_IN("Open the M3M_1.O link and sign in with your e-mail and password.", ["After 5 wrong attempts the account is locked for a while — use Forgot password if needed."]),
      { title: "Choosing a portfolio", steps: ["Pick the location: M3M Noida, M3M Gurgaon or Smartworld, then click NEXT.", "Pick Existing Projects or New Projects, then click NEXT.", "Switch portfolio any time from the header."], shot: { click: ["Smartworld", "NEXT"] } },
      { title: "Dashboard — projects list", steps: ["The Dashboard lists the portfolio's projects with classification, type, category, location and owner.", "Search by name, or filter by date, project type and category; Reset Filter clears them.", "Click ⋯ on a project to open, edit or download it.", "Click Add New Project to create one."], shot: { click: ["Existing Projects", "NEXT"] } },
      { title: "Working on a project", steps: ["Open a project to see its modules as a grid.", "Module 1 — Key Ratio: enter areas and counts; each ratio is checked against the benchmark and coloured.", "Modules 2–3 — apartment and common-area design chapters: answer each chapter's questions.", "Locked modules can be opened only after the earlier ones are complete.", "Download the DPR (PDF) from the project menu."] },
      { title: "Design brief", text: "Each department fills its part of the brief: Liaison, Business Development, Land, Structure, MEP.", steps: ["Open the project's Design Brief.", "Each department opens its tab, fills the fields and uploads files.", "Submit; reviewers add comments, and the brief moves to Final submission.", "Download the full brief when all departments are done."] },
      { title: "Portfolio", steps: ["Click Portfolio for an efficiency view of every project in the portfolio, with key ratios side by side."], shot: { path: "/dashboard/portfolio" } },
      { title: "Project governance", steps: ["Click Project Governance.", "See each project's progress by department and what is pending with whom."], shot: undefined },
      { title: "Comparing projects", steps: ["Open Compare from a project.", "Pick a second project — their ratios and chapters appear side by side.", "Download the comparison as a PDF."] },
      { title: "Role and access control (admin)", steps: ["Click Role and Access Control.", "Add users, set their role and department, and choose which modules each role can view or edit."], shot: { path: "/dashboard/roles-access-control" } },
      { title: "Audit logs", steps: ["Click Audit Logs to see every sign-in and change — who, what and when — with filters."], shot: { path: "/dashboard/audit-logs" } },
    ],
  },

  /* ------------------------------------------------------------------ Document Flow ------------------------------------------------------------------ */
  {
    names: ["Document Flow"], codes: ["DOC_FLOW"], version: 2, audience: "Storekeeper (admin), transferrer (courier) and employees",
    intro: "Document Flow tracks where every physical customer file is — in the storage room or with a named employee. Files move only through an approved issue / return flow with a transferrer carrying them, every step asks for confirmation, and a file is locked while it is out of storage, so it can never be with two people at once.",
    before: ["Your Document Flow login. On first sign-in you set your own password."],
    roles: [
      { role: "Admin (storekeeper)", can: "Approve issues, receive returns, add files, users, reports" },
      { role: "Transferrer (courier)", can: "Accept pick-ups and mark drops" },
      { role: "Employee", can: "Request files, confirm receipt, return files" },
    ],
    loginNote: "Use the storekeeper (admin) login.",
    sections: [
      SIGN_IN("Open the Document Flow link and sign in with your username and password."),
      { title: "Documents", text: "Live location of every file, project by project.", steps: ["Click Documents.", "Click a project chip at the top to see its files.", "Each file shows its file number, tower and flat, customer and where it is now (in storage, in transit or with an employee).", "Search by file number, customer, tower or flat."], shot: { click: ["Documents", "Sky Arc"] } },
      { title: "Requesting a file (employee)", steps: ["Find the file and click Request to take.", "Enter the reason and confirm.", "The storekeeper is notified."] },
      { title: "Approvals (storekeeper)", steps: ["Click Approvals — the number shows how many wait for you.", "Approve, or Reject with a reason.", "Approved files wait for the transferrer to pick them up."], shot: { click: ["Approvals"] } },
      { title: "Carrying the file (transferrer)", steps: ["Click Accept when you pick the file up — it shows In transit.", "Click Dropped when you hand it over."] },
      { title: "Receiving (employee and storekeeper)", steps: ["Employee: click Received when the file reaches you — it now shows With you.", "Storekeeper: returned files appear under Receiving; click Received to put them back In storage."], shot: { click: ["Receiving"] } },
      { title: "Returning to storage", steps: ["Employee: click Return to storage on a file you hold.", "Transferrer: Accept on pick-up, Dropped at the storage room.", "Storekeeper: Received — the file is back and can be requested again."] },
      { title: "Report", steps: ["Click Report for the custody log: every movement with file, customer, who had it and when.", "Export to Excel."], shot: { click: ["Report"] } },
      { title: "Users and adding files (storekeeper)", steps: ["Users: add employees and transferrers; reset a password.", "Documents → Add files: paste or type file numbers with tower, flat and customer for a project."], shot: { click: ["Users"] } },
    ],
    faq: [{ q: "Why can't I request a file?", a: "It is out of storage. A file is locked until it is fully back in the storage room." }],
  },

  /* ------------------------------------------------------------------ MIS Company ------------------------------------------------------------------ */
  {
    names: ["MIS Company", "Complaint MIS", "MIS_Copmany"], codes: ["MIS_COMPANY"], version: 2, audience: "CRM teams of M3M, Smartworld and NoBrokerHood",
    intro: "One link for the complaint MIS of all three companies — M3M, Smartworld and NoBrokerHood. Sign in once, choose the company, and use its familiar MIS reports exactly as before. Each company's data comes from its latest complaints Excel.",
    sections: [
      SIGN_IN("Open the Complaint MIS link and sign in with the MIS login."),
      { title: "Choosing a company", steps: ["After signing in you see Choose an application.", "Click M3M MIS, Smartworld MIS or NBH MIS.", "Switch any time with the Home chip at the bottom-right of every page."], shot: { path: "" } },
      { title: "M3M and Smartworld MIS", text: "Customer-complaint dashboards built from the SFDC exports.", steps: ["Use the tabs for the summary, ageing, categories, team-wise and detailed lists.", "Open the filters to narrow by project, category, status or date.", "Click a number to see the complaints behind it.", "Export any report to Excel or PDF."], shot: { path: "/__gate/select/smartworld", wait: 4000 } },
      { title: "NBH MIS", text: "NoBrokerHood facility-management complaints.", steps: ["Click NBH MIS on the home page.", "See complaints by society, category, status and age; use the filters and export as above."], shot: { path: "/__gate/select/nbh", wait: 4000 } },
      { title: "Refreshing the data", steps: ["Export the latest complaints from the CRM system.", "Send it to IT — or replace the company's Excel in its data folder (data/m3m, data/smartworld or data/nbh) yourself.", "Reload the page — the new data shows straight away, no restart needed."] },
    ],
  },

  /* ------------------------------------------------------------------ VendorGlobe ------------------------------------------------------------------ */
  {
    names: ["VendorGlobe API Sync", "PR/NFA API Sync", "PR & NFA reports"], codes: ["VENDORGLOBE"], version: 2, audience: "Procurement and Contracts & Procurement",
    intro: "Two report pages show the latest purchase requisitions and NFA approval times from VendorGlobe (QMS). The same data is saved every few minutes for SAP and feeds the management dashboard's PR to PO tracker.",
    sections: [
      { title: "PR report", steps: ["Open the PR report link (port 5002 on the IT server).", "Search by PR number, project, department or date.", "See each requisition's details and status."], shot: { path: "" } },
      { title: "NFA TAT report", text: "How long each NFA spent at every step.", steps: ["Open NFA TAT.", "See time with the validator, the CP, and at each approval level (1–8), and who it is pending with now.", "Use the date range to narrow the list; export to Excel."], shot: { path: "/nfatat" } },
      { title: "Returned NFAs", steps: ["Open Returned to see NFAs sent back, with the reason and who returned them."], shot: { path: "/nfatat/returned" } },
      { title: "Where else this data appears", steps: ["SAP reads the same data for its PR and NFA TAT reports.", "The management dashboard's PR to PO page uses it to show each PR's journey to a PO."] },
    ],
  },

  /* ------------------------------------------------------------------ QMS ------------------------------------------------------------------ */
  {
    names: ["QMS SAP PR Sync", "QMS PR Sync"], codes: ["QMS_SAP_PR"], version: 2, audience: "Procurement and SAP users",
    intro: "QMS SAP PR Sync works in the background to keep purchase-requisition data moving between QMS and SAP. There is nothing to open or click — this page explains what you'll notice and what to do if something looks wrong.",
    sections: [
      { title: "What it does", steps: ["Every few minutes it reads new and changed PRs and NFA data.", "It keeps exactly one up-to-date row per PR, so reports never show duplicates.", "SAP reads the data from it for the QMS PR reports."] },
      { title: "What you'll notice", steps: ["New and changed PRs appear in the SAP / QMS PR reports within minutes.", "Nothing else changes in how you work."] },
      { title: "If something looks wrong", steps: ["If a PR is missing or out of date for more than an hour, raise a ticket on the IT helpdesk with the PR number.", "Mention whether it is in SAP Production, Quality or Development."] },
    ],
  },

  /* ------------------------------------------------------------------ IT Manager ------------------------------------------------------------------ */
  {
    names: ["IT Manager"], codes: ["IT_MANAGER"], version: 2, audience: "IT team and application owners",
    intro: "IT Manager lists every application Smartworld uses — built in-house or licensed — with its users and licences, usage, helpdesk tickets, tasks, documents and user manuals, releases and access rights, and opens any app in one click.",
    roles: [
      { role: "Admin", can: "Everything, including users, settings and imports" },
      { role: "Editor", can: "Edit the apps they have edit rights on" },
      { role: "Viewer", can: "View apps, docs and dashboards" },
    ],
    loginNote: "Use an admin login.",
    sections: [
      SIGN_IN("Open IT Manager on port 4000 of the IT server and sign in with your username and password."),
      { title: "Dashboard", steps: ["KPI cards show applications, active users, open tickets and licence seats used.", "The Live applications card scrolls through every app — hover to pause.", "Below: usage by application, issues, licences to review, the task calendar and team workload."], shot: { path: "/#/" } },
      { title: "Applications", steps: ["Open Applications.", "Switch between Grouped, Cards and List; group by category, hosting or in-house / vendor.", "Hover a card to see seats used, active users, open tickets and tasks done; click to open the app's page.", "Use + New application, or import a list from Excel."], shot: { path: "/#/apps" } },
      { title: "An application's page", steps: ["Overview: about text, owner, dates, users and usage.", "Tabs: Screens, Tasks, Usage, Users, Tickets, Docs & manual, Releases, Files, Access, Activity.", "Docs & manual has the user manual (PDF) — Download PDF, or Make it again from the live app.", "Delete an app with the bin icon (admins)."] },
      { title: "All tasks", steps: ["Open All tasks to see every app's tasks by app or by due date.", "Click a task to edit it; click a column title to open the whole column."], shot: { path: "/#/tasks" } },
      { title: "Tickets", steps: ["Open Tickets for helpdesk tickets synced from ServiceDesk Plus.", "Tickets are tagged to apps automatically; tag the rest by hand or with the suggestions panel.", "Click a ticket for its details."], shot: { path: "/#/tickets" } },
      { title: "Users & rights (admins)", steps: ["Open Users & rights to add people and set their role.", "Per-app edit / view rights are on each app's Access tab."], shot: { path: "/#/users" } },
    ],
  },
];

export function manualFor(app: { name: string; code: string }) {
  const n = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return MANUALS.find((m) => m.names.some((x) => n(x) === n(app.name))) ?? MANUALS.find((m) => m.codes?.some((c) => n(c) === n(app.code)));
}
