import type { ToolDefinition, ToolHandler } from "../../../types.js";

export const STAR_ALLIANCE: Record<string, string> = {
  UA: "United Airlines",
  AC: "Air Canada",
  LH: "Lufthansa",
  LX: "SWISS",
  OS: "Austrian",
  SN: "Brussels Airlines",
  NH: "ANA",
  SQ: "Singapore Airlines",
  TK: "Turkish Airlines",
  TG: "THAI",
  NZ: "Air New Zealand",
  OZ: "Asiana Airlines",
  CA: "Air China",
  ZH: "Shenzhen Airlines",
  AI: "Air India",
  AV: "Avianca",
  CM: "Copa Airlines",
  TP: "TAP Air Portugal",
  LO: "LOT Polish Airlines",
  MS: "EGYPTAIR",
  ET: "Ethiopian Airlines",
  BR: "EVA Air",
  SA: "South African Airways",
  OU: "Croatia Airlines",
};

export const UA_PARTNERS: Record<string, string> = {
  JS: "JSX",
  "9K": "Cape Air",
  "3M": "Silver Airways",
  AD: "Azul",
  EI: "Aer Lingus",
  VA: "Virgin Australia",
  HA: "Hawaiian Airlines",
};

export const ALL_ALLOWED: Record<string, string> = {
  ...STAR_ALLIANCE,
  ...UA_PARTNERS,
};

export const DEFAULT_INCLUDE = Object.keys(ALL_ALLOWED).join(",");

export const listAirlinesTool: ToolDefinition = {
  name: "flight_list_airlines",
  description:
    "List the airline carrier allowlist used by default for flight searches: Star Alliance members plus United's non-alliance partners.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

export const listAirlinesHandler: ToolHandler = async () => {
  const starLines = Object.entries(STAR_ALLIANCE)
    .map(([code, name]) => `  ${code}  ${name}`)
    .join("\n");
  const partnerLines = Object.entries(UA_PARTNERS)
    .map(([code, name]) => `  ${code}  ${name}`)
    .join("\n");

  return {
    content: [{
      type: "text",
      text: [
        "Star Alliance members:",
        starLines,
        "",
        "United non-alliance partners:",
        partnerLines,
        "",
        `Default include_airlines value: ${DEFAULT_INCLUDE}`,
      ].join("\n"),
    }],
  };
};
