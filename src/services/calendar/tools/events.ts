import { getCalendarClient, resolveAccount } from "../client.js";
import type { ToolDefinition, ToolHandler } from "../../../types.js";
import type { calendar_v3 } from "googleapis";

const ACCOUNT_PARAM = {
  account: {
    type: "string",
    description: 'Account ID to use (e.g. "personal", "pm-personal"). Defaults to "personal".',
  },
};

/**
 * Build a Calendar API EventDateTime from a flexible string input.
 * - "YYYY-MM-DD"            → all-day event ({ date })
 * - "YYYY-MM-DDTHH:mm[...]" → timed event ({ dateTime, timeZone? })
 *
 * If the datetime string lacks a timezone offset (e.g. "2026-05-15T10:00:00"),
 * the optional `timeZone` argument is required so the API can resolve it.
 */
function buildEventDateTime(value: string, timeZone?: string): calendar_v3.Schema$EventDateTime {
  const isDateOnly = !value.includes("T");
  if (isDateOnly) {
    return { date: value };
  }
  const out: calendar_v3.Schema$EventDateTime = { dateTime: value };
  if (timeZone) out.timeZone = timeZone;
  return out;
}

export const createEventTool: ToolDefinition = {
  name: "calendar_create_event",
  description:
    "Create an event on a Google Calendar. Use 'YYYY-MM-DD' strings for all-day events, " +
    "or 'YYYY-MM-DDTHH:mm:ss' (with optional timezone offset like '-07:00' or 'Z') for timed events. " +
    "If a timed event has no offset in the string, pass time_zone (e.g. 'America/Los_Angeles').",
  inputSchema: {
    type: "object",
    properties: {
      calendar_id: {
        type: "string",
        description: "Calendar ID. Use 'primary' for the account's primary calendar (the default). Use calendar_list_calendars to find other IDs.",
      },
      summary: { type: "string", description: "Event title" },
      start: { type: "string", description: "Start as ISO date (YYYY-MM-DD) or datetime (YYYY-MM-DDTHH:mm:ss[±HH:MM|Z])" },
      end: { type: "string", description: "End as ISO date or datetime; for all-day events, end is exclusive" },
      time_zone: {
        type: "string",
        description: "IANA timezone (e.g. 'America/Los_Angeles'). Required for timed events whose start/end strings have no offset; ignored for all-day events.",
      },
      description: { type: "string", description: "Event description / notes" },
      location: { type: "string", description: "Event location (free text or address)" },
      attendees: {
        type: "array",
        items: { type: "string" },
        description: "Attendee email addresses",
      },
      send_updates: {
        type: "string",
        enum: ["all", "externalOnly", "none"],
        description: "Whether to email invitations. Defaults to 'none'. Use 'all' to send to every attendee.",
      },
      ...ACCOUNT_PARAM,
    },
    required: ["summary", "start", "end"],
  },
};

export const createEventHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const calendar = await getCalendarClient(accountId);

  const calendarId = (args.calendar_id as string | undefined)?.trim() || "primary";
  const summary = args.summary as string;
  const startStr = args.start as string;
  const endStr = args.end as string;
  const timeZone = args.time_zone as string | undefined;

  const requestBody: calendar_v3.Schema$Event = {
    summary,
    start: buildEventDateTime(startStr, timeZone),
    end: buildEventDateTime(endStr, timeZone),
  };

  if (args.description) requestBody.description = args.description as string;
  if (args.location) requestBody.location = args.location as string;
  if (Array.isArray(args.attendees) && args.attendees.length > 0) {
    requestBody.attendees = (args.attendees as string[]).map((email) => ({ email }));
  }

  const sendUpdates = (args.send_updates as string | undefined) ?? "none";

  const res = await calendar.events.insert({
    calendarId,
    sendUpdates,
    requestBody,
  });

  const event = res.data;
  const startOut = event.start?.dateTime ?? event.start?.date ?? "(unknown)";
  const endOut = event.end?.dateTime ?? event.end?.date ?? "(unknown)";

  return {
    content: [{
      type: "text",
      text: [
        `Event created in account "${accountId}" on calendar "${calendarId}":`,
        `  id: ${event.id}`,
        `  summary: ${event.summary}`,
        `  start: ${startOut}`,
        `  end: ${endOut}`,
        event.location ? `  location: ${event.location}` : null,
        event.attendees?.length
          ? `  attendees: ${event.attendees.map((a) => a.email).join(", ")}`
          : null,
        event.htmlLink ? `  link: ${event.htmlLink}` : null,
      ].filter(Boolean).join("\n"),
    }],
  };
};

export const deleteEventTool: ToolDefinition = {
  name: "calendar_delete_event",
  description:
    "Delete an event from a Google Calendar by ID. The deletion is permanent (the event is moved to the Calendar trash and removed from the visible calendar).",
  inputSchema: {
    type: "object",
    properties: {
      event_id: { type: "string", description: "The Calendar event ID (returned by calendar_create_event or via list/get tools)" },
      calendar_id: {
        type: "string",
        description: "Calendar ID the event lives on. Use 'primary' for the account's primary calendar (the default).",
      },
      send_updates: {
        type: "string",
        enum: ["all", "externalOnly", "none"],
        description: "Whether to email a cancellation to attendees. Defaults to 'none'.",
      },
      ...ACCOUNT_PARAM,
    },
    required: ["event_id"],
  },
};

export const deleteEventHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const calendar = await getCalendarClient(accountId);

  const calendarId = (args.calendar_id as string | undefined)?.trim() || "primary";
  const eventId = args.event_id as string;
  const sendUpdates = (args.send_updates as string | undefined) ?? "none";

  await calendar.events.delete({ calendarId, eventId, sendUpdates });

  return {
    content: [{
      type: "text",
      text: `Event ${eventId} deleted from calendar "${calendarId}" in account "${accountId}".`,
    }],
  };
};

function formatEventDetail(event: calendar_v3.Schema$Event, accountId: string, calendarId: string): string {
  const startOut = event.start?.dateTime ?? event.start?.date ?? "(unknown)";
  const endOut = event.end?.dateTime ?? event.end?.date ?? "(unknown)";
  return [
    `Account: ${accountId}`,
    `Calendar: ${calendarId}`,
    `ID: ${event.id}`,
    `Summary: ${event.summary ?? "(no summary)"}`,
    `Start: ${startOut}`,
    `End: ${endOut}`,
    event.location ? `Location: ${event.location}` : null,
    event.status ? `Status: ${event.status}` : null,
    event.attendees?.length
      ? `Attendees: ${event.attendees.map((a) => `${a.email}${a.responseStatus ? ` (${a.responseStatus})` : ""}`).join(", ")}`
      : null,
    event.organizer?.email ? `Organizer: ${event.organizer.email}` : null,
    event.htmlLink ? `Link: ${event.htmlLink}` : null,
    event.description ? `\n${event.description}` : null,
  ].filter(Boolean).join("\n");
}

export const getEventTool: ToolDefinition = {
  name: "calendar_get_event",
  description: "Read the full details of a single Calendar event by ID.",
  inputSchema: {
    type: "object",
    properties: {
      event_id: { type: "string", description: "The Calendar event ID" },
      calendar_id: {
        type: "string",
        description: "Calendar ID the event lives on. Defaults to 'primary'.",
      },
      ...ACCOUNT_PARAM,
    },
    required: ["event_id"],
  },
};

export const getEventHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const calendar = await getCalendarClient(accountId);

  const calendarId = (args.calendar_id as string | undefined)?.trim() || "primary";
  const eventId = args.event_id as string;

  const res = await calendar.events.get({ calendarId, eventId });
  return {
    content: [{ type: "text", text: formatEventDetail(res.data, accountId, calendarId) }],
  };
};

export const listEventsTool: ToolDefinition = {
  name: "calendar_list_events",
  description:
    "List events on a calendar. Defaults to upcoming events from now onward. Recurring events are expanded into individual instances and ordered by start time.",
  inputSchema: {
    type: "object",
    properties: {
      calendar_id: {
        type: "string",
        description: "Calendar ID. Defaults to 'primary'. Use calendar_list_calendars to find other IDs.",
      },
      time_min: {
        type: "string",
        description: "Lower bound (RFC3339 datetime, e.g. '2026-05-09T00:00:00-07:00' or '2026-05-09T00:00:00Z'). Defaults to now.",
      },
      time_max: {
        type: "string",
        description: "Upper bound (RFC3339 datetime). Optional; if omitted the range is open-ended.",
      },
      query: {
        type: "string",
        description: "Free-text search across summary, description, location, attendees, and creator/organizer.",
      },
      max_results: {
        type: "number",
        description: "Maximum number of events to return (default 25, API max 2500).",
      },
      ...ACCOUNT_PARAM,
    },
  },
};

export const listEventsHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const calendar = await getCalendarClient(accountId);

  const calendarId = (args.calendar_id as string | undefined)?.trim() || "primary";
  const timeMin = (args.time_min as string | undefined) ?? new Date().toISOString();
  const timeMax = args.time_max as string | undefined;
  const q = args.query as string | undefined;
  const maxResults = typeof args.max_results === "number" ? args.max_results : 25;

  const res = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    q,
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });

  const items = res.data.items ?? [];
  if (items.length === 0) {
    return { content: [{ type: "text", text: `No events found on calendar "${calendarId}" in account "${accountId}" for the given range.` }] };
  }

  const lines = items.map((e) => {
    const start = e.start?.dateTime ?? e.start?.date ?? "?";
    const end = e.end?.dateTime ?? e.end?.date ?? "?";
    const summary = e.summary ?? "(no summary)";
    const loc = e.location ? ` @ ${e.location}` : "";
    return `  [${e.id}] ${start} → ${end}\n    ${summary}${loc}`;
  });

  const rangeStr = timeMax ? `${timeMin} to ${timeMax}` : `from ${timeMin}`;
  return {
    content: [{
      type: "text",
      text: `Events on calendar "${calendarId}" in account "${accountId}" (${items.length}, ${rangeStr}):\n\n${lines.join("\n\n")}`,
    }],
  };
};

export const updateEventTool: ToolDefinition = {
  name: "calendar_update_event",
  description:
    "Patch fields on an existing Calendar event. Only the fields you provide are changed; everything else is preserved. " +
    "When updating start or end, follow the same date/datetime conventions as calendar_create_event. " +
    "Note: providing attendees replaces the entire attendee list.",
  inputSchema: {
    type: "object",
    properties: {
      event_id: { type: "string", description: "The Calendar event ID" },
      calendar_id: {
        type: "string",
        description: "Calendar ID the event lives on. Defaults to 'primary'.",
      },
      summary: { type: "string", description: "New event title" },
      start: { type: "string", description: "New start (ISO date or datetime)" },
      end: { type: "string", description: "New end (ISO date or datetime)" },
      time_zone: {
        type: "string",
        description: "IANA timezone for new timed start/end if they have no offset.",
      },
      description: { type: "string", description: "New event description (replaces existing)" },
      location: { type: "string", description: "New location (replaces existing)" },
      attendees: {
        type: "array",
        items: { type: "string" },
        description: "New attendee email list. Replaces the entire existing attendee list.",
      },
      send_updates: {
        type: "string",
        enum: ["all", "externalOnly", "none"],
        description: "Whether to email attendees about the change. Defaults to 'none'.",
      },
      ...ACCOUNT_PARAM,
    },
    required: ["event_id"],
  },
};

export const updateEventHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const calendar = await getCalendarClient(accountId);

  const calendarId = (args.calendar_id as string | undefined)?.trim() || "primary";
  const eventId = args.event_id as string;
  const timeZone = args.time_zone as string | undefined;

  const requestBody: calendar_v3.Schema$Event = {};
  if (typeof args.summary === "string") requestBody.summary = args.summary;
  if (typeof args.description === "string") requestBody.description = args.description;
  if (typeof args.location === "string") requestBody.location = args.location;
  if (typeof args.start === "string") requestBody.start = buildEventDateTime(args.start, timeZone);
  if (typeof args.end === "string") requestBody.end = buildEventDateTime(args.end, timeZone);
  if (Array.isArray(args.attendees)) {
    requestBody.attendees = (args.attendees as string[]).map((email) => ({ email }));
  }

  if (Object.keys(requestBody).length === 0) {
    throw new Error("calendar_update_event requires at least one field to change.");
  }

  const sendUpdates = (args.send_updates as string | undefined) ?? "none";

  const res = await calendar.events.patch({
    calendarId,
    eventId,
    sendUpdates,
    requestBody,
  });

  return {
    content: [{
      type: "text",
      text: `Event updated:\n\n${formatEventDetail(res.data, accountId, calendarId)}`,
    }],
  };
};
