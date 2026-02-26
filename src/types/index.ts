// Types pour les terrains de padel

export interface PadelCourt {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: "FR" | "BE" | "ES" | string;
  lat: number;
  lng: number;
  totalCourts: number;
  indoorCourts: number;
  outdoorCourts: number;
  source: ("playtomic" | "osm" | "google" | "tenup")[];
  googlePlaceId?: string;
  playtomicId?: string;
  osmId?: string;
  tenupId?: string;
  phone?: string;
  website?: string;
  imageUrl?: string;
  // Données enrichies
  department?: string; // FR: 75, 33, etc. / BE: province
  region?: string;
  population?: number; // Population de la commune
}

export interface PlaytomicTenant {
  tenant_id: string;
  tenant_name: string;
  address: {
    street: string;
    city: string;
    postal_code: string;
    country: string;
    coordinate: {
      lat: number;
      lon: number;
    };
  };
  images?: { url: string }[];
  properties?: {
    number_of_courts?: number;
    indoor_courts?: number;
    outdoor_courts?: number;
  };
  contact?: {
    phone?: string;
    website?: string;
  };
}

export interface PlaytomicResponse {
  tenants: PlaytomicTenant[];
  pagination: {
    total: number;
    page: number;
    size: number;
  };
}

export interface OSMElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    sport?: string;
    "addr:street"?: string;
    "addr:city"?: string;
    "addr:postcode"?: string;
    indoor?: string;
    leisure?: string;
  };
}

export interface GridPoint {
  lat: number;
  lng: number;
  name: string;
}

export interface ScrapingProgress {
  total: number;
  completed: number;
  found: number;
  errors: string[];
}
