import { getSerpApiKey } from "./config.js";

const BASE = "https://serpapi.com/search.json";

export interface FlightSearchParams {
  departure_id: string;
  arrival_id: string;
  outbound_date: string;
  return_date?: string;
  type: 1 | 2; // 1=round-trip, 2=one-way
  adults?: number;
  children?: number;
  travel_class?: 1 | 2 | 3 | 4; // 1=economy, 2=premium_economy, 3=business, 4=first
  include_airlines?: string; // comma-separated IATA codes
  stops?: 0 | 1 | 2; // 0=any, 1=1 stop or fewer, 2=nonstop only
  currency?: string;
  max_price?: number;
}

export interface MultiCityLeg {
  departure_id: string;
  arrival_id: string;
  date: string;
}

export interface MultiCityParams {
  multi_city_json: MultiCityLeg[];
  adults?: number;
  children?: number;
  travel_class?: 1 | 2 | 3 | 4;
  include_airlines?: string;
  stops?: 0 | 1 | 2;
  currency?: string;
  max_price?: number;
}

async function serpGet(params: Record<string, string | number>): Promise<unknown> {
  const qs = new URLSearchParams();
  qs.set("engine", "google_flights");
  qs.set("api_key", getSerpApiKey());
  qs.set("hl", "en");
  for (const [k, v] of Object.entries(params)) {
    qs.set(k, String(v));
  }
  const res = await fetch(`${BASE}?${qs}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SerpAPI error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function searchFlights(p: FlightSearchParams): Promise<unknown> {
  const params: Record<string, string | number> = {
    departure_id: p.departure_id,
    arrival_id: p.arrival_id,
    outbound_date: p.outbound_date,
    type: p.type,
  };
  if (p.return_date) params.return_date = p.return_date;
  if (p.adults != null) params.adults = p.adults;
  if (p.children != null) params.children = p.children;
  if (p.travel_class != null) params.travel_class = p.travel_class;
  if (p.include_airlines) params.include_airlines = p.include_airlines;
  if (p.stops != null) params.stops = p.stops;
  if (p.currency) params.currency = p.currency;
  if (p.max_price != null) params.max_price = p.max_price;
  return serpGet(params);
}

export async function searchMultiCity(p: MultiCityParams): Promise<unknown> {
  const params: Record<string, string | number> = {
    type: 3,
    multi_city_json: JSON.stringify(p.multi_city_json),
  };
  if (p.adults != null) params.adults = p.adults;
  if (p.children != null) params.children = p.children;
  if (p.travel_class != null) params.travel_class = p.travel_class;
  if (p.include_airlines) params.include_airlines = p.include_airlines;
  if (p.stops != null) params.stops = p.stops;
  if (p.currency) params.currency = p.currency;
  if (p.max_price != null) params.max_price = p.max_price;
  return serpGet(params);
}
