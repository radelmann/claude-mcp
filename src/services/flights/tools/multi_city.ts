import { searchMultiCity } from "../client.js";
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

export const flightSearchMultiCityTool: ToolDefinition = {
  name: "flight_search_multi_city",
  description:
    "Search for multi-city itineraries on United Airlines and Star Alliance partners (plus UA non-alliance partners). " +
    "Provide an ordered array of legs, each with origin, destination, and date.",
  inputSchema: {
    type: "object",
    properties: {
      legs: {
        type: "array",
        description: "Ordered list of flight legs (minimum 2).",
        items: {
          type: "object",
          properties: {
            origin: { type: "string", description: "Origin airport IATA code" },
            destination: { type: "string", description: "Destination airport IATA code" },
            date: { type: "string", description: "Departure date in YYYY-MM-DD format" },
          },
          required: ["origin", "destination", "date"],
        },
        minItems: 2,
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
        description: "Stop filter per leg. Defaults to any.",
      },
      include_airlines: {
        type: "string",
        description: "Comma-separated IATA codes to override the default allowlist.",
      },
      currency: { type: "string", description: "Currency code (default USD)." },
      max_price: { type: "number", description: "Maximum total price." },
    },
    required: ["legs"],
  },
};

export const flightSearchMultiCityHandler: ToolHandler = async (args) => {
  const rawLegs = args.legs as Array<Record<string, string>>;
  const legs = rawLegs.map((l) => ({
    departure_id: l.origin.toUpperCase(),
    arrival_id: l.destination.toUpperCase(),
    date: l.date,
  }));

  const cabin = (args.cabin as string | undefined) ?? "economy";
  const adults = (args.adults as number | undefined) ?? 1;
  const children = (args.children as number | undefined) ?? 0;
  const stops = (args.stops as string | undefined) ?? "any";
  const include_airlines = (args.include_airlines as string | undefined) ?? DEFAULT_INCLUDE;
  const currency = (args.currency as string | undefined) ?? "USD";
  const max_price = args.max_price as number | undefined;

  const result = await searchMultiCity({
    multi_city_json: legs,
    adults,
    children,
    travel_class: CABIN_MAP[cabin] ?? 1,
    include_airlines,
    stops: STOPS_MAP[stops] ?? 0,
    currency,
    max_price,
  });

  const d = result as Record<string, unknown>;
  if (d.error) return { content: [{ type: "text", text: `SerpAPI error: ${d.error}` }] };

  const routeStr = legs.map((l) => `${l.departure_id}→${l.arrival_id}`).join(", ");
  const sections: string[] = [`Multi-city results (${routeStr}, ${cabin}, ${currency}):`];

  for (const key of ["best_flights", "other_flights"] as const) {
    const flights = d[key] as unknown[] | undefined;
    if (!flights?.length) continue;
    sections.push(`\n${key === "best_flights" ? "Best" : "Other"} options:`);
    for (const f of flights) {
      const fi = f as Record<string, unknown>;
      const price = fi.price ?? "N/A";
      const mins = Number(fi.total_duration ?? 0);
      const duration = mins ? `${Math.floor(mins / 60)}h ${mins % 60}m` : "";
      sections.push(`  Price: ${price}  Total duration: ${duration}`);
      const fLegs = (fi.flights as unknown[] | undefined) ?? [];
      for (const leg of fLegs) {
        const l = leg as Record<string, unknown>;
        const dep = l.departure_airport as Record<string, unknown> | undefined;
        const arr = l.arrival_airport as Record<string, unknown> | undefined;
        sections.push(
          `    ${dep?.id ?? "?"} ${dep?.time ?? ""} → ${arr?.id ?? "?"} ${arr?.time ?? ""}  ${l.airline ?? ""}${l.flight_number ? " " + l.flight_number : ""}`
        );
      }
    }
  }

  if (sections.length === 1) {
    sections.push("No itineraries found for the requested legs and carriers.");
  }

  return { content: [{ type: "text", text: sections.join("\n") }] };
};
