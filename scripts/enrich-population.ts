import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');

interface Commune {
  code_postal: string;
  code_insee: string;
  nom: string;
  dep_code: string;
  dep_nom: string;
  reg_nom: string;
  population: number;
  lat: number;
  lng: number;
}

function parseCSV(content: string): Commune[] {
  const lines = content.split('\n');
  const header = lines[0].split(',');

  const idx = {
    code_postal: header.indexOf('code_postal'),
    code_insee: header.indexOf('code_insee'),
    nom: header.indexOf('nom_standard'),
    dep_code: header.indexOf('dep_code'),
    dep_nom: header.indexOf('dep_nom'),
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
      dep_nom: cols[idx.dep_nom],
      reg_nom: cols[idx.reg_nom],
      population: isNaN(pop) ? 0 : pop,
      lat,
      lng,
    });
  }
  return communes;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function main() {
  console.log('Loading communes...');
  const csvContent = readFileSync(join(DATA_DIR, 'communes-france-2025.csv'), 'utf-8');
  const communes = parseCSV(csvContent);
  console.log(`Loaded ${communes.length} communes`);

  // Build postal code index
  const byPostal = new Map<string, Commune[]>();
  for (const c of communes) {
    const existing = byPostal.get(c.code_postal) || [];
    existing.push(c);
    byPostal.set(c.code_postal, existing);
  }

  // Build spatial grid for nearest-commune lookup
  const gridSize = 0.1; // ~10km grid cells
  const grid = new Map<string, Commune[]>();
  for (const c of communes) {
    const key = `${Math.floor(c.lat / gridSize)},${Math.floor(c.lng / gridSize)}`;
    const existing = grid.get(key) || [];
    existing.push(c);
    grid.set(key, existing);
  }

  function findNearest(lat: number, lng: number): Commune | null {
    const gLat = Math.floor(lat / gridSize);
    const gLng = Math.floor(lng / gridSize);
    let best: Commune | null = null;
    let bestDist = Infinity;

    for (let dLat = -2; dLat <= 2; dLat++) {
      for (let dLng = -2; dLng <= 2; dLng++) {
        const key = `${gLat + dLat},${gLng + dLng}`;
        const cells = grid.get(key);
        if (!cells) continue;
        for (const c of cells) {
          const d = haversine(lat, lng, c.lat, c.lng);
          if (d < bestDist) {
            bestDist = d;
            best = c;
          }
        }
      }
    }
    return best;
  }

  // Load merged data
  console.log('Loading merged.json...');
  const merged = JSON.parse(readFileSync(join(DATA_DIR, 'merged.json'), 'utf-8'));
  let matched = 0;
  let byPostalMatch = 0;
  let byGeoMatch = 0;

  for (const court of merged.courts) {
    // Try postal code match first
    const postalCandidates = byPostal.get(court.postalCode);
    if (postalCandidates && postalCandidates.length > 0) {
      // If multiple communes share the postal code, pick closest
      let best = postalCandidates[0];
      if (postalCandidates.length > 1 && court.lat && court.lng) {
        let bestDist = Infinity;
        for (const c of postalCandidates) {
          const d = haversine(court.lat, court.lng, c.lat, c.lng);
          if (d < bestDist) {
            bestDist = d;
            best = c;
          }
        }
      }
      court.department = best.dep_code;
      court.region = best.reg_nom;
      court.population = best.population;
      matched++;
      byPostalMatch++;
      continue;
    }

    // Fallback to nearest by coordinates
    if (court.lat && court.lng) {
      const nearest = findNearest(court.lat, court.lng);
      if (nearest) {
        court.department = nearest.dep_code;
        court.region = nearest.reg_nom;
        court.population = nearest.population;
        matched++;
        byGeoMatch++;
      }
    }
  }

  console.log(`\nEnriched ${matched}/${merged.courts.length} courts`);
  console.log(`  By postal code: ${byPostalMatch}`);
  console.log(`  By geo proximity: ${byGeoMatch}`);
  console.log(`  Unmatched: ${merged.courts.length - matched}`);

  // Save
  writeFileSync(join(DATA_DIR, 'merged.json'), JSON.stringify(merged, null, 2));
  console.log('\nSaved enriched merged.json');
}

main();
