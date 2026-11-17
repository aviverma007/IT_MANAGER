// Markdown templates for documentation. Used by the seed data and by the "Insert template" button in the Docs tab.
interface AppLike {
  name: string;
  tagline?: string;
  description?: string;
  url?: string;
  techStack?: string[];
  department?: string;
}

export function manualTemplate(app: AppLike) {
  const url = app.url || "<application link>";
  return `# ${app.name} — User Manual

> ${app.tagline || "What this application does, in one line."}

## 1. Overview
${app.description || `${app.name} helps the ${app.department || "business"} team get their work done faster. Describe who uses it and why.`}

**Who should use it:** list the roles or departments.
**Where to open it:** [${url}](${app.url || "#"})

## 2. Getting started
1. Open **${url}** in Chrome or Edge.
2. Sign in with your company username and password.
3. On first login, check that your name and department are correct on the profile screen.

> **Tip:** Bookmark the link, or open it any time from **IT Manager → Applications → ${app.name} → Open app**.

## 3. Screens at a glance
| Screen | What you do there |
| --- | --- |
| Home / Dashboard | See a summary of your work and pending items |
| Entry form | Create a new record |
| Reports | Filter, view and export data to Excel |
| Settings | Manage your profile and preferences |

## 4. Step-by-step: common tasks
### 4.1 Create a new entry
1. Click **New** on the top right.
2. Fill in the mandatory fields (marked with \\*).
3. Click **Save**. A green confirmation appears.

### 4.2 Search and edit an entry
1. Use the search bar to find the record.
2. Click the row to open it, then **Edit**.
3. Change the fields and click **Save**.

### 4.3 Export a report
1. Go to **Reports**, set the date range and filters.
2. Click **Export → Excel**.

## 5. Roles and rights
- **Admin** — full access, user management.
- **Editor** — create and update records.
- **Viewer** — read-only access.

## 6. FAQ
**I can't sign in.** Check Caps Lock, then ask IT to reset your password.
**The page is blank.** Refresh with Ctrl + F5 or clear your browser cache.
**A number looks wrong.** Note the record ID and contact IT support.

## 7. Support
Raise a ticket with the IT team and mention **${app.name}** and a screenshot of the issue.
`;
}

export function technicalTemplate(app: AppLike) {
  const stack = app.techStack?.length ? app.techStack.join(", ") : "React, Node/Express, SQL Server";
  return `# ${app.name} — Technical notes

## Architecture
- **Frontend:** ${stack.split(",")[0]}
- **Stack:** ${stack}
- **Hosting:** server / IIS / PM2 details
- **Database:** server, database name, key tables

## Environments
| Env | URL | Notes |
| --- | --- | --- |
| Production | ${app.url || "—"} | |
| UAT | — | |

## Deployment
\`\`\`bash
git pull
npm ci
npm run build
pm2 restart ${app.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
\`\`\`

## Integrations
- SAP / APIs / scheduled jobs this app depends on.

## Backups & monitoring
- Backup schedule, log locations, health-check URL.

## Known issues
- None recorded yet.
`;
}
