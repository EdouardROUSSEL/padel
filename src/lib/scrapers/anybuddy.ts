import { PadelCourt } from "@/types";

const ANYBUDDY_API = "https://api-booking.anybuddyapp.com/v1/centers?activity=padel";

interface AnybuddyCenter {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  postalCode: string;
  city: string;
  state: string;
  country: string;
  priceMin: string | null;
  priceMax: string | null;
  activity: string;
  nbFacilities: number;
  photo: string;
  description: string;
  url: string;
  createdAt: string;
}

// Parse le CSV retourné par l'API Anybuddy
function parseCSV(csv: string): AnybuddyCenter[] {
  const lines = csv.split("\n");
  const headers = lines[0].split(",");
  const centers: AnybuddyCenter[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Parse CSV avec gestion des guillemets
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values.length >= 17) {
      centers.push({
        id: values[0],
        name: values[1],
        lat: parseFloat(values[2]),
        lng: parseFloat(values[3]),
        address: values[4],
        postalCode: values[5],
        city: values[6],
        state: values[7],
        country: values[8],
        priceMin: values[9] !== "null" ? values[9] : null,
        priceMax: values[10] !== "null" ? values[10] : null,
        activity: values[11],
        nbFacilities: parseInt(values[12]) || 0,
        photo: values[13],
        description: values[14],
        url: values[15],
        createdAt: values[16],
      });
    }
  }

  return centers;
}

// Convertit un centre Anybuddy en PadelCourt
function convertToPadelCourt(center: AnybuddyCenter): PadelCourt {
  return {
    id: `anybuddy_${center.id}`,
    anybuddyId: center.id,
    name: center.name,
    address: center.address,
    city: center.city,
    postalCode: center.postalCode,
    country: center.country,
    lat: center.lat,
    lng: center.lng,
    totalCourts: center.nbFacilities,
    indoorCourts: 0, // Non disponible dans l'API
    outdoorCourts: 0, // Non disponible dans l'API
    source: ["anybuddy"],
    url: center.url,
    imageUrl: center.photo || undefined,
    priceMin: center.priceMin || undefined,
    priceMax: center.priceMax || undefined,
  };
}

// Scrape Anybuddy pour tous les centres de padel
export async function scrapeAnybuddy(
  countryFilter: string | string[] = ["FR", "BE"],
  onProgress?: (found: number) => void
): Promise<PadelCourt[]> {
  const countries = Array.isArray(countryFilter) ? countryFilter : [countryFilter];
  console.log(`Démarrage scraping Anybuddy pour: ${countries.join(", ")}...`);

  try {
    const response = await fetch(ANYBUDDY_API, {
      headers: {
        "Accept": "text/csv",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Anybuddy API error: ${response.status}`);
    }

    const csv = await response.text();
    const allCenters = parseCSV(csv);

    // Filtrer par pays et activité padel
    const padelCenters = allCenters.filter(
      (c) => c.activity === "padel" && countries.includes(c.country)
    );

    if (onProgress) {
      onProgress(padelCenters.length);
    }

    const courts = padelCenters.map(convertToPadelCourt);

    console.log(`Scraping Anybuddy terminé: ${courts.length} centres de padel (${countries.join(", ")})`);

    return courts;
  } catch (error) {
    console.error("Erreur scraping Anybuddy:", error);
    throw error;
  }
}

// Test avec quelques résultats
export async function testAnybuddyScraper(): Promise<PadelCourt[]> {
  const courts = await scrapeAnybuddy("FR");
  return courts.slice(0, 10);
}
