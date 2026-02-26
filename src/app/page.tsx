"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { PadelCourt } from "@/types";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
        <span className="text-sm text-zinc-500">Chargement de la carte...</span>
      </div>
    </div>
  ),
});

interface CourtsResponse {
  courts: PadelCourt[];
  total: number;
  sources: Record<string, { scrapedAt: string; count: number }>;
  message?: string;
}

const ALL_SOURCES = ["osm", "playtomic", "google", "tenup", "padelmagazine"] as const;
type SourceType = typeof ALL_SOURCES[number];

export default function Home() {
  const [courts, setCourts] = useState<PadelCourt[]>([]);
  const [sources, setSources] = useState<CourtsResponse["sources"]>({});
  const [loading, setLoading] = useState(true);
  const [selectedCourt, setSelectedCourt] = useState<PadelCourt | null>(null);
  const [activeSources, setActiveSources] = useState<Set<SourceType>>(new Set(ALL_SOURCES));
  const [showFilters, setShowFilters] = useState(false);

  const toggleSource = (source: SourceType) => {
    setActiveSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  };

  const filteredCourts = useMemo(() => {
    if (activeSources.size === ALL_SOURCES.length) return courts;
    return courts.filter(court =>
      court.source.some(s => activeSources.has(s as SourceType))
    );
  }, [courts, activeSources]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch("/api/courts");
        const data: CourtsResponse = await res.json();
        setCourts(data.courts || []);
        setSources(data.sources || {});
      } catch (err) {
        console.error("Erreur chargement:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
          <p className="text-zinc-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-50">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-zinc-200/80">
        <div className="px-3 sm:px-5 h-12 sm:h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-900 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16z" opacity="0.3" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm sm:text-[15px] font-semibold text-zinc-900 leading-tight">Padel Map</h1>
              <p className="text-[10px] sm:text-[11px] text-zinc-400 leading-tight">France & Belgique</p>
            </div>
          </div>

          {/* Filter button on mobile, sources on desktop */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile filter button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 text-xs font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtres
              {activeSources.size < ALL_SOURCES.length && (
                <span className="bg-blue-500 text-white text-[10px] px-1.5 rounded-full">{activeSources.size}</span>
              )}
            </button>

            {/* Desktop sources */}
            <div className="hidden md:flex items-center gap-3">
              <SourceToggle
                name="osm"
                count={sources.osm?.count || 0}
                color="bg-green-500"
                active={activeSources.has("osm")}
                onClick={() => toggleSource("osm")}
              />
              <SourceToggle
                name="playtomic"
                count={sources.playtomic?.count || 0}
                color="bg-blue-500"
                active={activeSources.has("playtomic")}
                onClick={() => toggleSource("playtomic")}
              />
              <SourceToggle
                name="google"
                count={sources.google?.count || 0}
                color="bg-amber-500"
                active={activeSources.has("google")}
                onClick={() => toggleSource("google")}
              />
              <SourceToggle
                name="tenup"
                count={sources.tenup?.count || 0}
                color="bg-violet-500"
                active={activeSources.has("tenup")}
                onClick={() => toggleSource("tenup")}
              />
              <SourceToggle
                name="padelmagazine"
                count={sources.padelmagazine?.count || 0}
                color="bg-rose-500"
                active={activeSources.has("padelmagazine")}
                onClick={() => toggleSource("padelmagazine")}
              />
            </div>
            <div className="text-right pl-2 sm:pl-4 border-l border-zinc-200">
              <div className="text-base sm:text-lg font-semibold text-zinc-900 tabular-nums">
                {filteredCourts.length.toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-[11px] text-zinc-400">clubs</div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile filter panel */}
      {showFilters && (
        <div className="md:hidden bg-white border-b border-zinc-200 px-3 py-3">
          <div className="flex flex-wrap gap-2">
            <SourceToggle
              name="OSM"
              count={sources.osm?.count || 0}
              color="bg-green-500"
              active={activeSources.has("osm")}
              onClick={() => toggleSource("osm")}
              showLabel
            />
            <SourceToggle
              name="Playtomic"
              count={sources.playtomic?.count || 0}
              color="bg-blue-500"
              active={activeSources.has("playtomic")}
              onClick={() => toggleSource("playtomic")}
              showLabel
            />
            <SourceToggle
              name="Google"
              count={sources.google?.count || 0}
              color="bg-amber-500"
              active={activeSources.has("google")}
              onClick={() => toggleSource("google")}
              showLabel
            />
            <SourceToggle
              name="Ten'Up"
              count={sources.tenup?.count || 0}
              color="bg-violet-500"
              active={activeSources.has("tenup")}
              onClick={() => toggleSource("tenup")}
              showLabel
            />
            <SourceToggle
              name="PadelMag"
              count={sources.padelmagazine?.count || 0}
              color="bg-rose-500"
              active={activeSources.has("padelmagazine")}
              onClick={() => toggleSource("padelmagazine")}
              showLabel
            />
          </div>
        </div>
      )}

      {/* Map */}
      <main className="flex-1 overflow-hidden">
        <Map
          courts={filteredCourts}
          selectedCourt={selectedCourt}
          onSelectCourt={setSelectedCourt}
        />
      </main>
    </div>
  );
}

function SourceToggle({
  name,
  count,
  color,
  active,
  onClick,
  showLabel = false,
}: {
  name: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
  showLabel?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all ${
        active
          ? "bg-zinc-100 text-zinc-800"
          : "bg-zinc-50 text-zinc-400 opacity-60"
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${color} ${!active && "opacity-40"}`} />
      <span className="tabular-nums">{count}</span>
      <span className={showLabel ? "" : "hidden sm:inline"}>{name}</span>
    </button>
  );
}
