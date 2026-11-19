import * as React from "react";
import * as XLSX from "xlsx";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, ClipboardPaste, Download, FileSpreadsheet, UploadCloud, XCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { useRun } from "@/api/hooks";
import type { ImportResult } from "@/core/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type ImportKind = "apps" | "tasks" | "usage";

type FieldDef = { key: string; label: string; required?: boolean; synonyms: string[] };

export const IMPORT_FIELDS: Record<ImportKind, FieldDef[]> = {
  apps: [
    { key: "name", label: "Name", required: true, synonyms: ["name", "application", "app", "application name", "app name", "title"] },
    { key: "code", label: "Code", synonyms: ["code", "app code", "short code", "id", "key"] },
    { key: "tagline", label: "Tagline", synonyms: ["tagline", "summary", "short description", "subtitle"] },
    { key: "description", label: "Description", synonyms: ["description", "details", "about", "remarks"] },
    { key: "status", label: "Status", synonyms: ["status", "stage", "state", "phase"] },
    { key: "category", label: "Category", synonyms: ["category", "type", "module"] },
    { key: "department", label: "Department", synonyms: ["department", "dept", "business", "team", "function"] },
    { key: "url", label: "Link / URL", synonyms: ["url", "link", "app link", "application link", "website", "prod url", "production url"] },
    { key: "version", label: "Version", synonyms: ["version", "release", "ver"] },
    { key: "techStack", label: "Tech stack", synonyms: ["tech stack", "stack", "technology", "technologies", "tech"] },
    { key: "owner", label: "Owner", synonyms: ["owner", "owned by", "responsible", "developer", "spoc"] },
    { key: "priority", label: "Priority", synonyms: ["priority", "criticality", "importance"] },
    { key: "startDate", label: "Start date", synonyms: ["start date", "start", "started", "kickoff"] },
    { key: "goLiveDate", label: "Go-live date", synonyms: ["go live", "go-live", "go live date", "golive", "launch date", "live date"] },
    { key: "seats", label: "Licensed seats", synonyms: ["seats", "licensed seats", "licenses", "licences", "license count", "licence count", "users licensed"] },
    { key: "activeUsers", label: "Active users", synonyms: ["active users", "active", "users", "active user count"] },
    { key: "hosting", label: "Hosting", synonyms: ["hosting", "deployment", "on-prem / cloud", "on prem", "cloud", "environment"] },
    { key: "vendor", label: "Vendor", synonyms: ["vendor", "provider", "publisher", "supplier"] },
    { key: "source", label: "In-house / vendor", synonyms: ["source", "built by", "in-house", "inhouse", "ownership"] },
  ],
  tasks: [
    { key: "group", label: "Heading / section", synonyms: ["heading", "group", "section", "phase", "stage", "module", "milestone", "category"] },
    { key: "title", label: "Task", required: true, synonyms: ["task", "title", "task name", "item", "activity", "description", "name"] },
    { key: "done", label: "Done?", synonyms: ["done", "completed", "complete", "status", "checked", "finished"] },
    { key: "assignee", label: "Assignee", synonyms: ["assignee", "assigned to", "owner", "responsible", "person"] },
    { key: "dueDate", label: "Due date", synonyms: ["due", "due date", "deadline", "target date", "end date"] },
    { key: "priority", label: "Priority", synonyms: ["priority", "importance"] },
    { key: "notes", label: "Notes", synonyms: ["notes", "remarks", "comment", "comments"] },
  ],
  usage: [
    { key: "app", label: "Application", synonyms: ["app", "application", "app name", "application name", "code", "app code"] },
    { key: "date", label: "Date", required: true, synonyms: ["date", "day", "on", "log date", "report date"] },
    { key: "activeUsers", label: "Active users", synonyms: ["active users", "users", "unique users", "dau", "user count"] },
    { key: "sessions", label: "Sessions / logins", synonyms: ["sessions", "logins", "visits", "login count", "hits", "page views"] },
    { key: "transactions", label: "Transactions", synonyms: ["transactions", "entries", "records", "documents", "txn", "actions"] },
    { key: "avgMinutes", label: "Avg minutes", synonyms: ["avg minutes", "average minutes", "avg time", "duration", "time spent"] },
    { key: "notes", label: "Notes", synonyms: ["notes", "remarks", "comment"] },
  ],
};

const TEMPLATES: Record<ImportKind, Record<string, unknown>[]> = {
  apps: [
    { Name: "SmartDesk", Code: "SMARTDESK", Tagline: "Employee portal", Status: "Live", Category: "Employee portal", Department: "All employees", Link: "https://smartdesk.company.local", Version: "2.4.0", "Tech stack": "React, Node.js, SQL Server", Owner: "admin", Priority: "High", "Start date": "2025-01-10", "Go-live date": "2025-06-01" },
    { Name: "Cheque Register", Code: "CHEQUE_REG", Tagline: "Track cheques", Status: "Development", Category: "Finance", Department: "Accounts", Link: "", Version: "0.5.0", "Tech stack": "React, Flask", Owner: "", Priority: "Medium", "Start date": "2026-09-01", "Go-live date": "2026-12-15" },
  ],
  tasks: [
    { Heading: "Development", Task: "Build login page", Done: "Yes", Assignee: "Anirudh", "Due date": "2026-11-20", Priority: "High", Notes: "" },
    { Heading: "Development", Task: "Excel export on reports", Done: "No", Assignee: "Anirudh", "Due date": "2026-11-28", Priority: "Medium", Notes: "" },
    { Heading: "Testing & UAT", Task: "UAT with accounts team", Done: "No", Assignee: "Priya", "Due date": "2026-12-05", Priority: "Critical", Notes: "" },
  ],
  usage: [
    { Application: "SMARTDESK", Date: "2026-11-15", "Active users": 96, Sessions: 210, Transactions: 540, "Avg minutes": 8.5, Notes: "" },
    { Application: "SMARTDESK", Date: "2026-11-16", "Active users": 102, Sessions: 225, Transactions: 580, "Avg minutes": 9.1, Notes: "" },
  ],
};

const norm = (s: string) => s.toLowerCase().replace(/[_\-./]+/g, " ").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

function guess(headers: string[], fields: FieldDef[]) {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  for (const f of fields) {
    const hit = headers.find((h) => !used.has(h) && (norm(h) === norm(f.label) || f.synonyms.includes(norm(h)) || norm(h) === norm(f.key)))
      ?? headers.find((h) => !used.has(h) && f.synonyms.some((s) => norm(h).includes(s)));
    if (hit) { map[f.key] = hit; used.add(hit); }
  }
  return map;
}

function parseWorkbook(wb: XLSX.WorkBook) {
  const sheets: Record<string, Record<string, unknown>[]> = {};
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name]!, { defval: "", raw: true });
    if (rows.length) sheets[name] = rows;
  }
  return sheets;
}

export function downloadTemplate(kind: ImportKind) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(TEMPLATES[kind]), kind);
  XLSX.writeFile(wb, `it-manager-${kind}-template.xlsx`);
}

export function ImportWizard({ open, onClose, kind, appId, appName }: { open: boolean; onClose: () => void; kind: ImportKind; appId?: string; appName?: string }) {
  const run = useRun();
  const fields = IMPORT_FIELDS[kind].filter((f) => !(kind === "usage" && appId && f.key === "app"));
  const [step, setStep] = React.useState<0 | 1 | 2>(0);
  const [sheets, setSheets] = React.useState<Record<string, Record<string, unknown>[]>>({});
  const [sheet, setSheet] = React.useState("");
  const [map, setMap] = React.useState<Record<string, string>>({});
  const [paste, setPaste] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [drag, setDrag] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  React.useEffect(() => { if (open) { setStep(0); setSheets({}); setSheet(""); setMap({}); setPaste(""); setFileName(""); setResult(null); } }, [open]);

  const rows = sheets[sheet] ?? [];
  const headers = rows.length ? Object.keys(rows[0]!) : [];

  function load(parsed: Record<string, Record<string, unknown>[]>, name: string) {
    const names = Object.keys(parsed);
    if (!names.length) { toast.error("No rows found in that file."); return; }
    setSheets(parsed);
    setSheet(names[0]!);
    setMap(guess(Object.keys(parsed[names[0]!]![0]!), fields));
    setFileName(name);
    setStep(1);
  }

  async function onFile(file: File) {
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".json")) {
        const data = JSON.parse(await file.text());
        const list = Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : Array.isArray(data?.items) ? data.items : Object.values(data).find(Array.isArray);
        if (!Array.isArray(list)) throw new Error("JSON must be an array of objects.");
        load({ data: list as Record<string, unknown>[] }, file.name);
        return;
      }
      const buffer = await file.arrayBuffer();
      load(parseWorkbook(XLSX.read(buffer, { type: "array", cellDates: true })), file.name);
    } catch (e) {
      toast.error(`Couldn't read ${file.name}: ${(e as Error).message}`);
    }
  }

  function onPaste() {
    const text = paste.trim();
    if (!text) return;
    try {
      if (text.startsWith("[") || text.startsWith("{")) {
        const data = JSON.parse(text);
        load({ pasted: Array.isArray(data) ? data : [data] }, "Pasted JSON");
      } else load(parseWorkbook(XLSX.read(text, { type: "string", raw: false })), "Pasted table");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const mapped = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const f of fields) if (map[f.key]) out[f.key] = row[map[f.key]!] instanceof Date ? (row[map[f.key]!] as Date).toISOString().slice(0, 10) : row[map[f.key]!];
    return out;
  });
  const missing = fields.filter((f) => f.required && !map[f.key]);

  async function submit() {
    setBusy(true);
    const method = kind === "apps" ? "apps.import" : kind === "tasks" ? "tasks.import" : "usage.import";
    const res = await run<ImportResult>(method, { appId, rows: mapped });
    setBusy(false);
    if (res) { setResult(res); setStep(2); }
  }

  const title = { apps: "Import applications", tasks: `Import tasks${appName ? ` into ${appName}` : ""}`, usage: `Import usage${appName ? ` for ${appName}` : ""}` }[kind];

  return (
    <Modal open={open} onClose={onClose} title={title} description="Excel (.xlsx/.xls), CSV, TSV, ODS, JSON or a table pasted from anywhere." icon={<FileSpreadsheet />} size="xl"
      footer={
        step === 0 ? <><Button variant="ghost" onClick={() => downloadTemplate(kind)}><Download />Download template</Button><Button variant="ghost" onClick={onClose}>Cancel</Button></>
          : step === 1 ? <><Button variant="ghost" onClick={() => setStep(0)}>Back</Button><Button variant="primary" disabled={!!missing.length || !rows.length} loading={busy} onClick={submit}>Import {rows.length} row{rows.length === 1 ? "" : "s"}</Button></>
            : <Button variant="primary" onClick={onClose}>Done</Button>
      }>
      <div className="mb-5 flex items-center gap-2 text-xs">
        {["Choose data", "Map columns", "Result"].map((label, i) => (
          <React.Fragment key={label}>
            <span className={cn("flex items-center gap-2 rounded-full px-3 py-1 font-medium transition-colors", i === step ? "emboss text-foreground" : i < step ? "text-success" : "text-muted-foreground")}>
              <span className={cn("grid size-5 place-items-center rounded-full text-[10px]", i <= step ? "bg-primary text-primary-foreground" : "bg-muted")}>{i + 1}</span>{label}
            </span>
            {i < 2 && <span className="h-px w-6 bg-border" />}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid gap-4 lg:grid-cols-2">
            <label
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void onFile(f); }}
              className={cn("relative flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border-2 border-dashed p-6 text-center transition-all", drag ? "scale-[1.02] border-primary bg-primary/10" : "border-border hover:border-ring hover:bg-muted/30")}
            >
              <motion.div animate={drag ? { y: -6, scale: 1.1 } : { y: 0, scale: 1 }} className="emboss grid size-16 place-items-center rounded-2xl text-primary"><UploadCloud className="size-7" /></motion.div>
              <div className="text-sm font-semibold">Drop a file here or click to browse</div>
              <div className="text-xs text-muted-foreground">.xlsx · .xls · .csv · .tsv · .ods · .json · .txt</div>
              <input type="file" hidden accept=".xlsx,.xls,.xlsm,.csv,.tsv,.ods,.json,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
            </label>
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"><ClipboardPaste className="size-4" />…or paste rows (with a header row)</span>
              <Textarea value={paste} onChange={(e) => setPaste(e.target.value)} className="min-h-44 flex-1 font-mono text-xs" placeholder={"Copy cells straight from Excel / Google Sheets, CSV text or JSON:\n\nName\tStatus\tLink\nSmartDesk\tLive\thttps://…"} />
              <Button variant="secondary" disabled={!paste.trim()} onClick={onPaste}>Use pasted data</Button>
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid gap-5">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">Source: <b className="text-foreground">{fileName}</b></span>
              {Object.keys(sheets).length > 1 && (
                <div className="w-52"><Select value={sheet} onChange={(e) => { setSheet(e.target.value); setMap(guess(Object.keys(sheets[e.target.value]![0]!), fields)); }}>{Object.keys(sheets).map((s) => <option key={s}>{s}</option>)}</Select></div>
              )}
              <span className="text-muted-foreground">{rows.length} rows · {headers.length} columns</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((f) => (
                <div key={f.key} className={cn("deboss rounded-2xl p-3", f.required && !map[f.key] && "ring-1 ring-destructive")}>
                  <div className="mb-1.5 flex items-center justify-between text-xs font-medium">{f.label}{f.required && <span className="text-destructive">required</span>}{map[f.key] && <CheckCircle2 className="size-3.5 text-success" />}</div>
                  <Select value={map[f.key] ?? ""} onChange={(e) => setMap((m) => ({ ...m, [f.key]: e.target.value }))} className="h-9 text-xs">
                    <option value="">— skip —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </Select>
                </div>
              ))}
            </div>
            {kind === "usage" && !appId && !map.app && <p className="text-xs text-warning">Map the Application column so each row lands on the right app (matched by code or name).</p>}
            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">Preview — first {Math.min(8, mapped.length)} rows after mapping</div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-popover"><tr>{fields.filter((f) => map[f.key]).map((f) => <th key={f.key} className="whitespace-nowrap px-3 py-2 text-left font-semibold">{f.label}</th>)}</tr></thead>
                  <tbody>
                    {mapped.slice(0, 8).map((r, i) => (
                      <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-t border-border">
                        {fields.filter((f) => map[f.key]).map((f) => <td key={f.key} className="max-w-56 truncate whitespace-nowrap px-3 py-1.5 text-muted-foreground">{String(r[f.key] ?? "")}</td>)}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && result && (
          <motion.div key="s2" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="grid gap-4">
            <div className="grid grid-cols-3 gap-3">
              {[["Created", result.created, "text-success"], ["Updated", result.updated, "text-chart-2"], ["Skipped", result.skipped, "text-muted-foreground"]].map(([label, n, color], i) => (
                <motion.div key={label as string} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.08 }} className="emboss rounded-2xl border border-border p-4 text-center">
                  <div className={cn("text-3xl font-bold tabular-nums", color as string)}>{n as number}</div>
                  <div className="text-xs text-muted-foreground">{label as string}</div>
                </motion.div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div className="deboss max-h-48 overflow-auto rounded-2xl p-3 text-xs">
                {result.errors.map((e, i) => <div key={i} className="flex items-center gap-2 py-0.5 text-muted-foreground"><XCircle className="size-3.5 text-destructive" />{e}</div>)}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
