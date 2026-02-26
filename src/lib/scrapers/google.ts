import { PadelCourt, GridPoint } from "@/types";

const GOOGLE_PLACES_API = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
const RADIUS_METERS = 30000;
const DELAY_MS = 250;
const MAX_REQUESTS = 2000; // Increased to cover full grid
const KEYWORD = "padel";

interface GooglePlace {
  place_id: string;
  name: string;
  vicinity?: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  business_status?: string;
  rating?: number;
  user_ratings_total?: number;
  photos?: { photo_reference: string }[];
}

interface GooglePlacesResponse {
  results: GooglePlace[];
  next_page_token?: string;
  status: string;
  error_message?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPlaces(apiKey: string, lat: number, lng: number): Promise<GooglePlace[]> {
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: RADIUS_METERS.toString(),
    keyword: KEYWORD,
    key: apiKey,
  });

  try {
    const response = await fetch(`${GOOGLE_PLACES_API}?${params}`);
    const data: GooglePlacesResponse = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error(`Google Places API error: ${data.status} - ${data.error_message}`);
      return [];
    }

    return data.results || [];
  } catch (error) {
    console.error(`Erreur fetch Google Places (${lat}, ${lng}):`, error);
    return [];
  }
}

function convertToPadelCourt(place: GooglePlace): PadelCourt {
  const lat = place.geometry.location.lat;
  const lng = place.geometry.location.lng;

  const vicinity = place.vicinity || "";
  const parts = vicinity.split(", ");
  const city = parts[parts.length - 1] || "";
  const address = parts.slice(0, -1).join(", ");

  return {
    id: `google_${place.place_id}`,
    googlePlaceId: place.place_id,
    name: place.name,
    address,
    city,
    postalCode: "",
    country: "OTHER", // Sera déterminé par cleanup via le code postal ou coordonnées
    lat,
    lng,
    totalCourts: 0,
    indoorCourts: 0,
    outdoorCourts: 0,
    source: ["google"],
    imageUrl: place.photos?.[0]?.photo_reference
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=API_KEY`
      : undefined,
  };
}

export async function scrapeGoogle(
  apiKey: string,
  points: GridPoint[],
  onProgress?: (completed: number, total: number, found: number) => void
): Promise<PadelCourt[]> {
  const allPlaces = new Map<string, GooglePlace>();
  let completed = 0;
  let requestCount = 0;

  const limitedPoints = points.slice(0, MAX_REQUESTS);

  console.log(`Démarrage scraping Google Places: ${limitedPoints.length} points`);

  for (const point of limitedPoints) {
    if (requestCount >= MAX_REQUESTS) {
      console.log(`Limite de ${MAX_REQUESTS} requêtes atteinte`);
      break;
    }

    const places = await fetchPlaces(apiKey, point.lat, point.lng);
    requestCount++;

    // Garder TOUS les résultats (pas de filtrage géographique)
    for (const place of places) {
      if (
        place.place_id &&
        !allPlaces.has(place.place_id) &&
        place.business_status !== "CLOSED_PERMANENTLY"
      ) {
        allPlaces.set(place.place_id, place);
      }
    }

    completed++;
    if (onProgress) onProgress(completed, limitedPoints.length, allPlaces.size);

    console.log(`[${completed}/${limitedPoints.length}] ${point.name}: ${places.length} trouvés (total: ${allPlaces.size})`);

    if (completed < limitedPoints.length) await delay(DELAY_MS);
  }

  const courts = Array.from(allPlaces.values()).map(convertToPadelCourt);
  console.log(`Scraping Google terminé: ${courts.length} clubs`);

  return courts;
}

export async function testGoogleScraper(apiKey: string): Promise<PadelCourt[]> {
  const testPoints: GridPoint[] = [
    { lat: 48.8566, lng: 2.3522, name: "Paris" },
    { lat: 50.8503, lng: 4.3517, name: "Bruxelles" },
  ];
  return scrapeGoogle(apiKey, testPoints);
}
