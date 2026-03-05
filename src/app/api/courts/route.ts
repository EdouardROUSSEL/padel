import { NextResponse } from "next/server";
import { readFile, existsSync } from "fs";
import { promisify } from "util";
import path from "path";
import { PadelCourt } from "@/types";

const readFileAsync = promisify(readFile);

export const dynamic = "force-dynamic";

const MERGED_FILE = path.join(process.cwd(), "data", "merged.json");
const TENNIS_FILE = path.join(process.cwd(), "data", "raw", "fft-tennis-enriched.json");

interface MergedData {
  generatedAt: string;
  sources: string[];
  total: number;
  courts: PadelCourt[];
}

interface TennisClub {
  code: string;
  nom: string;
  ville: string;
  nombreCourts: number;
  pratiques: string[];
  lat?: number;
  lng?: number;
  address?: string;
  postalCode?: string;
}

interface TennisData {
  source: string;
  scrapedAt: string;
  total: number;
  clubs: TennisClub[];
}

async function loadMergedData(): Promise<PadelCourt[]> {
  if (!existsSync(MERGED_FILE)) return [];
  try {
    const content = await readFileAsync(MERGED_FILE, "utf-8");
    const data: MergedData = JSON.parse(content);
    return data.courts.map((c) => ({ ...c, type: "padel" as const }));
  } catch (e) {
    console.error("Error loading merged data:", e);
    return [];
  }
}

async function loadTennisData(): Promise<PadelCourt[]> {
  if (!existsSync(TENNIS_FILE)) return [];
  try {
    const content = await readFileAsync(TENNIS_FILE, "utf-8");
    const data: TennisData = JSON.parse(content);
    return data.clubs
      .filter((club) => club.lat && club.lng)
      .map((club) => ({
        id: `fft-tennis_${club.code}`,
        name: club.nom,
        address: club.address || "",
        city: club.ville,
        postalCode: club.postalCode || "",
        country: "FR",
        lat: club.lat!,
        lng: club.lng!,
        totalCourts: club.nombreCourts,
        indoorCourts: 0,
        outdoorCourts: 0,
        type: "tennis" as const,
        source: ["fft-tennis" as const],
        tenupId: club.code,
      }));
  } catch (e) {
    console.error("Error loading tennis data:", e);
    return [];
  }
}

export async function GET() {
  const [padelCourts, tennisCourts] = await Promise.all([
    loadMergedData(),
    loadTennisData(),
  ]);

  const allCourts = [...padelCourts, ...tennisCourts];

  if (allCourts.length === 0) {
    return NextResponse.json({
      total: 0,
      sources: {},
      courts: [],
      counts: { padel: 0, tennis: 0 },
      message: "Aucune donnée. Lancez: npx tsx scripts/merge-data.ts",
    });
  }

  // Count per source
  const sourceCounts: Record<string, number> = {};
  for (const court of allCourts) {
    for (const source of court.source) {
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    }
  }
  const sources: Record<string, { count: number }> = {};
  for (const [name, count] of Object.entries(sourceCounts)) {
    sources[name] = { count };
  }

  return NextResponse.json({
    total: allCourts.length,
    sources,
    counts: { padel: padelCourts.length, tennis: tennisCourts.length },
    courts: allCourts,
  });
}
