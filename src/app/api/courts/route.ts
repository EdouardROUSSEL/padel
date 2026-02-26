import { NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import path from "path";
import { PadelCourt } from "@/types";

export const dynamic = "force-dynamic";

const RAW_DIR = path.join(process.cwd(), "data", "raw");

interface RawSourceFile {
  scrapedAt: string;
  source: string;
  total: number;
  courts: PadelCourt[];
}

async function loadAllRaw(): Promise<{ courts: PadelCourt[]; sources: Record<string, { scrapedAt: string; count: number }> }> {
  const courts: PadelCourt[] = [];
  const sources: Record<string, { scrapedAt: string; count: number }> = {};

  try {
    const files = await readdir(RAW_DIR);
    const jsonFiles = files.filter(f => f.endsWith(".json"));

    for (const file of jsonFiles) {
      try {
        const content = await readFile(path.join(RAW_DIR, file), "utf-8");
        const data: RawSourceFile = JSON.parse(content);
        const sourceName = data.source || file.replace(".json", "");

        if (data.courts && Array.isArray(data.courts)) {
          // Convert raw courts to PadelCourt format
          const normalizedCourts = data.courts.map((court: any) => ({
            ...court,
            // Ensure source is always an array
            source: Array.isArray(court.source) ? court.source : [court.source || sourceName],
            // Provide defaults for required fields
            id: court.id || court.sourceId || `${sourceName}_${court.lat}_${court.lng}`,
            address: court.address || "",
            city: court.city || "",
            postalCode: court.postalCode || "",
            country: court.country || "FR",
            totalCourts: court.totalCourts || 0,
            indoorCourts: court.indoorCourts || 0,
            outdoorCourts: court.outdoorCourts || 0,
          }));

          courts.push(...normalizedCourts);
          sources[sourceName] = {
            scrapedAt: data.scrapedAt,
            count: data.courts.length,
          };
        }
      } catch (e) {
        console.error(`Error loading ${file}:`, e);
      }
    }
  } catch {
    // Directory doesn't exist or is empty
  }

  return { courts, sources };
}

export async function GET() {
  const { courts, sources } = await loadAllRaw();

  if (courts.length === 0) {
    return NextResponse.json({
      total: 0,
      sources: {},
      courts: [],
      message: "Aucune donnée. Lancez les scrapers: POST /api/scrape-osm, etc.",
    });
  }

  return NextResponse.json({
    total: courts.length,
    sources,
    courts,
  });
}
