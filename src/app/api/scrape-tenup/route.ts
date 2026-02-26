import { NextResponse } from "next/server";
import { scrapeTenUp } from "@/lib/scrapers/tenup";
import { FRANCE_GRID, MAIN_CITIES } from "@/lib/scrapers/grid";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const maxDuration = 600;
export const dynamic = "force-dynamic";

const RAW_DIR = path.join(process.cwd(), "data", "raw");

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const testMode = body.testMode ?? false;

  // TenUp = FFT = France uniquement
  const points = testMode ? MAIN_CITIES.filter(p => p.name !== "Bruxelles" && p.name !== "Anvers" && p.name !== "Gand" && p.name !== "Liège") : FRANCE_GRID;
  console.log(`=== TenUp Scraping (${points.length} points, testMode: ${testMode}) ===`);

  const courts = await scrapeTenUp(points);

  await mkdir(RAW_DIR, { recursive: true });
  await writeFile(
    path.join(RAW_DIR, "tenup.json"),
    JSON.stringify({
      scrapedAt: new Date().toISOString(),
      source: "tenup",
      total: courts.length,
      courts,
    }, null, 2)
  );

  return NextResponse.json({
    success: true,
    source: "tenup",
    total: courts.length,
    points: points.length,
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/scrape-tenup",
    description: "Scrape Ten'Up FFT (France uniquement)",
    options: { testMode: "boolean (default: false)" },
    gridPoints: FRANCE_GRID.length,
  });
}
