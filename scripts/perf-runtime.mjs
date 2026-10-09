#!/usr/bin/env node
/**
 * Runtime perf pass: headless Chrome, phone viewport + touch, CPU throttling,
 * driven over raw DevTools protocol (Node's global WebSocket, no deps).
 * Uses the `?perf=1` HUD (`window.__sugarPerf`) for frame stats.
 *
 *   VITE_ENABLE_LABS=1 npm run build && npx vite preview --port 4174 --strictPort
 *   node scripts/perf-runtime.mjs
 *   PERF_COOKIE="sugar_session=…" node scripts/perf-runtime.mjs   # adds signed-in routes
 *
 * Env: PERF_BASE, PERF_CPU (default 4), PERF_OUT (default .perf), CHROME_PATH,
 *      PERF_ONLY=idle,scroll,swipe,scratch,leak (scenario kinds).
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = (process.env.PERF_BASE || "https://localhost:4174").replace(/\/+$/, "");
const CPU = Number(process.env.PERF_CPU || 4);
const OUT = process.env.PERF_OUT || ".perf";
const COOKIE = process.env.PERF_COOKIE || "";
const ONLY = (process.env.PERF_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
const CHROME =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const VIEW = { width: 390, height: 844 };

const GAME = "/game?model=julianaval&card=julianaval_cop";

const GUEST_IDLE = [
  "/",
  "/discover",
  "/store",
  "/creator/julianaval",
  "/creator/julianaval/motion/julianaval_cop",
  "/coverflow-v2",
  "/mobile-carousel",
  GAME,
  "/game-ui",
  "/photo-scratch",
  "/pre-loader",
];
const AUTH_IDLE = [
  "/collection",
  "/rewards",
  "/profile",
  "/profile/transactions",
  "/profile/game-history",
  "/settings",
  "/inbox",
  "/pack-pocket",
];
const SCROLL = ["/", "/discover", "/store", "/creator/julianaval"];
const AUTH_SCROLL = ["/collection", "/profile"];
const SWIPE = ["/coverflow-v2", "/mobile-carousel", "/discover"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (kind) => !ONLY.length || ONLY.includes(kind);

class Cdp {
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

async function launch() {
  const profile = mkdtempSync(path.join(os.tmpdir(), "sugar-perf-"));
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--ignore-certificate-errors",
      "--autoplay-policy=no-user-gesture-required",
      "--mute-audio",
      "--enable-precise-memory-info",
      `--window-size=${VIEW.width},${VIEW.height}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  for (let i = 0; i < 50; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return { proc, wsUrl: page.webSocketDebuggerUrl };
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  proc.kill();
  throw new Error("Chrome did not start");
}

async function setup(cdp) {
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    ...VIEW,
    deviceScaleFactor: 3,
    mobile: true,
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await cdp.send("Emulation.setUserAgentOverride", {
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
}

async function goto(cdp, route, settleMs = 5000) {
  const loaded = cdp.once("Page.loadEventFired", 45000);
  const sep = route.includes("?") ? "&" : "?";
  await cdp.send("Page.navigate", { url: `${BASE}${route}${sep}perf=1` });
  await loaded;
  for (let i = 0; i < 40; i += 1) {
    if (await cdp.eval("!!window.__sugarPerf")) break;
    await sleep(250);
  }
  await sleep(settleMs);
}

async function heap(cdp) {
  await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
  const { usedSize } = await cdp.send("Runtime.getHeapUsage");
  return Math.round(usedSize / 1048576);
}

async function measure(cdp, fn, windowMs) {
  await cdp.eval("__sugarPerf.reset()");
  const started = Date.now();
  if (fn) await fn();
  const left = windowMs - (Date.now() - started);
  if (left > 0) await sleep(left);
  const s = await cdp.eval(
    "(() => { const s = __sugarPerf.snapshot(); return { route: location.pathname + location.search, fps: s.fps, p50: s.p50Ms, p95: s.p95Ms, p99: s.p99Ms, worst: s.worstMs, slow: s.slowFrames, long: s.longFrames, frames: s.totalFrames, longTasks: s.longTasks, blockingMs: s.blockingMs, dom: s.domNodes, canvases: s.canvases, videos: s.videos }; })()",
  );
  return { ...s, heapMb: await heap(cdp) };
}

async function touchDrag(cdp, points, stepMs = 16) {
  const [first, ...rest] = points;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first] });
  for (const p of rest) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [p] });
    await sleep(stepMs);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

function line(x0, y0, x1, y1, steps) {
  return Array.from({ length: steps + 1 }, (_, i) => ({
    x: x0 + ((x1 - x0) * i) / steps,
    y: y0 + ((y1 - y0) * i) / steps,
  }));
}

async function scrollPage(cdp) {
  const cx = VIEW.width / 2;
  for (let i = 0; i < 3; i += 1) {
    await cdp.send("Input.synthesizeScrollGesture", {
      x: cx,
      y: VIEW.height * 0.7,
      yDistance: -1400,
      speed: 1400,
      gestureSourceType: "touch",
    });
    await sleep(300);
  }
  await cdp.send("Input.synthesizeScrollGesture", {
    x: cx,
    y: VIEW.height * 0.3,
    yDistance: 3000,
    speed: 2400,
    gestureSourceType: "touch",
  });
}

async function swipeCarousel(cdp) {
  const y = VIEW.height * 0.5;
  for (let i = 0; i < 4; i += 1) {
    await touchDrag(cdp, line(VIEW.width * 0.85, y, VIEW.width * 0.15, y, 18));
    await sleep(700);
  }
  for (let i = 0; i < 2; i += 1) {
    await touchDrag(cdp, line(VIEW.width * 0.15, y, VIEW.width * 0.85, y, 18));
    await sleep(700);
  }
}

async function scratch(cdp, durationMs) {
  const cx = VIEW.width / 2;
  const cy = VIEW.height * 0.5;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(2500);
  const end = Date.now() + durationMs;
  let row = 0;
  while (Date.now() < end) {
    const y = VIEW.height * (0.3 + ((row % 8) * 0.05));
    const [x0, x1] = row % 2 ? [VIEW.width * 0.85, VIEW.width * 0.15] : [VIEW.width * 0.15, VIEW.width * 0.85];
    await touchDrag(cdp, line(x0, y, x1, y + 20, 24), 12);
    row += 1;
  }
}

async function spaNav(cdp, route) {
  await cdp.eval(
    `history.pushState({}, "", ${JSON.stringify(route)}); dispatchEvent(new PopStateEvent("popstate")); true`,
  );
}

async function leakCycle(cdp, cycles) {
  await goto(cdp, "/", 4000);
  const samples = [];
  const sampleNow = async (label) => {
    const counts = await cdp.eval(
      "({ dom: document.getElementsByTagName('*').length, canvases: document.querySelectorAll('canvas:not([data-perf-hud])').length, videos: document.getElementsByTagName('video').length })",
    );
    samples.push({ label, heapMb: await heap(cdp), ...counts });
  };
  await sampleNow("start");
  for (let i = 1; i <= cycles; i += 1) {
    await spaNav(cdp, GAME);
    await sleep(7000);
    await spaNav(cdp, "/");
    await sleep(3000);
    await sampleNow(`after cycle ${i}`);
  }
  return samples;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { proc, wsUrl } = await launch();
  const cdp = new Cdp(wsUrl);
  await cdp.open();
  await setup(cdp);
  const results = { cpuThrottle: CPU, viewport: VIEW, idle: [], scroll: [], swipe: [], scratch: [], leak: {} };
  const save = () => writeFileSync(path.join(OUT, "runtime.json"), JSON.stringify(results, null, 2));
  const log = (kind, pass, r) =>
    console.log(
      `${kind.padEnd(7)} ${pass.padEnd(5)} ${r.route.slice(0, 44).padEnd(44)} fps ${r.fps.toFixed(0).padStart(3)}  p99 ${r.p99.toFixed(0).padStart(3)}ms  >50ms ${String(r.long).padStart(3)}  lt ${r.longTasks}/${Math.round(r.blockingMs)}ms  heap ${r.heapMb}MB  dom ${r.dom}`,
    );

  const passes = [["guest", null]];
  if (COOKIE) passes.push(["auth", COOKIE]);

  try {
    for (const [pass, cookie] of passes) {
      if (cookie) {
        const [name, ...rest] = cookie.split("=");
        await cdp.send("Network.setCookie", { name, value: rest.join("="), domain: "localhost", path: "/", secure: true, httpOnly: true });
      }
      const idle = pass === "guest" ? GUEST_IDLE : AUTH_IDLE;
      const scroll = pass === "guest" ? SCROLL : AUTH_SCROLL;

      if (want("idle")) {
        for (const route of idle) {
          try {
            await goto(cdp, route);
            const r = { pass, ...(await measure(cdp, null, 6000)) };
            results.idle.push(r);
            log("idle", pass, r);
          } catch (err) {
            results.idle.push({ pass, route, error: String(err.message) });
            console.log(`idle    ${pass} ${route} ERROR ${err.message}`);
          }
          save();
        }
      }
      if (want("scroll")) {
        for (const route of scroll) {
          await goto(cdp, route);
          const r = { pass, ...(await measure(cdp, () => scrollPage(cdp), 8000)) };
          results.scroll.push(r);
          log("scroll", pass, r);
          save();
        }
      }
      if (pass === "guest" && want("swipe")) {
        for (const route of SWIPE) {
          await goto(cdp, route);
          const r = { pass, ...(await measure(cdp, () => swipeCarousel(cdp), 9000)) };
          results.swipe.push(r);
          log("swipe", pass, r);
          save();
        }
      }
      if (want("scratch") && (pass === "auth" || !COOKIE)) {
        for (const route of [GAME, "/game-ui"]) {
          await goto(cdp, route, 6000);
          const r = { pass, ...(await measure(cdp, () => scratch(cdp, 12000), 14000)) };
          results.scratch.push(r);
          log("scratch", pass, r);
          save();
        }
      }
      if (want("leak") && pass === "guest") {
        results.leak.homeGame = await leakCycle(cdp, 5);
        for (const s of results.leak.homeGame) {
          console.log(`leak    ${s.label.padEnd(14)} heap ${s.heapMb}MB  dom ${s.dom}  canvas ${s.canvases}  video ${s.videos}`);
        }
        save();
      }
    }
  } finally {
    save();
    cdp.ws.close();
    proc.kill();
  }
  console.log(`\nWrote ${path.join(OUT, "runtime.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
