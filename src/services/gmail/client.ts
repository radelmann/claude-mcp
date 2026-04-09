import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import { getAuthenticatedClient } from "./auth.js";

export async function getGmailClient(accountId: string): Promise<gmail_v1.Gmail> {
  const auth = await getAuthenticatedClient(accountId);
  return google.gmail({ version: "v1", auth });
}

export function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }
  if (payload.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
    const part = textPart ?? htmlPart;
    if (part?.body?.data) {
      return Buffer.from(part.body.data, "base64url").toString("utf-8");
    }
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }
  return "";
}

export function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export function resolveAccount(args: Record<string, unknown>): string {
  return typeof args.account === "string" && args.account.trim()
    ? args.account.trim()
    : "personal";
}
