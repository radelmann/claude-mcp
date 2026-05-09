import {
  listAccountsTool, listAccountsHandler,
  listCalendarsTool, listCalendarsHandler,
} from "./tools/calendars.js";
import {
  createEventTool, createEventHandler,
  deleteEventTool, deleteEventHandler,
  getEventTool, getEventHandler,
  listEventsTool, listEventsHandler,
  updateEventTool, updateEventHandler,
} from "./tools/events.js";
import { CALENDAR_SCOPES } from "./auth.js";
import type { ServiceModule } from "../../types.js";

const calendarService: ServiceModule = {
  name: "calendar",
  scopes: CALENDAR_SCOPES,
  tools: [
    listAccountsTool, listCalendarsTool,
    listEventsTool, getEventTool, createEventTool, updateEventTool, deleteEventTool,
  ],
  handlers: {
    calendar_list_accounts: listAccountsHandler,
    calendar_list_calendars: listCalendarsHandler,
    calendar_list_events: listEventsHandler,
    calendar_get_event: getEventHandler,
    calendar_create_event: createEventHandler,
    calendar_update_event: updateEventHandler,
    calendar_delete_event: deleteEventHandler,
  },
};

export default calendarService;
