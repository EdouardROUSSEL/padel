import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');

interface Court {
  lat: number;
  lng: number;
  totalCourts: number;
  department?: string;
  region?: string;
  population?: number;
  type?: string;
  [key: string]: unknown;
}

interface Commune {
  code_postal: string;
  code_insee: string;
  nom: string;
  dep_code: string;
  reg_nom: string;
  population: number;
  lat: number;
  lng: number;
}

interface Friche {
  id: string;
  nom: string;
  type: string;
  commune: string;
  dep: string;
  surface: number;
  lat: number;
  lng: number;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Parse communes CSV
function loadCommunes(): Commune[] {
  const content = readFileSync(join(DATA_DIR, 'communes-france-2025.csv'), 'utf-8');
  const lines = content.split('\n');
  const header = lines[0].split(',');
  const idx = {
    code_postal: header.indexOf('code_postal'),
    code_insee: header.indexOf('code_insee'),
    nom: header.indexOf('nom_standard'),
    dep_code: header.indexOf('dep_code'),
    reg_nom: header.indexOf('reg_nom'),
    population: header.indexOf('population'),
    lat: header.indexOf('latitude_centre'),
    lng: header.indexOf('longitude_centre'),
  };

  const communes: Commune[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 10) continue;
    const pop = parseInt(cols[idx.population], 10);
    const lat = parseFloat(cols[idx.lat]);
    const lng = parseFloat(cols[idx.lng]);
    if (isNaN(lat) || isNaN(lng)) continue;
    communes.push({
      code_postal: cols[idx.code_postal],
      code_insee: cols[idx.code_insee],
      nom: cols[idx.nom],
      dep_code: cols[idx.dep_code],
      reg_nom: cols[idx.reg_nom],
      population: isNaN(pop) ? 0 : pop,
      lat, lng,
    });
  }
  return communes;
}

// Parse friches CSV (semicolon separated)
function loadFriches(): Friche[] {
  const content = readFileSync(join(DATA_DIR, 'friches.csv'), 'utf-8');
  const lines = content.split('\n');
  const header = lines[0].split(';').map(h => h.replace(/"/g, ''));

  const idx = {
    id: header.indexOf('site_id'),
    nom: header.indexOf('site_nom'),
    type: header.indexOf('site_type'),
    commune: header.indexOf('comm_nom'),
    insee: header.indexOf('comm_insee'),
    surface: header.indexOf('unite_fonciere_surface'),
    geompoint: header.indexOf('geompoint'),
  };

  const friches: Friche[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(c => c.replace(/"/g, ''));
    if (cols.length < 5) continue;

    const geo = cols[idx.geompoint];
    if (!geo || geo === 'NA') continue;

    // Parse POINT (lng lat)
    const match = geo.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/);
    if (!match) continue;

    const lng = parseFloat(match[1]);
    const lat = parseFloat(match[2]);
    if (isNaN(lat) || isNaN(lng)) continue;

    const surface = parseInt(cols[idx.surface], 10);
    const dep = (cols[idx.insee] || '').substring(0, 2);

    friches.push({
      id: cols[idx.id] || '',
      nom: cols[idx.nom] || 'Friche',
      type: cols[idx.type] || '',
      commune: cols[idx.commune] || '',
      dep,
      surface: isNaN(surface) ? 0 : surface,
      lat, lng,
    });
  }
  return friches;
}

// Estimate court count for clubs that don't report it (e.g. Google)
function estimateCourts(court: Court): number {
  if (court.totalCourts > 0) return court.totalCourts;
  // Average club has 3 courts — reasonable default for Google/unknown sources
  return 3;
}

function main() {
  console.log('Loading data...');
  const merged = JSON.parse(readFileSync(join(DATA_DIR, 'merged.json'), 'utf-8'));
  const padelCourts: Court[] = merged.courts.filter((c: Court) => c.type !== 'tennis');
  const communes = loadCommunes();
  const friches = loadFriches();

  console.log(`Padel courts: ${padelCourts.length}`);
  console.log(`Communes: ${communes.length}`);
  console.log(`Friches: ${friches.length}`);

  // Build spatial grid for padel courts
  const gridSize = 0.2; // ~20km
  const courtGrid = new Map<string, Court[]>();
  for (const c of padelCourts) {
    if (!c.lat || !c.lng) continue;
    const key = `${Math.floor(c.lat / gridSize)},${Math.floor(c.lng / gridSize)}`;
    const arr = courtGrid.get(key) || [];
    arr.push(c);
    courtGrid.set(key, arr);
  }

  function courtsWithinRadius(lat: number, lng: number, radiusKm: number): Court[] {
    const gLat = Math.floor(lat / gridSize);
    const gLng = Math.floor(lng / gridSize);
    const results: Court[] = [];
    const searchRadius = Math.ceil(radiusKm / 20); // grid cells to search
    for (let dLat = -searchRadius; dLat <= searchRadius; dLat++) {
      for (let dLng = -searchRadius; dLng <= searchRadius; dLng++) {
        const key = `${gLat + dLat},${gLng + dLng}`;
        const cells = courtGrid.get(key);
        if (!cells) continue;
        for (const c of cells) {
          if (haversine(lat, lng, c.lat, c.lng) <= radiusKm) {
            results.push(c);
          }
        }
      }
    }
    return results;
  }

  function nearestCourtDistance(lat: number, lng: number): number {
    let minDist = Infinity;
    const gLat = Math.floor(lat / gridSize);
    const gLng = Math.floor(lng / gridSize);
    for (let dLat = -3; dLat <= 3; dLat++) {
      for (let dLng = -3; dLng <= 3; dLng++) {
        const key = `${gLat + dLat},${gLng + dLng}`;
        const cells = courtGrid.get(key);
        if (!cells) continue;
        for (const c of cells) {
          const d = haversine(lat, lng, c.lat, c.lng);
          if (d < minDist) minDist = d;
        }
      }
    }
    return minDist;
  }

  // === DEPARTMENT STATS ===
  console.log('\nBuilding department stats...');
  const depPop = new Map<string, { code: string; name: string; region: string; population: number }>();
  for (const c of communes) {
    if (!c.dep_code) continue;
    const existing = depPop.get(c.dep_code);
    if (existing) {
      existing.population += c.population;
    } else {
      depPop.set(c.dep_code, {
        code: c.dep_code,
        name: '',
        region: c.reg_nom,
        population: c.population,
      });
    }
  }
  // Fill department names from communes
  for (const c of communes) {
    const dep = depPop.get(c.dep_code);
    if (dep && !dep.name) {
      // Find a header row with dep_nom
      const content = readFileSync(join(DATA_DIR, 'communes-france-2025.csv'), 'utf-8');
      const header = content.split('\n')[0].split(',');
      const depNomIdx = header.indexOf('dep_nom');
      for (const line of content.split('\n').slice(1)) {
        const cols = line.split(',');
        if (cols[header.indexOf('dep_code')] === c.dep_code && cols[depNomIdx]) {
          dep.name = cols[depNomIdx];
          break;
        }
      }
      break; // We'll do this differently
    }
  }

  // Rebuild dep names properly
  {
    const content = readFileSync(join(DATA_DIR, 'communes-france-2025.csv'), 'utf-8');
    const lines = content.split('\n');
    const header = lines[0].split(',');
    const depCodeIdx = header.indexOf('dep_code');
    const depNomIdx = header.indexOf('dep_nom');
    const depNames = new Map<string, string>();
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols[depCodeIdx] && !depNames.has(cols[depCodeIdx])) {
        depNames.set(cols[depCodeIdx], cols[depNomIdx]);
      }
    }
    for (const [code, dep] of depPop) {
      dep.name = depNames.get(code) || code;
    }
  }

  // Count courts per department (using estimated counts for clubs without data)
  const depCourts = new Map<string, { clubs: number; courts: number }>();
  for (const c of padelCourts) {
    if (!c.department) continue;
    const existing = depCourts.get(c.department) || { clubs: 0, courts: 0 };
    existing.clubs++;
    existing.courts += estimateCourts(c);
    depCourts.set(c.department, existing);
  }

  // Calculate national average
  let totalNationalCourts = 0;
  let totalNationalPop = 0;
  for (const [, dep] of depPop) {
    totalNationalPop += dep.population;
  }
  for (const [, d] of depCourts) {
    totalNationalCourts += d.courts;
  }
  const avgNational = totalNationalCourts / (totalNationalPop / 100000);
  console.log(`National average: ${avgNational.toFixed(2)} courts per 100k`);

  // Build department list with scores
  const departments: Array<{
    code: string;
    name: string;
    region: string;
    population: number;
    totalClubs: number;
    totalCourts: number;
    courtsPerCapita: number;
    score: number;
  }> = [];

  for (const [code, dep] of depPop) {
    const courts = depCourts.get(code) || { clubs: 0, courts: 0 };
    const ratio = courts.courts / (dep.population / 100000);
    // Score: high when ratio is low (under-served)
    const score = Math.max(0, Math.min(100, Math.round((1 - ratio / (avgNational * 2)) * 100)));

    departments.push({
      code,
      name: dep.name,
      region: dep.region,
      population: dep.population,
      totalClubs: courts.clubs,
      totalCourts: courts.courts,
      courtsPerCapita: parseFloat(ratio.toFixed(2)),
      score,
    });
  }

  departments.sort((a, b) => b.score - a.score);
  console.log(`\nTop 10 opportunity departments:`);
  departments.slice(0, 10).forEach(d =>
    console.log(`  ${d.code} ${d.name} | pop:${(d.population/1000).toFixed(0)}k | courts:${d.totalCourts} | ratio:${d.courtsPerCapita} | score:${d.score}`)
  );

  // === WHITE CITIES ===
  console.log('\nFinding white cities (>15k pop, no padel within 15km)...');
  const whiteCities: Array<{
    name: string;
    population: number;
    department: string;
    region: string;
    lat: number;
    lng: number;
    nearestPadelKm: number;
  }> = [];

  const bigCities = communes.filter(c => c.population >= 15000);
  console.log(`Cities >15k: ${bigCities.length}`);

  for (const city of bigCities) {
    const nearest = nearestCourtDistance(city.lat, city.lng);
    if (nearest > 15) {
      whiteCities.push({
        name: city.nom,
        population: city.population,
        department: city.dep_code,
        region: city.reg_nom,
        lat: city.lat,
        lng: city.lng,
        nearestPadelKm: parseFloat(nearest.toFixed(1)),
      });
    }
  }

  whiteCities.sort((a, b) => b.population - a.population);
  console.log(`White cities found: ${whiteCities.length}`);
  whiteCities.slice(0, 10).forEach(c =>
    console.log(`  ${c.name} | ${(c.population/1000).toFixed(0)}k | nearest: ${c.nearestPadelKm}km`)
  );

  // === FRICHES — pre-compute nearestPadel for all viable friches ===
  // Send all > 400m² in France metro with pre-computed distance. Client filters interactively.
  console.log('\nPre-computing friche distances...');
  const allViableFriches: Array<{
    id: string;
    nom: string;
    type: string;
    commune: string;
    department: string;
    surface: number;
    lat: number;
    lng: number;
    nearestPadelKm: number;
  }> = [];

  for (const f of friches) {
    if (f.surface < 400) continue;
    if (!f.lat || !f.lng || f.lat < 41 || f.lat > 52) continue;

    const nearestPadel = nearestCourtDistance(f.lat, f.lng);

    allViableFriches.push({
      id: f.id,
      nom: f.nom,
      type: f.type,
      commune: f.commune,
      department: f.dep,
      surface: f.surface,
      lat: f.lat,
      lng: f.lng,
      nearestPadelKm: parseFloat(nearestPadel.toFixed(1)),
    });
  }

  allViableFriches.sort((a, b) => b.surface - a.surface);
  console.log(`Viable friches (>400m², France metro): ${allViableFriches.length}`);
  allViableFriches.filter(f => f.nearestPadelKm >= 10).slice(0, 5).forEach(f =>
    console.log(`  ${f.nom} | ${f.commune} (${f.department}) | ${f.surface}m² | padel: ${f.nearestPadelKm}km`)
  );

  // === DEFAULT HEATMAP DATA (computed with defaults, client will recompute) ===
  console.log('\nBuilding default heatmap points...');
  const heatmapPoints: Array<[number, number, number]> = [];
  for (const city of communes) {
    if (city.population < 5000) continue;
    const nearby = courtsWithinRadius(city.lat, city.lng, 20);
    const totalCourts = nearby.reduce((sum, c) => sum + estimateCourts(c), 0);
    const weight = totalCourts === 0
      ? city.population / 10000
      : city.population / (totalCourts * 20000);
    if (weight > 0.1) {
      heatmapPoints.push([city.lat, city.lng, Math.min(weight, 5)]);
    }
  }
  console.log(`Heatmap points: ${heatmapPoints.length}`);

  // === COMMUNES for client-side dynamic analysis ===
  // Send all communes > 2000 pop with trimmed fields
  const communesForClient = communes
    .filter(c => c.population >= 2000)
    .map(c => ({
      n: c.nom,
      p: c.population,
      la: parseFloat(c.lat.toFixed(4)),
      ln: parseFloat(c.lng.toFixed(4)),
      d: c.dep_code,
      r: c.reg_nom,
    }));
  console.log(`\nCommunes for client (pop >= 2k): ${communesForClient.length}`);

  // === WRITE OUTPUT ===
  const output = {
    generatedAt: new Date().toISOString(),
    nationalStats: {
      totalClubs: padelCourts.length,
      totalCourts: totalNationalCourts,
      population: totalNationalPop,
      avgCourtsPerCapita: parseFloat(avgNational.toFixed(2)),
    },
    departments,
    whiteCities,
    friches: allViableFriches,
    heatmapPoints,
    communes: communesForClient,
  };

  writeFileSync(join(DATA_DIR, 'opportunity.json'), JSON.stringify(output));
  console.log(`\nSaved opportunity.json (${(JSON.stringify(output).length / 1024).toFixed(0)}kb)`);
}

main();
