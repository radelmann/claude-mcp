import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { AccountsConfig, GoogleOAuthClient } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, "..");

export function getAccountsConfig(): AccountsConfig {
  const path = resolve(ROOT, "config", "accounts.json");
  return JSON.parse(readFileSync(path, "utf-8")) as AccountsConfig;
}

export function getGoogleOAuthClient(): GoogleOAuthClient {
  const path = resolve(ROOT, "credentials", "google-oauth-client.json");
  return JSON.parse(readFileSync(path, "utf-8")) as GoogleOAuthClient;
}

export function getTokensPath(): string {
  return resolve(ROOT, "credentials", "tokens.json");
}

export function getDefaultAccount(): string {
  return "personal";
}
