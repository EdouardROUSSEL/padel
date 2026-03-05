import { writeFile, readFile } from "fs/promises";
import { execSync } from "child_process";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const TENNIS_FILE = path.join(DATA_DIR, "raw", "fft-tennis-only.json");
const OUTPUT_FILE = path.join(DATA_DIR, "raw", "fft-tennis-enriched.json");
const STATUS_FILE = path.join(DATA_DIR, "fft-tennis-enrich-status.json");

const DELAY_MS = 250;
const SAVE_EVERY = 25;

interface TennisClub {
  code: string;
  nom: string;
  ville: string;
  nombreCourts: number;
  pratiques: string[];
  lat?: number;
  lng?: number;
  address?: string;
  postalCode?: string;
}

interface Status {
  total: number;
  enriched: number;
  failed: number;
  failedCodes: string[];
  enrichedCodes: string[];
}

// ── Live dashboard ──────────────────────────────────────────────────

const PROGRESS_BAR_WIDTH = 40;

function clearLines(n: number) {
  for (let i = 0; i < n; i++) {
    process.stdout.write("\x1b[1A\x1b[2K");
  }
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m${rs.toString().padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h${rm.toString().padStart(2, "0")}m`;
}

function progressBar(ratio: number): string {
  const filled = Math.round(ratio * PROGRESS_BAR_WIDTH);
  const empty = PROGRESS_BAR_WIDTH - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

interface DashboardState {
  totalToProcess: number;
  processed: number;
  sessionSuccess: number;
  sessionFail: number;
  globalEnriched: number;
  globalFailed: number;
  globalTotal: number;
  startTime: number;
  lastClub: string;
  lastResult: "success" | "fail" | "cookie" | "";
  cookieRefreshes: number;
  linesDrawn: number;
}

function drawDashboard(state: DashboardState) {
  if (state.linesDrawn > 0) {
    clearLines(state.linesDrawn);
  }

  const elapsed = Date.now() - state.startTime;
  const ratio = state.totalToProcess > 0 ? state.processed / state.totalToProcess : 0;
  const speed = elapsed > 0 ? (state.processed / elapsed) * 1000 : 0;
  const eta = speed > 0 ? (state.totalToProcess - state.processed) / speed * 1000 : 0;

  const globalDone = state.globalEnriched + state.globalFailed;
  const globalRatio = state.globalTotal > 0 ? globalDone / state.globalTotal : 0;

  const lines: string[] = [];

  lines.push("\x1b[36m╔══════════════════════════════════════════════════════════════╗\x1b[0m");
  lines.push("\x1b[36m║\x1b[0m  \x1b[1m🎾 FFT Tennis Enrichment\x1b[0m                                   \x1b[36m║\x1b[0m");
  lines.push("\x1b[36m╠══════════════════════════════════════════════════════════════╣\x1b[0m");

  // Session progress
  const pct = (ratio * 100).toFixed(1).padStart(5);
  lines.push(`\x1b[36m║\x1b[0m  Session:  ${progressBar(ratio)} ${pct}%  \x1b[36m║\x1b[0m`);
  lines.push(`\x1b[36m║\x1b[0m  Progress: \x1b[1m${state.processed}\x1b[0m / ${state.totalToProcess} remaining                      \x1b[36m║\x1b[0m`);

  // Global progress
  const globalPct = (globalRatio * 100).toFixed(1).padStart(5);
  lines.push(`\x1b[36m║\x1b[0m  Global:   ${progressBar(globalRatio)} ${globalPct}%  \x1b[36m║\x1b[0m`);
  lines.push(`\x1b[36m║\x1b[0m  Total:    \x1b[1m${globalDone}\x1b[0m / ${state.globalTotal} clubs                            \x1b[36m║\x1b[0m`);

  lines.push("\x1b[36m╠══════════════════════════════════════════════════════════════╣\x1b[0m");

  // Stats
  const successRate = state.processed > 0
    ? ((state.sessionSuccess / state.processed) * 100).toFixed(1)
    : "0.0";
  lines.push(`\x1b[36m║\x1b[0m  \x1b[32m✓ Success:\x1b[0m ${state.sessionSuccess.toString().padEnd(6)} \x1b[31m✗ Failed:\x1b[0m ${state.sessionFail.toString().padEnd(6)} \x1b[33mRate:\x1b[0m ${successRate}%    \x1b[36m║\x1b[0m`);
  lines.push(`\x1b[36m║\x1b[0m  \x1b[34m⏱ Elapsed:\x1b[0m ${formatDuration(elapsed).padEnd(8)} \x1b[34m⏳ ETA:\x1b[0m ${formatDuration(eta).padEnd(10)} \x1b[34m⚡\x1b[0m ${speed.toFixed(1)}/s   \x1b[36m║\x1b[0m`);

  if (state.cookieRefreshes > 0) {
    lines.push(`\x1b[36m║\x1b[0m  \x1b[33m🔄 Cookie refreshes:\x1b[0m ${state.cookieRefreshes}                                  \x1b[36m║\x1b[0m`);
  }

  lines.push("\x1b[36m╠══════════════════════════════════════════════════════════════╣\x1b[0m");

  // Last club
  const icon = state.lastResult === "success" ? "\x1b[32m✓\x1b[0m"
    : state.lastResult === "fail" ? "\x1b[31m✗\x1b[0m"
    : state.lastResult === "cookie" ? "\x1b[33m🔄\x1b[0m"
    : " ";
  const clubDisplay = state.lastClub.length > 50
    ? state.lastClub.substring(0, 50) + "…"
    : state.lastClub;
  lines.push(`\x1b[36m║\x1b[0m  ${icon} ${clubDisplay.padEnd(55)} \x1b[36m║\x1b[0m`);

  lines.push("\x1b[36m╚══════════════════════════════════════════════════════════════╝\x1b[0m");

  const output = lines.join("\n");
  process.stdout.write(output + "\n");
  state.linesDrawn = lines.length;
}

// ── Cookie management ───────────────────────────────────────────────

function getNewCookie(): string {
  process.stdout.write("\n\x1b[33m🔄 Getting new Queue-it cookie via browser...\x1b[0m\n");
  try {
    execSync("npx agent-browser open https://tenup.fft.fr/club/60660441", {
      timeout: 45000,
      stdio: "pipe",
    });
    const cookieOutput = execSync('npx agent-browser eval "document.cookie"', {
      timeout: 15000,
      stdio: "pipe",
    })
      .toString()
      .trim();
    execSync("npx agent-browser close", { timeout: 10000, stdio: "pipe" });

    const cookie = cookieOutput.replace(/^"|"$/g, "");
    process.stdout.write("\x1b[32m✅ Got new cookie\x1b[0m\n\n");
    return cookie;
  } catch (error) {
    console.error("Failed to get cookie:", error);
    throw error;
  }
}

// ── Fetch logic ─────────────────────────────────────────────────────

async function fetchClubPage(
  codeClub: string,
  cookie: string
): Promise<{ lat: number; lng: number; address: string; postalCode: string; cookieExpired: boolean } | null> {
  const url = `https://tenup.fft.fr/club/${codeClub}`;

  try {
    const response = await fetch(url, {
      headers: {
        Cookie: cookie,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "manual",
    });

    if (response.status === 302) {
      const location = response.headers.get("location") || "";
      if (location.includes("queue-it")) {
        return { lat: 0, lng: 0, address: "", postalCode: "", cookieExpired: true };
      }
    }

    if (!response.ok) return null;

    const html = await response.text();
    const coordsMatch = html.match(/destination=([-\d.]+),([-\d.]+)/);
    if (!coordsMatch) return null;

    const lat = parseFloat(coordsMatch[1]);
    const lng = parseFloat(coordsMatch[2]);

    const addressMatch = html.match(/<a[^>]*maps[^>]*>([^<]+)<\/a>/);
    let address = "";
    let postalCode = "";

    if (addressMatch) {
      const rawAddress = addressMatch[1].trim();
      const cpMatch = rawAddress.match(/(\d{5})/);
      if (cpMatch) {
        postalCode = cpMatch[1];
        address = rawAddress.substring(0, rawAddress.indexOf(cpMatch[1])).trim();
      } else {
        address = rawAddress;
      }
    }

    return { lat, lng, address, postalCode, cookieExpired: false };
  } catch {
    return null;
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Status persistence ──────────────────────────────────────────────

async function loadStatus(): Promise<Status> {
  try {
    const data = await readFile(STATUS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { total: 0, enriched: 0, failed: 0, failedCodes: [], enrichedCodes: [] };
  }
}

async function saveStatus(status: Status): Promise<void> {
  await writeFile(STATUS_FILE, JSON.stringify(status, null, 2));
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.clear();
  console.log("\x1b[1m🎾 FFT Tennis Club Enrichment — Starting...\x1b[0m\n");

  // Load data
  let tennisData;
  try {
    tennisData = JSON.parse(await readFile(OUTPUT_FILE, "utf-8"));
    console.log("📂 Resuming from enriched file");
  } catch {
    tennisData = JSON.parse(await readFile(TENNIS_FILE, "utf-8"));
    console.log("📂 Starting from raw file");
  }
  const clubs: TennisClub[] = tennisData.clubs;

  const status = await loadStatus();
  status.total = clubs.length;

  const alreadyDone = new Set([...status.enrichedCodes, ...status.failedCodes]);
  const remaining = clubs.filter((c) => !alreadyDone.has(c.code));

  console.log(`📊 Total: ${clubs.length} | Already done: ${alreadyDone.size} | Remaining: ${remaining.length}\n`);

  if (remaining.length === 0) {
    console.log("\x1b[32m✅ All clubs already processed! Nothing to do.\x1b[0m");
    return;
  }

  // Get initial cookie
  let cookie = getNewCookie();

  const dashboard: DashboardState = {
    totalToProcess: remaining.length,
    processed: 0,
    sessionSuccess: 0,
    sessionFail: 0,
    globalEnriched: status.enriched,
    globalFailed: status.failed,
    globalTotal: clubs.length,
    startTime: Date.now(),
    lastClub: "",
    lastResult: "",
    cookieRefreshes: 1,
    linesDrawn: 0,
  };

  // Initial draw
  drawDashboard(dashboard);

  for (const club of clubs) {
    if (alreadyDone.has(club.code)) continue;

    const result = await fetchClubPage(club.code, cookie);

    if (result?.cookieExpired) {
      dashboard.lastResult = "cookie";
      dashboard.lastClub = `Cookie expired — refreshing...`;
      drawDashboard(dashboard);

      cookie = getNewCookie();
      dashboard.cookieRefreshes++;
      // Reset drawn lines after cookie output messes up the terminal
      dashboard.linesDrawn = 0;

      const retry = await fetchClubPage(club.code, cookie);
      if (retry && !retry.cookieExpired) {
        club.lat = retry.lat;
        club.lng = retry.lng;
        if (retry.address) club.address = retry.address;
        if (retry.postalCode) club.postalCode = retry.postalCode;
        status.enriched++;
        status.enrichedCodes.push(club.code);
        dashboard.sessionSuccess++;
        dashboard.globalEnriched++;
        dashboard.lastResult = "success";
      } else {
        status.failed++;
        status.failedCodes.push(club.code);
        dashboard.sessionFail++;
        dashboard.globalFailed++;
        dashboard.lastResult = "fail";
      }
    } else if (result) {
      club.lat = result.lat;
      club.lng = result.lng;
      if (result.address) club.address = result.address;
      if (result.postalCode) club.postalCode = result.postalCode;
      status.enriched++;
      status.enrichedCodes.push(club.code);
      dashboard.sessionSuccess++;
      dashboard.globalEnriched++;
      dashboard.lastResult = "success";
    } else {
      status.failed++;
      status.failedCodes.push(club.code);
      dashboard.sessionFail++;
      dashboard.globalFailed++;
      dashboard.lastResult = "fail";
    }

    dashboard.processed++;
    dashboard.lastClub = `${club.code} — ${club.nom} (${club.ville})`;
    drawDashboard(dashboard);

    // Save periodically
    if (dashboard.processed % SAVE_EVERY === 0) {
      await saveStatus(status);
      tennisData.clubs = clubs;
      tennisData.enrichedAt = new Date().toISOString();
      await writeFile(OUTPUT_FILE, JSON.stringify(tennisData, null, 2));
    }

    await delay(DELAY_MS);
  }

  // Final save
  await saveStatus(status);
  tennisData.clubs = clubs;
  tennisData.enrichedAt = new Date().toISOString();
  await writeFile(OUTPUT_FILE, JSON.stringify(tennisData, null, 2));

  const withCoords = clubs.filter((c) => c.lat && c.lat !== 0);

  // Final summary
  clearLines(dashboard.linesDrawn);
  const elapsed = Date.now() - dashboard.startTime;
  console.log("\x1b[36m╔══════════════════════════════════════════════════════════════╗\x1b[0m");
  console.log("\x1b[36m║\x1b[0m  \x1b[1m🎾 FFT Tennis Enrichment — DONE\x1b[0m                            \x1b[36m║\x1b[0m");
  console.log("\x1b[36m╠══════════════════════════════════════════════════════════════╣\x1b[0m");
  console.log(`\x1b[36m║\x1b[0m  \x1b[32m✓ Enriched:\x1b[0m  ${status.enriched.toString().padEnd(46)} \x1b[36m║\x1b[0m`);
  console.log(`\x1b[36m║\x1b[0m  \x1b[31m✗ Failed:\x1b[0m    ${status.failed.toString().padEnd(46)} \x1b[36m║\x1b[0m`);
  console.log(`\x1b[36m║\x1b[0m  \x1b[34m📍 With GPS:\x1b[0m ${(withCoords.length + "/" + clubs.length).padEnd(46)} \x1b[36m║\x1b[0m`);
  console.log(`\x1b[36m║\x1b[0m  \x1b[34m⏱ Duration:\x1b[0m  ${formatDuration(elapsed).padEnd(46)} \x1b[36m║\x1b[0m`);
  console.log("\x1b[36m╚══════════════════════════════════════════════════════════════╝\x1b[0m");
}

main().catch(console.error);
