"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PadelCourt } from "@/types";

// Corsica rectangle
const CORSICA_BOUNDS = {
  minLat: 41.3,
  maxLat: 43.0,
  minLng: 8.5,
  maxLng: 9.6,
};

// France + Belgium + Luxembourg polygon (user-drawn)
const FRANCE_BELGIUM_POLYGON: [number, number][] = [
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

interface MapProps {
  courts: PadelCourt[];
  selectedCourt?: PadelCourt | null;
  onSelectCourt?: (court: PadelCourt) => void;
}

// Source colors matching the design system
const sourceColors = {
  playtomic: "#0066FF",
  osm: "#16A34A",
  google: "#F59E0B",
  tenup: "#8B5CF6",
  padelmagazine: "#F43F5E",
  multiple: "#18181B",
};

const getMarkerColor = (court: PadelCourt): string => {
  if (court.source.length > 1) return sourceColors.multiple;
  if (court.source.includes("playtomic")) return sourceColors.playtomic;
  if (court.source.includes("osm")) return sourceColors.osm;
  if (court.source.includes("google")) return sourceColors.google;
  if (court.source.includes("tenup")) return sourceColors.tenup;
  if (court.source.includes("padelmagazine")) return sourceColors.padelmagazine;
  return "#71717A";
};

const getMarkerSize = (court: PadelCourt): number => {
  if (court.totalCourts >= 8) return 10;
  if (court.totalCourts >= 4) return 8;
  if (court.totalCourts >= 2) return 6;
  return 5;
};

// Clean map style (Carto Positron)
const MAP_TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

// Generate grid points for visualization (same logic as grid.ts)
const STEP_KM = 40; // 40km spacing with 30km radius = 20km overlap = no gaps
const SEARCH_RADIUS_KM = 30;

// Ray-casting algorithm for point-in-polygon
function isPointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
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

function isInZone(lat: number, lng: number): boolean {
  // Check main France+Belgium polygon
  if (isPointInPolygon(lat, lng, FRANCE_BELGIUM_POLYGON)) return true;
  // Check Corsica rectangle
  if (lat >= CORSICA_BOUNDS.minLat && lat <= CORSICA_BOUNDS.maxLat &&
      lng >= CORSICA_BOUNDS.minLng && lng <= CORSICA_BOUNDS.maxLng) return true;
  return false;
}

function generateGridPoints(): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  const latStep = STEP_KM / 111;

  // Combined bounds (covers all zones)
  const bounds = {
    minLat: 41.3,
    maxLat: 51.5,
    minLng: -5.0,
    maxLng: 9.6,
  };

  for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += latStep) {
    const lngStep = STEP_KM / (111 * Math.cos((lat * Math.PI) / 180));

    for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += lngStep) {
      const roundedLat = Math.round(lat * 10000) / 10000;
      const roundedLng = Math.round(lng * 10000) / 10000;

      if (isInZone(roundedLat, roundedLng)) {
        points.push({ lat: roundedLat, lng: roundedLng });
      }
    }
  }

  return points;
}

const GRID_POINTS = generateGridPoints();

export default function Map({ courts, selectedCourt, onSelectCourt }: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const polygonsRef = useRef<L.Polygon[]>([]);
  const gridCirclesRef = useRef<L.Circle[]>([]);
  const [showPolygons, setShowPolygons] = useState(true);
  const [showGrid, setShowGrid] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
    }).setView([46.6, 2.5], 6);

    // Add zoom control to top-right
    L.control.zoom({ position: "topright" }).addTo(mapRef.current);

    // Clean tile layer
    L.tileLayer(MAP_TILE_URL, {
      attribution: MAP_ATTRIBUTION,
      maxZoom: 18,
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw search zone polygons
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing shapes
    polygonsRef.current.forEach((p) => p.remove());
    polygonsRef.current = [];

    if (showPolygons) {
      const style = { color: "#0066FF", weight: 2, fillColor: "#0066FF", fillOpacity: 0.05 };

      // France + Belgium + Luxembourg polygon
      const mainPolygon = L.polygon(FRANCE_BELGIUM_POLYGON, style).addTo(mapRef.current);
      polygonsRef.current.push(mainPolygon);

      // Corsica rectangle
      const corsicaRect = L.rectangle(
        [[CORSICA_BOUNDS.minLat, CORSICA_BOUNDS.minLng], [CORSICA_BOUNDS.maxLat, CORSICA_BOUNDS.maxLng]],
        style
      ).addTo(mapRef.current);
      polygonsRef.current.push(corsicaRect as unknown as L.Polygon);
    }
  }, [showPolygons]);

  // Draw grid circles (30km radius)
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing grid circles
    gridCirclesRef.current.forEach((c) => c.remove());
    gridCirclesRef.current = [];

    if (showGrid) {
      GRID_POINTS.forEach((point) => {
        const circle = L.circle([point.lat, point.lng], {
          radius: SEARCH_RADIUS_KM * 1000, // Convert km to meters
          color: "#10B981",
          weight: 1,
          fillColor: "#10B981",
          fillOpacity: 0.08,
        }).addTo(mapRef.current!);
        gridCirclesRef.current.push(circle);
      });
    }
  }, [showGrid]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add markers
    courts.forEach((court) => {
      if (!court.lat || !court.lng) return;

      const marker = L.circleMarker([court.lat, court.lng], {
        radius: getMarkerSize(court),
        fillColor: getMarkerColor(court),
        color: "#FFFFFF",
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.85,
      });

      // Clean popup
      const sourceBadges = court.source
        .map((s) => {
          const colors: Record<string, string> = {
            playtomic: "background:#0066FF",
            osm: "background:#16A34A",
            google: "background:#F59E0B",
            tenup: "background:#8B5CF6",
          };
          return `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;${colors[s] || "background:#71717A"};margin-right:4px"></span>${s}`;
        })
        .join('<span style="margin:0 4px;color:#D4D4D8">·</span>');

      const popupContent = `
        <div style="font-family:var(--font-sans),system-ui,sans-serif;min-width:200px">
          <div style="font-weight:600;font-size:14px;color:#18181B;margin-bottom:4px;line-height:1.3">${court.name}</div>
          <div style="font-size:12px;color:#71717A;margin-bottom:10px">
            ${court.address ? court.address + ", " : ""}${court.city}${court.postalCode ? " " + court.postalCode : ""}
          </div>
          ${court.totalCourts > 0 ? `
            <div style="display:flex;gap:12px;padding:8px 0;border-top:1px solid #F4F4F5;border-bottom:1px solid #F4F4F5;margin-bottom:8px">
              <div>
                <div style="font-size:18px;font-weight:600;color:#18181B">${court.totalCourts}</div>
                <div style="font-size:10px;color:#A1A1AA;text-transform:uppercase;letter-spacing:0.5px">terrains</div>
              </div>
              ${court.indoorCourts > 0 ? `
                <div>
                  <div style="font-size:18px;font-weight:600;color:#18181B">${court.indoorCourts}</div>
                  <div style="font-size:10px;color:#A1A1AA;text-transform:uppercase;letter-spacing:0.5px">indoor</div>
                </div>
              ` : ""}
              ${court.outdoorCourts > 0 ? `
                <div>
                  <div style="font-size:18px;font-weight:600;color:#18181B">${court.outdoorCourts}</div>
                  <div style="font-size:10px;color:#A1A1AA;text-transform:uppercase;letter-spacing:0.5px">outdoor</div>
                </div>
              ` : ""}
            </div>
          ` : ""}
          <div style="font-size:11px;color:#A1A1AA;display:flex;align-items:center">
            ${sourceBadges}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        closeButton: false,
        className: "clean-popup",
      });
      marker.on("click", () => onSelectCourt?.(court));
      marker.addTo(mapRef.current!);
      markersRef.current.push(marker);
    });
  }, [courts, onSelectCourt]);

  useEffect(() => {
    if (!mapRef.current || !selectedCourt) return;
    mapRef.current.setView([selectedCourt.lat, selectedCourt.lng], 14);
  }, [selectedCourt]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-5 left-5 bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-zinc-100 z-[1000]">
        <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-3">Sources</div>
        <div className="space-y-2">
          <LegendItem color={sourceColors.playtomic} label="Playtomic" />
          <LegendItem color={sourceColors.osm} label="OpenStreetMap" />
          <LegendItem color={sourceColors.google} label="Google" />
          <LegendItem color={sourceColors.tenup} label="Ten'Up (FFT)" />
          <LegendItem color={sourceColors.padelmagazine} label="PadelMagazine" />
          <LegendItem color={sourceColors.multiple} label="Multi-sources" />
        </div>
      </div>

      {/* Court count */}
      <div className="absolute top-5 left-5 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border border-zinc-100 z-[1000]">
        <span className="text-lg font-semibold text-zinc-900 tabular-nums">{courts.length.toLocaleString()}</span>
        <span className="text-sm text-zinc-500 ml-1.5">clubs visibles</span>
      </div>

      {/* Toggle buttons */}
      <div className="absolute top-5 right-20 flex gap-2 z-[1000]">
        <button
          onClick={() => setShowPolygons(!showPolygons)}
          className={`px-3 py-2 text-sm font-medium rounded-lg shadow-md border border-zinc-100 transition-colors ${
            showPolygons
              ? "bg-blue-500 text-white"
              : "bg-white/95 text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {showPolygons ? "Masquer zones" : "Zones"}
        </button>
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`px-3 py-2 text-sm font-medium rounded-lg shadow-md border border-zinc-100 transition-colors ${
            showGrid
              ? "bg-emerald-500 text-white"
              : "bg-white/95 text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {showGrid ? `Masquer grille (${GRID_POINTS.length})` : `Grille (${GRID_POINTS.length})`}
        </button>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-zinc-600">{label}</span>
    </div>
  );
}
