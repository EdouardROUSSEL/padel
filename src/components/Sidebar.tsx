"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { PadelCourt } from "@/types";
import { AnalysisParams } from "@/hooks/useOpportunityAnalysis";
import FilterBar from "./FilterBar";
import ClubDetail from "./ClubDetail";
import { WhiteCityControls, FricheControls, HeatmapControls } from "./AnalysisControls";

type SourceType = "osm" | "playtomic" | "google" | "tenup" | "padelmagazine" | "anybuddy" | "fft-padel" | "fft-tennis";
type CourtType = "padel" | "tennis";

export interface SidebarProps {
  sources: Record<string, { count: number }>;
  activeSources: Set<SourceType>;
  activeTypes: Set<CourtType>;
  onToggleSource: (source: SourceType) => void;
  onToggleType: (type: CourtType) => void;
  selectedCourt: PadelCourt | null;
  onSelectCourt: (court: PadelCourt | null) => void;
  totalCount: number;
  showCourts: boolean;
  showWhiteCities: boolean;
  showFriches: boolean;
  showHeatmap: boolean;
  onToggleCourts: () => void;
  onToggleWhiteCities: () => void;
  onToggleFriches: () => void;
  onToggleHeatmap: () => void;
  whiteCitiesCount: number;
  frichesCount: number;
  heatmapPointCount: number;
  analysisParams: AnalysisParams;
  onChangeParams: (params: Partial<AnalysisParams>) => void;
  onResetParams: () => void;
  isDefaultParams: boolean;
}

// --- Simple toggle switch ---
function Toggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative w-8 h-[18px] rounded-full transition-colors flex-shrink-0 ${
        active ? "bg-zinc-900" : "bg-zinc-200"
      }`}
    >
      <span
        className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${
          active ? "left-[16px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}

// --- Layer row with toggle ---
interface LayerRowProps {
  label: string;
  description?: string;
  count?: number;
  active: boolean;
  onToggle: () => void;
  expanded?: boolean;
  onExpand?: () => void;
  children?: React.ReactNode;
}

function LayerRow({ label, description, count, active, onToggle, expanded, onExpand, children }: LayerRowProps) {
  const hasSettings = !!children;
  return (
    <div>
      <div className="flex items-center gap-2.5 py-2.5 px-1">
        <Toggle active={active} onClick={onToggle} />
        <button
          onClick={hasSettings && active ? onExpand : onToggle}
          className="flex-1 flex items-center justify-between min-w-0"
        >
          <div className="min-w-0">
            <span className={`text-[13px] font-medium ${active ? "text-zinc-900" : "text-zinc-400"}`}>
              {label}
            </span>
            {description && (
              <p className={`text-[10px] leading-tight mt-0.5 ${active ? "text-zinc-400" : "text-zinc-300"}`}>
                {description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            {count != null && (
              <span className={`text-[11px] tabular-nums ${active ? "text-zinc-400" : "text-zinc-300"}`}>
                {count.toLocaleString()}
              </span>
            )}
            {hasSettings && active && (
              <svg
                className={`w-3 h-3 text-zinc-300 transition-transform ${expanded ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </button>
      </div>
      {active && expanded && children && (
        <div className="pb-1 animate-fade-in">{children}</div>
      )}
    </div>
  );
}

// --- Layers section ---
function LayersSection(props: SidebarProps) {
  const [expandedLayer, setExpandedLayer] = useState<string | null>(null);

  const toggle = (key: string) => {
    setExpandedLayer((prev) => (prev === key ? null : key));
  };

  return (
    <div className="divide-y divide-zinc-100">
      <LayerRow
        label="Clubs"
        description="Clubs de padel recenses depuis toutes les sources"
        count={props.totalCount}
        active={props.showCourts}
        onToggle={props.onToggleCourts}
      />

      <LayerRow
        label="Zones blanches"
        description="Villes sans club de padel a proximite, opportunites d'implantation"
        count={props.whiteCitiesCount}
        active={props.showWhiteCities}
        onToggle={props.onToggleWhiteCities}
        expanded={expandedLayer === "white"}
        onExpand={() => toggle("white")}
      >
        <WhiteCityControls
          params={props.analysisParams}
          onChange={props.onChangeParams}
          count={props.whiteCitiesCount}
        />
      </LayerRow>

      <LayerRow
        label="Friches"
        description="Terrains industriels ou commerciaux disponibles, potentiels sites de construction"
        count={props.frichesCount}
        active={props.showFriches}
        onToggle={props.onToggleFriches}
        expanded={expandedLayer === "friches"}
        onExpand={() => toggle("friches")}
      >
        <FricheControls
          params={props.analysisParams}
          onChange={props.onChangeParams}
          count={props.frichesCount}
        />
      </LayerRow>

      <LayerRow
        label="Heatmap demande"
        description="Zones sous-equipees en padel par rapport a la population locale"
        count={props.heatmapPointCount}
        active={props.showHeatmap}
        onToggle={props.onToggleHeatmap}
        expanded={expandedLayer === "heatmap"}
        onExpand={() => toggle("heatmap")}
      >
        <HeatmapControls
          params={props.analysisParams}
          onChange={props.onChangeParams}
          pointCount={props.heatmapPointCount}
        />
      </LayerRow>

      {!props.isDefaultParams && (
        <div className="pt-2">
          <button
            onClick={props.onResetParams}
            className="w-full py-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors text-center"
          >
            Reinitialiser les parametres
          </button>
        </div>
      )}
    </div>
  );
}

// --- Desktop sidebar ---
function DesktopSidebar(props: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`hidden md:flex flex-col absolute top-0 left-0 z-[1000] transition-all duration-300 ${
        collapsed ? "w-0" : "w-[280px]"
      }`}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-3 -right-9 z-10 w-8 h-8 bg-white rounded-r-xl border border-l-0 border-zinc-200/80 shadow-sm flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-all"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="w-[280px] h-full bg-white/95 backdrop-blur-md border-r border-zinc-200/60 shadow-sm overflow-hidden flex flex-col">
          {/* Filters */}
          <div className="px-4 pt-4 pb-3">
            <FilterBar
              sources={props.sources}
              activeSources={props.activeSources}
              activeTypes={props.activeTypes}
              onToggleSource={props.onToggleSource}
              onToggleType={props.onToggleType}
            />
          </div>

          <div className="h-px bg-zinc-100 mx-4" />

          {/* Layers */}
          <div className="flex-1 overflow-auto px-4 py-2">
            <span className="text-[10px] font-semibold text-zinc-300 uppercase tracking-widest">Couches</span>
            <div className="mt-1">
              <LayersSection {...props} />
            </div>
          </div>

          {/* Club detail */}
          {props.selectedCourt && (
            <>
              <div className="h-px bg-zinc-100" />
              <div className="overflow-auto max-h-[40%]">
                <ClubDetail court={props.selectedCourt} onClose={() => props.onSelectCourt(null)} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// --- Mobile bottom sheet ---
function MobileBottomSheet(props: SidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startY: 0, startHeight: 0, isDragging: false });

  useEffect(() => {
    if (props.selectedCourt) setExpanded(true);
  }, [props.selectedCourt]);

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = {
      startY: clientY,
      startHeight: sheetRef.current?.getBoundingClientRect().height || 56,
      isDragging: true,
    };
  };

  const handleDragMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (!dragRef.current.isDragging || !sheetRef.current) return;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const delta = dragRef.current.startY - clientY;
    const newHeight = dragRef.current.startHeight + delta;
    const vh = window.innerHeight;
    sheetRef.current.style.height = `${Math.max(56, Math.min(vh * 0.85, newHeight))}px`;
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!dragRef.current.isDragging || !sheetRef.current) return;
    dragRef.current.isDragging = false;
    const currentHeight = sheetRef.current.getBoundingClientRect().height;
    setExpanded(currentHeight > 120);
    sheetRef.current.style.height = "";
  }, []);

  useEffect(() => {
    document.addEventListener("touchmove", handleDragMove, { passive: false });
    document.addEventListener("touchend", handleDragEnd);
    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleDragEnd);
    return () => {
      document.removeEventListener("touchmove", handleDragMove);
      document.removeEventListener("touchend", handleDragEnd);
      document.removeEventListener("mousemove", handleDragMove);
      document.removeEventListener("mouseup", handleDragEnd);
    };
  }, [handleDragMove, handleDragEnd]);

  return (
    <div
      ref={sheetRef}
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl border-t border-zinc-200 z-[1000] flex flex-col transition-[height] duration-300 ease-out overflow-hidden"
      style={{ height: expanded ? "auto" : "56px", maxHeight: "85vh" }}
    >
      <div
        className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
        onTouchStart={handleDragStart}
        onMouseDown={handleDragStart}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="bottom-sheet-handle" />
        <div className="px-4 pb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-900 tabular-nums">
            {props.totalCount.toLocaleString()} <span className="text-zinc-400 font-normal">clubs</span>
          </span>
          <svg
            className={`w-4 h-4 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="flex-1 overflow-auto px-4 pb-4 space-y-3">
          <FilterBar
            sources={props.sources}
            activeSources={props.activeSources}
            activeTypes={props.activeTypes}
            onToggleSource={props.onToggleSource}
            onToggleType={props.onToggleType}
          />
          <div className="h-px bg-zinc-100" />
          <LayersSection {...props} />
          {props.selectedCourt && (
            <>
              <div className="h-px bg-zinc-100" />
              <ClubDetail court={props.selectedCourt} onClose={() => props.onSelectCourt(null)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Sidebar(props: SidebarProps) {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileBottomSheet {...props} />
    </>
  );
}
