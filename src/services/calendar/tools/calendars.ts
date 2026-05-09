import { getCalendarClient, resolveAccount } from "../client.js";
import { getAccountsConfig } from "../../../config.js";
import { listAuthorizedAccounts } from "../../../auth/token-store.js";
import type { ToolDefinition, ToolHandler } from "../../../types.js";

const ACCOUNT_PARAM = {
  account: {
    type: "string",
    description: 'Account ID to use (e.g. "personal", "pm-personal"). Defaults to "personal".',
  },
};

export const listAccountsTool: ToolDefinition = {
  name: "calendar_list_accounts",
  description: "List all configured Calendar accounts and their authorization status.",
  inputSchema: { type: "object", properties: {} },
};

export const listAccountsHandler: ToolHandler = async () => {
  const config = getAccountsConfig();
  const authorized = listAuthorizedAccounts("calendar");
  const lines = config.accounts
    .filter((a) => a.services.includes("calendar"))
    .map((a) => {
      const status = authorized.includes(a.id) ? "authorized" : "NOT authorized";
      return `${a.id} (${a.label}) — ${status}`;
    });
  return {
    content: [{ type: "text", text: lines.join("\n") || "No Calendar accounts configured." }],
  };
};

export const listCalendarsTool: ToolDefinition = {
  name: "calendar_list_calendars",
  description: "List all calendars accessible to a Google account, including the primary calendar and any shared/subscribed calendars.",
  inputSchema: {
    type: "object",
    properties: { ...ACCOUNT_PARAM },
  },
};

export const listCalendarsHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const calendar = await getCalendarClient(accountId);
  const res = await calendar.calendarList.list();
  const items = res.data.items ?? [];

  if (items.length === 0) {
    return { content: [{ type: "text", text: `No calendars found for account "${accountId}".` }] };
  }

  const lines = items.map((c) => {
    const flags: string[] = [];
    if (c.primary) flags.push("primary");
    if (c.selected) flags.push("selected");
    if (c.accessRole) flags.push(c.accessRole);
    const flagStr = flags.length ? ` [${flags.join(", ")}]` : "";
    const tz = c.timeZone ? ` (${c.timeZone})` : "";
    return `  ${c.id} — ${c.summary}${tz}${flagStr}`;
  });

  return {
    content: [{
      type: "text",
      text: `Calendars for account "${accountId}" (${items.length}):\n\n${lines.join("\n")}`,
    }],
  };
};
