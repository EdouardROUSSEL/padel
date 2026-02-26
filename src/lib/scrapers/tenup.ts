import { PadelCourt, GridPoint } from "@/types";

const TENUP_API = "https://tenup.fft.fr/back/public/v1/locations-horaires";
const DISTANCE_KM = 30; // Max allowed by API
const DELAY_MS = 300; // Délai entre requêtes

// Retourne le prochain jeudi dans ~14 jours
function getSearchDate(): string {
  const now = new Date();
  const target = new Date(now);
  target.setDate(now.getDate() + 14);

  // Ajuster au jeudi suivant (jour 4)
  const dayOfWeek = target.getDay();
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  target.setDate(target.getDate() + daysUntilThursday);

  // Mettre à 10h du matin
  target.setHours(10, 0, 0, 0);

  return target.toISOString();
}

interface TenUpCourt {
  dateFin: string;
  duree: number;
  idParametrage: number;
  nomCourt: string;
  idCourt: number;
  pratique: { code: string; libelle: string };
  surface: { code: string; libelle: string };
  couvert: boolean;
  prix: number;
}

interface TenUpResult {
  codeClub: string;
  nomClub: string;
  idInstallation: number;
  nomInstallation: string;
  adresse1: string | null;
  adresse2: string | null;
  ville: string;
  codePostal: string;
  telephone: string | null;
  photo: string | null;
  lat: number;
  lng: number;
  distance: number;
  creneaux: {
    dateDebut: string;
    courts: TenUpCourt[];
  }[];
}

interface TenUpResponse {
  resultats: TenUpResult[];
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch les clubs pour un point
async function fetchClubs(lat: number, lng: number): Promise<TenUpResult[]> {
  const payload = {
    lat,
    lng,
    distance: DISTANCE_KM,
    date: getSearchDate(),
    pratiques: ["PADEL"],
  };

  try {
    const response = await fetch(TENUP_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://tenup.fft.fr",
        "Referer": "https://tenup.fft.fr/location-horaire/resultats",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Ten'Up API error: ${response.status}`);
      return [];
    }

    const data: TenUpResponse = await response.json();
    return data.resultats || [];
  } catch (error) {
    console.error(`Erreur fetch Ten'Up (${lat}, ${lng}):`, error);
    return [];
  }
}

// Compte le nombre de terrains de padel uniques
function countPadelCourts(result: TenUpResult): number {
  const courtIds = new Set<number>();

  for (const creneau of result.creneaux) {
    for (const court of creneau.courts) {
      if (court.pratique.code === "PADEL") {
        courtIds.add(court.idCourt);
      }
    }
  }

  return courtIds.size;
}

// Vérifie si au moins un terrain est couvert
function hasIndoorCourts(result: TenUpResult): boolean {
  for (const creneau of result.creneaux) {
    for (const court of creneau.courts) {
      if (court.pratique.code === "PADEL" && court.couvert) {
        return true;
      }
    }
  }
  return false;
}

// Convertit un résultat Ten'Up en PadelCourt
function convertToPadelCourt(result: TenUpResult): PadelCourt {
  const totalCourts = countPadelCourts(result);
  const hasIndoor = hasIndoorCourts(result);

  return {
    id: `tenup_${result.codeClub}`,
    tenupId: result.codeClub,
    name: result.nomClub,
    address: [result.adresse1, result.adresse2].filter(Boolean).join(", ") || "",
    city: result.ville,
    postalCode: result.codePostal,
    country: "FR", // Ten'Up = FFT = France uniquement
    lat: result.lat,
    lng: result.lng,
    totalCourts,
    indoorCourts: hasIndoor ? totalCourts : 0, // Approximation
    outdoorCourts: hasIndoor ? 0 : totalCourts,
    source: ["tenup"],
    phone: result.telephone || undefined,
    imageUrl: result.photo || undefined,
  };
}

// Scrape Ten'Up pour une liste de points
export async function scrapeTenUp(
  points: GridPoint[],
  onProgress?: (completed: number, total: number, found: number) => void
): Promise<PadelCourt[]> {
  const allClubs = new Map<string, TenUpResult>();
  let completed = 0;

  console.log(`Démarrage scraping Ten'Up: ${points.length} points`);

  for (const point of points) {
    const results = await fetchClubs(point.lat, point.lng);

    // Dédoublonner par codeClub
    for (const result of results) {
      if (!allClubs.has(result.codeClub)) {
        allClubs.set(result.codeClub, result);
      }
    }

    completed++;
    const found = allClubs.size;

    if (onProgress) {
      onProgress(completed, points.length, found);
    }

    console.log(
      `[${completed}/${points.length}] ${point.name}: ${results.length} trouvés (total unique: ${found})`
    );

    // Délai entre les requêtes
    if (completed < points.length) {
      await delay(DELAY_MS);
    }
  }

  // Convertir en PadelCourt
  const courts = Array.from(allClubs.values()).map(convertToPadelCourt);

  console.log(`Scraping Ten'Up terminé: ${courts.length} clubs uniques`);

  return courts;
}

// Test avec quelques villes
export async function testTenUpScraper(): Promise<PadelCourt[]> {
  const testPoints: GridPoint[] = [
    { lat: 48.8566, lng: 2.3522, name: "Paris" },
    { lat: 45.764, lng: 4.8357, name: "Lyon" },
    { lat: 43.2965, lng: 5.3698, name: "Marseille" },
  ];

  return scrapeTenUp(testPoints);
}
