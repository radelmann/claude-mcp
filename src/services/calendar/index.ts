import {
  listAccountsTool, listAccountsHandler,
  listCalendarsTool, listCalendarsHandler,
} from "./tools/calendars.js";
import { createEventTool, createEventHandler } from "./tools/events.js";
import { CALENDAR_SCOPES } from "./auth.js";
import type { ServiceModule } from "../../types.js";

const calendarService: ServiceModule = {
  name: "calendar",
  scopes: CALENDAR_SCOPES,
  tools: [
    listAccountsTool, listCalendarsTool, createEventTool,
  ],
  handlers: {
    calendar_list_accounts: listAccountsHandler,
    calendar_list_calendars: listCalendarsHandler,
    calendar_create_event: createEventHandler,
  },
};

export default calendarService;
