"use client";

import { PadelCourt } from "@/types";

const SOURCE_LABELS: Record<string, string> = {
  playtomic: "Playtomic",
  osm: "OpenStreetMap",
  google: "Google",
  tenup: "Ten'Up (FFT)",
  padelmagazine: "Padel Magazine",
  anybuddy: "Anybuddy",
  "fft-padel": "FFT Padel",
  "fft-tennis": "FFT Tennis",
};

const SOURCE_COLORS: Record<string, string> = {
  playtomic: "#0066FF",
  osm: "#16A34A",
  google: "#F59E0B",
  tenup: "#8B5CF6",
  padelmagazine: "#F43F5E",
  anybuddy: "#EC4899",
  "fft-padel": "#14B8A6",
  "fft-tennis": "#F97316",
};

interface ClubDetailProps {
  court: PadelCourt;
  onClose: () => void;
}

export default function ClubDetail({ court, onClose }: ClubDetailProps) {
  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-zinc-900 leading-tight">{court.name}</h3>
            <p className="text-sm text-zinc-500 mt-0.5">
              {court.address ? `${court.address}, ` : ""}
              {court.city}
              {court.postalCode ? ` ${court.postalCode}` : ""}
            </p>
            {(court.department || court.population) && (
              <div className="flex items-center gap-2 mt-1">
                {court.department && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-100 text-[10px] font-medium text-zinc-500">
                    Dept. {court.department}
                  </span>
                )}
                {court.population != null && court.population > 0 && (
                  <span className="text-[10px] text-zinc-400">
                    {(court.population / 1000).toFixed(0)}k hab.
                  </span>
                )}
                {court.region && (
                  <span className="text-[10px] text-zinc-400">{court.region}</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-zinc-600 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Court counts */}
      {court.totalCourts > 0 && (
        <div className="px-4 py-3 border-b border-zinc-100">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-2xl font-bold text-zinc-900 tabular-nums">{court.totalCourts}</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">
                {court.type === "tennis" ? "Terrains tennis" : "Terrains padel"}
              </div>
            </div>
            {court.indoorCourts > 0 && (
              <div className="pl-4 border-l border-zinc-100">
                <div className="text-lg font-semibold text-zinc-900 tabular-nums">{court.indoorCourts}</div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">Indoor</div>
              </div>
            )}
            {court.outdoorCourts > 0 && (
              <div className="pl-4 border-l border-zinc-100">
                <div className="text-lg font-semibold text-zinc-900 tabular-nums">{court.outdoorCourts}</div>
                <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">Outdoor</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Links */}
      {(court.website || court.url) && (
        <div className="px-4 py-3 border-b border-zinc-100 flex gap-2">
          {court.website && (
            <a
              href={court.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Site web
            </a>
          )}
          {court.url && !court.website && (
            <a
              href={court.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 text-xs font-medium hover:bg-zinc-200 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Lien
            </a>
          )}
          {court.phone && (
            <a
              href={`tel:${court.phone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 text-xs font-medium hover:bg-zinc-200 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {court.phone}
            </a>
          )}
        </div>
      )}

      {/* Sources */}
      <div className="px-4 py-3">
        <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium mb-2">Sources</div>
        <div className="flex flex-wrap gap-1.5">
          {court.source.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-600 bg-zinc-50 px-2 py-0.5 rounded-md"
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: SOURCE_COLORS[s] || "#A1A1AA" }}
              />
              {SOURCE_LABELS[s] || s}
            </span>
          ))}
        </div>
      </div>

      {/* Coordinates */}
      <div className="px-4 py-2 border-t border-zinc-100">
        <div className="text-[10px] text-zinc-400 font-mono tabular-nums">
          {court.lat.toFixed(5)}, {court.lng.toFixed(5)}
        </div>
      </div>
    </div>
  );
}
