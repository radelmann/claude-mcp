import gmailService from "./gmail/index.js";
import type { ServiceModule } from "../types.js";

export const SERVICES: ServiceModule[] = [
  gmailService,
  // Future: calendarService, slackService, notionService, ...
];

export function getAllTools() {
  return SERVICES.flatMap((s) => s.tools);
}

export function getAllHandlers() {
  return Object.fromEntries(SERVICES.flatMap((s) => Object.entries(s.handlers)));
}
