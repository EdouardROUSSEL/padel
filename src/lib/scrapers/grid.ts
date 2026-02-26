import { GridPoint } from "@/types";
import { getCountryFromCoords, isInSearchZone, FRANCE_BELGIUM_BOUNDS } from "@/lib/geo";

/**
 * Grid generation for France + Belgium + Luxembourg
 * Uses 40km spacing for good coverage with 30km search radius (20km overlap)
 * Uses precise polygon for mainland + rectangle for Corsica
 */

const STEP_KM = 40; // 40km spacing with 30km radius = 20km overlap = no gaps

/**
 * Generate grid points that fall within France or Belgium
 */
function generateFranceBelgiumGrid(): GridPoint[] {
  const points: GridPoint[] = [];
  const latStep = STEP_KM / 111; // ~0.36 degrees

  const { minLat, maxLat, minLng, maxLng } = FRANCE_BELGIUM_BOUNDS;

  for (let lat = minLat; lat <= maxLat; lat += latStep) {
    // Adjust longitude step for latitude (Earth curvature)
    const lngStep = STEP_KM / (111 * Math.cos((lat * Math.PI) / 180));

    for (let lng = minLng; lng <= maxLng; lng += lngStep) {
      const roundedLat = Math.round(lat * 10000) / 10000;
      const roundedLng = Math.round(lng * 10000) / 10000;

      // Only include points that are in one of the 4 search zones
      if (isInSearchZone(roundedLat, roundedLng)) {
        const country = getCountryFromCoords(roundedLat, roundedLng);
        points.push({
          lat: roundedLat,
          lng: roundedLng,
          name: `${country || "FR"}_${points.length}`,
        });
      }
    }
  }

  return points;
}

/**
 * Generate France-only grid (for TenUp/FFT)
 */
function generateFranceOnlyGrid(): GridPoint[] {
  return generateFranceBelgiumGrid().filter(p => p.name.startsWith("FR_"));
}

/**
 * Generate Belgium-only grid
 */
function generateBelgiumOnlyGrid(): GridPoint[] {
  return generateFranceBelgiumGrid().filter(p => p.name.startsWith("BE_"));
}

// Main grids
export const FRANCE_BELGIUM_GRID = generateFranceBelgiumGrid();
export const FRANCE_GRID = generateFranceOnlyGrid();
export const BELGIUM_GRID = generateBelgiumOnlyGrid();

// Alias for backwards compatibility
export const FULL_GRID = FRANCE_BELGIUM_GRID;

// Main cities for test mode
export const MAIN_CITIES: GridPoint[] = [
  // France
  { lat: 48.8566, lng: 2.3522, name: "Paris" },
  { lat: 43.2965, lng: 5.3698, name: "Marseille" },
  { lat: 45.764, lng: 4.8357, name: "Lyon" },
  { lat: 43.6047, lng: 1.4442, name: "Toulouse" },
  { lat: 44.8378, lng: -0.5792, name: "Bordeaux" },
  { lat: 43.7102, lng: 7.262, name: "Nice" },
  { lat: 50.6292, lng: 3.0573, name: "Lille" },
  { lat: 47.2184, lng: -1.5536, name: "Nantes" },
  { lat: 48.5734, lng: 7.7521, name: "Strasbourg" },
  { lat: 43.6108, lng: 3.8767, name: "Montpellier" },
  // Belgium
  { lat: 50.8503, lng: 4.3517, name: "Bruxelles" },
  { lat: 51.2194, lng: 4.4025, name: "Anvers" },
  { lat: 51.0543, lng: 3.7174, name: "Gand" },
  { lat: 50.6326, lng: 5.5797, name: "Liège" },
  // Luxembourg
  { lat: 49.6117, lng: 6.1319, name: "Luxembourg" },
];

// Stats
export const GRID_STATS = {
  total: FRANCE_BELGIUM_GRID.length,
  france: FRANCE_GRID.length,
  belgium: BELGIUM_GRID.length,
  stepKm: STEP_KM,
  coverage: "France + Belgique + Luxembourg (polygone précis)",
};

// Log stats on module load (for debugging)
console.log(`Grid stats: ${GRID_STATS.total} points (FR: ${GRID_STATS.france}, BE: ${GRID_STATS.belgium})`);
