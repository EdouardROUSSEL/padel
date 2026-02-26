import { PadelCourt, GridPoint } from "@/types";

const PLAYTOMIC_API = "https://api.playtomic.io/v1/tenants";
const RADIUS_METERS = 30000; // 30km
const PAGE_SIZE = 100;
const DELAY_MS = 300; // Délai entre requêtes

// Structure réelle de l'API Playtomic
interface PlaytomicResource {
  resource_id: string;
  name: string;
  sport_id: string;
  is_active: boolean;
  properties: {
    resource_type?: "indoor" | "outdoor";
    resource_size?: "single" | "double";
    resource_feature?: string;
  };
}

interface PlaytomicTenant {
  tenant_id: string;
  tenant_name: string;
  tenant_status: string;
  address: {
    street?: string;
    postal_code?: string;
    city?: string;
    country?: string;
    country_code?: string;
    coordinate: {
      lat: number;
      lon: number;
    };
  };
  images?: string[];
  resources?: PlaytomicResource[];
  sport_ids?: string[];
}

// Délai helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch les résultats pour un point
async function fetchTenants(
  lat: number,
  lng: number,
  size: number = PAGE_SIZE
): Promise<PlaytomicTenant[]> {
  const params = new URLSearchParams({
    coordinate: `${lat},${lng}`,
    sport_id: "PADEL",
    radius: RADIUS_METERS.toString(),
    size: size.toString(),
  });

  const url = `${PLAYTOMIC_API}?${params}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Playtomic/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(`HTTP ${response.status} pour ${lat},${lng}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Erreur fetch Playtomic (${lat}, ${lng}):`, error);
    return [];
  }
}

// Compte les terrains par type depuis les resources
function countCourts(resources?: PlaytomicResource[]): {
  total: number;
  indoor: number;
  outdoor: number;
} {
  if (!resources || resources.length === 0) {
    return { total: 0, indoor: 0, outdoor: 0 };
  }

  // Filtrer seulement les terrains de padel actifs
  const padelCourts = resources.filter(
    (r) => r.sport_id === "PADEL" && r.is_active
  );

  const indoor = padelCourts.filter(
    (r) => r.properties?.resource_type === "indoor"
  ).length;
  const outdoor = padelCourts.filter(
    (r) => r.properties?.resource_type === "outdoor"
  ).length;

  return {
    total: padelCourts.length,
    indoor,
    outdoor,
  };
}

// Convertit un tenant Playtomic en PadelCourt normalisé
function convertToPadelCourt(tenant: PlaytomicTenant): PadelCourt {
  const address = tenant.address || {};
  const coord = address.coordinate || { lat: 0, lon: 0 };
  const courts = countCourts(tenant.resources);

  // Garder le vrai code pays de l'API
  const country = address.country_code?.toUpperCase() || "OTHER";

  return {
    id: `playtomic_${tenant.tenant_id}`,
    playtomicId: tenant.tenant_id,
    name: tenant.tenant_name || "Club sans nom",
    address: address.street || "",
    city: address.city || "",
    postalCode: address.postal_code || "",
    country,
    lat: coord.lat,
    lng: coord.lon,
    totalCourts: courts.total,
    indoorCourts: courts.indoor,
    outdoorCourts: courts.outdoor,
    source: ["playtomic"],
    imageUrl: tenant.images?.[0],
  };
}

// Scrape Playtomic pour une liste de points
export async function scrapePlaytomic(
  points: GridPoint[],
  onProgress?: (completed: number, total: number, found: number) => void
): Promise<PadelCourt[]> {
  const allTenants = new Map<string, PlaytomicTenant>();
  let completed = 0;

  console.log(`Démarrage scraping Playtomic: ${points.length} points`);

  for (const point of points) {
    const tenants = await fetchTenants(point.lat, point.lng);

    // Dédoublonner par tenant_id et ne garder que les clubs actifs
    for (const tenant of tenants) {
      if (
        tenant.tenant_id &&
        tenant.tenant_status === "ACTIVE" &&
        !allTenants.has(tenant.tenant_id)
      ) {
        // Vérifier que c'est bien un club de padel
        if (tenant.sport_ids?.includes("PADEL")) {
          allTenants.set(tenant.tenant_id, tenant);
        }
      }
    }

    completed++;
    const found = allTenants.size;

    if (onProgress) {
      onProgress(completed, points.length, found);
    }

    console.log(
      `[${completed}/${points.length}] ${point.name}: ${tenants.length} trouvés (total unique: ${found})`
    );

    // Délai entre les points
    if (completed < points.length) {
      await delay(DELAY_MS);
    }
  }

  // Garder TOUS les clubs (le filtrage se fait dans /api/cleanup)
  const allTenantsArray = Array.from(allTenants.values());
  console.log(`Scraping Playtomic terminé: ${allTenantsArray.length} clubs trouvés`);

  // Convertir en PadelCourt
  return allTenantsArray.map(convertToPadelCourt);
}

// Test rapide avec quelques villes
export async function testPlaytomicScraper(): Promise<PadelCourt[]> {
  const testPoints: GridPoint[] = [
    { lat: 48.8566, lng: 2.3522, name: "Paris" },
    { lat: 50.8503, lng: 4.3517, name: "Bruxelles" },
  ];

  return scrapePlaytomic(testPoints);
}
