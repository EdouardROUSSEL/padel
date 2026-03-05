import { writeFile, readFile, mkdir } from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "raw");
const STATUS_FILE = path.join(process.cwd(), "data", "fft-scrape-status.json");

const FFT_API = "https://tenup.fft.fr/back/public/v1/clubs";
const DISTANCE_KM = 30; // 30km radius per request (API max)
const DELAY_MS = 250;

// France grid bounds
const FRANCE_BOUNDS = {
  minLat: 42.3,  // South (Perpignan)
  maxLat: 51.1,  // North (Dunkerque)
  minLng: -5.2,  // West (Brest - extended)
  maxLng: 8.5,   // East (Strasbourg)
};
const STEP_KM = 15; // Denser grid to capture all clubs (API limits to 100 per request)

interface GridPoint {
  lat: number;
  lng: number;
  name: string;
}

interface FFTClub {
  code: string;
  nom: string;
  ville: string;
  nombreCourts: number;
  nombreCourtsCouverts: number;
  distance: number;
  pratiques: string[]; // TENNIS, PADEL, BEACH, PICKLE
}

interface Status {
  totalPoints: number;
  scrapedPoints: number;
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

async function fetchClubs(lat: number, lng: number): Promise<FFTClub[]> {
  const url = `${FFT_API}?lat=${lat}&lng=${lng}&distance=${DISTANCE_KM}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Origin: "https://tenup.fft.fr",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      console.error(`API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
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
      totalClubs: 0,
      scrapedIndexes: [],
    };
  }
}

async function saveStatus(status: Status): Promise<void> {
  await writeFile(STATUS_FILE, JSON.stringify(status, null, 2));
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`Starting FFT Clubs scraping: ${FULL_GRID.length} points`);
  console.log(`Grid step: ${STEP_KM}km, Search radius: ${DISTANCE_KM}km`);
  console.log("");

  const status = await loadStatus();
  const allClubs = new Map<string, FFTClub>();

  console.log(`Resuming from: ${status.scrapedPoints}/${status.totalPoints} (${status.totalClubs} clubs found)`);
  console.log("");

  for (let i = 0; i < FULL_GRID.length; i++) {
    if (status.scrapedIndexes.includes(i)) continue;

    const point = FULL_GRID[i];
    const results = await fetchClubs(point.lat, point.lng);

    let newClubs = 0;
    for (const club of results) {
      if (!allClubs.has(club.code)) {
        allClubs.set(club.code, club);
        newClubs++;
      }
    }

    status.scrapedIndexes.push(i);
    status.scrapedPoints++;
    status.totalClubs = allClubs.size;

    // Save every 20 points
    if (status.scrapedPoints % 20 === 0) {
      await saveStatus(status);
    }

    const pct = ((status.scrapedPoints / status.totalPoints) * 100).toFixed(1);
    console.log(
      `[${status.scrapedPoints}/${status.totalPoints}] ${pct}% | ${point.name} (${point.lat}, ${point.lng}) | Found: ${results.length} | New: ${newClubs} | Total: ${allClubs.size}`
    );

    await delay(DELAY_MS);
  }

  // Final save of status
  await saveStatus(status);

  // Process and save results
  console.log("");
  console.log("Processing results...");

  const clubs = Array.from(allClubs.values());

  // Count pratiques
  const pratiqueCounts: Record<string, number> = {};
  for (const club of clubs) {
    for (const p of club.pratiques) {
      pratiqueCounts[p] = (pratiqueCounts[p] || 0) + 1;
    }
  }
  console.log("Pratiques distribution:", pratiqueCounts);

  // Separate into PADEL and TENNIS-only
  const padelClubs = clubs.filter(c => c.pratiques.includes("PADEL"));
  const tennisOnlyClubs = clubs.filter(c =>
    c.pratiques.includes("TENNIS") && !c.pratiques.includes("PADEL")
  );

  console.log(`Clubs with PADEL: ${padelClubs.length}`);
  console.log(`Clubs TENNIS-only (no PADEL): ${tennisOnlyClubs.length}`);

  // Save files
  await mkdir(DATA_DIR, { recursive: true });

  // Save all clubs
  const allClubsFile = path.join(DATA_DIR, "fft-all-clubs.json");
  await writeFile(allClubsFile, JSON.stringify({
    source: "fft",
    scrapedAt: new Date().toISOString(),
    total: clubs.length,
    pratiques: pratiqueCounts,
    clubs: clubs,
  }, null, 2));
  console.log(`Saved all clubs to: ${allClubsFile}`);

  // Save PADEL clubs in standard format
  const padelFile = path.join(DATA_DIR, "fft-padel.json");
  const padelData = {
    source: "fft-padel",
    scrapedAt: new Date().toISOString(),
    total: padelClubs.length,
    courts: padelClubs.map(c => ({
      id: `fft_${c.code}`,
      name: c.nom,
      address: "",
      city: c.ville,
      postalCode: "",
      country: "FR",
      lat: 0, // API doesn't return coordinates
      lng: 0,
      totalCourts: c.nombreCourts,
      indoorCourts: c.nombreCourtsCouverts,
      outdoorCourts: c.nombreCourts - c.nombreCourtsCouverts,
      source: ["fft"],
      pratiques: c.pratiques,
      codeClub: c.code,
    })),
  };
  await writeFile(padelFile, JSON.stringify(padelData, null, 2));
  console.log(`Saved PADEL clubs to: ${padelFile}`);

  // Save TENNIS-only clubs
  const tennisFile = path.join(DATA_DIR, "fft-tennis-only.json");
  const tennisData = {
    source: "fft-tennis-only",
    scrapedAt: new Date().toISOString(),
    total: tennisOnlyClubs.length,
    clubs: tennisOnlyClubs.map(c => ({
      code: c.code,
      nom: c.nom,
      ville: c.ville,
      nombreCourts: c.nombreCourts,
      pratiques: c.pratiques,
    })),
  };
  await writeFile(tennisFile, JSON.stringify(tennisData, null, 2));
  console.log(`Saved TENNIS-only clubs to: ${tennisFile}`);

  console.log("");
  console.log(`Done! Total FFT clubs: ${clubs.length}`);
  console.log(`- PADEL: ${padelClubs.length}`);
  console.log(`- TENNIS-only: ${tennisOnlyClubs.length}`);
}

main().catch(console.error);
