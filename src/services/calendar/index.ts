import {
  listAccountsTool, listAccountsHandler,
  listCalendarsTool, listCalendarsHandler,
} from "./tools/calendars.js";
import {
  createEventTool, createEventHandler,
  deleteEventTool, deleteEventHandler,
} from "./tools/events.js";
import { CALENDAR_SCOPES } from "./auth.js";
import type { ServiceModule } from "../../types.js";

const calendarService: ServiceModule = {
  name: "calendar",
  scopes: CALENDAR_SCOPES,
  tools: [
    listAccountsTool, listCalendarsTool, createEventTool, deleteEventTool,
  ],
  handlers: {
    calendar_list_accounts: listAccountsHandler,
    calendar_list_calendars: listCalendarsHandler,
    calendar_create_event: createEventHandler,
    calendar_delete_event: deleteEventHandler,
  },
};

export default calendarService;
