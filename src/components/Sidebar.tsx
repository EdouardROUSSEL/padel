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

// --- Layer toggle item ---
interface LayerItemProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  color: string;
  children?: React.ReactNode;
}

function LayerItem({ icon, label, count, active, onClick, color, children }: LayerItemProps) {
  return (
    <div>
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${
          active
            ? "bg-zinc-900 text-white shadow-sm"
            : "hover:bg-zinc-50 text-zinc-600"
        }`}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
            active ? "bg-white/15" : "bg-zinc-100"
          }`}
          style={!active ? { backgroundColor: `${color}10` } : undefined}
        >
          <div className={active ? "text-white" : ""} style={!active ? { color } : undefined}>
            {icon}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] font-medium leading-tight ${active ? "text-white" : "text-zinc-800"}`}>
            {label}
          </div>
        </div>
        {count != null && (
          <span className={`text-xs tabular-nums font-medium ${active ? "text-white/60" : "text-zinc-400"}`}>
            {count.toLocaleString()}
          </span>
        )}
      </button>
      {active && children && (
        <div className="mt-1.5 animate-fade-in">{children}</div>
      )}
    </div>
  );
}

// --- Layers section ---
function LayersSection(props: SidebarProps) {
  return (
    <div className="space-y-1">
      <LayerItem
        icon={
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
        label="Clubs"
        count={props.totalCount}
        active={props.showCourts}
        onClick={props.onToggleCourts}
        color="#18181B"
      />

      <LayerItem
        icon={
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" strokeDasharray="4 2" />
            <path strokeLinecap="round" d="M12 8v4l2 2" />
          </svg>
        }
        label="Zones blanches"
        count={props.whiteCitiesCount}
        active={props.showWhiteCities}
        onClick={props.onToggleWhiteCities}
        color="#EF4444"
      >
        <WhiteCityControls
          params={props.analysisParams}
          onChange={props.onChangeParams}
          count={props.whiteCitiesCount}
        />
      </LayerItem>

      <LayerItem
        icon={
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        }
        label="Friches"
        count={props.frichesCount}
        active={props.showFriches}
        onClick={props.onToggleFriches}
        color="#F59E0B"
      >
        <FricheControls
          params={props.analysisParams}
          onChange={props.onChangeParams}
          count={props.frichesCount}
        />
      </LayerItem>

      <LayerItem
        icon={
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
          </svg>
        }
        label="Heatmap"
        count={props.heatmapPointCount}
        active={props.showHeatmap}
        onClick={props.onToggleHeatmap}
        color="#EF4444"
      >
        <HeatmapControls
          params={props.analysisParams}
          onChange={props.onChangeParams}
          pointCount={props.heatmapPointCount}
        />
      </LayerItem>

      {!props.isDefaultParams && (
        <button
          onClick={props.onResetParams}
          className="w-full mt-1 px-3 py-2 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-colors text-center"
        >
          Reinitialiser les parametres
        </button>
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
        collapsed ? "w-0" : "w-[320px]"
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
        <div className="w-[320px] h-full bg-white border-r border-zinc-200/80 shadow-lg overflow-hidden flex flex-col">
          {/* Filters section */}
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

          {/* Layers section */}
          <div className="flex-1 overflow-auto px-3 py-3">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Couches</span>
            </div>
            <LayersSection {...props} />
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
