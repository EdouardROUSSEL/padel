import { RawCourt } from "@/types";
import { isInSearchZone } from "@/lib/geo";

const BASE_URL = "https://padelmagazine.fr/annuaire-des-clubs/";
const DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface PadelMagClub {
  id: string;
  name: string;
  lat: number;
  lng: number;
  url: string;
}

/**
 * Parse JavaScript markers from HTML page
 * Format: w2dc_map_markers_attrs_array.push(new w2dc_map_markers_attrs('hash', eval([["id","lat","lng",false,false,"8","Name","image","url",...], ...])))
 */
function parseMarkersFromHtml(html: string): PadelMagClub[] {
  const clubs: PadelMagClub[] = [];

  // Find the eval array content
  const evalMatch = html.match(/eval\(\[\[([\s\S]*?)\]\]\)/);
  if (!evalMatch) {
    // Alternative: match individual club arrays
    const clubArrayRegex = /\["(\d+)","([\d.-]+)","([\d.-]+)",false,false,"8","([^"]+)","[^"]*","(https?:[^"]+)"/g;
    let match;
    while ((match = clubArrayRegex.exec(html)) !== null) {
      const id = match[1];
      const lat = parseFloat(match[2]);
      const lng = parseFloat(match[3]);
      const name = match[4].replace(/&#8211;/g, "-").replace(/\\u[\dA-Fa-f]{4}/g, (m) =>
        String.fromCharCode(parseInt(m.slice(2), 16))
      );
      const url = match[5].replace(/\\\//g, "/");

      if (!isNaN(lat) && !isNaN(lng)) {
        clubs.push({ id, name, lat, lng, url });
      }
    }
    return clubs;
  }

  // Parse the nested arrays
  const arrayContent = evalMatch[1];
  const clubArrayRegex = /\["(\d+)","([\d.-]+)","([\d.-]+)",false,false,"8","([^"]+)","[^"]*","(https?:[^"]+)"/g;

  let match;
  while ((match = clubArrayRegex.exec(arrayContent)) !== null) {
    const id = match[1];
    const lat = parseFloat(match[2]);
    const lng = parseFloat(match[3]);
    const name = match[4].replace(/&#8211;/g, "-").replace(/\\u[\dA-Fa-f]{4}/g, (m) =>
      String.fromCharCode(parseInt(m.slice(2), 16))
    );
    const url = match[5].replace(/\\\//g, "/");

    if (!isNaN(lat) && !isNaN(lng)) {
      clubs.push({ id, name, lat, lng, url });
    }
  }

  return clubs;
}

/**
 * Scrape PadelMagazine directory
 */
export async function scrapePadelMagazine(): Promise<RawCourt[]> {
  const allClubs: PadelMagClub[] = [];
  let page = 1;
  let hasMore = true;

  console.log("Starting PadelMagazine scrape...");

  while (hasMore) {
    const url = page === 1 ? BASE_URL : `${BASE_URL}page/${page}/`;
    console.log(`Fetching page ${page}: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PadelScraper/1.0)",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          hasMore = false;
          break;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const clubs = parseMarkersFromHtml(html);

      if (clubs.length === 0) {
        hasMore = false;
      } else {
        // Filter for unique clubs (by ID) and add to list
        for (const club of clubs) {
          if (!allClubs.find(c => c.id === club.id)) {
            allClubs.push(club);
          }
        }
        console.log(`  Found ${clubs.length} clubs on page ${page}, total: ${allClubs.length}`);
        page++;
        await sleep(DELAY_MS);
      }

      // Safety limit
      if (page > 50) {
        console.log("Safety limit reached");
        hasMore = false;
      }
    } catch (error) {
      console.error(`Error on page ${page}:`, error);
      hasMore = false;
    }
  }

  console.log(`Total clubs found: ${allClubs.length}`);

  // Convert to RawCourt format and filter by zone
  const courts: RawCourt[] = [];

  for (const club of allClubs) {
    // Filter by search zone
    if (!isInSearchZone(club.lat, club.lng)) {
      continue;
    }

    courts.push({
      name: club.name,
      lat: club.lat,
      lng: club.lng,
      source: "padelmagazine",
      sourceId: club.id,
      url: club.url || undefined,
    });
  }

  console.log(`After zone filter: ${courts.length} clubs in France/Belgium/Luxembourg`);

  return courts;
}
