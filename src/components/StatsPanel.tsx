"use client";

import { useState } from "react";

interface Department {
  code: string;
  name: string;
  region: string;
  population: number;
  totalClubs: number;
  totalCourts: number;
  courtsPerCapita: number;
  score: number;
}

interface WhiteCity {
  name: string;
  population: number;
  department: string;
  region: string;
  lat: number;
  lng: number;
  nearestPadelKm: number;
}

interface NationalStats {
  totalClubs: number;
  totalCourts: number;
  population: number;
  avgCourtsPerCapita: number;
}

interface StatsPanelProps {
  opportunity: {
    nationalStats: NationalStats;
    departments: Department[];
    whiteCities: WhiteCity[];
    friches: Array<{
      id: string;
      nom: string;
      type: string;
      commune: string;
      department: string;
      surface: number;
      lat: number;
      lng: number;
      nearestPadelKm: number;
    }>;
    heatmapPoints: [number, number, number][];
  };
  onClose: () => void;
}

type Tab = "departments" | "whiteCities" | "friches";

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-red-500" : score >= 40 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs tabular-nums text-zinc-500 w-6 text-right">{score}</span>
    </div>
  );
}

export default function StatsPanel({ opportunity, onClose }: StatsPanelProps) {
  const [tab, setTab] = useState<Tab>("departments");
  const [searchQuery, setSearchQuery] = useState("");
  const { nationalStats, departments, whiteCities, friches } = opportunity;

  const filteredDepartments = departments.filter(
    (d) =>
      !searchQuery ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.code.includes(searchQuery) ||
      d.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWhiteCities = whiteCities.filter(
    (c) =>
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.department.includes(searchQuery)
  );

  const filteredFriches = friches.filter(
    (f) =>
      !searchQuery ||
      f.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.commune.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.department.includes(searchQuery)
  );

  return (
    <div className="absolute inset-0 z-[1100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-zinc-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Analyse opportunite</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Donnees demographiques vs couverture padel</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-zinc-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* National stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-zinc-50 rounded-xl px-3 py-2.5">
              <div className="text-lg font-bold text-zinc-900 tabular-nums">{nationalStats.totalClubs.toLocaleString()}</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">Clubs padel</div>
            </div>
            <div className="bg-zinc-50 rounded-xl px-3 py-2.5">
              <div className="text-lg font-bold text-zinc-900 tabular-nums">{nationalStats.totalCourts.toLocaleString()}</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">Terrains</div>
            </div>
            <div className="bg-zinc-50 rounded-xl px-3 py-2.5">
              <div className="text-lg font-bold text-zinc-900 tabular-nums">{nationalStats.avgCourtsPerCapita.toFixed(1)}</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">/ 100k hab.</div>
            </div>
            <div className="bg-zinc-50 rounded-xl px-3 py-2.5">
              <div className="text-lg font-bold text-red-600 tabular-nums">{whiteCities.length}</div>
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">Zones blanches</div>
            </div>
          </div>

          {/* Tabs + Search */}
          <div className="flex items-center gap-3">
            <div className="flex bg-zinc-100 rounded-lg p-0.5 flex-shrink-0">
              {([
                { key: "departments", label: "Departements" },
                { key: "whiteCities", label: "Zones blanches" },
                { key: "friches", label: "Friches" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    tab === key
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white placeholder:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-300"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {tab === "departments" && (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-100">
                <tr className="text-left text-zinc-400 uppercase tracking-wider">
                  <th className="px-5 py-2.5 font-medium">Departement</th>
                  <th className="px-3 py-2.5 font-medium text-right hidden sm:table-cell">Pop.</th>
                  <th className="px-3 py-2.5 font-medium text-right">Clubs</th>
                  <th className="px-3 py-2.5 font-medium text-right">Terrains</th>
                  <th className="px-3 py-2.5 font-medium text-right hidden sm:table-cell">/100k</th>
                  <th className="px-5 py-2.5 font-medium text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredDepartments.map((d) => (
                  <tr key={d.code} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-zinc-900">{d.code} — {d.name}</div>
                      <div className="text-[10px] text-zinc-400">{d.region}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-600 hidden sm:table-cell">
                      {(d.population / 1000).toFixed(0)}k
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-600">{d.totalClubs}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-600">{d.totalCourts}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-600 hidden sm:table-cell">
                      {d.courtsPerCapita.toFixed(1)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <ScoreBar score={d.score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "whiteCities" && (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-100">
                <tr className="text-left text-zinc-400 uppercase tracking-wider">
                  <th className="px-5 py-2.5 font-medium">Ville</th>
                  <th className="px-3 py-2.5 font-medium text-right">Pop.</th>
                  <th className="px-3 py-2.5 font-medium text-right">Dept.</th>
                  <th className="px-5 py-2.5 font-medium text-right">Padel le + proche</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredWhiteCities.map((c, i) => (
                  <tr key={i} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-zinc-900">{c.name}</div>
                      <div className="text-[10px] text-zinc-400">{c.region}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-600">
                      {(c.population / 1000).toFixed(0)}k
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-600">{c.department}</td>
                    <td className="px-5 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 text-red-600 font-medium tabular-nums">
                        {c.nearestPadelKm} km
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "friches" && (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-100">
                <tr className="text-left text-zinc-400 uppercase tracking-wider">
                  <th className="px-5 py-2.5 font-medium">Site</th>
                  <th className="px-3 py-2.5 font-medium text-right hidden sm:table-cell">Surface</th>
                  <th className="px-3 py-2.5 font-medium text-right">Dept.</th>
                  <th className="px-5 py-2.5 font-medium text-right">Padel le + proche</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredFriches.slice(0, 200).map((f) => (
                  <tr key={f.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-zinc-900 truncate max-w-[200px]">{f.nom}</div>
                      <div className="text-[10px] text-zinc-400">{f.commune} — {f.type || "Non classe"}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-600 hidden sm:table-cell">
                      {f.surface.toLocaleString()} m²
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-600">{f.department}</td>
                    <td className="px-5 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 text-amber-600 font-medium tabular-nums">
                        {f.nearestPadelKm} km
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredFriches.length > 200 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-3 text-center text-zinc-400">
                      ... et {filteredFriches.length - 200} autres friches
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
