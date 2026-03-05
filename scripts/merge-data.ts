import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface Court {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  lat: number;
  lng: number;
  totalCourts: number;
  indoorCourts: number;
  outdoorCourts: number;
  source: string[];
  imageUrl?: string;
  url?: string;
  [key: string]: unknown;
}

interface DataFile {
  courts: Court[];
  total: number;
  source: string;
}

interface MergedData {
  generatedAt: string;
  sources: string[];
  total: number;
  courts: Court[];
}

const DATA_DIR = join(process.cwd(), 'data');

// Sources to merge (ordered by court count reliability: padel-only sources first)
const SOURCES = [
  { path: 'raw/tenup.json', name: 'tenup' },
  { path: 'raw/anybuddy.json', name: 'anybuddy' },
  { path: 'raw/playtomic.json', name: 'playtomic' },
  { path: 'raw/padelmagazine.json', name: 'padelmagazine' },
  { path: 'raw/fft-padel-enriched.json', name: 'fft-padel' },
  { path: 'google_padel.json', name: 'google' },
  { path: 'raw/osm.json', name: 'osm' },
];

function loadDataFile(relativePath: string): DataFile | null {
  const fullPath = join(DATA_DIR, relativePath);

  if (!existsSync(fullPath)) {
    console.warn(`File not found: ${fullPath}`);
    return null;
  }

  try {
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content) as DataFile;
  } catch (error) {
    console.error(`Error reading ${fullPath}:`, error);
    return null;
  }
}

// Haversine formula to calculate distance between two points in meters
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function normalizeSource(source: string | string[]): string[] {
  if (Array.isArray(source)) {
    return source;
  }
  return [source];
}

// Merge distance threshold in meters
const MERGE_DISTANCE_METERS = 100;
// Extended distance for name-based matching
const MERGE_DISTANCE_WITH_NAME_METERS = 500;

// Court count priority: sources that report padel-only counts first
// tenup/anybuddy/playtomic report padel courts only
// fft-padel reports ALL courts (tennis + padel) → unreliable for padel count
// google/osm have 0 most of the time
const COURT_COUNT_SOURCE_PRIORITY = ['tenup', 'anybuddy', 'playtomic', 'padelmagazine', 'fft-padel', 'google', 'osm'];

// Normalize name for comparison
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, '') // Keep only alphanumeric
    .trim();
}

// Check if two names are similar
function areNamesSimilar(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  // Exact match after normalization
  if (n1 === n2) return true;

  // One contains the other
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Check common padel club patterns
  const patterns = ['4padel', 'urbanpadel', 'padelshot', 'padel', 'tennis'];
  for (const pattern of patterns) {
    if (n1.includes(pattern) && n2.includes(pattern)) {
      // Both have same pattern, check if they share more words
      const words1 = n1.replace(pattern, '').split(/\d+/).filter(w => w.length > 2);
      const words2 = n2.replace(pattern, '').split(/\d+/).filter(w => w.length > 2);

      for (const w1 of words1) {
        for (const w2 of words2) {
          if (w1.includes(w2) || w2.includes(w1)) return true;
        }
      }
    }
  }

  return false;
}

// Get priority rank for a source (lower = better for court counts)
function getSourcePriority(source: string): number {
  const idx = COURT_COUNT_SOURCE_PRIORITY.indexOf(source);
  return idx === -1 ? 999 : idx;
}

// Get the best source for court counts from a source array
function getBestCourtCountSource(sources: string[]): string {
  let best = sources[0] || '';
  let bestPriority = getSourcePriority(best);
  for (const s of sources) {
    const p = getSourcePriority(s);
    if (p < bestPriority) {
      best = s;
      bestPriority = p;
    }
  }
  return best;
}

function mergeCourts(allCourts: Court[]): Court[] {
  const mergedCourts: Court[] = [];
  const nameIndex: Map<string, number> = new Map();
  // Track which source provided the court counts for each merged entry
  const courtCountSource: Map<number, string> = new Map();

  for (const court of allCourts) {
    // Skip courts without valid coordinates
    if (!court.lat || !court.lng || court.lat === 0 || court.lng === 0) {
      continue;
    }

    // Normalize source to array
    court.source = normalizeSource(court.source as string | string[]);
    const courtSource = court.source[0] || '';

    // First check by exact normalized name
    const normalizedName = normalizeName(court.name || '');
    let existingIndex = nameIndex.get(normalizedName);

    // If no name match, check by distance (200m)
    if (existingIndex === undefined || normalizedName.length === 0) {
      for (let i = 0; i < mergedCourts.length; i++) {
        const existing = mergedCourts[i];
        const distance = haversineDistance(court.lat, court.lng, existing.lat, existing.lng);
        if (distance <= 200) {
          existingIndex = i;
          break;
        }
      }
    }

    if (existingIndex !== undefined) {
      // Merge with existing court
      const existing = mergedCourts[existingIndex];

      // Merge sources
      const sources = new Set([...existing.source, ...court.source]);
      existing.source = Array.from(sources);

      // Prefer non-empty values (keep existing if it has value, otherwise take new)
      if (!existing.name && court.name) existing.name = court.name;
      if (!existing.address && court.address) existing.address = court.address;
      if (!existing.city && court.city) existing.city = court.city;
      if (!existing.postalCode && court.postalCode) existing.postalCode = court.postalCode;
      if (!existing.imageUrl && court.imageUrl) existing.imageUrl = court.imageUrl;
      if (!existing.url && court.url) existing.url = court.url;

      // Court counts: use source with best priority (padel-only sources first)
      const existingSource = courtCountSource.get(existingIndex) || '';
      const existingPriority = getSourcePriority(existingSource);
      const newPriority = getSourcePriority(courtSource);

      if ((court.totalCourts || 0) > 0 && (newPriority < existingPriority || (existing.totalCourts || 0) === 0)) {
        existing.totalCourts = court.totalCourts || 0;
        existing.indoorCourts = court.indoorCourts || 0;
        existing.outdoorCourts = court.outdoorCourts || 0;
        courtCountSource.set(existingIndex, courtSource);
      }
    } else {
      // Add new court
      const newIndex = mergedCourts.length;
      mergedCourts.push({ ...court });
      courtCountSource.set(newIndex, courtSource);
      if (normalizedName.length > 0) {
        nameIndex.set(normalizedName, newIndex);
      }
    }
  }

  return mergedCourts;
}

function main() {
  console.log('Merging padel court data...\n');

  const allCourts: Court[] = [];
  const loadedSources: string[] = [];

  for (const source of SOURCES) {
    const data = loadDataFile(source.path);

    if (data && data.courts) {
      console.log(`✓ ${source.name}: ${data.courts.length} courts`);
      allCourts.push(...data.courts);
      loadedSources.push(source.name);
    } else {
      console.log(`✗ ${source.name}: no data`);
    }
  }

  console.log(`\nTotal courts before merge: ${allCourts.length}`);

  // Merge and deduplicate
  const mergedCourts = mergeCourts(allCourts);

  console.log(`Total courts after merge: ${mergedCourts.length}`);
  console.log(`Duplicates removed: ${allCourts.length - mergedCourts.length}`);

  // Create merged data object
  const mergedData: MergedData = {
    generatedAt: new Date().toISOString(),
    sources: loadedSources,
    total: mergedCourts.length,
    courts: mergedCourts,
  };

  // Write to file
  const outputPath = join(DATA_DIR, 'merged.json');
  writeFileSync(outputPath, JSON.stringify(mergedData, null, 2));

  console.log(`\n✓ Merged data written to: ${outputPath}`);
}

main();
