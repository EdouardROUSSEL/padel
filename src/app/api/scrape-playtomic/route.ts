import { NextResponse } from "next/server";
import { scrapePlaytomic } from "@/lib/scrapers/playtomic";
import { FRANCE_BELGIUM_GRID, MAIN_CITIES } from "@/lib/scrapers/grid";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const maxDuration = 600;
export const dynamic = "force-dynamic";

const RAW_DIR = path.join(process.cwd(), "data", "raw");

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const testMode = body.testMode ?? false;

  const points = testMode ? MAIN_CITIES : FRANCE_BELGIUM_GRID;
  console.log(`=== Playtomic Scraping (${points.length} points, testMode: ${testMode}) ===`);

  const courts = await scrapePlaytomic(points);

  await mkdir(RAW_DIR, { recursive: true });
  await writeFile(
    path.join(RAW_DIR, "playtomic.json"),
    JSON.stringify({
      scrapedAt: new Date().toISOString(),
      source: "playtomic",
      total: courts.length,
      courts,
    }, null, 2)
  );

  return NextResponse.json({
    success: true,
    source: "playtomic",
    total: courts.length,
    points: points.length,
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/scrape-playtomic",
    description: "Scrape Playtomic (France + Belgique)",
    options: { testMode: "boolean (default: false)" },
    gridPoints: FRANCE_BELGIUM_GRID.length,
    testPoints: MAIN_CITIES.length,
  });
}
