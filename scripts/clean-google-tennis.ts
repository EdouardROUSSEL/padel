import { readFile, writeFile } from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const GOOGLE_RAW = path.join(DATA_DIR, "raw", "google.json");
const TENNIS_FILE = path.join(DATA_DIR, "raw", "fft-tennis-enriched.json");
const PADEL_SOURCES = [
  path.join(DATA_DIR, "raw", "anybuddy.json"),
  path.join(DATA_DIR, "raw", "playtomic.json"),
  path.join(DATA_DIR, "raw", "osm.json"),
  path.join(DATA_DIR, "raw", "padelmagazine.json"),
  path.join(DATA_DIR, "raw", "tenup.json"),
  path.join(DATA_DIR, "raw", "fft-padel-enriched.json"),
];
const OUTPUT_FILE = path.join(DATA_DIR, "google_padel.json");

const MATCH_RADIUS_KM = 0.5;

interface Coord {
  lat: number;
  lng: number;
}

function haversineKm(a: Coord, b: Coord): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function findNearby(point: Coord, coords: Coord[], radiusKm: number): boolean {
  for (const c of coords) {
    if (haversineKm(point, c) <= radiusKm) return true;
  }
  return false;
}

async function main() {
  console.log("Loading data...");

  // Load Google
  const googleData = JSON.parse(await readFile(GOOGLE_RAW, "utf-8"));
  const googleCourts: any[] = googleData.courts;
  console.log(`  Google: ${googleCourts.length} entries`);

  // Load FFT Tennis-only
  const tennisData = JSON.parse(await readFile(TENNIS_FILE, "utf-8"));
  const tennisCoords: Coord[] = tennisData.clubs
    .filter((c: any) => c.lat && c.lng)
    .map((c: any) => ({ lat: c.lat, lng: c.lng }));
  console.log(`  FFT Tennis-only: ${tennisCoords.length} clubs`);

  // Load all padel sources
  const padelCoords: Coord[] = [];
  for (const file of PADEL_SOURCES) {
    try {
      const data = JSON.parse(await readFile(file, "utf-8"));
      const courts = data.courts || data.clubs || [];
      for (const c of courts) {
        const lat = c.lat ?? c.latitude;
        const lng = c.lng ?? c.longitude;
        if (lat && lng) padelCoords.push({ lat, lng });
      }
      console.log(`  ${path.basename(file)}: ${courts.length}`);
    } catch {
      console.log(`  ${path.basename(file)}: skipped`);
    }
  }
  console.log(`  Total padel reference points: ${padelCoords.length}`);

  console.log("\nCross-referencing...");

  const kept: any[] = [];
  const removed: any[] = [];
  let matchesPadel = 0;
  let matchesTennisOnly = 0;
  let matchesNone = 0;

  for (let i = 0; i < googleCourts.length; i++) {
    const court = googleCourts[i];
    if (!court.lat || !court.lng) {
      kept.push(court);
      continue;
    }

    const point: Coord = { lat: court.lat, lng: court.lng };
    const hasPadelInName = /padel/i.test(court.name);
    const nearPadel = findNearby(point, padelCoords, MATCH_RADIUS_KM);
    const nearTennis = findNearby(point, tennisCoords, MATCH_RADIUS_KM);

    if (nearTennis && !nearPadel && !hasPadelInName) {
      // Matches tennis-only, no padel nearby, name doesn't mention padel → remove
      removed.push(court);
      matchesTennisOnly++;
    } else {
      kept.push(court);
      if (nearPadel) matchesPadel++;
      else matchesNone++;
    }

    if ((i + 1) % 100 === 0) {
      const pct = (((i + 1) / googleCourts.length) * 100).toFixed(0);
      process.stdout.write(`\r  ${i + 1}/${googleCourts.length} (${pct}%)`);
    }
  }
  process.stdout.write(`\r  ${googleCourts.length}/${googleCourts.length} (100%)\n`);

  console.log("\nResults:");
  console.log(`  Kept: ${kept.length}`);
  console.log(`    - Near a padel source: ${matchesPadel}`);
  console.log(`    - No match (kept by default): ${matchesNone}`);
  console.log(`  Removed (tennis-only match): ${removed.length}`);

  // Save filtered Google data
  const output = {
    ...googleData,
    courts: kept,
    total: kept.length,
    filteredAt: new Date().toISOString(),
    removedTennisOnly: removed.length,
  };
  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nSaved to ${OUTPUT_FILE}`);

  // Save removed list for reference
  const removedFile = path.join(DATA_DIR, "google_tennis_only.json");
  await writeFile(
    removedFile,
    JSON.stringify(
      {
        reason: "Matched FFT tennis-only club within 500m, no padel source nearby",
        total: removed.length,
        courts: removed,
      },
      null,
      2
    )
  );
  console.log(`Removed list saved to ${removedFile}`);
}

main().catch(console.error);
