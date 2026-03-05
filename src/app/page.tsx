"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { PadelCourt } from "@/types";
import Sidebar from "@/components/Sidebar";
import {
  CommuneData,
  FricheData,
  AnalysisParams,
  DEFAULT_PARAMS,
  useOpportunityAnalysis,
} from "@/hooks/useOpportunityAnalysis";
import { WhiteCity } from "@/components/Map";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
        <span className="text-sm text-zinc-500">Chargement...</span>
      </div>
    </div>
  ),
});

const StatsPanel = dynamic(() => import("@/components/StatsPanel"), {
  ssr: false,
});

interface OpportunityRaw {
  nationalStats: {
    totalClubs: number;
    totalCourts: number;
    population: number;
    avgCourtsPerCapita: number;
  };
  departments: Array<{
    code: string;
    name: string;
    region: string;
    population: number;
    totalClubs: number;
    totalCourts: number;
    courtsPerCapita: number;
    score: number;
  }>;
  whiteCities: WhiteCity[];
  friches: FricheData[];
  heatmapPoints: [number, number, number][];
  communes: CommuneData[];
}

interface CourtsResponse {
  courts: PadelCourt[];
  total: number;
  sources: Record<string, { count: number }>;
  counts: { padel: number; tennis: number };
  opportunity: OpportunityRaw | null;
}

const ALL_SOURCES = ["osm", "playtomic", "google", "tenup", "padelmagazine", "anybuddy", "fft-padel", "fft-tennis"] as const;
type SourceType = (typeof ALL_SOURCES)[number];
type CourtType = "padel" | "tennis";

export default function Home() {
  const [courts, setCourts] = useState<PadelCourt[]>([]);
  const [sources, setSources] = useState<CourtsResponse["sources"]>({});
  const [opportunityRaw, setOpportunityRaw] = useState<OpportunityRaw | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCourt, setSelectedCourt] = useState<PadelCourt | null>(null);
  const [activeSources, setActiveSources] = useState<Set<SourceType>>(new Set(ALL_SOURCES));
  const [activeTypes, setActiveTypes] = useState<Set<CourtType>>(new Set(["padel"]));
  const [showStatsPanel, setShowStatsPanel] = useState(false);

  // Layer toggles
  const [showCourts, setShowCourts] = useState(true);
  const [showWhiteCities, setShowWhiteCities] = useState(false);
  const [showFriches, setShowFriches] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Analysis params — user-adjustable
  const [analysisParams, setAnalysisParams] = useState<AnalysisParams>(DEFAULT_PARAMS);

  const changeParams = useCallback((partial: Partial<AnalysisParams>) => {
    setAnalysisParams((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetParams = useCallback(() => {
    setAnalysisParams(DEFAULT_PARAMS);
  }, []);

  const isDefaultParams = useMemo(() => {
    return JSON.stringify(analysisParams) === JSON.stringify(DEFAULT_PARAMS);
  }, [analysisParams]);

  const toggleSource = (source: SourceType) => {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  };

  const toggleType = (type: CourtType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const toggleCourts = useCallback(() => setShowCourts((v) => !v), []);
  const toggleWhiteCities = useCallback(() => setShowWhiteCities((v) => !v), []);
  const toggleFriches = useCallback(() => setShowFriches((v) => !v), []);
  const toggleHeatmap = useCallback(() => setShowHeatmap((v) => !v), []);

  const filteredCourts = useMemo(() => {
    return courts.filter((court) => {
      if (!activeTypes.has(court.type || "padel")) return false;
      return court.source.some((s) => activeSources.has(s as SourceType));
    });
  }, [courts, activeSources, activeTypes]);

  // Client-side dynamic analysis
  const communes = useMemo(() => opportunityRaw?.communes || [], [opportunityRaw]);
  const allFriches = useMemo(() => opportunityRaw?.friches || [], [opportunityRaw]);

  // Only run dynamic computation when user has changed params from defaults
  // Otherwise use pre-computed data from server
  const dynamicAnalysis = useOpportunityAnalysis(
    courts,
    communes,
    allFriches,
    analysisParams
  );

  // Use dynamic results when params differ from defaults, otherwise use server pre-computed
  const activeWhiteCities = isDefaultParams
    ? (opportunityRaw?.whiteCities || [])
    : dynamicAnalysis.whiteCities;

  const activeHeatmapPoints = isDefaultParams
    ? (opportunityRaw?.heatmapPoints || [])
    : dynamicAnalysis.heatmapPoints;

  const activeFriches = isDefaultParams
    ? allFriches.filter((f) => f.surface >= DEFAULT_PARAMS.fricheMinSurface && f.nearestPadelKm >= DEFAULT_PARAMS.fricheMinDistPadel)
    : dynamicAnalysis.filteredFriches;

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch("/api/courts");
        const data: CourtsResponse = await res.json();
        setCourts(data.courts || []);
        setSources(data.sources || {});
        setOpportunityRaw(data.opportunity || null);
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
          <p className="text-sm text-zinc-500">Chargement...</p>
        </div>
      </div>
    );
  }

  // Build stats panel data from current analysis state
  const statsPanelData = opportunityRaw
    ? {
        ...opportunityRaw,
        whiteCities: activeWhiteCities,
        friches: activeFriches,
        heatmapPoints: activeHeatmapPoints,
      }
    : null;

  return (
    <div className="h-screen flex flex-col bg-zinc-50">
      {/* Header */}
      <header className="flex-shrink-0 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 z-[1001]">
        <div className="px-3 sm:px-4 h-12 flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16z" opacity="0.3" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-zinc-900 leading-tight">Padel Map</h1>
              <p className="text-[10px] text-zinc-400 leading-tight">France & Belgique</p>
            </div>
          </div>

          {/* Right: stats button + count */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {opportunityRaw && (
              <button
                onClick={() => setShowStatsPanel(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-xs font-medium text-zinc-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="hidden sm:inline">Analyse</span>
              </button>
            )}
            <div className="text-right">
              <div className="text-base font-semibold text-zinc-900 tabular-nums leading-tight">
                {filteredCourts.length.toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-400">clubs</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content: Map + Sidebar */}
      <main className="flex-1 relative overflow-hidden">
        <Map
          courts={filteredCourts}
          selectedCourt={selectedCourt}
          onSelectCourt={setSelectedCourt}
          whiteCities={activeWhiteCities}
          friches={activeFriches}
          heatmapPoints={activeHeatmapPoints}
          showCourts={showCourts}
          showWhiteCities={showWhiteCities}
          showFriches={showFriches}
          showHeatmap={showHeatmap}
        />
        <Sidebar
          sources={sources}
          activeSources={activeSources}
          activeTypes={activeTypes}
          onToggleSource={toggleSource}
          onToggleType={toggleType}
          selectedCourt={selectedCourt}
          onSelectCourt={setSelectedCourt}
          totalCount={filteredCourts.length}
          showCourts={showCourts}
          showWhiteCities={showWhiteCities}
          showFriches={showFriches}
          showHeatmap={showHeatmap}
          onToggleCourts={toggleCourts}
          onToggleWhiteCities={toggleWhiteCities}
          onToggleFriches={toggleFriches}
          onToggleHeatmap={toggleHeatmap}
          whiteCitiesCount={activeWhiteCities.length}
          frichesCount={activeFriches.length}
          heatmapPointCount={activeHeatmapPoints.length}
          analysisParams={analysisParams}
          onChangeParams={changeParams}
          onResetParams={resetParams}
          isDefaultParams={isDefaultParams}
        />

        {/* Stats Panel overlay */}
        {showStatsPanel && statsPanelData && (
          <StatsPanel
            opportunity={statsPanelData}
            onClose={() => setShowStatsPanel(false)}
          />
        )}
      </main>
    </div>
  );
}
