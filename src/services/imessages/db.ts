import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";

const DB_PATH = join(homedir(), "Library", "Messages", "chat.db");

// Apple epoch starts 2001-01-01; dates stored as nanoseconds since then
const APPLE_EPOCH_OFFSET = 978307200;

export function openDb(): Database.Database {
  return new Database(DB_PATH, { readonly: true, fileMustExist: true });
}

export function appleTimeToDate(appleTime: number): Date {
  const seconds = appleTime > 1e12 ? appleTime / 1e9 : appleTime;
  return new Date((seconds + APPLE_EPOCH_OFFSET) * 1000);
}

export function formatDate(appleTime: number | null): string {
  if (!appleTime) return "unknown";
  return appleTimeToDate(appleTime).toISOString().replace("T", " ").slice(0, 19);
}

export interface ConversationRow {
  id: number;
  guid: string;
  display_name: string | null;
  service_name: string;
  participants: string | null;
  message_count: number;
  last_message_date: number | null;
  last_message_text: string | null;
}

export interface MessageRow {
  id: number;
  text: string | null;
  date: number;
  is_from_me: number;
  sender: string | null;
  chat_id: number | null;
}
