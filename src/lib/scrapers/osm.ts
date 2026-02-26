import { PadelCourt, OSMElement } from "@/types";

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

// Requêtes Overpass par pays (France + Belgique uniquement)
const COUNTRIES = [
  { code: "FR", name: "France" },
  { code: "BE", name: "Belgique" },
];

function makeOverpassQuery(isoCode: string): string {
  return `
[out:json][timeout:180];
(
  area["ISO3166-1"="${isoCode}"]->.a;
  nwr["sport"="padel"](area.a);
  nwr["sport"~"padel"](area.a);
);
out center tags;
`;
}

interface OverpassResponse {
  elements: OSMElement[];
}

async function fetchOverpass(query: string): Promise<OSMElement[]> {
  try {
    const response = await fetch(OVERPASS_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: OverpassResponse = await response.json();
    return data.elements || [];
  } catch (error) {
    console.error("Erreur fetch Overpass:", error);
    return [];
  }
}

function extractPostalCode(tags: OSMElement["tags"]): string {
  if (!tags) return "";
  return tags["addr:postcode"] || "";
}

function convertToPadelCourt(element: OSMElement, countryCode: string): PadelCourt | null {
  let lat: number, lng: number;

  if (element.lat !== undefined && element.lon !== undefined) {
    lat = element.lat;
    lng = element.lon;
  } else if (element.center) {
    lat = element.center.lat;
    lng = element.center.lon;
  } else {
    return null;
  }

  const tags = element.tags || {};

  return {
    id: `osm_${element.type}_${element.id}`,
    osmId: `${element.type}/${element.id}`,
    name: tags.name || "Terrain de padel",
    address: tags["addr:street"] || "",
    city: tags["addr:city"] || "",
    postalCode: extractPostalCode(tags),
    country: countryCode,
    lat,
    lng,
    totalCourts: 0,
    indoorCourts: tags.indoor === "yes" ? 1 : 0,
    outdoorCourts: tags.indoor === "yes" ? 0 : 1,
    source: ["osm"],
  };
}

export async function scrapeOSM(): Promise<PadelCourt[]> {
  console.log("Démarrage scraping OSM...");

  const allCourts: PadelCourt[] = [];

  for (const country of COUNTRIES) {
    console.log(`OSM: Scraping ${country.name} (${country.code})...`);
    const elements = await fetchOverpass(makeOverpassQuery(country.code));
    console.log(`OSM ${country.name}: ${elements.length} éléments`);

    for (const element of elements) {
      const court = convertToPadelCourt(element, country.code);
      if (court) {
        allCourts.push(court);
      }
    }
  }

  // Dédoublonner par ID
  const unique = new Map<string, PadelCourt>();
  for (const court of allCourts) {
    if (!unique.has(court.id)) {
      unique.set(court.id, court);
    }
  }

  const courts = Array.from(unique.values());
  console.log(`Scraping OSM terminé: ${courts.length} terrains`);

  return courts;
}

export async function testOSMScraper(): Promise<PadelCourt[]> {
  return scrapeOSM();
}
