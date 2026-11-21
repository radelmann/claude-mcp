import gmailService from "./gmail/index.js";
import calendarService from "./calendar/index.js";
import flightsService from "./flights/index.js";
import imessagesService from "./imessages/index.js";
import type { ServiceModule } from "../types.js";

export const SERVICES: ServiceModule[] = [
  gmailService,
  calendarService,
  flightsService,
  imessagesService,
];

export function getAllTools() {
  return SERVICES.flatMap((s) => s.tools);
}

export function getAllHandlers() {
  return Object.fromEntries(SERVICES.flatMap((s) => Object.entries(s.handlers)));
}
