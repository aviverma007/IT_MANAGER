export {};
// End-to-end API test: exercises auth, rights, tasks/progress, usage, docs, releases, files, imports and the audit log.
//   PORT=4000 npm start   (in another terminal, with a fresh DATA_DIR)
//   API=http://localhost:4000 npm run test:api
const API = process.env.API ?? "http://localhost:4000";
let failures = 0;
let passed = 0;

async function call<T = any>(method: string, params: Record<string, unknown> = {}, token?: string): Promise<{ status: number; body: T }> {
  const res = await fetch(`${API}/api/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(params),
  });
  return { status: res.status, body: (await res.json()) as T };
}

function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failures++; console.log(`  ✗ ${name}`, detail ?? ""); }
}

async function login(username: string, password: string) {
  const r = await call<{ token: string }>("login", { username, password });
  if (r.status !== 200) throw new Error(`login ${username} failed: ${JSON.stringify(r.body)}`);
  return r.body.token;
}

console.log(`Testing ${API}`);
const bad = await call("login", { username: "admin", password: "nope" });
check("wrong password is rejected (401)", bad.status === 401);
check("unauthenticated call is rejected (401)", (await call("apps.list")).status === 401);

const admin = await login("admin", "admin123");
const editor = await login("priya", "editor123");
const viewer = await login("rahul", "viewer123");
check("three roles can sign in", !!admin && !!editor && !!viewer);

// create app as editor
const created = await call("apps.create", { name: "Test Portal", code: "TEST_PORTAL", status: "development", url: "example.com", techStack: "React, Node" }, editor);
check("editor can create an application", created.status === 200, created.body);
const appId = created.body.id as string;
check("url is normalised to https", created.body.url === "https://example.com");
check("template checklist is added (4 headings, 2 tasks pre-ticked for development)", created.body.tasksTotal === 11 && created.body.tasksDone === 2, created.body.tasksTotal);
check("viewer cannot create applications", (await call("apps.create", { name: "Nope" }, viewer)).status === 403);

// viewer: view only on public app
const asViewer = await call("apps.get", { id: appId }, viewer);
check("viewer can view a public app", asViewer.status === 200 && asViewer.body.permission === "view");
check("viewer cannot edit", (await call("apps.update", { id: appId, tagline: "x" }, viewer)).status === 403);

// restrict + grant
await call("apps.access", { id: appId, visibility: "restricted", acl: {} }, admin);
check("restricted app is hidden from viewer", (await call("apps.get", { id: appId }, viewer)).status === 403);
const users = (await call<any[]>("users.list", {}, admin)).body;
const rahul = users.find((u) => u.username === "rahul");
await call("apps.access", { id: appId, acl: { [rahul.id]: "edit" } }, admin);
const granted = await call("apps.get", { id: appId }, viewer);
check("explicit edit grant lets a viewer edit", granted.status === 200 && granted.body.permission === "edit");

// tasks & progress
const detail = (await call("apps.get", { id: appId }, admin)).body;
const firstGroup = detail.groups[0];
const t = await call("tasks.create", { groupId: firstGroup.id, title: "Write API tests", dueDate: "01/12/2026" }, editor);
check("task created with DD/MM/YYYY date normalised", t.status === 200 && t.body.dueDate === "2026-12-01", t.body);
await call("tasks.update", { id: t.body.id, done: true }, viewer);
const after = (await call("apps.get", { id: appId }, admin)).body;
check("ticking a task updates progress", after.tasksDone === detail.tasksDone + 1 && after.progress === Math.round(((detail.tasksDone + 1) / (detail.tasksTotal + 1)) * 100), { done: after.tasksDone, p: after.progress });
check("completion recorded who did it", after.tasks.find((x: any) => x.id === t.body.id).doneBy === "Rahul Mehta");

// imports
const ti = await call("tasks.import", { appId, rows: [{ group: "Phase 2", title: "Reports", done: "yes" }, { group: "Phase 2", title: "Dashboards", done: "no" }, { title: "" }] }, admin);
check("task import creates headings and tasks, skips blanks", ti.body.created === 2 && ti.body.skipped === 1, ti.body);
const ui = await call("usage.import", { rows: [{ app: "TEST_PORTAL", date: "2026-11-01", sessions: 10, activeUsers: 4 }, { app: "TEST_PORTAL", date: 46000, sessions: "1,200" }, { app: "UNKNOWN", date: "2026-11-01" }] }, admin);
check("usage import matches by code, parses Excel serial + '1,200'", ui.body.created === 2 && ui.body.skipped === 1, ui.body);
const upd = await call("usage.save", { appId, date: "2026-11-01", sessions: 25, activeUsers: 7 }, admin);
check("saving an existing date updates instead of duplicating", upd.body.sessions === 25 && (await call("apps.get", { id: appId }, admin)).body.usageEntries.length === 2);
const ai = await call("apps.import", { rows: [{ name: "Test Portal", code: "TEST_PORTAL", status: "Production" }, { name: "Imported App", status: "dev", owner: "priya", techStack: "Python; Flask" }] }, admin);
check("app import updates by code and creates new", ai.body.updated === 1 && ai.body.created === 1, ai.body);
const apps = (await call<any[]>("apps.list", {}, admin)).body;
check("status synonyms map (Production→live, dev→development)", apps.find((a) => a.code === "TEST_PORTAL").status === "live" && apps.find((a) => a.name === "Imported App").status === "development");

// docs, releases, files
const doc = await call("docs.save", { appId, kind: "manual", title: "Manual", content: "# Hello" }, admin);
check("document saved", doc.status === 200);
const rel = await call("releases.save", { appId, version: "1.2.0", title: "First", setCurrent: true }, admin);
check("release sets current version", rel.status === 200 && (await call("apps.get", { id: appId }, admin)).body.version === "1.2.0");
const file = await call("files.upload", { appId, name: "notes.txt", type: "text/plain", dataUrl: "data:text/plain;base64,aGVsbG8=" }, admin);
check("file upload", file.status === 200 && file.body.size === 5, file.body);
check("file download returns content", (await call("files.get", { id: file.body.id }, admin)).body.dataUrl.endsWith("aGVsbG8="));

// screenshots
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const s1 = await call("shots.add", { appId, dataUrl: png, width: 1, height: 1, caption: "Login" }, admin);
check("screenshot added and becomes cover", s1.status === 200 && (await call("apps.get", { id: appId }, admin)).body.coverShot?.id === s1.body.id, s1.body);
const s2 = await call("shots.add", { appId, dataUrl: png, width: 1, height: 1, caption: "Dashboard" }, admin);
await call("shots.cover", { id: s2.body.id }, admin);
check("cover can be switched", (await call("apps.get", { id: appId }, admin)).body.coverShot?.id === s2.body.id);
const img = await fetch(`${API}/api/shot/${s2.body.id}?t=${admin}`);
check("screenshot served as an image file", img.status === 200 && (img.headers.get("content-type") ?? "").startsWith("image/png"));
check("screenshot needs a valid token", (await fetch(`${API}/api/shot/${s2.body.id}?t=nope`)).status === 404);
check("non-images are refused", (await call("shots.add", { appId, dataUrl: "data:text/plain;base64,aGk=" }, admin)).status === 400);
check("view-only user can't add screenshots", (await call("shots.add", { appId: apps.find((a) => a.code === "SMARTDESK").id, dataUrl: png }, viewer)).status === 403);
await call("shots.delete", { id: s2.body.id }, admin);
check("deleting the cover falls back to the next screenshot", (await call("apps.get", { id: appId }, admin)).body.coverShot?.id === s1.body.id);

// launches & usage summary
await call("apps.launch", { id: appId }, viewer);
check("launch counted", (await call("apps.get", { id: appId }, admin)).body.usage.launches30 === 1);

// logs
const logs = await call("logs.list", { appId, limit: 200 }, admin);
const actions = new Set(logs.body.items.map((l: any) => l.action));
check("audit log captured create/access/complete/import/upload/open", ["create", "access", "complete", "import", "upload", "open"].every((a) => actions.has(a)), [...actions]);
const accessLog = logs.body.items.find((l: any) => l.action === "access");
check("access log has before → after changes", accessLog?.changes?.length > 0);
const viewerLogs = await call("logs.list", {}, viewer);
check("viewer only sees logs for apps they can access", viewerLogs.body.items.every((l: any) => !l.appId || apps.some((a) => a.id === l.appId)));

// users
const nu = await call("users.create", { username: "test.user", password: "secret1", role: "viewer", name: "Test User" }, admin);
check("admin creates user", nu.status === 200);
check("non-admin cannot create users", (await call("users.create", { username: "x.y", password: "secret1" }, editor)).status === 403);
await call("users.update", { id: nu.body.id, active: false }, admin);
check("deactivated user can't sign in", (await call("login", { username: "test.user", password: "secret1" })).status === 403);
check("admin can't delete themselves", (await call("users.delete", { id: users.find((u) => u.username === "admin").id }, admin)).status === 400);

// cleanup
check("delete cascades", (await call("apps.delete", { id: appId }, admin)).status === 200 && (await call("apps.get", { id: appId }, admin)).status === 404);
const backup = await call("admin.export", {}, admin);
check("backup export has no sessions", Array.isArray(backup.body.apps) && backup.body.sessions.length === 0);

console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
