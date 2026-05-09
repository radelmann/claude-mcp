/**
 * add-account.ts
 * Authorizes an account for a given service and stores its OAuth2 tokens.
 *
 * Usage:
 *   npm run add-account -- --name personal
 *   npm run add-account -- --name personal --service calendar
 *   npm run add-account -- --name pm-personal
 *   npm run add-account -- --name pm-finance
 *
 * --service defaults to "gmail" for backwards compatibility.
 * Tokens are stored per (account, service), so a single account can be
 * authorized for multiple services independently.
 */

import { createServer } from "http";
import { createOAuth2Client, getAuthUrl, exchangeCode, REDIRECT_PORT } from "../src/auth/oauth.js";
import { saveTokens } from "../src/auth/token-store.js";
import { getAccountsConfig } from "../src/config.js";
import { SERVICES } from "../src/services/registry.js";

function getFlag(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx === -1 ? undefined : process.argv[idx + 1];
}

const accountId = getFlag("name");
if (!accountId) {
  console.error("Usage: npm run add-account -- --name <account-id> [--service <service>]");
  process.exit(1);
}

const serviceName = getFlag("service") ?? "gmail";

const service = SERVICES.find((s) => s.name === serviceName);
if (!service) {
  console.error(`Unknown service "${serviceName}". Available: ${SERVICES.map((s) => s.name).join(", ")}`);
  process.exit(1);
}

const config = getAccountsConfig();
const account = config.accounts.find((a) => a.id === accountId);
if (!account) {
  console.error(`Account "${accountId}" not found in config/accounts.json.`);
  console.error(`Available: ${config.accounts.map((a) => a.id).join(", ")}`);
  process.exit(1);
}

if (!account.services.includes(serviceName)) {
  console.error(
    `Account "${accountId}" does not have "${serviceName}" in its services list. ` +
    `Add it to config/accounts.json under this account's services array.`
  );
  process.exit(1);
}

console.log(`\nAuthorizing ${serviceName} for: ${account.label} (${accountId})`);

const client = createOAuth2Client();
const authUrl = getAuthUrl(client, service.scopes);

console.log(`\nOpening browser for Google authorization...`);
console.log(`\nIf the browser does not open, visit:\n${authUrl}\n`);

const { default: open } = await import("open");
await open(authUrl);

const code = await new Promise<string>((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${REDIRECT_PORT}`);
    if (url.pathname !== "/callback") { res.writeHead(404); res.end(); return; }

    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<h2>Authorization failed: ${error}</h2><p>You can close this tab.</p>`);
      server.close();
      reject(new Error(`Authorization failed: ${error}`));
      return;
    }

    if (!code) {
      res.writeHead(400); res.end("<h2>No code received.</h2>");
      server.close();
      reject(new Error("No authorization code in callback."));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<h2>Success!</h2><p><strong>${account.label}</strong> is connected for ${serviceName}. You can close this tab.</p>`);
    server.close();
    resolve(code);
  });

  server.listen(REDIRECT_PORT, () => {
    console.log(`Waiting for Google callback on http://localhost:${REDIRECT_PORT}/callback ...`);
  });

  server.on("error", reject);
  setTimeout(() => { server.close(); reject(new Error("Timed out after 5 minutes.")); }, 5 * 60 * 1000);
});

console.log(`\nExchanging code for tokens...`);
const tokens = await exchangeCode(client, code);
saveTokens(accountId, serviceName, tokens);
console.log(`\nDone! "${account.label}" (${accountId}) is now authorized for ${serviceName}.\n`);
