"use client";

const SOURCE_CONFIG = {
  osm: { label: "OSM", color: "#16A34A" },
  playtomic: { label: "Playtomic", color: "#0066FF" },
  google: { label: "Google", color: "#F59E0B" },
  tenup: { label: "Ten'Up", color: "#8B5CF6" },
  padelmagazine: { label: "PadelMag", color: "#F43F5E" },
  anybuddy: { label: "Anybuddy", color: "#EC4899" },
  "fft-padel": { label: "FFT Padel", color: "#14B8A6" },
  "fft-tennis": { label: "FFT Tennis", color: "#F97316" },
} as const;

type SourceType = keyof typeof SOURCE_CONFIG;
type CourtType = "padel" | "tennis";

interface FilterBarProps {
  sources: Record<string, { count: number }>;
  activeSources: Set<SourceType>;
  activeTypes: Set<CourtType>;
  onToggleSource: (source: SourceType) => void;
  onToggleType: (type: CourtType) => void;
}

export default function FilterBar({
  sources,
  activeSources,
  activeTypes,
  onToggleSource,
  onToggleType,
}: FilterBarProps) {
  const padelSources: SourceType[] = ["osm", "playtomic", "google", "tenup", "padelmagazine", "anybuddy", "fft-padel"];
  const tennisSources: SourceType[] = ["fft-tennis"];

  const visibleSources = [
    ...(activeTypes.has("padel") ? padelSources : []),
    ...(activeTypes.has("tennis") ? tennisSources : []),
  ];

  return (
    <div className="space-y-2.5">
      {/* Sport toggle */}
      <div className="flex bg-zinc-100 rounded-lg p-0.5">
        <button
          onClick={() => onToggleType("padel")}
          className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
            activeTypes.has("padel")
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-400 hover:text-zinc-500"
          }`}
        >
          Padel
        </button>
        <button
          onClick={() => onToggleType("tennis")}
          className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
            activeTypes.has("tennis")
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-400 hover:text-zinc-500"
          }`}
        >
          Tennis
        </button>
      </div>

      {/* Sources - compact inline */}
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        {visibleSources.map((source) => {
          const config = SOURCE_CONFIG[source];
          const count = sources[source]?.count || 0;
          const active = activeSources.has(source);
          return (
            <button
              key={source}
              onClick={() => onToggleSource(source)}
              className={`inline-flex items-center gap-1 text-[11px] transition-colors ${
                active ? "text-zinc-600" : "text-zinc-300"
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: config.color, opacity: active ? 1 : 0.25 }}
              />
              {config.label}
              <span className="tabular-nums opacity-40">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
