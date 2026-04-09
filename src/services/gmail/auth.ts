import { OAuth2Client } from "google-auth-library";
import { getGoogleOAuthClient } from "../../config.js";
import { getTokens, saveTokens } from "../../auth/token-store.js";
import type { OAuthTokens } from "../../types.js";

export const GMAIL_SCOPES = ["https://mail.google.com/"];
export const REDIRECT_PORT = 3000;
export const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

export function createOAuth2Client(): OAuth2Client {
  const creds = getGoogleOAuthClient();
  return new OAuth2Client(
    creds.installed.client_id,
    creds.installed.client_secret,
    REDIRECT_URI
  );
}

export async function getAuthenticatedClient(accountId: string): Promise<OAuth2Client> {
  const stored = getTokens(accountId, "gmail");
  if (!stored) {
    throw new Error(
      `No Gmail credentials found for account "${accountId}". ` +
      `Run: npm run add-account -- --name ${accountId}`
    );
  }

  const client = createOAuth2Client();
  client.setCredentials(stored);

  if (stored.expiry_date && Date.now() > stored.expiry_date - 60_000) {
    const { credentials } = await client.refreshAccessToken();
    const updated = credentials as OAuthTokens;
    saveTokens(accountId, "gmail", updated);
    client.setCredentials(updated);
  }

  return client;
}

export function getAuthUrl(client: OAuth2Client): string {
  return client.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    prompt: "consent",
  });
}

export async function exchangeCode(client: OAuth2Client, code: string): Promise<OAuthTokens> {
  const { tokens } = await client.getToken(code);
  return tokens as OAuthTokens;
}
