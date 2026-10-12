#!/usr/bin/env node
/**
 * Signed-in end-to-end player flow against the local stack: headless phone
 * Chrome with CPU throttling, the `?perf=1` HUD for frame stats and CDP
 * Network for every request each screen makes.
 *
 *   npm run dev:all                                      # repo root: API :8090 + media :5080
 *   npm run build
 *   VITE_API_PROXY=http://127.0.0.1:8090 VITE_MEDIA_PROXY=https://localhost:5080 \
 *     npx vite preview --port 4174 --strictPort
 *   npm run perf:flow
 *
 * A fresh player is registered directly on PERF_API and its session cookie is
 * handed to the browser; the run aborts if the app's /api proxy reaches a
 * different backend. Flow: home → store (buy diamonds) → creator (buy pack) →
 * pack pocket (open + reveal) → collection → scratch game → collection →
 * transactions → home. Purchases go through the app's own /api proxy as
 * in-page fetches (tear-open needs router state, so it is not UI-driven).
 *
 * Env: PERF_BASE (default https://localhost:4174), PERF_API (default
 *      http://127.0.0.1:8090), PERF_CPU (default 4), PERF_OUT (default .perf),
 *      PERF_CREATOR / PERF_CARD (default: first creator / its first free meshed
 *      card), CHROME_PATH, DASHBOARD_TOKEN (deletes the perf player afterwards),
 *      PERF_KEEP_USER=1.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  Cdp,
  DEFAULT_CHROME,
  PHONE_VIEW,
  emulatePhone,
  heapMb,
  launchChrome,
  sleep,
  spaNav,
  touchDrag,
  line,
} from "./perf-cdp.mjs";

const BASE = (process.env.PERF_BASE || "https://localhost:4174").replace(/\/+$/, "");
const API = (process.env.PERF_API || "http://127.0.0.1:8090").replace(/\/+$/, "");
const CPU = Number(process.env.PERF_CPU || 4);
const OUT = process.env.PERF_OUT || ".perf";
const CHROME = process.env.CHROME_PATH || DEFAULT_CHROME;
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || "";
const KEEP_USER = process.env.PERF_KEEP_USER === "1";
const PORT = 9334;
const VIEW = PHONE_VIEW;

const SESSION_COOKIE = "sugar_session";
const PERF_PASSWORD = "perf-flow-password";
const DIAMOND_PRODUCT_ID = "d2500";
const QUIET_MS = 800;
const READY_TIMEOUT_MS = 20000;
const IDLE_WINDOW_MS = 5000;
const SCROLL_WINDOW_MS = 8000;
const SCRATCH_MS = 12000;
const SCRATCH_WINDOW_MS = 14000;
const SCRATCH_START_DELAY_MS = 2500;
const SLOWEST_API_SHOWN = 10;

async function apiDirect(method, pathname, { body, cookie, headers = {} } = {}) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${API}${pathname} -> ${res.status} ${await res.text()}`);
  return res;
}

async function registerPlayer() {
  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const email = `perf-flow-${tag}@example.com`;
  const res = await apiDirect("POST", "/api/auth/register", {
    body: { email, password: PERF_PASSWORD, username: `perfflow${tag}` },
  });
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) throw new Error(`register did not set ${SESSION_COOKIE}`);
  const { user } = await res.json();
  return { email, userId: user.id, token: cookie.slice(SESSION_COOKIE.length + 1) };
}

async function pickContent(token) {
  const models = (await (await apiDirect("GET", "/api/models")).json()).models ?? [];
  const creator = process.env.PERF_CREATOR || models[0]?.id;
  if (!creator) throw new Error("No creators in /api/models; set PERF_CREATOR.");
  const board = await (await apiDirect("GET", `/api/me/creators/${creator}/board`, { cookie: token })).json();
  const cards = (await (await apiDirect("GET", "/api/cards")).json()).cards ?? [];
  const card =
    process.env.PERF_CARD ||
    cards.find((c) => c.model_id === creator && c.has_mesh && !c.price)?.id ||
    cards.find((c) => c.has_mesh)?.id;
  if (!card) throw new Error("No meshed card in /api/cards; set PERF_CARD.");
  const packs = (await (await apiDirect("GET", "/api/packs")).json()).packs ?? [];
  const pack =
    board.pack?.id ||
    packs.filter((p) => p.available).sort((a, b) => a.diamondCost - b.diamondCost)[0]?.id;
  if (!pack) throw new Error("No available pack in /api/packs.");
  return { creator, card, pack };
}

/** Tags every request with the step that issued it; /api calls keep timing detail. */
class NetworkLog {
  constructor(cdp) {
    this.step = "boot";
    this.inflight = new Map();
    this.done = [];
    this.lastApiActivity = 0;
    cdp.on("Network.requestWillBeSent", (p) => {
      const url = new URL(p.request.url);
      const isApi = url.origin === new URL(BASE).origin && url.pathname.startsWith("/api/");
      this.inflight.set(p.requestId, {
        step: this.step,
        isApi,
        method: p.request.method,
        path: url.pathname,
        search: url.search,
        start: p.timestamp,
        startedAt: Date.now(),
      });
      if (isApi) this.lastApiActivity = Date.now();
    });
    cdp.on("Network.responseReceived", (p) => {
      const r = this.inflight.get(p.requestId);
      if (!r) return;
      r.status = p.response.status;
      const headers = Object.fromEntries(
        Object.entries(p.response.headers).map(([k, v]) => [k.toLowerCase(), v]),
      );
      const server = Number(headers["x-response-time-ms"]);
      r.serverMs = Number.isFinite(server) ? server : null;
    });
    cdp.on("Network.loadingFinished", (p) => this.finish(p.requestId, p.timestamp, p.encodedDataLength, null));
    cdp.on("Network.loadingFailed", (p) =>
      this.finish(p.requestId, p.timestamp, 0, p.canceled ? null : p.errorText),
    );
  }

  finish(id, timestamp, bytes, error) {
    const r = this.inflight.get(id);
    if (!r) return;
    this.inflight.delete(id);
    this.done.push({ ...r, ms: Math.round((timestamp - r.start) * 1000), bytes, error });
    if (r.isApi) this.lastApiActivity = Date.now();
  }

  // Requests orphaned by a full navigation never get loadingFinished/Failed,
  // so only calls issued since the step began can hold it open.
  apiInflightSince(since) {
    return [...this.inflight.values()].filter((r) => r.isApi && r.startedAt >= since);
  }

  /** Waits for /api to go quiet; returns ms from `since` to the last /api activity. */
  async settle(since) {
    const deadline = since + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const lastActivity = Math.max(this.lastApiActivity, since);
      if (this.apiInflightSince(since).length === 0 && Date.now() - lastActivity >= QUIET_MS) {
        return { readyMs: lastActivity - since, timedOut: false };
      }
      await sleep(100);
    }
    const pending = this.apiInflightSince(since).map((r) => `${r.method} ${r.path}`);
    return { readyMs: READY_TIMEOUT_MS, timedOut: true, pending };
  }

  forStep(step) {
    const all = this.done.filter((r) => r.step === step);
    const api = all.filter((r) => r.isApi);
    return {
      requests: all.length,
      kb: Math.round(all.reduce((sum, r) => sum + (r.bytes || 0), 0) / 1024),
      api: api.map(({ method, path: p, search, status, ms, serverMs, error }) => ({
        method,
        path: p,
        search,
        status,
        ms,
        serverMs,
        error,
      })),
    };
  }
}

async function pageApi(cdp, method, pathname, body, headers = {}) {
  const init = {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
  const res = await cdp.eval(
    `fetch(${JSON.stringify(pathname)}, ${JSON.stringify(init)}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))`,
  );
  if (res.status >= 400) throw new Error(`${method} ${pathname} -> ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

async function buyDiamonds(cdp) {
  const { session } = await pageApi(cdp, "POST", "/api/store/purchases", { product_id: DIAMOND_PRODUCT_ID });
  await pageApi(cdp, "POST", `/api/store/purchases/${session.id}/verify`, { outcome: "completed" });
}

function buyPack(packId) {
  return async (cdp, state) => {
    const bought = await pageApi(cdp, "POST", `/api/packs/${packId}/purchase`, { quantity: 1 }, {
      "Idempotency-Key": `perf-flow-${Date.now()}`,
    });
    state.instanceId = bought.instances[0].instanceId;
  };
}

async function openPack(cdp, state) {
  const opened = await pageApi(cdp, "POST", `/api/me/packs/${state.instanceId}/open`);
  for (const card of opened.session.cards) {
    await pageApi(cdp, "POST", `/api/me/openings/${opened.openingId}/cards/${card.id}/reveal`);
  }
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

async function scratch(cdp) {
  const cx = VIEW.width / 2;
  const cy = VIEW.height * 0.5;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(SCRATCH_START_DELAY_MS);
  const end = Date.now() + SCRATCH_MS;
  let row = 0;
  while (Date.now() < end) {
    const y = VIEW.height * (0.3 + (row % 8) * 0.05);
    const [x0, x1] = row % 2 ? [VIEW.width * 0.85, VIEW.width * 0.15] : [VIEW.width * 0.15, VIEW.width * 0.85];
    await touchDrag(cdp, line(x0, y, x1, y + 20, 24), 12);
    row += 1;
  }
}

const INTERACTIONS = {
  idle: { run: null, windowMs: IDLE_WINDOW_MS },
  scroll: { run: scrollPage, windowMs: SCROLL_WINDOW_MS },
  scratch: { run: scratch, windowMs: SCRATCH_WINDOW_MS },
};

async function measureFrames(cdp, interaction) {
  const { run, windowMs } = INTERACTIONS[interaction];
  await cdp.eval("window.__sugarPerf?.reset(); true");
  const started = Date.now();
  if (run) await run(cdp);
  const left = windowMs - (Date.now() - started);
  if (left > 0) await sleep(left);
  return cdp.eval(
    "(() => { const s = window.__sugarPerf?.snapshot(); return s ? { fps: s.fps, p95: s.p95Ms, p99: s.p99Ms, worst: s.worstMs, long: s.longFrames, longTasks: s.longTasks, blockingMs: s.blockingMs, dom: s.domNodes, canvases: s.canvases, videos: s.videos } : null; })()",
  );
}

async function loadTimings(cdp) {
  return cdp.eval(`(async () => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paint = Object.fromEntries(performance.getEntriesByType("paint").map((e) => [e.name, e.startTime]));
    const lcp = await new Promise((resolve) => {
      let last = null;
      new PerformanceObserver((list) => { last = list.getEntries().at(-1)?.startTime ?? last; })
        .observe({ type: "largest-contentful-paint", buffered: true });
      setTimeout(() => resolve(last), 200);
    });
    const r = (v) => (v == null ? null : Math.round(v));
    return {
      ttfbMs: r(nav?.responseStart),
      fcpMs: r(paint["first-contentful-paint"]),
      lcpMs: r(lcp),
      domContentLoadedMs: r(nav?.domContentLoadedEventEnd),
      loadMs: r(nav?.loadEventEnd),
    };
  })()`);
}

async function runStep(cdp, net, step, state) {
  net.step = step.name;
  const started = Date.now();
  const result = { step: step.name, route: step.route };
  try {
    if (step.fullLoad) {
      const loaded = cdp.once("Page.loadEventFired", 45000);
      const sep = step.route.includes("?") ? "&" : "?";
      await cdp.send("Page.navigate", { url: `${BASE}${step.route}${sep}perf=1` });
      await loaded;
    } else {
      await spaNav(cdp, step.route);
    }
    Object.assign(result, await net.settle(started));
    if (step.fullLoad) result.load = await loadTimings(cdp);
    if (step.action) {
      const actionStarted = Date.now();
      await step.action(cdp, state);
      result.actionMs = Date.now() - actionStarted;
    }
    result.landed = await cdp.eval("location.pathname + location.search");
    result.frames = await measureFrames(cdp, step.interaction);
    result.heapMb = await heapMb(cdp);
  } catch (err) {
    result.error = String(err.message ?? err);
  }
  return result;
}

/** Same GET (path + query) issued more than once in one step. */
function duplicateGets(api) {
  const counts = new Map();
  for (const r of api) {
    if (r.method !== "GET") continue;
    const key = `${r.path}${r.search ?? ""}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n > 1).map(([key, n]) => `GET ${key} ×${n}`);
}

function summarize(result, net) {
  const traffic = net.forStep(result.step);
  const api = traffic.api;
  const failed = api.filter((r) => r.error || (r.status ?? 0) >= 400);
  return {
    ...result,
    requests: traffic.requests,
    kb: traffic.kb,
    apiCount: api.length,
    apiMaxMs: api.reduce((m, r) => Math.max(m, r.ms), 0),
    apiFailed: failed.map((r) => `${r.method} ${r.path} ${r.status ?? r.error}`),
    apiDuplicates: duplicateGets(api),
    api,
  };
}

function printStep(s) {
  const f = s.frames;
  const frames = f
    ? `fps ${f.fps.toFixed(0).padStart(3)}  p95 ${f.p95.toFixed(0).padStart(3)}  p99 ${f.p99.toFixed(0).padStart(3)}  >50ms ${String(f.long).padStart(3)}`
    : "frames n/a".padEnd(36);
  const ready = `${s.timedOut ? ">" : ""}${s.readyMs ?? "-"}ms`;
  console.log(
    `${s.step.padEnd(17)} ready ${ready.padStart(8)}  api ${String(s.apiCount).padStart(3)} max ${String(s.apiMaxMs).padStart(5)}ms  ` +
      `req ${String(s.requests).padStart(3)} ${String(s.kb).padStart(6)}KB  ${frames}  heap ${s.heapMb ?? "-"}MB` +
      (s.actionMs != null ? `  action ${s.actionMs}ms` : "") +
      (s.landed && s.landed.split("?")[0] !== s.route.split("?")[0] ? `  → ${s.landed}` : "") +
      (s.pending?.length ? `  PENDING ${s.pending.join(", ")}` : "") +
      (s.error ? `  ERROR ${s.error}` : "") +
      (s.apiFailed.length ? `  FAILED ${s.apiFailed.join(", ")}` : "") +
      (s.apiDuplicates.length ? `  DUP ${s.apiDuplicates.join(", ")}` : ""),
  );
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  try {
    await apiDirect("GET", "/api/health/live");
  } catch (err) {
    throw new Error(`API not reachable at ${API} (${err.message}). Start it with \`npm run dev:api\` in the repo root.`);
  }

  const player = await registerPlayer();
  const content = await pickContent(player.token);
  console.log(`Player ${player.email} · creator ${content.creator} · pack ${content.pack} · card ${content.card} · CPU ${CPU}x`);

  const { proc, wsUrl } = await launchChrome({ chrome: CHROME, port: PORT, view: VIEW });
  const cdp = new Cdp(wsUrl);
  await cdp.open();
  await emulatePhone(cdp, { view: VIEW, cpu: CPU });
  const net = new NetworkLog(cdp);
  const results = { base: BASE, api: API, cpuThrottle: CPU, viewport: VIEW, player: player.email, content, steps: [] };
  const save = () => writeFileSync(path.join(OUT, "flow.json"), JSON.stringify(results, null, 2));
  let failed = false;

  try {
    await cdp.send("Network.setCookie", {
      name: SESSION_COOKIE,
      value: player.token,
      url: BASE,
      httpOnly: true,
      sameSite: "Lax",
    });
    const loaded = cdp.once("Page.loadEventFired", 45000);
    await cdp.send("Page.navigate", { url: `${BASE}/?perf=1` });
    await loaded;
    const session = await pageApi(cdp, "GET", "/api/auth/session");
    if (!session?.authenticated || session.user?.id !== player.userId) {
      throw new Error(
        `${BASE} proxies /api to a different backend than ${API}. Start the player app with ` +
          "VITE_API_PROXY=http://127.0.0.1:8090 VITE_MEDIA_PROXY=https://localhost:5080 (see header).",
      );
    }
    await pageApi(cdp, "POST", "/api/me/welcome/claim");

    const state = {};
    const steps = [
      { name: "home", route: "/", fullLoad: true, interaction: "idle" },
      { name: "store", route: "/get-diamonds", action: buyDiamonds, interaction: "idle" },
      { name: "creator", route: `/creator/${content.creator}`, action: buyPack(content.pack), interaction: "scroll" },
      { name: "pack-pocket", route: "/pack-pocket", action: openPack, interaction: "idle" },
      { name: "collection", route: "/collection", interaction: "scroll" },
      { name: "game", route: `/game?model=${content.creator}&card=${content.card}`, interaction: "scratch" },
      { name: "collection-after", route: "/collection", interaction: "idle" },
      { name: "transactions", route: "/profile/transactions", interaction: "idle" },
      { name: "home-return", route: "/", interaction: "idle" },
    ];

    for (const step of steps) {
      const summary = summarize(await runStep(cdp, net, step, state), net);
      results.steps.push(summary);
      printStep(summary);
      if (summary.error || summary.apiFailed.length) failed = true;
      save();
    }

    const first = results.steps.find((s) => s.heapMb != null);
    const last = results.steps.findLast((s) => s.heapMb != null);
    results.heapGrowthMb = first && last ? last.heapMb - first.heapMb : null;
    const home = results.steps[0];
    if (home.load) {
      const l = home.load;
      console.log(
        `\nFirst load: TTFB ${l.ttfbMs}ms · FCP ${l.fcpMs}ms · LCP ${l.lcpMs}ms · DCL ${l.domContentLoadedMs}ms · load ${l.loadMs}ms`,
      );
    }
    console.log(`Heap ${first?.heapMb}MB → ${last?.heapMb}MB (${results.heapGrowthMb >= 0 ? "+" : ""}${results.heapGrowthMb}MB over the flow)`);

    const slowest = results.steps
      .flatMap((s) => s.api.map((r) => ({ ...r, step: s.step })))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, SLOWEST_API_SHOWN);
    console.log("\nSlowest /api calls (browser ms / server ms):");
    for (const r of slowest) {
      console.log(
        `  ${String(r.ms).padStart(5)} / ${String(r.serverMs ?? "-").padStart(5)}  ${r.method.padEnd(5)} ${r.path}  [${r.step}]`,
      );
    }
  } finally {
    save();
    cdp.ws.close();
    proc.kill();
    if (!KEEP_USER && DASHBOARD_TOKEN) {
      await apiDirect("DELETE", `/api/users/${player.userId}`, {
        headers: { "x-dashboard-token": DASHBOARD_TOKEN },
      }).catch((err) => console.warn(`Could not delete perf player: ${err.message}`));
    } else if (!KEEP_USER) {
      console.log(`\nPerf player kept (no DASHBOARD_TOKEN): ${player.email}`);
    }
  }
  console.log(`\nWrote ${path.join(OUT, "flow.json")}`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
