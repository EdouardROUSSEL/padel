import { useMemo } from "react";
import { PadelCourt } from "@/types";

export interface CommuneData {
  n: string;  // name
  p: number;  // population
  la: number; // lat
  ln: number; // lng
  d: string;  // department code
  r: string;  // region name
}

export interface FricheData {
  id: string;
  nom: string;
  type: string;
  commune: string;
  department: string;
  surface: number;
  lat: number;
  lng: number;
  nearestPadelKm: number;
}

export interface AnalysisParams {
  whiteCityMinPop: number;
  whiteCityMaxDist: number;
  heatmapRadius: number;
  heatmapMinPop: number;
  fricheMinSurface: number;
  fricheMinDistPadel: number;
  defaultCourtsPerClub: number;
}

export const DEFAULT_PARAMS: AnalysisParams = {
  whiteCityMinPop: 15000,
  whiteCityMaxDist: 15,
  heatmapRadius: 20,
  heatmapMinPop: 5000,
  fricheMinSurface: 500,
  fricheMinDistPadel: 10,
  defaultCourtsPerClub: 3,
};

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface CourtGridEntry {
  lat: number;
  lng: number;
  courts: number;
}

export function useOpportunityAnalysis(
  courts: PadelCourt[],
  communes: CommuneData[],
  allFriches: FricheData[],
  params: AnalysisParams
) {
  // Build spatial grid from padel courts (only recomputes when courts change)
  const courtGrid = useMemo(() => {
    const gridSize = 0.2;
    const grid = new Map<string, CourtGridEntry[]>();
    for (const c of courts) {
      if (!c.lat || !c.lng || c.type === "tennis") continue;
      const effectiveCourts = c.totalCourts > 0 ? c.totalCourts : params.defaultCourtsPerClub;
      const key = `${Math.floor(c.lat / gridSize)},${Math.floor(c.lng / gridSize)}`;
      const arr = grid.get(key) || [];
      arr.push({ lat: c.lat, lng: c.lng, courts: effectiveCourts });
      grid.set(key, arr);
    }
    return grid;
  }, [courts, params.defaultCourtsPerClub]);

  // White cities — recomputed when params change
  const whiteCities = useMemo(() => {
    if (!communes.length) return [];
    const gridSize = 0.2;
    const result: Array<{
      name: string;
      population: number;
      department: string;
      region: string;
      lat: number;
      lng: number;
      nearestPadelKm: number;
    }> = [];

    const filtered = communes.filter((c) => c.p >= params.whiteCityMinPop);

    for (const city of filtered) {
      let minDist = Infinity;
      const gLat = Math.floor(city.la / gridSize);
      const gLng = Math.floor(city.ln / gridSize);
      for (let dLat = -3; dLat <= 3; dLat++) {
        for (let dLng = -3; dLng <= 3; dLng++) {
          const key = `${gLat + dLat},${gLng + dLng}`;
          const cells = courtGrid.get(key);
          if (!cells) continue;
          for (const c of cells) {
            const d = haversine(city.la, city.ln, c.lat, c.lng);
            if (d < minDist) minDist = d;
          }
        }
      }

      if (minDist > params.whiteCityMaxDist) {
        result.push({
          name: city.n,
          population: city.p,
          department: city.d,
          region: city.r,
          lat: city.la,
          lng: city.ln,
          nearestPadelKm: parseFloat(minDist.toFixed(1)),
        });
      }
    }

    return result.sort((a, b) => b.population - a.population);
  }, [communes, courtGrid, params.whiteCityMinPop, params.whiteCityMaxDist]);

  // Heatmap points — recomputed when params change
  const heatmapPoints = useMemo(() => {
    if (!communes.length) return [];
    const gridSize = 0.2;
    const points: [number, number, number][] = [];

    for (const city of communes) {
      if (city.p < params.heatmapMinPop) continue;
      // Skip DOM-TOM (no clubs, max-out scale)
      if (city.la < 41 || city.la > 52 || city.ln < -6 || city.ln > 10) continue;

      // Count courts within radius
      const gLat = Math.floor(city.la / gridSize);
      const gLng = Math.floor(city.ln / gridSize);
      const searchRadius = Math.ceil(params.heatmapRadius / 20);
      let totalCourts = 0;

      for (let dLat = -searchRadius; dLat <= searchRadius; dLat++) {
        for (let dLng = -searchRadius; dLng <= searchRadius; dLng++) {
          const key = `${gLat + dLat},${gLng + dLng}`;
          const cells = courtGrid.get(key);
          if (!cells) continue;
          for (const c of cells) {
            if (haversine(city.la, city.ln, c.lat, c.lng) <= params.heatmapRadius) {
              totalCourts += c.courts;
            }
          }
        }
      }

      const weight =
        totalCourts === 0
          ? city.p / 10000
          : city.p / (totalCourts * 20000);
      if (weight > 0.25) {
        points.push([city.la, city.ln, Math.min(weight, 5)]);
      }
    }

    return points;
  }, [communes, courtGrid, params.heatmapMinPop, params.heatmapRadius]);

  // Filtered friches — simple client-side filter on pre-computed data
  const filteredFriches = useMemo(() => {
    return allFriches
      .filter(
        (f) =>
          f.surface >= params.fricheMinSurface &&
          f.nearestPadelKm >= params.fricheMinDistPadel
      )
      .sort((a, b) => b.surface - a.surface);
  }, [allFriches, params.fricheMinSurface, params.fricheMinDistPadel]);

  return { whiteCities, heatmapPoints, filteredFriches };
}
