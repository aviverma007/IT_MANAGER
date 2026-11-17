// Shared domain model — used by the Express API (server/) and the in-browser demo transport.

export type Role = "admin" | "editor" | "viewer";
export type Access = "edit" | "view";
export type Tone = 1 | 2 | 3 | 4 | 5;

export const APP_STATUSES = ["planning", "development", "testing", "uat", "live", "maintenance", "on-hold", "retired"] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const DOC_KINDS = ["overview", "manual", "technical", "faq", "other"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  department: string;
  bio: string;
  avatar: string;
  tone: Tone;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserRecord extends User {
  salt: string;
  passwordHash: string;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface EnvLink {
  label: string;
  url: string;
}

export interface App {
  id: string;
  name: string;
  code: string;
  tagline: string;
  description: string;
  category: string;
  department: string;
  status: AppStatus;
  priority: Priority;
  url: string;
  repoUrl: string;
  environments: EnvLink[];
  techStack: string[];
  ownerId: string | null;
  version: string;
  cover: string;
  tone: Tone;
  startDate: string;
  goLiveDate: string;
  visibility: "public" | "restricted";
  acl: Record<string, Access>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface TaskGroup {
  id: string;
  appId: string;
  title: string;
  order: number;
  createdAt: string;
}

export interface Task {
  id: string;
  appId: string;
  groupId: string;
  title: string;
  notes: string;
  done: boolean;
  doneAt: string | null;
  doneBy: string | null;
  assignee: string;
  dueDate: string;
  priority: Priority;
  order: number;
  createdAt: string;
}

export interface UsageEntry {
  id: string;
  appId: string;
  date: string; // YYYY-MM-DD
  activeUsers: number;
  sessions: number;
  transactions: number;
  avgMinutes: number;
  notes: string;
  source: "manual" | "import";
  createdAt: string;
}

export interface Launch {
  id: string;
  appId: string;
  userId: string;
  at: string;
}

export interface Doc {
  id: string;
  appId: string;
  kind: DocKind;
  title: string;
  content: string; // markdown
  order: number;
  updatedAt: string;
  updatedBy: string;
}

export interface Release {
  id: string;
  appId: string;
  version: string;
  date: string;
  title: string;
  notes: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  appId: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  uploadedAt: string;
  uploadedBy: string;
}

export type AttachmentMeta = Omit<Attachment, "dataUrl">;

export interface Change {
  field: string;
  from: unknown;
  to: unknown;
}

export interface LogEntry {
  id: string;
  at: string;
  userId: string | null;
  userName: string;
  action: string;
  entity: string;
  entityId: string | null;
  appId: string | null;
  appName: string | null;
  summary: string;
  changes: Change[];
}

export interface DB {
  version: number;
  users: UserRecord[];
  sessions: Session[];
  apps: App[];
  groups: TaskGroup[];
  tasks: Task[];
  usage: UsageEntry[];
  launches: Launch[];
  docs: Doc[];
  releases: Release[];
  attachments: Attachment[];
  favorites: { userId: string; appId: string }[];
  logs: LogEntry[];
}

/* ---------- view models returned by the API ---------- */

export interface UsageSummary {
  sessions30: number;
  sessionsPrev30: number;
  trend: number; // % change vs previous 30 days
  activeUsers: number; // latest entry
  transactions30: number;
  launches30: number;
  lastEntry: string | null;
  spark: number[]; // last 14 days sessions
}

export interface AppSummary extends App {
  progress: number; // 0..100
  tasksDone: number;
  tasksTotal: number;
  overdue: number;
  usage: UsageSummary;
  permission: Access;
  favorite: boolean;
  ownerName: string;
  docCount: number;
}

export interface AppDetail extends AppSummary {
  groups: TaskGroup[];
  tasks: Task[];
  usageEntries: UsageEntry[];
  docs: Doc[];
  releases: Release[];
  attachments: AttachmentMeta[];
  activity: LogEntry[];
}

export interface DashboardStats {
  totals: { apps: number; live: number; inProgress: number; avgProgress: number; tasksOpen: number; overdue: number; sessions30: number; trend: number; users: number };
  byStatus: { status: AppStatus; count: number }[];
  usageSeries: { date: string; sessions: number; activeUsers: number; launches: number }[];
  topApps: { id: string; name: string; sessions: number; tone: Tone }[];
  dueSoon: (Task & { appName: string })[];
  recent: LogEntry[];
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export type ImportResult = { created: number; updated: number; skipped: number; errors: string[] };
