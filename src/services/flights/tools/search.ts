import { searchFlights } from "../client.js";
import { DEFAULT_INCLUDE } from "./airlines.js";
import type { ToolDefinition, ToolHandler } from "../../../types.js";

const CABIN_MAP: Record<string, 1 | 2 | 3 | 4> = {
  economy: 1,
  premium_economy: 2,
  business: 3,
  first: 4,
};

const STOPS_MAP: Record<string, 0 | 1 | 2> = {
  any: 0,
  one_or_fewer: 1,
  nonstop: 2,
};

export const flightSearchTool: ToolDefinition = {
  name: "flight_search",
  description:
    "Search for one-way or round-trip flights on United Airlines and Star Alliance partners (plus UA non-alliance partners). " +
    "Returns available itineraries with prices, duration, and stop details. " +
    "Override airlines with the include_airlines param if needed.",
  inputSchema: {
    type: "object",
    properties: {
      origin: { type: "string", description: "Origin airport IATA code (e.g. SFO)" },
      destination: { type: "string", description: "Destination airport IATA code (e.g. NRT)" },
      depart_date: { type: "string", description: "Departure date in YYYY-MM-DD format" },
      return_date: {
        type: "string",
        description: "Return date in YYYY-MM-DD for round-trip. Omit for one-way.",
      },
      cabin: {
        type: "string",
        enum: ["economy", "premium_economy", "business", "first"],
        description: "Cabin class. Defaults to economy.",
      },
      adults: { type: "number", description: "Number of adult passengers (default 1)" },
      children: { type: "number", description: "Number of child passengers (default 0)" },
      stops: {
        type: "string",
        enum: ["any", "one_or_fewer", "nonstop"],
        description: "Stop filter. Defaults to any.",
      },
      include_airlines: {
        type: "string",
        description: "Comma-separated IATA codes to override the default Star Alliance + UA partners allowlist.",
      },
      currency: { type: "string", description: "Currency code for prices (e.g. USD). Defaults to USD." },
      max_price: { type: "number", description: "Maximum price filter in the specified currency." },
    },
    required: ["origin", "destination", "depart_date"],
  },
};

export const flightSearchHandler: ToolHandler = async (args) => {
  const origin = (args.origin as string).toUpperCase();
  const destination = (args.destination as string).toUpperCase();
  const depart_date = args.depart_date as string;
  const return_date = args.return_date as string | undefined;
  const cabin = (args.cabin as string | undefined) ?? "economy";
  const adults = (args.adults as number | undefined) ?? 1;
  const children = (args.children as number | undefined) ?? 0;
  const stops = (args.stops as string | undefined) ?? "any";
  const include_airlines = (args.include_airlines as string | undefined) ?? DEFAULT_INCLUDE;
  const currency = (args.currency as string | undefined) ?? "USD";
  const max_price = args.max_price as number | undefined;

  const result = await searchFlights({
    departure_id: origin,
    arrival_id: destination,
    outbound_date: depart_date,
    return_date,
    type: return_date ? 1 : 2,
    adults,
    children,
    travel_class: CABIN_MAP[cabin] ?? 1,
    include_airlines,
    stops: STOPS_MAP[stops] ?? 0,
    currency,
    max_price,
  });

  return {
    content: [{ type: "text", text: formatResults(result, origin, destination, cabin, currency) }],
  };
};

function formatResults(data: unknown, origin: string, dest: string, cabin: string, currency: string): string {
  const d = data as Record<string, unknown>;

  if (d.error) return `SerpAPI error: ${d.error}`;

  const sections: string[] = [];

  for (const key of ["best_flights", "other_flights"] as const) {
    const flights = d[key] as unknown[] | undefined;
    if (!flights?.length) continue;

    sections.push(`${key === "best_flights" ? "Best" : "Other"} flights (${origin} → ${dest}, ${cabin}, ${currency}):`);
    for (const f of flights) {
      sections.push(formatItinerary(f as Record<string, unknown>));
    }
  }

  if (sections.length === 0) return `No flights found for ${origin} → ${dest} on the requested dates with the selected carriers.`;

  const priceInsights = d.price_insights as Record<string, unknown> | undefined;
  if (priceInsights?.lowest_price != null) {
    sections.push(`\nLowest available price: ${currency} ${priceInsights.lowest_price}`);
  }

  return sections.join("\n");
}

function formatItinerary(f: Record<string, unknown>): string {
  const price = f.price != null ? `${f.price}` : "N/A";
  const duration = f.total_duration != null ? `${Math.floor(Number(f.total_duration) / 60)}h ${Number(f.total_duration) % 60}m` : "";
  const legs = (f.flights as unknown[] | undefined) ?? [];

  const legLines = legs.map((leg) => {
    const l = leg as Record<string, unknown>;
    const dep = l.departure_airport as Record<string, unknown> | undefined;
    const arr = l.arrival_airport as Record<string, unknown> | undefined;
    const airline = l.airline as string | undefined;
    const flight_number = l.flight_number as string | undefined;
    const travel_class = l.travel_class as string | undefined;
    return `  ${dep?.id ?? "?"} ${dep?.time ?? ""} → ${arr?.id ?? "?"} ${arr?.time ?? ""}  ${airline ?? ""}${flight_number ? " " + flight_number : ""}${travel_class ? " [" + travel_class + "]" : ""}`;
  });

  const layovers = (f.layovers as unknown[] | undefined) ?? [];
  const layoverLines = layovers.map((ly) => {
    const l = ly as Record<string, unknown>;
    const mins = Number(l.duration ?? 0);
    return `  Layover ${l.id ?? "?"}: ${Math.floor(mins / 60)}h ${mins % 60}m${l.overnight ? " (overnight)" : ""}`;
  });

  const lines = [`Price: ${price}  Duration: ${duration}`, ...legLines];
  if (layoverLines.length) lines.push(...layoverLines);
  if (f.carbon_emissions) {
    const co2 = f.carbon_emissions as Record<string, unknown>;
    if (co2.this_flight != null) lines.push(`  CO₂: ${co2.this_flight}g`);
  }
  return lines.join("\n");
}
