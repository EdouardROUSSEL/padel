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

export default function Home() {
  const [courts, setCourts] = useState<PadelCourt[]>([]);
  const [sources, setSources] = useState<CourtsResponse["sources"]>({});
  const [loading, setLoading] = useState(true);
  const [selectedCourt, setSelectedCourt] = useState<PadelCourt | null>(null);

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
        <div className="px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16z" opacity="0.3" />
              </svg>
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-zinc-900 leading-tight">Padel Map</h1>
              <p className="text-[11px] text-zinc-400 leading-tight">France & Belgique</p>
            </div>
          </div>

          {/* Sources */}
          <div className="flex items-center gap-4">
            <SourceBadge name="osm" count={sources.osm?.count || 0} color="bg-green-500" />
            <SourceBadge name="playtomic" count={sources.playtomic?.count || 0} color="bg-blue-500" />
            <SourceBadge name="google" count={sources.google?.count || 0} color="bg-amber-500" />
            <SourceBadge name="tenup" count={sources.tenup?.count || 0} color="bg-violet-500" />
            <SourceBadge name="padelmagazine" count={sources.padelmagazine?.count || 0} color="bg-rose-500" />
            <div className="text-right pl-4 border-l border-zinc-200">
              <div className="text-lg font-semibold text-zinc-900 tabular-nums">
                {courts.length.toLocaleString()}
              </div>
              <div className="text-[11px] text-zinc-400">total</div>
            </div>
          </div>
        </div>
      </header>

      {/* Map */}
      <main className="flex-1 overflow-hidden">
        <Map
          courts={courts}
          selectedCourt={selectedCourt}
          onSelectCourt={setSelectedCourt}
        />
      </main>
    </div>
  );
}

function SourceBadge({ name, count, color }: { name: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-zinc-600">
        <span className="font-medium tabular-nums">{count}</span> {name}
      </span>
    </div>
  );
}
