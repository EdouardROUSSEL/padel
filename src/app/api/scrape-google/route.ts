import { NextResponse } from "next/server";
import { scrapeGoogle } from "@/lib/scrapers/google";
import { FRANCE_BELGIUM_GRID, MAIN_CITIES } from "@/lib/scrapers/grid";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const maxDuration = 600;
export const dynamic = "force-dynamic";

const RAW_DIR = path.join(process.cwd(), "data", "raw");

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const testMode = body.testMode ?? false;
  const apiKey = body.apiKey || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Google API key required" }, { status: 400 });
  }

  const points = testMode ? MAIN_CITIES : FRANCE_BELGIUM_GRID;
  console.log(`=== Google Scraping (${points.length} points, testMode: ${testMode}) ===`);

  const courts = await scrapeGoogle(apiKey, points);

  await mkdir(RAW_DIR, { recursive: true });
  await writeFile(
    path.join(RAW_DIR, "google.json"),
    JSON.stringify({
      scrapedAt: new Date().toISOString(),
      source: "google",
      total: courts.length,
      courts,
    }, null, 2)
  );

  return NextResponse.json({
    success: true,
    source: "google",
    total: courts.length,
    points: points.length,
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/scrape-google",
    description: "Scrape Google Places (France + Belgique)",
    options: { testMode: "boolean", apiKey: "string (or env GOOGLE_API_KEY)" },
    gridPoints: FRANCE_BELGIUM_GRID.length,
  });
}
