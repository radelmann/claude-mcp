import { getGmailClient, extractBody, getHeader, resolveAccount } from "../client.js";
import { getAccountsConfig } from "../../../config.js";
import { listAuthorizedAccounts } from "../../../auth/token-store.js";
import type { ToolDefinition, ToolHandler } from "../../../types.js";

const ACCOUNT_PARAM = {
  account: {
    type: "string",
    description: 'Account ID to use (e.g. "personal", "pm-personal", "pm-finance"). Defaults to "personal".',
  },
};

export const listAccountsTool: ToolDefinition = {
  name: "gmail_list_accounts",
  description: "List all configured Gmail accounts and their authorization status.",
  inputSchema: { type: "object", properties: {} },
};

export const listAccountsHandler: ToolHandler = async () => {
  const config = getAccountsConfig();
  const authorized = listAuthorizedAccounts("gmail");
  const lines = config.accounts
    .filter((a) => a.services.includes("gmail"))
    .map((a) => {
      const status = authorized.includes(a.id) ? "authorized" : "NOT authorized";
      return `${a.id} (${a.label}) — ${status}`;
    });
  return {
    content: [{ type: "text", text: lines.join("\n") || "No Gmail accounts configured." }],
  };
};

export const searchMessagesTool: ToolDefinition = {
  name: "gmail_search_messages",
  description: "Search Gmail messages using Gmail search syntax.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Gmail search query (e.g. 'label:inbox is:unread')" },
      max_results: { type: "number", description: "Maximum number of results to return (default 20)" },
      ...ACCOUNT_PARAM,
    },
    required: ["query"],
  },
};

export const searchMessagesHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const gmail = await getGmailClient(accountId);
  const maxResults = typeof args.max_results === "number" ? args.max_results : 20;

  const res = await gmail.users.messages.list({
    userId: "me",
    q: args.query as string,
    maxResults,
  });

  const messages = res.data.messages ?? [];
  if (messages.length === 0) {
    return { content: [{ type: "text", text: "No messages found." }] };
  }

  const details = await Promise.all(
    messages.map((m) =>
      gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      })
    )
  );

  const lines = details.map((d) => {
    const h = d.data.payload?.headers;
    const subject = getHeader(h, "Subject") || "(no subject)";
    const from = getHeader(h, "From");
    const date = getHeader(h, "Date");
    return `[${d.data.id}] ${date} | From: ${from}\n  Subject: ${subject}\n  Snippet: ${d.data.snippet}`;
  });

  return {
    content: [{
      type: "text",
      text: `Found ${messages.length} message(s) in account "${accountId}":\n\n${lines.join("\n\n")}`,
    }],
  };
};

export const readMessageTool: ToolDefinition = {
  name: "gmail_read_message",
  description: "Read the full content of a Gmail message by ID.",
  inputSchema: {
    type: "object",
    properties: {
      message_id: { type: "string", description: "The Gmail message ID" },
      ...ACCOUNT_PARAM,
    },
    required: ["message_id"],
  },
};

export const readMessageHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const gmail = await getGmailClient(accountId);

  const res = await gmail.users.messages.get({
    userId: "me",
    id: args.message_id as string,
    format: "full",
  });

  const msg = res.data;
  const headers = msg.payload?.headers;
  const subject = getHeader(headers, "Subject") || "(no subject)";
  const from = getHeader(headers, "From");
  const to = getHeader(headers, "To");
  const date = getHeader(headers, "Date");
  const body = extractBody(msg.payload ?? undefined);
  const labels = (msg.labelIds ?? []).join(", ");

  return {
    content: [{
      type: "text",
      text: [
        `Account: ${accountId}`,
        `ID: ${msg.id}`,
        `Date: ${date}`,
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `Labels: ${labels}`,
        ``,
        body || "(no body)",
      ].join("\n"),
    }],
  };
};

export const archiveMessageTool: ToolDefinition = {
  name: "gmail_archive_message",
  description: "Archive a Gmail message (remove from inbox).",
  inputSchema: {
    type: "object",
    properties: {
      message_id: { type: "string", description: "The Gmail message ID" },
      ...ACCOUNT_PARAM,
    },
    required: ["message_id"],
  },
};

export const archiveMessageHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const gmail = await getGmailClient(accountId);
  await gmail.users.messages.modify({
    userId: "me",
    id: args.message_id as string,
    requestBody: { removeLabelIds: ["INBOX"] },
  });
  return {
    content: [{ type: "text", text: `Message ${args.message_id} archived from account "${accountId}".` }],
  };
};

export const deleteMessageTool: ToolDefinition = {
  name: "gmail_delete_message",
  description: "Move a Gmail message to trash.",
  inputSchema: {
    type: "object",
    properties: {
      message_id: { type: "string", description: "The Gmail message ID" },
      ...ACCOUNT_PARAM,
    },
    required: ["message_id"],
  },
};

export const deleteMessageHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const gmail = await getGmailClient(accountId);
  await gmail.users.messages.trash({
    userId: "me",
    id: args.message_id as string,
  });
  return {
    content: [{ type: "text", text: `Message ${args.message_id} moved to trash in account "${accountId}".` }],
  };
};

export const labelMessageTool: ToolDefinition = {
  name: "gmail_label_message",
  description: "Add or remove labels on a Gmail message.",
  inputSchema: {
    type: "object",
    properties: {
      message_id: { type: "string", description: "The Gmail message ID" },
      add_labels: { type: "array", items: { type: "string" }, description: "Label IDs to add" },
      remove_labels: { type: "array", items: { type: "string" }, description: "Label IDs to remove" },
      ...ACCOUNT_PARAM,
    },
    required: ["message_id"],
  },
};

export const labelMessageHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const gmail = await getGmailClient(accountId);
  await gmail.users.messages.modify({
    userId: "me",
    id: args.message_id as string,
    requestBody: {
      addLabelIds: (args.add_labels as string[]) ?? [],
      removeLabelIds: (args.remove_labels as string[]) ?? [],
    },
  });
  return {
    content: [{ type: "text", text: `Labels updated on message ${args.message_id} in account "${accountId}".` }],
  };
};

export const getProfileTool: ToolDefinition = {
  name: "gmail_get_profile",
  description: "Get the Gmail profile for an account (email address, message count, etc.).",
  inputSchema: { type: "object", properties: { ...ACCOUNT_PARAM } },
};

export const getProfileHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const gmail = await getGmailClient(accountId);
  const res = await gmail.users.getProfile({ userId: "me" });
  const p = res.data;
  return {
    content: [{
      type: "text",
      text: [
        `Account: ${accountId}`,
        `Email: ${p.emailAddress}`,
        `Total messages: ${p.messagesTotal}`,
        `Total threads: ${p.threadsTotal}`,
        `History ID: ${p.historyId}`,
      ].join("\n"),
    }],
  };
};
