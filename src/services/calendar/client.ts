import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { getAuthenticatedClient } from "../../auth/oauth.js";

export async function getCalendarClient(accountId: string): Promise<calendar_v3.Calendar> {
  const auth = await getAuthenticatedClient(accountId, "calendar");
  return google.calendar({ version: "v3", auth });
}

export function resolveAccount(args: Record<string, unknown>): string {
  return typeof args.account === "string" && args.account.trim()
    ? args.account.trim()
    : "personal";
}
