#!/usr/bin/env node
/**
 * Computed-style diff between two builds, for CSS moves that must not change rendering.
 * Loads every route in headless Chrome against both servers, freezes animations and
 * compares getComputedStyle for every element (plus ::before/::after).
 *
 *   # build A (baseline) served on :4175, build B (candidate) on :4174
 *   STYLE_A=https://localhost:4175 STYLE_B=https://localhost:4174 node scripts/style-diff.mjs
 *
 * Env: STYLE_ROUTES=/,/store (default below), STYLE_WIDTHS=390,1280,
 *      STYLE_COOKIE="name=value" (signed-in pass), STYLE_SETTLE_MS=4000,
 *      STYLE_OUT=.perf/style-diff.json. Exits 1 when any route differs.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const A = (process.env.STYLE_A || "https://localhost:4175").replace(/\/+$/, "");
const B = (process.env.STYLE_B || "https://localhost:4174").replace(/\/+$/, "");
const ROUTES = (process.env.STYLE_ROUTES || "/,/discover,/store,/rank,/creator/julianaval")
  .split(",").map((s) => s.trim()).filter(Boolean);
const WIDTHS = (process.env.STYLE_WIDTHS || "390,1280").split(",").map(Number);
const COOKIE = process.env.STYLE_COOKIE || "";
const SETTLE_MS = Number(process.env.STYLE_SETTLE_MS || 4000);
const OUT = process.env.STYLE_OUT || ".perf/style-diff.json";
const CHROME = process.env.CHROME_PATH
  || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const MAX_REPORTED = 40;

const FREEZE_CSS = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

/** Runs in the page: path → { prop: value } for every element and generated pseudo. */
function snapshotInPage() {
  const props = Array.from(getComputedStyle(document.documentElement));
  const out = {};
  const pathOf = (el) => {
    const parts = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const parent = n.parentElement;
      const idx = parent ? Array.prototype.indexOf.call(parent.children, n) : 0;
      parts.push(`${n.tagName.toLowerCase()}:${idx}`);
    }
    return parts.reverse().join(">");
  };
  const read = (cs) => {
    const row = {};
    for (const p of props) row[p] = cs.getPropertyValue(p);
    return row;
  };
  for (const el of document.querySelectorAll("*")) {
    if (el.closest("head")) continue;
    const key = pathOf(el);
    const row = read(getComputedStyle(el));
    row["@animation-name"] = el.dataset.styleDiffAnim ?? "";
    row["@class"] = typeof el.className === "string" ? el.className : "";
    out[key] = row;
    for (const pseudo of ["::before", "::after"]) {
      const cs = getComputedStyle(el, pseudo);
      if (cs.content && cs.content !== "none" && cs.content !== "normal") {
        out[key + pseudo] = read(cs);
      }
    }
  }
  return out;
}

function markAnimationsInPage() {
  for (const el of document.querySelectorAll("*")) {
    const name = getComputedStyle(el).animationName;
    if (name && name !== "none") el.dataset.styleDiffAnim = name;
  }
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.waiters = [];
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message}`));
        else resolve(msg.result);
      } else if (msg.method) {
        this.waiters = this.waiters.filter((w) => !(w.method === msg.method && (w.resolve(msg.params), true)));
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  once(method, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), timeoutMs);
      this.waiters.push({ method, resolve: (p) => { clearTimeout(timer); resolve(p); } });
    });
  }
  async evaluate(fn) {
    const { result, exceptionDetails } = await this.send("Runtime.evaluate", {
      expression: `(${fn.toString()})()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.text);
    return result.value;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const userDir = mkdtempSync(path.join(tmpdir(), "style-diff-"));
  const proc = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDir}`,
    "--ignore-certificate-errors",
    "--no-first-run",
    "--mute-audio",
    "--hide-scrollbars",
    "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          ws.addEventListener("open", resolve, { once: true });
          ws.addEventListener("error", reject, { once: true });
        });
        const close = async () => {
          const exited = new Promise((r) => proc.once("exit", r));
          proc.kill();
          await exited;
          rmSync(userDir, { recursive: true, force: true, maxRetries: 5 });
        };
        return { cdp: new Cdp(ws), close };
      }
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  proc.kill();
  throw new Error("Chrome did not start");
}

async function snapshot(cdp, base, route, width) {
  await cdp.send("Network.clearBrowserCookies");
  if (COOKIE) {
    const [name, ...rest] = COOKIE.split("=");
    await cdp.send("Network.setCookie", { name, value: rest.join("="), url: base });
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width, height: width < 768 ? 844 : 900, deviceScaleFactor: 1, mobile: width < 768,
  });
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  const loaded = cdp.once("Page.loadEventFired", 60000);
  await cdp.send("Page.navigate", { url: base + route });
  await loaded;
  await sleep(SETTLE_MS);
  await cdp.evaluate(markAnimationsInPage);
  await cdp.evaluate(new Function(`return () => {
    const s = document.createElement("style");
    s.textContent = ${JSON.stringify(FREEZE_CSS)};
    document.head.appendChild(s);
  }`)());
  await sleep(150);
  return cdp.evaluate(snapshotInPage);
}

/**
 * Drop the server origin from url()s, React useId suffixes, and spellings that
 * differ only because Tailwind's Lightning CSS pass rewrote the entry CSS but
 * not lazy CSS: oklch(24.9% …) vs oklch(.249 …), oklch black/white vs rgba,
 * explicit 0%/100% gradient stops, 0% 0% vs 0px 0px. Plus sub-pixel noise.
 */
function normalize(value, origin) {
  return value
    .split(origin).join("")
    .replace(/_r_[a-z0-9]+_/g, "_r_")
    .replace(/oklch\(\s*([\d.]+)(%?)/g, (_, l, pct) =>
      `oklch(${Number((pct ? Number(l) / 100 : Number(l)).toFixed(4))}`)
    .replace(/\s*\/\s*/g, "/")
    .replace(/-?\d*\.\d+/g, (n) => Number(n).toFixed(2))
    .replace(/oklch\(0 0 0\/([\d.]+)\)/g, "rgba(0, 0, 0, $1)")
    .replace(/oklch\(1 0 0\/([\d.]+)\)/g, "rgba(255, 255, 255, $1)")
    .replace(/\) 0%(?=,)/g, ")")
    .replace(/\) 100%\)/g, "))")
    .replace(/(^|[\s,])0% 0%(?=$|[\s,])/g, "$10px 0px");
}

function diff(a, b) {
  const onlyA = Object.keys(a).filter((k) => !(k in b));
  const onlyB = Object.keys(b).filter((k) => !(k in a));
  const changed = [];
  for (const key of Object.keys(a)) {
    if (!(key in b)) continue;
    const props = [];
    for (const [p, v] of Object.entries(a[key])) {
      if (p === "@class") continue;
      const bv = b[key][p] ?? "";
      if (normalize(v, A) !== normalize(bv, B)) props.push({ prop: p, a: v, b: bv });
    }
    if (props.length) changed.push({ key, class: a[key]["@class"], props });
  }
  return { elements: Object.keys(a).length, onlyA: onlyA.length, onlyB: onlyB.length, changed };
}

const { cdp, close } = await launch();
const report = [];
let failed = false;
try {
  await cdp.send("Page.enable");
  await cdp.send("Network.enable");
  for (const route of ROUTES) {
    for (const width of WIDTHS) {
      const a = await snapshot(cdp, A, route, width);
      const b = await snapshot(cdp, B, route, width);
      const d = diff(a, b);
      const ok = d.changed.length === 0 && d.onlyA === 0 && d.onlyB === 0;
      if (!ok) failed = true;
      console.log(
        `${ok ? "same" : "DIFF"}  ${route} @${width}  elements ${d.elements}` +
          (ok ? "" : `  changed ${d.changed.length}  onlyA ${d.onlyA}  onlyB ${d.onlyB}`),
      );
      for (const c of d.changed.slice(0, 5)) {
        const sample = c.props.slice(0, 4).map((p) => `${p.prop}: ${p.a} → ${p.b}`).join("; ");
        console.log(`      ${c.class || c.key.split(">").pop()}  ${sample}`);
      }
      report.push({ route, width, ...d, changed: d.changed.slice(0, MAX_REPORTED) });
    }
  }
} finally {
  await close();
}
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(`\nWrote ${OUT}`);
process.exit(failed ? 1 : 0);
