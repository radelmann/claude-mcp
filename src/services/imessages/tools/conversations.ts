import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";
import { openDb, formatDate, type ConversationRow, type MessageRow } from "../db.js";

const DB_PATH = join(homedir(), "Library", "Messages", "chat.db");
import type { ToolDefinition, ToolHandler } from "../../../types.js";

// ── List Conversations ──────────────────────────────────────────────────────

export const listConversationsTool: ToolDefinition = {
  name: "imessage_list_conversations",
  description:
    "List iMessage/SMS conversations with participant info, message count, and last message. Useful for identifying spam, marketing, and 2FA conversations to clean up.",
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Max conversations to return (default 50)",
      },
      filter: {
        type: "string",
        description:
          'Optional filter: "unknown" (non-contacts/short-codes), "sms" (SMS only), "imessage" (iMessage only)',
      },
      search: {
        type: "string",
        description: "Filter by participant name/number containing this string",
      },
    },
  },
};

export const listConversationsHandler: ToolHandler = async (args) => {
  const db = openDb();
  const limit = typeof args.limit === "number" ? args.limit : 50;
  const filter = typeof args.filter === "string" ? args.filter : null;
  const search = typeof args.search === "string" ? args.search : null;

  let serviceWhere = "";
  if (filter === "sms") serviceWhere = "AND c.service_name = 'SMS'";
  else if (filter === "imessage") serviceWhere = "AND c.service_name = 'iMessage'";

  const rows = db
    .prepare(
      `SELECT
        c.ROWID as id,
        c.guid,
        c.display_name,
        c.service_name,
        GROUP_CONCAT(DISTINCT h.id) as participants,
        COUNT(DISTINCT m.ROWID) as message_count,
        MAX(m.date) as last_message_date,
        (SELECT text FROM message
          WHERE ROWID = (
            SELECT message_id FROM chat_message_join
            WHERE chat_id = c.ROWID ORDER BY message_id DESC LIMIT 1
          )
        ) as last_message_text
      FROM chat c
      LEFT JOIN chat_handle_join chj ON c.ROWID = chj.chat_id
      LEFT JOIN handle h ON chj.handle_id = h.ROWID
      LEFT JOIN chat_message_join cmj ON c.ROWID = cmj.chat_id
      LEFT JOIN message m ON cmj.message_id = m.ROWID
      WHERE 1=1 ${serviceWhere}
      GROUP BY c.ROWID
      ORDER BY last_message_date DESC
      LIMIT ?`
    )
    .all(limit) as ConversationRow[];

  let filtered = rows;

  if (filter === "unknown") {
    // Short codes (5-6 digits) or numbers with no alpha display name
    filtered = rows.filter((r) => {
      const p = r.participants ?? "";
      const isShortCode = /^\d{5,6}$/.test(p.trim());
      const noDisplayName = !r.display_name;
      return isShortCode || (noDisplayName && !/^[a-zA-Z]/.test(p));
    });
  }

  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        (r.participants ?? "").toLowerCase().includes(s) ||
        (r.display_name ?? "").toLowerCase().includes(s)
    );
  }

  if (filtered.length === 0) {
    return { content: [{ type: "text", text: "No conversations found." }] };
  }

  const lines = filtered.map((r) => {
    const name = r.display_name || r.participants || "Unknown";
    const preview = r.last_message_text
      ? r.last_message_text.slice(0, 80).replace(/\n/g, " ")
      : "(no text)";
    return [
      `[${r.id}] ${name} (${r.service_name})`,
      `  Participants: ${r.participants ?? "none"}`,
      `  Messages: ${r.message_count} | Last: ${formatDate(r.last_message_date)}`,
      `  Preview: ${preview}`,
      `  GUID: ${r.guid}`,
    ].join("\n");
  });

  return {
    content: [
      {
        type: "text",
        text: `Found ${filtered.length} conversation(s):\n\n${lines.join("\n\n")}`,
      },
    ],
  };
};

// ── Get Messages ────────────────────────────────────────────────────────────

export const getMessagesTool: ToolDefinition = {
  name: "imessage_get_messages",
  description: "Get messages from a specific conversation by its ID.",
  inputSchema: {
    type: "object",
    properties: {
      conversation_id: {
        type: "number",
        description: "Conversation ID (from imessage_list_conversations)",
      },
      limit: {
        type: "number",
        description: "Max messages to return (default 30, most recent first)",
      },
    },
    required: ["conversation_id"],
  },
};

export const getMessagesHandler: ToolHandler = async (args) => {
  const db = openDb();
  const chatId = args.conversation_id as number;
  const limit = typeof args.limit === "number" ? args.limit : 30;

  const rows = db
    .prepare(
      `SELECT
        m.ROWID as id,
        m.text,
        m.date,
        m.is_from_me,
        h.id as sender
      FROM message m
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
      WHERE cmj.chat_id = ?
      ORDER BY m.date DESC
      LIMIT ?`
    )
    .all(chatId, limit) as MessageRow[];

  if (rows.length === 0) {
    return { content: [{ type: "text", text: "No messages found." }] };
  }

  const lines = rows.map((m) => {
    const who = m.is_from_me ? "Me" : (m.sender ?? "Them");
    const text = m.text ?? "(attachment)";
    return `[${formatDate(m.date)}] ${who}: ${text}`;
  });

  return {
    content: [{ type: "text", text: lines.reverse().join("\n") }],
  };
};

// ── Search Messages ─────────────────────────────────────────────────────────

export const searchMessagesTool: ToolDefinition = {
  name: "imessage_search_messages",
  description:
    "Search iMessage/SMS messages by text content or sender. Good for finding all 2FA codes, marketing texts, or messages from a specific number.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Text to search for in message body",
      },
      sender: {
        type: "string",
        description: "Filter by sender phone number or email (partial match)",
      },
      limit: {
        type: "number",
        description: "Max results to return (default 30)",
      },
    },
  },
};

export const searchMessagesHandler: ToolHandler = async (args) => {
  const db = openDb();
  const limit = typeof args.limit === "number" ? args.limit : 30;
  const query = typeof args.query === "string" ? `%${args.query}%` : null;
  const sender = typeof args.sender === "string" ? `%${args.sender}%` : null;

  if (!query && !sender) {
    return {
      content: [{ type: "text", text: "Provide at least one of: query, sender" }],
      isError: true,
    };
  }

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query) {
    conditions.push("m.text LIKE ?");
    params.push(query);
  }
  if (sender) {
    conditions.push("h.id LIKE ?");
    params.push(sender);
  }
  params.push(limit);

  const rows = db
    .prepare(
      `SELECT
        m.ROWID as id,
        m.text,
        m.date,
        m.is_from_me,
        h.id as sender,
        cmj.chat_id
      FROM message m
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY m.date DESC
      LIMIT ?`
    )
    .all(...params) as (MessageRow & { chat_id: number })[];

  if (rows.length === 0) {
    return { content: [{ type: "text", text: "No messages found." }] };
  }

  const lines = rows.map((m) => {
    const who = m.is_from_me ? "Me" : (m.sender ?? "Them");
    const text = (m.text ?? "(attachment)").slice(0, 120).replace(/\n/g, " ");
    return `[${formatDate(m.date)}] [chat ${m.chat_id}] ${who}: ${text}`;
  });

  return {
    content: [
      {
        type: "text",
        text: `Found ${rows.length} message(s):\n\n${lines.join("\n")}`,
      },
    ],
  };
};

// ── Delete Conversation ─────────────────────────────────────────────────────

export const deleteConversationTool: ToolDefinition = {
  name: "imessage_delete_conversation",
  description:
    "Delete an entire iMessage/SMS conversation by its GUID. Permanently removes the conversation from chat.db. Use imessage_list_conversations to find the GUID first.",
  inputSchema: {
    type: "object",
    properties: {
      guid: {
        type: "string",
        description: "Conversation GUID (from imessage_list_conversations, e.g. 'SMS;-;+15551234567')",
      },
    },
    required: ["guid"],
  },
};

export const deleteConversationHandler: ToolHandler = async (args) => {
  const guid = args.guid as string;
  const db = new Database(DB_PATH, { readonly: false, fileMustExist: true });

  try {
    // Dynamically discover and stub out all Apple custom SQLite functions used
    // in triggers. These only exist when Messages.app loads its extension — without
    // stubs, any DELETE fails. We parse all trigger SQL to find every function call.
    const noop = () => null;
    const triggers = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND sql IS NOT NULL"
    ).all() as { sql: string }[];
    const fnNames = new Set<string>();
    for (const { sql } of triggers) {
      for (const match of sql.matchAll(/\b([a-z][a-z0-9_]*)\s*\(/gi)) {
        fnNames.add(match[1].toLowerCase());
      }
    }
    // Filter out built-in SQLite keywords that aren't custom functions
    const builtins = new Set(["select","insert","update","delete","where","from",
      "join","on","and","or","not","null","case","when","then","else","end",
      "count","max","min","sum","avg","coalesce","ifnull","typeof","cast","abs"]);
    for (const fn of fnNames) {
      if (builtins.has(fn)) continue;
      try { db.function(fn, { varargs: true }, noop); } catch {}
    }

    // Look up the chat row
    const chat = db.prepare("SELECT ROWID FROM chat WHERE guid = ?").get(guid) as { ROWID: number } | undefined;
    if (!chat) {
      return {
        content: [{ type: "text", text: `Conversation not found: ${guid}` }],
        isError: true,
      };
    }
    const chatId = chat.ROWID;

    // Delete in a transaction — remove the chat and its join records.
    db.transaction(() => {
      db.prepare("DELETE FROM chat_message_join WHERE chat_id = ?").run(chatId);
      db.prepare("DELETE FROM chat_handle_join WHERE chat_id = ?").run(chatId);
      db.prepare("DELETE FROM chat WHERE ROWID = ?").run(chatId);
    })();

    return {
      content: [{ type: "text", text: `Deleted conversation: ${guid}` }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Failed to delete: ${msg}` }],
      isError: true,
    };
  } finally {
    db.close();
  }
};
