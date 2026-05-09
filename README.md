# claude-mcp

A personal MCP (Model Context Protocol) server providing Gmail and Google Calendar tools across multiple Google accounts.

## Overview

`claude-mcp` exposes Google Workspace functionality as MCP tools, enabling Claude (and other MCP clients) to read, search, compose, and manage email and calendar events across multiple configured Google accounts. Each account can opt in to one or more services independently.

## Tools

### Gmail

| Tool | Description |
|------|-------------|
| `gmail_list_accounts` | List all configured and authorized Gmail accounts |
| `gmail_get_profile` | Get profile info for an account |
| `gmail_search_messages` | Search messages using Gmail query syntax |
| `gmail_search_all_accounts` | Search messages across all authorized accounts simultaneously, results grouped by account |
| `gmail_read_message` | Read a single message by ID |
| `gmail_read_messages` | Batch-read up to 10 messages in a single call (cross-account supported) |
| `gmail_read_thread` | Read a full email thread |
| `gmail_list_labels` | List all labels for an account |
| `gmail_create_label` | Create a new user label; returns the label ID for use in filters |
| `gmail_rename_label` | Rename an existing user label |
| `gmail_delete_label` | Delete a user label; Gmail removes it from any messages that have it |
| `gmail_label_message` | Apply or remove labels on a message |
| `gmail_archive_message` | Archive a message |
| `gmail_delete_message` | Delete a message |
| `gmail_create_draft` | Create a draft email; supports reply and reply-all via `reply_to_message_id` and `reply_all` |
| `gmail_list_drafts` | List drafts for an account |
| `gmail_send_email` | Send an email; supports reply and reply-all via `reply_to_message_id` and `reply_all` |
| `gmail_list_filters` | List all filters configured on an account |
| `gmail_create_filter` | Create a filter with criteria + action (e.g. archive, label, delete, forward) |
| `gmail_delete_filter` | Delete a filter by ID |

### Calendar

| Tool | Description |
|------|-------------|
| `calendar_list_accounts` | List all configured and authorized Calendar accounts |
| `calendar_list_calendars` | List all calendars accessible to an account |
| `calendar_list_events` | List events on a calendar (defaults to upcoming); supports search and time-range filtering |
| `calendar_get_event` | Read the full details of a single event by ID |
| `calendar_create_event` | Create an event on a calendar; supports all-day or timed events, attendees, and invitations |
| `calendar_update_event` | Patch fields on an existing event; only provided fields are changed |
| `calendar_delete_event` | Delete an event by ID; optionally notifies attendees of the cancellation |

## Setup

### Prerequisites

- Node.js 18+
- A Google Cloud project with the Gmail API and Google Calendar API enabled, and an OAuth 2.0 client configured

### 1. Add OAuth credentials

Download your OAuth client JSON from Google Cloud Console and save it to:

```
credentials/google-oauth-client.json
```

### 2. Configure accounts

Edit `config/accounts.json` to define your accounts. Each account opts into one or more services (`gmail`, `calendar`):

```json
{
  "accounts": [
    { "id": "personal", "label": "Personal", "services": ["gmail", "calendar"] },
    { "id": "work", "label": "Work", "services": ["gmail"] }
  ]
}
```

### 3. Authorize each account

Run the interactive OAuth flow once per (account, service) pair. The `--service` flag defaults to `gmail`:

```bash
# Gmail
npm run add-account -- --name personal
npm run add-account -- --name work

# Calendar (only for accounts whose services array includes "calendar")
npm run add-account -- --name personal --service calendar
```

Each run opens a browser for Google sign-in and stores the resulting tokens in `credentials/tokens.json` keyed by account and service. Authorizing a new service does not affect existing tokens for other services on the same account.

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
    "claude-mcp": {
      "command": "node",
      "args": ["/path/to/claude-mcp/dist/index.js"]
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
  "args": ["/path/to/claude-mcp/dist/index.js"]
}
```

4. Save — the connector will appear in your CoWork sessions.

## Project structure

```
claude-mcp/
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
    │   ├── oauth.ts           # Shared Google OAuth2 helpers
    │   └── token-store.ts     # Token persistence (keyed by account + service)
    └── services/
        ├── registry.ts        # Aggregates all service modules
        ├── gmail/
        │   ├── auth.ts        # GMAIL_SCOPES
        │   ├── client.ts      # Authenticated Gmail API client
        │   ├── index.ts       # Gmail service module
        │   └── tools/         # Tool definitions + handlers
        │       ├── messages.ts
        │       ├── threads.ts
        │       ├── labels.ts
        │       ├── drafts.ts
        │       └── filters.ts
        └── calendar/
            ├── auth.ts        # CALENDAR_SCOPES
            ├── client.ts      # Authenticated Calendar API client
            ├── index.ts       # Calendar service module
            └── tools/         # Tool definitions + handlers
                ├── calendars.ts
                └── events.ts
```
