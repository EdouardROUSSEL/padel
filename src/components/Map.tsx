"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { PadelCourt } from "@/types";

// Source colors
const sourceColors: Record<string, string> = {
  playtomic: "#0066FF",
  osm: "#16A34A",
  google: "#F59E0B",
  tenup: "#8B5CF6",
  padelmagazine: "#F43F5E",
  anybuddy: "#EC4899",
  "fft-padel": "#14B8A6",
  "fft-tennis": "#F97316",
  multiple: "#18181B",
};

const getMarkerColor = (court: PadelCourt): string => {
  if (court.source.length > 1) return sourceColors.multiple;
  return sourceColors[court.source[0]] || "#71717A";
};

const getMarkerSize = (court: PadelCourt): number => {
  if (court.totalCourts >= 8) return 9;
  if (court.totalCourts >= 4) return 7;
  if (court.totalCourts >= 2) return 6;
  return 5;
};

const MAP_TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

export interface WhiteCity {
  name: string;
  population: number;
  department: string;
  region: string;
  lat: number;
  lng: number;
  nearestPadelKm: number;
}

export interface FrichePoint {
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

interface MapProps {
  courts: PadelCourt[];
  selectedCourt?: PadelCourt | null;
  onSelectCourt?: (court: PadelCourt) => void;
  whiteCities?: WhiteCity[];
  friches?: FrichePoint[];
  heatmapPoints?: [number, number, number][];
  showCourts?: boolean;
  showWhiteCities?: boolean;
  showFriches?: boolean;
  showHeatmap?: boolean;
}

export default function Map({
  courts,
  selectedCourt,
  onSelectCourt,
  whiteCities = [],
  friches = [],
  heatmapPoints = [],
  showCourts = true,
  showWhiteCities = false,
  showFriches = false,
  showHeatmap = false,
}: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const whiteCityLayerRef = useRef<L.LayerGroup | null>(null);
  const frichesLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
      preferCanvas: true,
    }).setView([46.6, 2.5], 6);

    L.control.zoom({ position: "topright" }).addTo(mapRef.current);

    L.tileLayer(MAP_TILE_URL, {
      attribution: MAP_ATTRIBUTION,
      maxZoom: 18,
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Build popup HTML
  const buildPopup = useCallback((court: PadelCourt) => {
    const sourceDots = court.source
      .map((s) => {
        const color = sourceColors[s] || "#71717A";
        return `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color}"></span>`;
      })
      .join("");

    const courtsSection = court.totalCourts > 0
      ? `<div style="display:flex;gap:8px;align-items:baseline;margin-top:6px">
          <span style="font-size:20px;font-weight:700;color:#18181B;line-height:1">${court.totalCourts}</span>
          <span style="font-size:10px;color:#A1A1AA;text-transform:uppercase;letter-spacing:0.5px">${court.type === "tennis" ? "tennis" : "padel"}</span>
          ${court.indoorCourts > 0 ? `<span style="font-size:11px;color:#71717A">${court.indoorCourts} in</span>` : ""}
          ${court.outdoorCourts > 0 ? `<span style="font-size:11px;color:#71717A">${court.outdoorCourts} out</span>` : ""}
        </div>`
      : "";

    const deptInfo = court.department
      ? `<div style="font-size:10px;color:#A1A1AA;margin-top:2px">${court.department} · ${court.population ? (court.population / 1000).toFixed(0) + "k hab." : ""}</div>`
      : "";

    return `<div style="padding:12px 14px;min-width:180px;max-width:260px">
      <div style="font-weight:600;font-size:13px;color:#18181B;line-height:1.3">${court.name}</div>
      <div style="font-size:11px;color:#71717A;margin-top:2px">${court.city}${court.postalCode ? " " + court.postalCode : ""}</div>
      ${deptInfo}
      ${courtsSection}
      <div style="display:flex;gap:3px;margin-top:8px;padding-top:8px;border-top:1px solid #F4F4F5">
        ${sourceDots}
      </div>
    </div>`;
  }, []);

  // Update court markers
  useEffect(() => {
    if (!mapRef.current) return;

    if (clusterGroupRef.current) {
      mapRef.current.removeLayer(clusterGroupRef.current);
      clusterGroupRef.current = null;
    }

    if (!showCourts) return;

    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      animate: true,
      animateAddingMarkers: false,
      disableClusteringAtZoom: 13,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let size = "small";
        if (count > 50) size = "large";
        else if (count > 20) size = "medium";
        return L.divIcon({
          html: `<div>${count}</div>`,
          className: `marker-cluster marker-cluster-${size}`,
          iconSize: L.point(40, 40),
        });
      },
    });

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
      marker.bindPopup(buildPopup(court), {
        closeButton: false,
        offset: L.point(0, -4),
      });
      marker.on("click", () => onSelectCourt?.(court));
      clusterGroup.addLayer(marker);
    });

    mapRef.current.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;
  }, [courts, showCourts, onSelectCourt, buildPopup]);

  // White cities layer
  useEffect(() => {
    if (!mapRef.current) return;
    if (whiteCityLayerRef.current) {
      mapRef.current.removeLayer(whiteCityLayerRef.current);
      whiteCityLayerRef.current = null;
    }
    if (!showWhiteCities || whiteCities.length === 0) return;

    const group = L.layerGroup();
    whiteCities.forEach((city) => {
      if (!city.lat || !city.lng || !isFinite(city.nearestPadelKm)) return;
      const radius = Math.max(10000, Math.min(30000, city.population * 0.4));

      // Outer glow ring
      const glow = L.circle([city.lat, city.lng], {
        radius: radius * 1.3,
        color: "transparent",
        weight: 0,
        fillColor: "#EF4444",
        fillOpacity: 0.06,
        interactive: false,
      });
      group.addLayer(glow);

      // Main circle
      const circle = L.circle([city.lat, city.lng], {
        radius,
        color: "#DC2626",
        weight: 2,
        fillColor: "#EF4444",
        fillOpacity: 0.2,
        dashArray: "8 5",
      });

      // Center marker dot
      const center = L.circleMarker([city.lat, city.lng], {
        radius: 5,
        fillColor: "#DC2626",
        color: "#FFFFFF",
        weight: 2,
        fillOpacity: 1,
      });

      const tooltipContent = `<div style="padding:4px 2px">
        <div style="font-weight:700;font-size:13px;color:#DC2626">${city.name}</div>
        <div style="font-size:11px;color:#71717A;margin-top:2px">${(city.population / 1000).toFixed(0)}k hab. — Dept. ${city.department}</div>
        <div style="font-size:12px;font-weight:600;color:#18181B;margin-top:4px">Padel le + proche : ${city.nearestPadelKm} km</div>
      </div>`;

      circle.bindTooltip(tooltipContent, { direction: "top", offset: L.point(0, -10) });
      center.bindTooltip(tooltipContent, { direction: "top", offset: L.point(0, -8) });

      group.addLayer(circle);
      group.addLayer(center);
    });
    group.addTo(mapRef.current);
    whiteCityLayerRef.current = group;
  }, [showWhiteCities, whiteCities]);

  // Friches layer
  useEffect(() => {
    if (!mapRef.current) return;
    if (frichesLayerRef.current) {
      mapRef.current.removeLayer(frichesLayerRef.current);
      frichesLayerRef.current = null;
    }
    if (!showFriches || friches.length === 0) return;

    const group = L.layerGroup();
    const limited = friches.slice(0, 800);
    limited.forEach((f) => {
      if (!f.lat || !f.lng) return;
      const size = Math.max(5, Math.min(14, Math.sqrt(f.surface) / 60));

      // Outer glow
      const glow = L.circleMarker([f.lat, f.lng], {
        radius: size + 4,
        fillColor: "#F59E0B",
        color: "transparent",
        weight: 0,
        fillOpacity: 0.2,
        interactive: false,
      });
      group.addLayer(glow);

      // Main marker — diamond shaped via DivIcon for big friches, circle for small
      const marker = L.circleMarker([f.lat, f.lng], {
        radius: size,
        fillColor: "#F59E0B",
        color: "#FFFFFF",
        weight: 2,
        fillOpacity: 0.85,
      });
      marker.bindTooltip(
        `<div style="padding:4px 2px">
          <div style="font-weight:700;font-size:13px;color:#D97706">${f.nom}</div>
          <div style="font-size:11px;color:#71717A;margin-top:2px">${f.commune} (${f.department})</div>
          <div style="font-size:12px;font-weight:600;color:#18181B;margin-top:4px">${f.surface.toLocaleString()} m² — padel : ${f.nearestPadelKm} km</div>
        </div>`,
        { direction: "top", offset: L.point(0, -6) }
      );
      group.addLayer(marker);
    });
    group.addTo(mapRef.current);
    frichesLayerRef.current = group;
  }, [showFriches, friches]);

  // Heatmap layer
  useEffect(() => {
    if (!mapRef.current) return;
    if (heatLayerRef.current) {
      mapRef.current.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    if (!showHeatmap || heatmapPoints.length === 0) return;

    // Dynamic import for leaflet.heat (no types)
    import("leaflet.heat").then(() => {
      if (!mapRef.current) return;
      // @ts-expect-error leaflet.heat extends L
      const heat = L.heatLayer(heatmapPoints, {
        radius: 40,
        blur: 15,
        maxZoom: 12,
        max: 2.5,
        minOpacity: 0.35,
        gradient: {
          0.0: "transparent",
          0.15: "#22c55e80",
          0.3: "#22c55e",
          0.45: "#eab308",
          0.6: "#f97316",
          0.75: "#ef4444",
          0.9: "#dc2626",
          1.0: "#991b1b",
        },
      });
      heat.addTo(mapRef.current);
      heatLayerRef.current = heat;
    });
  }, [showHeatmap, heatmapPoints]);

  // Handle selected court
  useEffect(() => {
    if (!mapRef.current || !selectedCourt) return;
    mapRef.current.flyTo([selectedCourt.lat, selectedCourt.lng], 14, {
      duration: 0.8,
    });
  }, [selectedCourt]);

  return <div ref={mapContainerRef} className="w-full h-full" />;
}
