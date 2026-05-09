import { OAuth2Client } from "google-auth-library";
import { getGoogleOAuthClient } from "../config.js";
import { getTokens, saveTokens } from "./token-store.js";
import type { OAuthTokens } from "../types.js";

export const REDIRECT_PORT = 3000;
export const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

/**
 * Create a fresh OAuth2 client using the application's credentials.
 * The same client class can drive any Google API; the scopes are
 * applied at consent time, not at client construction.
 */
export function createOAuth2Client(): OAuth2Client {
  const creds = getGoogleOAuthClient();
  return new OAuth2Client(
    creds.installed.client_id,
    creds.installed.client_secret,
    REDIRECT_URI
  );
}

/**
 * Load stored tokens for (account, service) and return an OAuth2Client
 * ready to drive the matching Google API. Refreshes the access token
 * if it is within 60 seconds of expiry.
 */
export async function getAuthenticatedClient(
  accountId: string,
  service: string
): Promise<OAuth2Client> {
  const stored = getTokens(accountId, service);
  if (!stored) {
    throw new Error(
      `No ${service} credentials found for account "${accountId}". ` +
      `Run: npm run add-account -- --name ${accountId} --service ${service}`
    );
  }

  const client = createOAuth2Client();
  client.setCredentials(stored);

  if (stored.expiry_date && Date.now() > stored.expiry_date - 60_000) {
    const { credentials } = await client.refreshAccessToken();
    const updated = credentials as OAuthTokens;
    saveTokens(accountId, service, updated);
    client.setCredentials(updated);
  }

  return client;
}

export function getAuthUrl(client: OAuth2Client, scopes: string[]): string {
  return client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });
}

export async function exchangeCode(client: OAuth2Client, code: string): Promise<OAuthTokens> {
  const { tokens } = await client.getToken(code);
  return tokens as OAuthTokens;
}
