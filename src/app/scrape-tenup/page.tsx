"use client";

import { useState, useEffect } from "react";

interface Point {
  lat: number;
  lng: number;
  name: string;
  index: number;
  scraped: boolean;
}

interface Status {
  totalPoints: number;
  scrapedPoints: number;
  remainingPoints: number;
  totalClubs: number;
  points: Point[];
}

interface ScrapeResult {
  success?: boolean;
  error?: string;
  point: string;
  found?: number;
  newClubs?: number;
  totalClubs?: number;
  progress?: string;
}

export default function ScrapeTenUpPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [currentPoint, setCurrentPoint] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScrapeResult | null>(null);
  const [autoMode, setAutoMode] = useState(false);

  // Charger le statut
  const loadStatus = async () => {
    try {
      const res = await fetch("/api/scrape-tenup");
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error("Erreur chargement statut:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // Scraper un point
  const scrapePoint = async (pointIndex: number) => {
    if (scraping) return;

    setScraping(true);
    const point = status?.points[pointIndex];
    setCurrentPoint(point?.name || null);

    try {
      const res = await fetch("/api/scrape-tenup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointIndex }),
      });

      const result: ScrapeResult = await res.json();
      setLastResult(result);

      // Recharger le statut
      await loadStatus();

      return result;
    } catch (err) {
      setLastResult({
        error: err instanceof Error ? err.message : "Erreur",
        point: point?.name || "?",
      });
      return null;
    } finally {
      setScraping(false);
      setCurrentPoint(null);
    }
  };

  // Scraper le prochain point non scrapé
  const scrapeNext = async () => {
    if (!status) return;

    const nextPoint = status.points.find((p) => !p.scraped);
    if (nextPoint) {
      await scrapePoint(nextPoint.index);
    }
  };

  // Mode auto: scrape tous les points restants avec délai
  useEffect(() => {
    if (!autoMode || !status) return;

    const nextPoint = status.points.find((p) => !p.scraped);
    if (!nextPoint) {
      setAutoMode(false);
      return;
    }

    const timeout = setTimeout(() => {
      scrapePoint(nextPoint.index);
    }, 2000); // 2s entre chaque requête

    return () => clearTimeout(timeout);
  }, [autoMode, status, scraping]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Chargement...</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Erreur de chargement</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Scraping Ten&apos;Up (FFT)</h1>

        {/* Stats */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600">
                {status.scrapedPoints}
              </div>
              <div className="text-sm text-gray-500">Points scrapés</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-600">
                {status.remainingPoints}
              </div>
              <div className="text-sm text-gray-500">Restants</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">
                {status.totalClubs}
              </div>
              <div className="text-sm text-gray-500">Clubs trouvés</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600">
                {status.totalPoints}
              </div>
              <div className="text-sm text-gray-500">Total points</div>
            </div>
          </div>
        </div>

        {/* Contrôles */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-4 items-center">
            <button
              onClick={scrapeNext}
              disabled={scraping || status.remainingPoints === 0}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scraping ? `Scraping ${currentPoint}...` : "Scraper le prochain"}
            </button>

            <button
              onClick={() => setAutoMode(!autoMode)}
              disabled={status.remainingPoints === 0}
              className={`px-6 py-3 rounded-lg font-medium ${
                autoMode
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-green-500 text-white hover:bg-green-600"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {autoMode ? "Arrêter auto" : "Mode auto"}
            </button>

            {autoMode && (
              <span className="text-sm text-gray-500 animate-pulse">
                Mode automatique actif (2s entre chaque)
              </span>
            )}
          </div>

          {/* Dernier résultat */}
          {lastResult && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                lastResult.success
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {lastResult.success ? (
                <p>
                  <strong>{lastResult.point}</strong>: {lastResult.found} clubs
                  trouvés ({lastResult.newClubs} nouveaux) - Total:{" "}
                  {lastResult.totalClubs}
                </p>
              ) : (
                <p>
                  <strong>{lastResult.point}</strong>: {lastResult.error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Liste des points */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Points de la grille</h2>
          <div className="grid grid-cols-4 gap-2">
            {status.points.map((point) => (
              <button
                key={point.index}
                onClick={() => scrapePoint(point.index)}
                disabled={scraping}
                className={`p-2 rounded text-sm text-left ${
                  point.scraped
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800 hover:bg-blue-100"
                } ${
                  currentPoint === point.name ? "ring-2 ring-blue-500" : ""
                } disabled:cursor-not-allowed`}
              >
                {point.scraped ? "✓ " : ""}
                {point.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
