import { NextResponse } from "next/server";
import { scrapePadelMagazine } from "@/lib/scrapers/padelmagazine";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const RAW_DIR = path.join(process.cwd(), "data", "raw");

export async function POST() {
  console.log("=== PadelMagazine Scraping ===");

  const courts = await scrapePadelMagazine();

  await mkdir(RAW_DIR, { recursive: true });
  await writeFile(
    path.join(RAW_DIR, "padelmagazine.json"),
    JSON.stringify({
      scrapedAt: new Date().toISOString(),
      source: "padelmagazine",
      total: courts.length,
      courts,
    }, null, 2)
  );

  return NextResponse.json({
    success: true,
    source: "padelmagazine",
    total: courts.length,
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/scrape-padelmagazine",
    description: "Scrape PadelMagazine.fr directory",
  });
}
