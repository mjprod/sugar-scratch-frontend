/**
 * On-device perf overlay, loaded only when `?perf=1` is set (see main.tsx).
 * Plain DOM so it never re-renders the React tree it is measuring.
 */
import {
  FrameStats,
  LONG_FRAME_MS,
  PERF_STORAGE_KEY,
  SLOW_FRAME_MS,
  type FrameSnapshot,
} from "./perfStats";

const UI_UPDATE_MS = 500;
const DOM_COUNT_MS = 2000;
const GRAPH_FRAMES = 120;
const GRAPH_W = 120;
const GRAPH_H = 32;
const GRAPH_MAX_MS = 66;
const HUD_ATTR = "data-perf-hud";

type ChromeMemory = { usedJSHeapSize: number; jsHeapSizeLimit: number };

type PerfApi = {
  snapshot: () => PerfReport;
  reset: () => void;
};

export type PerfReport = FrameSnapshot & {
  route: string;
  longTasks: number | null;
  blockingMs: number | null;
  heapMb: number | null;
  heapPeakMb: number | null;
  domNodes: number;
  canvases: number;
  videos: number;
  dpr: number;
  viewport: string;
  userAgent: string;
};

let mounted = false;

export function mountPerfHud(): void {
  if (mounted || typeof document === "undefined") return;
  mounted = true;

  const stats = new FrameStats();
  const graphBuf = new Float64Array(GRAPH_FRAMES);

  let longTasks = 0;
  let blockingMs = 0;
  let heapPeakMb = 0;
  let domNodes = 0;
  let canvases = 0;
  let videos = 0;

  const longTaskSupported =
    typeof PerformanceObserver !== "undefined" &&
    (PerformanceObserver.supportedEntryTypes ?? []).includes("longtask");
  let longTaskObserver: PerformanceObserver | null = null;
  if (longTaskSupported) {
    longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks += 1;
        blockingMs += Math.max(0, entry.duration - LONG_FRAME_MS);
      }
    });
    longTaskObserver.observe({ type: "longtask", buffered: false });
  }

  const readHeapMb = (): number | null => {
    const memory = (performance as Performance & { memory?: ChromeMemory }).memory;
    if (!memory) return null;
    const mb = memory.usedJSHeapSize / 1048576;
    if (mb > heapPeakMb) heapPeakMb = mb;
    return mb;
  };

  const countDom = () => {
    domNodes = document.getElementsByTagName("*").length;
    canvases = document.querySelectorAll(`canvas:not([${HUD_ATTR}])`).length;
    videos = document.getElementsByTagName("video").length;
  };

  const report = (): PerfReport => {
    const heapMb = readHeapMb();
    return {
      ...stats.snapshot(),
      route: window.location.pathname + window.location.search,
      longTasks: longTaskSupported ? longTasks : null,
      blockingMs: longTaskSupported ? blockingMs : null,
      heapMb,
      heapPeakMb: heapMb === null ? null : heapPeakMb,
      domNodes,
      canvases,
      videos,
      dpr: window.devicePixelRatio,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      userAgent: navigator.userAgent,
    };
  };

  const reset = () => {
    stats.reset();
    longTasks = 0;
    blockingMs = 0;
    heapPeakMb = 0;
  };

  // ---- DOM ----
  const root = document.createElement("div");
  root.setAttribute(HUD_ATTR, "");
  root.style.cssText = [
    "position:fixed",
    "top:calc(env(safe-area-inset-top, 0px) + 4px)",
    "left:calc(env(safe-area-inset-left, 0px) + 4px)",
    "z-index:2147483647",
    "padding:6px 8px",
    "border-radius:8px",
    "background:rgba(0,0,0,0.78)",
    "color:#e8e8e8",
    "font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace",
    "pointer-events:none",
    "user-select:none",
    "-webkit-user-select:none",
    "max-width:210px",
  ].join(";");

  const fpsLine = document.createElement("div");
  fpsLine.style.cssText = "font-size:13px;font-weight:700";
  const detail = document.createElement("div");
  detail.style.whiteSpace = "pre";

  const graph = document.createElement("canvas");
  graph.setAttribute(HUD_ATTR, "");
  graph.width = GRAPH_W;
  graph.height = GRAPH_H;
  graph.style.cssText = `display:block;width:${GRAPH_W}px;height:${GRAPH_H}px;margin:3px 0`;
  const g = graph.getContext("2d");

  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;gap:4px;margin-top:4px;pointer-events:auto";
  const makeButton = (label: string, onClick: (btn: HTMLButtonElement) => void) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.style.cssText =
      "flex:1;padding:3px 0;border:1px solid #555;border-radius:4px;background:#222;color:#eee;font:inherit;touch-action:manipulation";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick(btn);
    });
    buttons.appendChild(btn);
    return btn;
  };

  let collapsed = false;
  const toggleBtn = makeButton("–", (btn) => {
    collapsed = !collapsed;
    detail.style.display = collapsed ? "none" : "";
    graph.style.display = collapsed ? "none" : "block";
    btn.textContent = collapsed ? "+" : "–";
  });
  toggleBtn.style.flex = "0 0 22px";
  makeButton("Reset", reset);
  makeButton("Copy", (btn) => {
    const text = formatReport(report());
    const done = (label: string) => {
      btn.textContent = label;
      window.setTimeout(() => (btn.textContent = "Copy"), 1200);
    };
    console.info(text);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => done("Copied"),
        () => done("Logged"),
      );
    } else {
      done("Logged");
    }
  });
  const closeBtn = makeButton("×", () => {
    try {
      window.localStorage.removeItem(PERF_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    unmount();
  });
  closeBtn.style.flex = "0 0 22px";

  root.append(fpsLine, graph, detail, buttons);
  document.body.appendChild(root);

  // ---- loop ----
  let rafId = 0;
  let last = 0;
  let lastUi = 0;
  let lastDom = 0;

  const drawGraph = () => {
    if (!g || collapsed) return;
    const n = stats.recent(GRAPH_FRAMES, graphBuf);
    g.clearRect(0, 0, GRAPH_W, GRAPH_H);
    const y = (ms: number) => GRAPH_H - (Math.min(ms, GRAPH_MAX_MS) / GRAPH_MAX_MS) * GRAPH_H;
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(0, Math.round(y(1000 / 60)), GRAPH_W, 1);
    g.fillRect(0, Math.round(y(SLOW_FRAME_MS)), GRAPH_W, 1);
    const barW = GRAPH_W / GRAPH_FRAMES;
    for (let i = 0; i < n; i += 1) {
      const ms = graphBuf[i];
      g.fillStyle = ms > LONG_FRAME_MS ? "#ff4d4d" : ms > SLOW_FRAME_MS ? "#ffc933" : "#4dff88";
      const top = y(ms);
      g.fillRect((GRAPH_FRAMES - n + i) * barW, top, Math.max(1, barW), GRAPH_H - top);
    }
  };

  const renderUi = () => {
    const r = report();
    fpsLine.textContent = `${r.fps.toFixed(0)} fps  p99 ${r.p99Ms.toFixed(1)}ms`;
    fpsLine.style.color = r.p99Ms > LONG_FRAME_MS ? "#ff4d4d" : r.p99Ms > SLOW_FRAME_MS ? "#ffc933" : "#4dff88";
    if (collapsed) return;
    const heap =
      r.heapMb === null ? "n/a" : `${r.heapMb.toFixed(0)}MB (peak ${r.heapPeakMb?.toFixed(0)})`;
    const lt =
      r.longTasks === null ? "n/a" : `${r.longTasks} / ${Math.round(r.blockingMs ?? 0)}ms blk`;
    detail.textContent = [
      `p50 ${r.p50Ms.toFixed(1)}  p95 ${r.p95Ms.toFixed(1)}  max ${r.worstMs.toFixed(0)}`,
      `>${SLOW_FRAME_MS}ms ${r.slowFrames}  >${LONG_FRAME_MS}ms ${r.longFrames}  / ${r.totalFrames}`,
      `longtask ${lt}`,
      `heap ${heap}`,
      `dom ${r.domNodes}  canvas ${r.canvases}  video ${r.videos}`,
      `dpr ${r.dpr}  ${r.viewport}`,
      r.route.length > 32 ? `${r.route.slice(0, 31)}…` : r.route,
    ].join("\n");
    drawGraph();
  };

  const tick = (now: number) => {
    if (last > 0) stats.push(now - last);
    last = now;
    if (now - lastDom >= DOM_COUNT_MS) {
      lastDom = now;
      countDom();
    }
    if (now - lastUi >= UI_UPDATE_MS) {
      lastUi = now;
      renderUi();
    }
    rafId = requestAnimationFrame(tick);
  };

  const onVisibility = () => {
    last = 0;
  };
  document.addEventListener("visibilitychange", onVisibility);

  countDom();
  rafId = requestAnimationFrame(tick);

  const api: PerfApi = { snapshot: report, reset };
  (window as Window & { __sugarPerf?: PerfApi }).__sugarPerf = api;

  function unmount() {
    cancelAnimationFrame(rafId);
    longTaskObserver?.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    root.remove();
    delete (window as Window & { __sugarPerf?: PerfApi }).__sugarPerf;
    mounted = false;
  }
}

export function formatReport(r: PerfReport): string {
  const minutes = r.elapsedMs / 60000;
  return [
    `Sugar perf — ${new Date().toISOString()}`,
    `route: ${r.route}`,
    `device: dpr ${r.dpr}, viewport ${r.viewport}`,
    `ua: ${r.userAgent}`,
    `window fps: ${r.fps.toFixed(1)}`,
    `frame ms: p50 ${r.p50Ms.toFixed(1)} / p95 ${r.p95Ms.toFixed(1)} / p99 ${r.p99Ms.toFixed(1)} / worst ${r.worstMs.toFixed(1)}`,
    `since reset: ${r.totalFrames} frames over ${minutes.toFixed(2)} min, >${SLOW_FRAME_MS}ms ${r.slowFrames}, >${LONG_FRAME_MS}ms ${r.longFrames}`,
    `long tasks: ${r.longTasks === null ? "n/a (not supported)" : `${r.longTasks}, blocking ${Math.round(r.blockingMs ?? 0)}ms`}`,
    `heap: ${r.heapMb === null ? "n/a (not supported)" : `${r.heapMb.toFixed(1)}MB, peak ${r.heapPeakMb?.toFixed(1)}MB`}`,
    `dom nodes ${r.domNodes}, canvases ${r.canvases}, videos ${r.videos}`,
  ].join("\n");
}
