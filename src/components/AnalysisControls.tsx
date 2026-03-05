"use client";

import { AnalysisParams } from "@/hooks/useOpportunityAnalysis";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, unit, onChange }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="py-1">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-zinc-500">{label}</span>
        <span className="text-[11px] font-semibold text-zinc-800 tabular-nums bg-zinc-100 px-1.5 py-0.5 rounded">
          {value.toLocaleString()}{unit}
        </span>
      </div>
      <div className="relative">
        <div className="h-1 rounded-full bg-zinc-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-zinc-900 transition-all duration-75"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-1 opacity-0 cursor-pointer"
          style={{ top: "-2px", height: "12px" }}
        />
      </div>
    </div>
  );
}

interface WhiteCityControlsProps {
  params: AnalysisParams;
  onChange: (params: Partial<AnalysisParams>) => void;
  count: number;
}

export function WhiteCityControls({ params, onChange }: WhiteCityControlsProps) {
  return (
    <div className="ml-11 mr-3 mb-2 px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
      <Slider
        label="Population min."
        value={params.whiteCityMinPop}
        min={3000}
        max={50000}
        step={1000}
        unit=" hab."
        onChange={(v) => onChange({ whiteCityMinPop: v })}
      />
      <Slider
        label="Distance min. sans padel"
        value={params.whiteCityMaxDist}
        min={5}
        max={50}
        step={1}
        unit=" km"
        onChange={(v) => onChange({ whiteCityMaxDist: v })}
      />
    </div>
  );
}

interface FricheControlsProps {
  params: AnalysisParams;
  onChange: (params: Partial<AnalysisParams>) => void;
  count: number;
}

export function FricheControls({ params, onChange }: FricheControlsProps) {
  return (
    <div className="ml-11 mr-3 mb-2 px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
      <Slider
        label="Surface min."
        value={params.fricheMinSurface}
        min={200}
        max={5000}
        step={100}
        unit=" m²"
        onChange={(v) => onChange({ fricheMinSurface: v })}
      />
      <Slider
        label="Distance min. padel"
        value={params.fricheMinDistPadel}
        min={0}
        max={50}
        step={1}
        unit=" km"
        onChange={(v) => onChange({ fricheMinDistPadel: v })}
      />
    </div>
  );
}

interface HeatmapControlsProps {
  params: AnalysisParams;
  onChange: (params: Partial<AnalysisParams>) => void;
  pointCount: number;
}

export function HeatmapControls({ params, onChange }: HeatmapControlsProps) {
  return (
    <div className="ml-11 mr-3 mb-2 px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
      <Slider
        label="Rayon d'analyse"
        value={params.heatmapRadius}
        min={5}
        max={50}
        step={5}
        unit=" km"
        onChange={(v) => onChange({ heatmapRadius: v })}
      />
      <Slider
        label="Population min."
        value={params.heatmapMinPop}
        min={1000}
        max={20000}
        step={1000}
        unit=" hab."
        onChange={(v) => onChange({ heatmapMinPop: v })}
      />
      <Slider
        label="Terrains/club (defaut)"
        value={params.defaultCourtsPerClub}
        min={1}
        max={6}
        step={1}
        unit=""
        onChange={(v) => onChange({ defaultCourtsPerClub: v })}
      />
    </div>
  );
}

export function ResetButton({ onReset, isDefault }: { onReset: () => void; isDefault: boolean }) {
  if (isDefault) return null;
  return (
    <button
      onClick={onReset}
      className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors underline underline-offset-2"
    >
      Reinitialiser
    </button>
  );
}
