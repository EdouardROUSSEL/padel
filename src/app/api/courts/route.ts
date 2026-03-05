import { NextResponse } from "next/server";
import { readFile, existsSync } from "fs";
import { promisify } from "util";
import path from "path";
import { PadelCourt } from "@/types";

const readFileAsync = promisify(readFile);

export const dynamic = "force-dynamic";

const MERGED_FILE = path.join(process.cwd(), "data", "merged.json");

interface MergedData {
  generatedAt: string;
  sources: string[];
  total: number;
  courts: PadelCourt[];
}

async function loadMergedData(): Promise<{
  courts: PadelCourt[];
  sources: Record<string, { count: number }>;
  generatedAt: string | null;
}> {
  if (!existsSync(MERGED_FILE)) {
    return { courts: [], sources: {}, generatedAt: null };
  }

  try {
    const content = await readFileAsync(MERGED_FILE, "utf-8");
    const data: MergedData = JSON.parse(content);

    // Count courts per source
    const sourceCounts: Record<string, number> = {};
    for (const court of data.courts) {
      for (const source of court.source) {
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      }
    }

    const sources: Record<string, { count: number }> = {};
    for (const [name, count] of Object.entries(sourceCounts)) {
      sources[name] = { count };
    }

    return {
      courts: data.courts,
      sources,
      generatedAt: data.generatedAt
    };
  } catch (e) {
    console.error("Error loading merged data:", e);
    return { courts: [], sources: {}, generatedAt: null };
  }
}

export async function GET() {
  const { courts, sources, generatedAt } = await loadMergedData();

  if (courts.length === 0) {
    return NextResponse.json({
      total: 0,
      sources: {},
      courts: [],
      message: "Aucune donnée. Lancez: npx tsx scripts/merge-data.ts",
    });
  }

  return NextResponse.json({
    total: courts.length,
    sources,
    generatedAt,
    courts,
  });
}
