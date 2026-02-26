/**
 * Geographic utilities for France + Belgium + Luxembourg detection
 * Uses precise polygon for mainland + rectangle for Corsica
 */

// France + Belgium + Luxembourg polygon (user-drawn)
export const FRANCE_BELGIUM_POLYGON: [number, number][] = [
  [51.45, 3.14], [50.99, 1.47], [50.18, 1.3], [49.85, 0.15], [49.41, -0.18],
  [49.51, -0.97], [49.84, -1.08], [49.87, -2.15], [49.54, -2.15], [48.84, -1.76],
  [49.05, -3.16], [48.75, -4.9], [47.92, -4.9], [47.64, -4.37], [47.2, -3.38],
  [46.8, -2.7], [46.23, -2.18], [45.66, -1.76], [44.95, -1.71], [44.17, -1.58],
  [43.6, -2], [43.23, -2.18], [42.86, -1.36], [42.55, 0.11], [42.42, 1.25],
  [42.23, 3.47], [42.92, 3.45], [43.31, 4.04], [43.2, 4.75], [43, 5.47],
  [42.88, 6.35], [43.15, 6.92], [43.52, 7.58], [43.85, 8.06], [44.37, 7.73],
  [44.84, 7.32], [45.21, 7.32], [45.63, 7.45], [46.04, 7.49], [46.6, 7.29],
  [46.65, 6.57], [47.01, 6.94], [47.29, 7.49], [47.69, 8.06], [48.3, 8],
  [49.07, 8.48], [49.24, 7.89], [49.44, 7.12], [49.62, 6.69], [49.85, 6.72],
  [50.01, 6.38], [50.18, 6.42], [50.38, 6.68], [50.63, 6.45], [50.81, 6.03],
  [51, 5.97], [51.21, 5.98], [51.39, 5.57], [51.53, 5], [51.58, 4.28], [51.38, 3.85],
];

// Corsica rectangle
export const CORSICA_BOUNDS = {
  minLat: 41.3,
  maxLat: 43.0,
  minLng: 8.5,
  maxLng: 9.6,
};

// Bounding box for grid generation (covers all zones)
export const FRANCE_BELGIUM_BOUNDS = {
  minLat: 41.3,  // Corsica sud
  maxLat: 51.6,  // Belgique nord
  minLng: -5.0,  // Bretagne ouest
  maxLng: 9.6,   // Corsica est
};

// Ray-casting algorithm for point-in-polygon
export function isPointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i][0], xi = polygon[i][1];
    const yj = polygon[j][0], xj = polygon[j][1];
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

export function isPointInCorsica(lat: number, lng: number): boolean {
  return lat >= CORSICA_BOUNDS.minLat && lat <= CORSICA_BOUNDS.maxLat &&
         lng >= CORSICA_BOUNDS.minLng && lng <= CORSICA_BOUNDS.maxLng;
}

export function isPointInMainland(lat: number, lng: number): boolean {
  return isPointInPolygon(lat, lng, FRANCE_BELGIUM_POLYGON);
}

export function isInSearchZone(lat: number, lng: number): boolean {
  return isPointInMainland(lat, lng) || isPointInCorsica(lat, lng);
}

export function getCountryFromCoords(lat: number, lng: number): "FR" | "BE" | "LU" | null {
  if (!isInSearchZone(lat, lng)) return null;

  // Corsica = France
  if (isPointInCorsica(lat, lng)) return "FR";

  // Belgium: roughly lat > 49.5, lng between 2.5 and 6.4
  if (lat >= 49.5 && lat <= 51.6 && lng >= 2.5 && lng <= 6.4) {
    // More precise: check if really in Belgium (north of France)
    if (lat >= 50.0) return "BE";
    // Luxembourg area
    if (lat >= 49.4 && lat <= 50.2 && lng >= 5.7 && lng <= 6.5) return "LU";
  }

  return "FR";
}

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
