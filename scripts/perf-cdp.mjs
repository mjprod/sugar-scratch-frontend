/**
 * Shared plumbing for the perf scripts: headless Chrome driven over raw
 * DevTools protocol (Node's global WebSocket, no deps), phone emulation,
 * touch input and heap sampling.
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const PHONE_VIEW = { width: 390, height: 844 };
export const DEFAULT_CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PHONE_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const LAUNCH_POLLS = 50;
const LAUNCH_POLL_MS = 200;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message}`));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const cb of this.listeners.get(msg.method) ?? []) cb(msg.params);
      }
    };
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(method, cb) {
    this.listeners.set(method, [...(this.listeners.get(method) ?? []), cb]);
  }
  once(method, timeoutMs) {
    return new Promise((resolve) => {
      const list = this.listeners.get(method) ?? [];
      const timer = setTimeout(() => done(null), timeoutMs);
      const done = (p) => {
        clearTimeout(timer);
        this.listeners.set(method, (this.listeners.get(method) ?? []).filter((f) => f !== done));
        resolve(p);
      };
      list.push(done);
      this.listeners.set(method, list);
    });
  }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
    return r.result.value;
  }
}

export async function launchChrome({ chrome = DEFAULT_CHROME, port, view = PHONE_VIEW }) {
  const profile = mkdtempSync(path.join(os.tmpdir(), "sugar-perf-"));
  const proc = spawn(
    chrome,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--ignore-certificate-errors",
      "--autoplay-policy=no-user-gesture-required",
      "--mute-audio",
      "--enable-precise-memory-info",
      `--window-size=${view.width},${view.height}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  for (let i = 0; i < LAUNCH_POLLS; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return { proc, wsUrl: page.webSocketDebuggerUrl };
    } catch {
      /* not up yet */
    }
    await sleep(LAUNCH_POLL_MS);
  }
  proc.kill();
  throw new Error("Chrome did not start");
}

export async function emulatePhone(cdp, { view = PHONE_VIEW, cpu }) {
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    ...view,
    deviceScaleFactor: 3,
    mobile: true,
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await cdp.send("Emulation.setUserAgentOverride", { userAgent: PHONE_USER_AGENT });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
}

export async function heapMb(cdp) {
  await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
  const { usedSize } = await cdp.send("Runtime.getHeapUsage");
  return Math.round(usedSize / 1048576);
}

export async function touchDrag(cdp, points, stepMs = 16) {
  const [first, ...rest] = points;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first] });
  for (const p of rest) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [p] });
    await sleep(stepMs);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

export function line(x0, y0, x1, y1, steps) {
  return Array.from({ length: steps + 1 }, (_, i) => ({
    x: x0 + ((x1 - x0) * i) / steps,
    y: y0 + ((y1 - y0) * i) / steps,
  }));
}

export async function spaNav(cdp, route) {
  await cdp.eval(
    `history.pushState({}, "", ${JSON.stringify(route)}); dispatchEvent(new PopStateEvent("popstate")); true`,
  );
}
