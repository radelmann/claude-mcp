/**
 * add-account.ts
 * Authorizes a Gmail account and stores its OAuth2 tokens.
 *
 * Usage:
 *   npm run add-account -- --name personal
 *   npm run add-account -- --name pm-personal
 *   npm run add-account -- --name pm-finance
 */

import { createServer } from "http";
import { createOAuth2Client, getAuthUrl, exchangeCode, REDIRECT_PORT } from "../src/services/gmail/auth.js";
import { saveTokens } from "../src/auth/token-store.js";
import { getAccountsConfig } from "../src/config.js";

const nameIdx = process.argv.indexOf("--name");
if (nameIdx === -1 || !process.argv[nameIdx + 1]) {
  console.error("Usage: npm run add-account -- --name <account-id>");
  process.exit(1);
}
const accountId = process.argv[nameIdx + 1];

const config = getAccountsConfig();
const account = config.accounts.find((a) => a.id === accountId);
if (!account) {
  console.error(`Account "${accountId}" not found in config/accounts.json.`);
  console.error(`Available: ${config.accounts.map((a) => a.id).join(", ")}`);
  process.exit(1);
}

if (!account.services.includes("gmail")) {
  console.error(`Account "${accountId}" does not have "gmail" in its services list.`);
  process.exit(1);
}

console.log(`\nAuthorizing Gmail for: ${account.label} (${accountId})`);

const client = createOAuth2Client();
const authUrl = getAuthUrl(client);

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
    res.end(`<h2>Success!</h2><p><strong>${account.label}</strong> is connected. You can close this tab.</p>`);
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
saveTokens(accountId, "gmail", tokens);
console.log(`\nDone! "${account.label}" (${accountId}) is now authorized.\n`);
