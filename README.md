# rob-mcp

A personal MCP (Model Context Protocol) server providing Gmail tools across multiple Google accounts.

## Overview

`rob-mcp` exposes Gmail functionality as MCP tools, enabling Claude (and other MCP clients) to read, search, compose, and manage email across multiple configured Google accounts.

## Tools

| Tool | Description |
|------|-------------|
| `gmail_list_accounts` | List all configured and authorized Gmail accounts |
| `gmail_get_profile` | Get profile info for an account |
| `gmail_search_messages` | Search messages using Gmail query syntax |
| `gmail_read_message` | Read a single message by ID |
| `gmail_read_thread` | Read a full email thread |
| `gmail_list_labels` | List all labels for an account |
| `gmail_label_message` | Apply or remove labels on a message |
| `gmail_archive_message` | Archive a message |
| `gmail_delete_message` | Delete a message |
| `gmail_create_draft` | Create a draft email |
| `gmail_list_drafts` | List drafts for an account |
| `gmail_send_email` | Send an email |

## Setup

### Prerequisites

- Node.js 18+
- A Google Cloud project with the Gmail API enabled and an OAuth 2.0 client configured

### 1. Add OAuth credentials

Download your OAuth client JSON from Google Cloud Console and save it to:

```
credentials/google-oauth-client.json
```

### 2. Configure accounts

Edit `config/accounts.json` to define your accounts:

```json
{
  "accounts": [
    { "id": "personal", "label": "Personal", "services": ["gmail"] },
    { "id": "work", "label": "Work", "services": ["gmail"] }
  ]
}
```

### 3. Authorize each account

Run the interactive OAuth flow for each account:

```bash
npm run add-account -- --name personal
npm run add-account -- --name work
```

This opens a browser for Google sign-in and stores the resulting tokens in `credentials/tokens.json`.

### 4. Build

```bash
npm install
npm run build
```

## Running

**Production (built):**
```bash
npm start
```

**Development (ts-node, no build step):**
```bash
npm run dev
```

The server communicates over stdio using the MCP protocol.

## Claude Desktop / MCP client configuration

Add the server to your MCP client config (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "rob-mcp": {
      "command": "node",
      "args": ["/path/to/rob-mcp/dist/index.js"]
    }
  }
}
```

## Claude CoWork

Add the server as a local MCP connector in the Claude Desktop app:

1. Go to **Settings > Customize > Connectors**
2. Click **+** → **Add local MCP server**
3. Set the command to `node` and args to the path of `dist/index.js`:

```json
{
  "command": "node",
  "args": ["/path/to/rob-mcp/dist/index.js"]
}
```

4. Save — the connector will appear in your CoWork sessions.

## Project structure

```
rob-mcp/
├── config/
│   └── accounts.json          # Account definitions
├── credentials/               # Git-ignored; OAuth client + tokens
│   ├── google-oauth-client.json
│   └── tokens.json
├── scripts/
│   └── add-account.ts         # OAuth authorization script
└── src/
    ├── index.ts               # MCP server entrypoint
    ├── config.ts              # Path/config helpers
    ├── types.ts               # Shared TypeScript types
    ├── auth/
    │   └── token-store.ts     # Token persistence
    └── services/
        ├── registry.ts        # Aggregates all service modules
        └── gmail/
            ├── auth.ts        # OAuth2 client setup
            ├── client.ts      # Authenticated Gmail API client
            ├── index.ts       # Gmail service module
            └── tools/         # Tool definitions + handlers
                ├── messages.ts
                ├── threads.ts
                ├── labels.ts
                └── drafts.ts
```
