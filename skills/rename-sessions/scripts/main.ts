#!/usr/bin/env bun
// rename-sessions: list and rename past agent sessions for the current project.
// Stores: Claude Code (~/.claude), qodercli (~/.qoder), Codex (codex app-server RPC).
//
//   bun main.ts list  --tool claude|qoder|codex|all [--cwd <path>] [--limit 30] [--min-user 2] [--include-formatted]
//   bun main.ts apply --tool claude|qoder|codex|all --plan <plan.json>
//
// The script only does the mechanical part. Choosing TYPE and Topic is left to the caller.

import { parseArgs } from "node:util";
import { createReadStream, existsSync } from "node:fs";
import { appendFile, open, readdir, readFile, stat, utimes } from "node:fs/promises";
import { createInterface } from "node:readline";
import os from "node:os";
import path from "node:path";

type Tool = "claude" | "qoder" | "codex";
const TOOLS: Tool[] = ["claude", "qoder", "codex"];
const HOME = os.homedir();
const DEFAULT_TZ = "Asia/Shanghai";
const TITLE_RE = /^\d{4}｜(FEA|DES|FIX|OPT|REL|EXP|DOC|RES|功能|设计|修复|优化|发布|探索|文档|研究)｜.+/;

interface Excerpt {
  userPrompts: string[];
  lastAssistant: string | null;
}

interface SessionInfo {
  tool: Tool;
  id: string;
  created: string;
  date: string;
  mmdd: string;
  title: string | null;
  titleSource: string;
  userMessages: number;
  excerpt: Excerpt;
}

interface ListResult {
  tool: Tool;
  cwd: string;
  store: string | null;
  note?: string;
  skipped: { live: number; small: number; formatted: number };
  sessions: SessionInfo[];
}

interface PlanEntry {
  id: string;
  title: string;
}

interface ApplyDetail {
  id: string;
  title?: string;
  status: "written" | "skipped" | "failed";
  reason?: string;
}

interface ApplyResult {
  tool: Tool;
  store: string | null;
  note?: string;
  written: number;
  skipped: number;
  failed: number;
  details: ApplyDetail[];
}

interface ListOptions {
  cwd: string;
  limit: number;
  minUser: number;
  includeFormatted: boolean;
  tz: string;
}

// ---------- helpers ----------

function expandHome(p: string): string {
  return p.startsWith("~") ? path.join(HOME, p.slice(1)) : p;
}

function localDate(iso: string, tz: string): { date: string; mmdd: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "??";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, mmdd: `${get("month")}${get("day")}` };
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

// Strip host-injected wrappers and interruption markers so only what the person typed remains.
function stripWrappers(s: string): string {
  return s
    .replace(/<(system-reminder|linked_note|command-[a-z-]+|local-command-[a-z-]+)>[\s\S]*?<\/\1>/g, "")
    .replace(/\[Request interrupted by user[^\]]*\]/g, "")
    .trim();
}

async function* lines(file: string): AsyncGenerator<string> {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) yield line;
}

function blockText(content: unknown, types: string[]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b && typeof b === "object" && types.includes((b as { type?: string }).type ?? "") && typeof (b as { text?: unknown }).text === "string")
    .map((b) => (b as { text: string }).text)
    .join("\n");
}

function pidAlive(pid: unknown): boolean {
  if (typeof pid !== "number") return true; // unknown → assume alive
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ---------- transcript stores (Claude Code, qodercli) ----------

interface TranscriptScan {
  firstUserTs: string | null;
  userMessages: number;
  userPrompts: string[];
  lastAssistant: string | null;
  customTitle: string | null;
  aiTitle: string | null;
}

function storeRoot(tool: "claude" | "qoder"): string {
  if (tool === "claude") return path.join(HOME, ".claude");
  const env = process.env.QODER_CONFIG_DIR;
  return env ? expandHome(env) : path.join(HOME, ".qoder");
}

function projectDirCandidates(cwd: string): string[] {
  const a = cwd.replace(/\//g, "-");
  const b = cwd.replace(/[^a-zA-Z0-9]/g, "-");
  return a === b ? [a] : [a, b];
}

function resolveProjectDir(root: string, cwd: string): string | null {
  for (const c of projectDirCandidates(cwd)) {
    const p = path.join(root, "projects", c);
    if (existsSync(p)) return p;
  }
  return null;
}

async function liveSessionIds(root: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const dir = path.join(root, "sessions");
  if (!existsSync(dir)) return ids;
  for (const f of await readdir(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      const d = JSON.parse(await readFile(path.join(dir, f), "utf8")) as { sessionId?: unknown; pid?: unknown };
      if (typeof d.sessionId === "string" && pidAlive(d.pid)) ids.add(d.sessionId);
    } catch {
      /* ignore unreadable registry entries */
    }
  }
  return ids;
}

function currentSessionId(tool: Tool): string | undefined {
  if (tool === "claude") return process.env.CLAUDE_CODE_SESSION_ID;
  if (tool === "qoder") return process.env.QODER_SESSION_ID;
  return process.env.CODEX_THREAD_ID ?? process.env.CODEX_SESSION_ID;
}

async function scanTranscript(file: string): Promise<TranscriptScan> {
  const r: TranscriptScan = { firstUserTs: null, userMessages: 0, userPrompts: [], lastAssistant: null, customTitle: null, aiTitle: null };
  for await (const line of lines(file)) {
    if (!line.startsWith("{")) continue;
    let d: Record<string, unknown>;
    try {
      d = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const msg = d.message as { content?: unknown } | undefined;
    switch (d.type) {
      case "custom-title":
        if (typeof d.customTitle === "string") r.customTitle = d.customTitle;
        break;
      case "ai-title":
        if (typeof d.aiTitle === "string") r.aiTitle = d.aiTitle;
        break;
      case "user": {
        if (!r.firstUserTs && typeof d.timestamp === "string") r.firstUserTs = d.timestamp;
        if (d.isMeta === true || d.isSidechain === true) break;
        const text = stripWrappers(blockText(msg?.content, ["text"]));
        if (!text) break;
        r.userMessages++;
        if (r.userPrompts.length < 3) r.userPrompts.push(clip(text, 200));
        break;
      }
      case "assistant": {
        if (d.isSidechain === true) break;
        const text = blockText(msg?.content, ["text"]).trim();
        if (text) r.lastAssistant = clip(text, 300);
        break;
      }
      default:
        break;
    }
  }
  return r;
}

async function listTranscriptStore(tool: "claude" | "qoder", opts: ListOptions): Promise<ListResult> {
  const root = storeRoot(tool);
  const skipped = { live: 0, small: 0, formatted: 0 };
  const projectDir = resolveProjectDir(root, opts.cwd);
  if (!projectDir) {
    return { tool, cwd: opts.cwd, store: null, note: `no project directory under ${path.join(root, "projects")} for this cwd`, skipped, sessions: [] };
  }
  const live = await liveSessionIds(root);
  const current = currentSessionId(tool);
  const entries = (await readdir(projectDir, { withFileTypes: true })).filter((e) => e.isFile() && e.name.endsWith(".jsonl"));
  const files = await Promise.all(
    entries.map(async (e) => {
      const file = path.join(projectDir, e.name);
      const st = await stat(file);
      return { file, id: e.name.slice(0, -".jsonl".length), mtimeMs: st.mtimeMs, birthMs: st.birthtimeMs || st.mtimeMs };
    }),
  );
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const sessions: SessionInfo[] = [];
  for (const f of files) {
    if (opts.limit > 0 && sessions.length >= opts.limit) break;
    if (f.id === current || live.has(f.id)) {
      skipped.live++;
      continue;
    }
    const scan = await scanTranscript(f.file);
    if (scan.userMessages < opts.minUser) {
      skipped.small++;
      continue;
    }
    const title = scan.customTitle ?? scan.aiTitle ?? scan.userPrompts[0] ?? null;
    const titleSource = scan.customTitle ? "custom" : scan.aiTitle ? "ai" : scan.userPrompts[0] ? "first-prompt" : "none";
    if (title && TITLE_RE.test(title) && !opts.includeFormatted) {
      skipped.formatted++;
      continue;
    }
    const created = scan.firstUserTs ?? new Date(f.birthMs).toISOString();
    const { date, mmdd } = localDate(created, opts.tz);
    sessions.push({
      tool,
      id: f.id,
      created,
      date,
      mmdd,
      title,
      titleSource,
      userMessages: scan.userMessages,
      excerpt: { userPrompts: scan.userPrompts, lastAssistant: scan.lastAssistant },
    });
  }
  return { tool, cwd: opts.cwd, store: projectDir, skipped, sessions };
}

// Look for one existing custom-title record in the store to confirm the shape is still what we write.
async function verifyRecordShape(projectDir: string): Promise<string | null> {
  const files = (await readdir(projectDir)).filter((f) => f.endsWith(".jsonl")).slice(0, 200);
  for (const f of files) {
    for await (const line of lines(path.join(projectDir, f))) {
      if (!line.startsWith('{"type":"custom-title"')) continue;
      try {
        const d = JSON.parse(line) as Record<string, unknown>;
        const ok = typeof d.customTitle === "string" && typeof d.sessionId === "string";
        return ok ? null : `existing custom-title record has an unexpected shape: ${clip(line, 200)}`;
      } catch {
        return `existing custom-title record is not valid JSON: ${clip(line, 200)}`;
      }
    }
  }
  return null; // no sample found (fresh store); nothing to compare against
}

async function endsWithNewline(file: string, size: number): Promise<boolean> {
  if (size === 0) return true;
  const fh = await open(file, "r");
  try {
    const buf = Buffer.alloc(1);
    await fh.read(buf, 0, 1, size - 1);
    return buf[0] === 0x0a;
  } finally {
    await fh.close();
  }
}

async function applyTranscriptStore(tool: "claude" | "qoder", plan: PlanEntry[], cwd: string): Promise<ApplyResult> {
  const root = storeRoot(tool);
  const projectDir = resolveProjectDir(root, cwd);
  const result: ApplyResult = { tool, store: projectDir, written: 0, skipped: 0, failed: 0, details: [] };
  if (!projectDir) {
    result.note = `no project directory under ${path.join(root, "projects")} for this cwd`;
    result.failed = plan.length;
    result.details = plan.map((p) => ({ id: p.id, title: p.title, status: "failed", reason: "no store" }));
    return result;
  }
  const shapeProblem = await verifyRecordShape(projectDir);
  if (shapeProblem) {
    result.note = `refusing to write: ${shapeProblem}`;
    result.failed = plan.length;
    result.details = plan.map((p) => ({ id: p.id, title: p.title, status: "failed", reason: "format check failed" }));
    return result;
  }
  const live = await liveSessionIds(root);
  const current = currentSessionId(tool);
  for (const entry of plan) {
    const file = path.join(projectDir, `${entry.id}.jsonl`);
    if (!existsSync(file)) {
      result.failed++;
      result.details.push({ id: entry.id, title: entry.title, status: "failed", reason: "transcript not found" });
      continue;
    }
    if (entry.id === current || live.has(entry.id)) {
      result.skipped++;
      result.details.push({ id: entry.id, title: entry.title, status: "skipped", reason: "session is live" });
      continue;
    }
    try {
      const st = await stat(file);
      const nl = (await endsWithNewline(file, st.size)) ? "" : "\n";
      // Match each host's own key order; both readers accept either.
      const record =
        tool === "claude"
          ? { type: "custom-title", customTitle: entry.title, sessionId: entry.id }
          : { type: "custom-title", sessionId: entry.id, customTitle: entry.title };
      await appendFile(file, `${nl}${JSON.stringify(record)}\n`);
      await utimes(file, st.atime, st.mtime); // keep picker order unchanged
      result.written++;
      result.details.push({ id: entry.id, title: entry.title, status: "written" });
    } catch (err) {
      result.failed++;
      result.details.push({ id: entry.id, title: entry.title, status: "failed", reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}

// ---------- Codex (app-server JSON-RPC over stdio) ----------

interface RpcPending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

class AppServer {
  private proc: ReturnType<typeof Bun.spawn>;
  private pending = new Map<number, RpcPending>();
  private nextId = 1;
  private buf = "";
  private closed = false;

  private constructor(proc: ReturnType<typeof Bun.spawn>) {
    this.proc = proc;
  }

  static async connect(): Promise<AppServer> {
    if (!Bun.which("codex")) throw new Error("codex CLI not found in PATH");
    const proc = Bun.spawn(["codex", "app-server"], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    const srv = new AppServer(proc);
    void srv.readLoop();
    await srv.request("initialize", {
      clientInfo: { name: "rename_sessions", title: "rename-sessions", version: "0.1.0" },
    });
    srv.notify("initialized");
    return srv;
  }

  private async readLoop(): Promise<void> {
    const reader = (this.proc.stdout as ReadableStream<Uint8Array>).getReader();
    const dec = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        this.buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = this.buf.indexOf("\n")) >= 0) {
          const line = this.buf.slice(0, i);
          this.buf = this.buf.slice(i + 1);
          this.handle(line);
        }
      }
    } finally {
      this.closed = true;
      for (const [, p] of this.pending) p.reject(new Error("app-server closed"));
      this.pending.clear();
    }
  }

  private handle(line: string): void {
    let m: { id?: unknown; result?: unknown; error?: { message?: string } };
    try {
      m = JSON.parse(line) as typeof m;
    } catch {
      return;
    }
    if (typeof m.id !== "number") return; // notification
    const p = this.pending.get(m.id);
    if (!p) return;
    this.pending.delete(m.id);
    if (m.error) p.reject(new Error(m.error.message ?? JSON.stringify(m.error)));
    else p.resolve(m.result);
  }

  private send(obj: unknown): void {
    const sink = this.proc.stdin as { write: (s: string) => void; flush: () => void };
    sink.write(`${JSON.stringify(obj)}\n`);
    sink.flush();
  }

  request(method: string, params: unknown, timeoutMs = 30_000): Promise<unknown> {
    if (this.closed) return Promise.reject(new Error("app-server closed"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`timeout waiting for ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(t);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(t);
          reject(e);
        },
      });
      this.send({ method, id, params });
    });
  }

  notify(method: string, params?: unknown): void {
    this.send(params === undefined ? { method } : { method, params });
  }

  close(): void {
    try {
      (this.proc.stdin as { end: () => void }).end();
    } catch {
      /* ignore */
    }
    this.proc.kill();
  }
}

interface CodexThread {
  id: string;
  name: string | null;
  preview: string;
  createdAt: number;
  updatedAt: number;
  path?: string;
  cwd?: string;
  status?: { type?: string };
}

interface RolloutScan {
  userMessages: number;
  userPrompts: string[];
  lastAssistant: string | null;
}

async function scanRollout(file: string): Promise<RolloutScan> {
  const r: RolloutScan = { userMessages: 0, userPrompts: [], lastAssistant: null };
  if (!existsSync(file)) return r;
  for await (const line of lines(file)) {
    if (!line.includes('"response_item"')) continue;
    let d: { type?: string; payload?: { type?: string; role?: string; content?: unknown } };
    try {
      d = JSON.parse(line) as typeof d;
    } catch {
      continue;
    }
    if (d.type !== "response_item" || d.payload?.type !== "message") continue;
    const text = blockText(d.payload.content, ["input_text", "output_text"]).trim();
    if (!text) continue;
    if (d.payload.role === "user") {
      if (text.startsWith("<")) continue; // environment_context, user_instructions, plugin lists
      r.userMessages++;
      if (r.userPrompts.length < 3) r.userPrompts.push(clip(text, 200));
    } else if (d.payload.role === "assistant") {
      r.lastAssistant = clip(text, 300);
    }
  }
  return r;
}

async function listCodex(opts: ListOptions): Promise<ListResult> {
  const skipped = { live: 0, small: 0, formatted: 0 };
  let srv: AppServer;
  try {
    srv = await AppServer.connect();
  } catch (err) {
    return { tool: "codex", cwd: opts.cwd, store: null, note: err instanceof Error ? err.message : String(err), skipped, sessions: [] };
  }
  try {
    const threads: CodexThread[] = [];
    let cursor: string | null = null;
    do {
      const params: Record<string, unknown> = { cwd: opts.cwd, limit: 100, sortKey: "updated_at", sortDirection: "desc" };
      if (cursor) params.cursor = cursor;
      const res = (await srv.request("thread/list", params)) as { data: CodexThread[]; nextCursor?: string | null };
      threads.push(...res.data);
      cursor = res.nextCursor ?? null;
    } while (cursor && (opts.limit === 0 || threads.length < opts.limit * 3));

    const current = currentSessionId("codex");
    const sessions: SessionInfo[] = [];
    for (const t of threads) {
      if (opts.limit > 0 && sessions.length >= opts.limit) break;
      if (t.id === current) {
        skipped.live++;
        continue;
      }
      const scan = t.path ? await scanRollout(t.path) : { userMessages: t.preview ? 1 : 0, userPrompts: t.preview ? [clip(t.preview, 200)] : [], lastAssistant: null };
      if (scan.userMessages < opts.minUser) {
        skipped.small++;
        continue;
      }
      const title = t.name ?? (t.preview || null);
      const titleSource = t.name ? "name" : t.preview ? "preview" : "none";
      if (title && TITLE_RE.test(title) && !opts.includeFormatted) {
        skipped.formatted++;
        continue;
      }
      const created = new Date(t.createdAt * 1000).toISOString();
      const { date, mmdd } = localDate(created, opts.tz);
      sessions.push({
        tool: "codex",
        id: t.id,
        created,
        date,
        mmdd,
        title,
        titleSource,
        userMessages: scan.userMessages,
        excerpt: { userPrompts: scan.userPrompts, lastAssistant: scan.lastAssistant },
      });
    }
    return { tool: "codex", cwd: opts.cwd, store: "codex app-server", skipped, sessions };
  } finally {
    srv.close();
  }
}

async function applyCodex(plan: PlanEntry[]): Promise<ApplyResult> {
  const result: ApplyResult = { tool: "codex", store: "codex app-server", written: 0, skipped: 0, failed: 0, details: [] };
  let srv: AppServer;
  try {
    srv = await AppServer.connect();
  } catch (err) {
    result.note = err instanceof Error ? err.message : String(err);
    result.failed = plan.length;
    result.details = plan.map((p) => ({ id: p.id, title: p.title, status: "failed", reason: "no app-server" }));
    return result;
  }
  try {
    for (const entry of plan) {
      try {
        await srv.request("thread/name/set", { threadId: entry.id, name: entry.title });
        result.written++;
        result.details.push({ id: entry.id, title: entry.title, status: "written" });
      } catch (err) {
        result.failed++;
        result.details.push({ id: entry.id, title: entry.title, status: "failed", reason: err instanceof Error ? err.message : String(err) });
      }
    }
  } finally {
    srv.close();
  }
  return result;
}

// ---------- CLI ----------

const HELP = `rename-sessions script

Usage:
  bun main.ts list  --tool <claude|qoder|codex|all> [--cwd <path>] [--limit 30] [--min-user 2] [--include-formatted] [--tz Asia/Shanghai]
  bun main.ts apply --tool <claude|qoder|codex|all> --plan <plan.json> [--cwd <path>]

--tool defaults to the host this runs in (CLAUDE_CODE_SESSION_ID, QODER_SESSION_ID, CODEX_THREAD_ID).
--limit 0 lists every qualifying session.
plan.json is [{"id": "<session id>", "title": "<new title>"}, ...]; with --tool all, entries may carry "tool".
Output is JSON on stdout.`;

function detectHost(): Tool | null {
  if (process.env.CLAUDE_CODE_SESSION_ID) return "claude";
  if (process.env.QODER_SESSION_ID) return "qoder";
  if (process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID) return "codex";
  return null;
}

function resolveTools(arg: string | undefined): Tool[] {
  if (!arg) {
    const host = detectHost();
    if (!host) throw new Error("cannot detect host; pass --tool claude|qoder|codex|all");
    return [host];
  }
  if (arg === "all") return TOOLS;
  if ((TOOLS as string[]).includes(arg)) return [arg as Tool];
  throw new Error(`unknown tool "${arg}"; expected claude|qoder|codex|all`);
}

function toInt(v: string | undefined, dflt: number): number {
  if (v === undefined) return dflt;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n) || n < 0) throw new Error(`invalid number "${v}"`);
  return n;
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      tool: { type: "string" },
      cwd: { type: "string" },
      limit: { type: "string" },
      "min-user": { type: "string" },
      "include-formatted": { type: "boolean", default: false },
      plan: { type: "string" },
      tz: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const cmd = positionals[0];
  if (values.help || !cmd) {
    console.log(HELP);
    return values.help ? 0 : 1;
  }
  const tools = resolveTools(values.tool);
  const cwd = path.resolve(expandHome(values.cwd ?? process.cwd()));

  if (cmd === "list") {
    const opts: ListOptions = {
      cwd,
      limit: toInt(values.limit, 30),
      minUser: toInt(values["min-user"], 2),
      includeFormatted: values["include-formatted"] ?? false,
      tz: values.tz ?? DEFAULT_TZ,
    };
    const results: ListResult[] = [];
    for (const tool of tools) results.push(tool === "codex" ? await listCodex(opts) : await listTranscriptStore(tool, opts));
    console.log(JSON.stringify(tools.length === 1 ? results[0] : results, null, 2));
    return 0;
  }

  if (cmd === "apply") {
    if (!values.plan) throw new Error("--plan <file> is required");
    const raw = JSON.parse(await readFile(expandHome(values.plan), "utf8")) as unknown;
    if (!Array.isArray(raw)) throw new Error("plan must be a JSON array");
    const plan = raw as Array<PlanEntry & { tool?: string }>;
    for (const p of plan) {
      if (typeof p.id !== "string" || typeof p.title !== "string" || !p.title.trim()) throw new Error(`bad plan entry: ${JSON.stringify(p)}`);
    }
    const results: ApplyResult[] = [];
    for (const tool of tools) {
      const mine = plan.filter((p) => !p.tool || p.tool === tool).map(({ id, title }) => ({ id, title: title.trim() }));
      if (mine.length === 0) continue;
      results.push(tool === "codex" ? await applyCodex(mine) : await applyTranscriptStore(tool, mine, cwd));
    }
    console.log(JSON.stringify(tools.length === 1 ? results[0] : results, null, 2));
    return results.some((r) => r.failed > 0) ? 2 : 0;
  }

  throw new Error(`unknown command "${cmd}"; expected list or apply`);
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
