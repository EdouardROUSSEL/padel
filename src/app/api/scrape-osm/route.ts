import { NextResponse } from "next/server";
import { scrapeOSM } from "@/lib/scrapers/osm";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const RAW_DIR = path.join(process.cwd(), "data", "raw");

export async function POST() {
  console.log("=== OSM Scraping (FR + BE) ===");

  const courts = await scrapeOSM();

  await mkdir(RAW_DIR, { recursive: true });
  await writeFile(
    path.join(RAW_DIR, "osm.json"),
    JSON.stringify({
      scrapedAt: new Date().toISOString(),
      source: "osm",
      total: courts.length,
      courts,
    }, null, 2)
  );

  return NextResponse.json({
    success: true,
    source: "osm",
    total: courts.length,
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/scrape-osm",
    description: "Scrape OpenStreetMap (France + Belgique)",
  });
}
