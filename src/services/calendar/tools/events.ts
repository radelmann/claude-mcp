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
