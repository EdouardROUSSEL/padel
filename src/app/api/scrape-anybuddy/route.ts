import { NextResponse } from "next/server";
import { scrapeAnybuddy } from "@/lib/scrapers/anybuddy";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const RAW_DIR = path.join(process.cwd(), "data", "raw");

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const countries = body.countries ?? ["FR", "BE"];

  console.log(`=== Anybuddy Scraping (countries: ${countries.join(", ")}) ===`);

  const courts = await scrapeAnybuddy(countries);

  await mkdir(RAW_DIR, { recursive: true });
  await writeFile(
    path.join(RAW_DIR, "anybuddy.json"),
    JSON.stringify({
      scrapedAt: new Date().toISOString(),
      source: "anybuddy",
      total: courts.length,
      courts,
    }, null, 2)
  );

  return NextResponse.json({
    success: true,
    source: "anybuddy",
    total: courts.length,
    countries,
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/scrape-anybuddy",
    description: "Scrape Anybuddy (centres de padel)",
    options: { countries: "string[] (default: ['FR', 'BE'])" },
  });
}
