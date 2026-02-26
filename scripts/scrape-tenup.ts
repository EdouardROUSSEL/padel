import { writeFile, readFile, mkdir } from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "tenup");
const STATUS_FILE = path.join(DATA_DIR, "status.json");
const CLUBS_FILE = path.join(DATA_DIR, "clubs.json");

const TENUP_API = "https://tenup.fft.fr/back/public/v1/locations-horaires";
const DISTANCE_KM = 30; // Max allowed by API
const DELAY_MS = 400;

// France-only grid (TenUp = FFT = France only)
const FRANCE_BOUNDS = {
  minLat: 42.3,  // South (Perpignan)
  maxLat: 51.1,  // North (Dunkerque)
  minLng: -4.8,  // West (Brest)
  maxLng: 8.2,   // East (Strasbourg)
};
const STEP_KM = 25; // Denser grid for better coverage

interface GridPoint {
  lat: number;
  lng: number;
  name: string;
}

interface TenUpResult {
  codeClub: string;
  nomClub: string;
  idInstallation: number;
  nomInstallation: string;
  adresse1: string | null;
  adresse2: string | null;
  ville: string;
  codePostal: string;
  telephone: string | null;
  photo: string | null;
  lat: number;
  lng: number;
  distance: number;
  creneaux: unknown[];
}

interface Status {
  totalPoints: number;
  scrapedPoints: number;
  remainingPoints: number;
  totalClubs: number;
  scrapedIndexes: number[];
}

function generateGrid(): GridPoint[] {
  const points: GridPoint[] = [];
  const latStep = STEP_KM / 111;

  for (let lat = FRANCE_BOUNDS.minLat; lat <= FRANCE_BOUNDS.maxLat; lat += latStep) {
    const lngStep = STEP_KM / (111 * Math.cos((lat * Math.PI) / 180));
    for (let lng = FRANCE_BOUNDS.minLng; lng <= FRANCE_BOUNDS.maxLng; lng += lngStep) {
      points.push({
        lat: Math.round(lat * 10000) / 10000,
        lng: Math.round(lng * 10000) / 10000,
        name: `P${points.length}`,
      });
    }
  }
  return points;
}

const FULL_GRID = generateGrid();

function getSearchDate(): string {
  const now = new Date();
  const target = new Date(now);
  target.setDate(now.getDate() + 14);
  const dayOfWeek = target.getDay();
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  target.setDate(target.getDate() + daysUntilThursday);
  target.setHours(10, 0, 0, 0);
  return target.toISOString();
}

async function fetchClubs(lat: number, lng: number): Promise<TenUpResult[]> {
  const payload = {
    lat,
    lng,
    distance: DISTANCE_KM,
    date: getSearchDate(),
    pratiques: ["PADEL"],
  };

  try {
    const response = await fetch(TENUP_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: "https://tenup.fft.fr",
        Referer: "https://tenup.fft.fr/location-horaire/resultats",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.resultats || [];
  } catch (error) {
    console.error(`Error (${lat}, ${lng}):`, error);
    return [];
  }
}

async function loadStatus(): Promise<Status> {
  try {
    const data = await readFile(STATUS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {
      totalPoints: FULL_GRID.length,
      scrapedPoints: 0,
      remainingPoints: FULL_GRID.length,
      totalClubs: 0,
      scrapedIndexes: [],
    };
  }
}

async function saveStatus(status: Status): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STATUS_FILE, JSON.stringify(status, null, 2));
}

async function loadClubs(): Promise<Map<string, TenUpResult>> {
  try {
    const data = await readFile(CLUBS_FILE, "utf-8");
    const arr: TenUpResult[] = JSON.parse(data);
    return new Map(arr.map((c) => [c.codeClub, c]));
  } catch {
    return new Map();
  }
}

async function saveClubs(clubs: Map<string, TenUpResult>): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CLUBS_FILE, JSON.stringify(Array.from(clubs.values()), null, 2));
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`Starting TenUp scraping: ${FULL_GRID.length} points`);
  console.log(`Search date: ${getSearchDate()}`);
  console.log("");

  const status = await loadStatus();
  const clubs = await loadClubs();

  console.log(`Resuming from: ${status.scrapedPoints}/${status.totalPoints} (${status.totalClubs} clubs found)`);
  console.log("");

  for (let i = 0; i < FULL_GRID.length; i++) {
    if (status.scrapedIndexes.includes(i)) continue;

    const point = FULL_GRID[i];
    const results = await fetchClubs(point.lat, point.lng);

    let newClubs = 0;
    for (const result of results) {
      if (!clubs.has(result.codeClub)) {
        clubs.set(result.codeClub, result);
        newClubs++;
      }
    }

    status.scrapedIndexes.push(i);
    status.scrapedPoints++;
    status.remainingPoints--;
    status.totalClubs = clubs.size;

    // Save every 10 points
    if (status.scrapedPoints % 10 === 0) {
      await saveStatus(status);
      await saveClubs(clubs);
    }

    const pct = ((status.scrapedPoints / status.totalPoints) * 100).toFixed(1);
    console.log(
      `[${status.scrapedPoints}/${status.totalPoints}] ${pct}% | ${point.name} (${point.lat}, ${point.lng}) | Found: ${results.length} | New: ${newClubs} | Total: ${clubs.size}`
    );

    await delay(DELAY_MS);
  }

  // Final save
  await saveStatus(status);
  await saveClubs(clubs);

  console.log("");
  console.log(`Done! Total clubs found: ${clubs.size}`);
}

main().catch(console.error);
