import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { getTokensPath } from "../config.js";
import type { OAuthTokens, TokenStore } from "../types.js";

function loadStore(): TokenStore {
  const path = getTokensPath();
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8")) as TokenStore;
}

function saveStore(store: TokenStore): void {
  const path = getTokensPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(store, null, 2), "utf-8");
}

export function getTokens(accountId: string, service: string): OAuthTokens | null {
  const store = loadStore();
  return store[accountId]?.[service] ?? null;
}

export function saveTokens(accountId: string, service: string, tokens: OAuthTokens): void {
  const store = loadStore();
  if (!store[accountId]) store[accountId] = {};
  store[accountId][service] = tokens;
  saveStore(store);
}

export function listAuthorizedAccounts(service: string): string[] {
  const store = loadStore();
  return Object.keys(store).filter((id) => !!store[id]?.[service]);
}

export function hasTokens(accountId: string, service: string): boolean {
  return getTokens(accountId, service) !== null;
}
