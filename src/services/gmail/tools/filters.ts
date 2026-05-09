import { getGmailClient, resolveAccount } from "../client.js";
import type { ToolDefinition, ToolHandler } from "../../../types.js";
import type { gmail_v1 } from "googleapis";

const ACCOUNT_PARAM = {
  account: {
    type: "string",
    description: 'Account ID to use (e.g. "personal", "pm-personal", "pm-finance"). Defaults to "personal".',
  },
};

function formatFilter(f: gmail_v1.Schema$Filter): string {
  const criteriaLines = Object.entries(f.criteria ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `    ${k}: ${JSON.stringify(v)}`);
  const actionLines = Object.entries(f.action ?? {})
    .filter(([, v]) => v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : true))
    .map(([k, v]) => `    ${k}: ${JSON.stringify(v)}`);

  return [
    `[${f.id}]`,
    `  criteria:`,
    ...(criteriaLines.length ? criteriaLines : ["    (none)"]),
    `  action:`,
    ...(actionLines.length ? actionLines : ["    (none)"]),
  ].join("\n");
}

export const listFiltersTool: ToolDefinition = {
  name: "gmail_list_filters",
  description: "List all Gmail filters configured on an account.",
  inputSchema: {
    type: "object",
    properties: { ...ACCOUNT_PARAM },
  },
};

export const listFiltersHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const gmail = await getGmailClient(accountId);
  const res = await gmail.users.settings.filters.list({ userId: "me" });
  const filters = res.data.filter ?? [];

  if (filters.length === 0) {
    return { content: [{ type: "text", text: `No filters found for account "${accountId}".` }] };
  }

  const sections = filters.map((f) => formatFilter(f));

  return {
    content: [{
      type: "text",
      text: `Filters for account "${accountId}" (${filters.length}):\n\n${sections.join("\n\n")}`,
    }],
  };
};

export const createFilterTool: ToolDefinition = {
  name: "gmail_create_filter",
  description:
    "Create a Gmail filter that automatically applies actions to matching incoming messages. " +
    "To 'skip inbox', use action.removeLabelIds: ['INBOX']. To 'delete', use action.addLabelIds: ['TRASH']. " +
    "Combine with addLabelIds to also apply a label.",
  inputSchema: {
    type: "object",
    properties: {
      criteria: {
        type: "object",
        description: "Match criteria. At least one field is required.",
        properties: {
          from: { type: "string", description: "Sender email or domain (e.g. 'noreply@linkedin.com' or 'linkedin.com')" },
          to: { type: "string", description: "Recipient email" },
          subject: { type: "string", description: "Subject contains" },
          query: { type: "string", description: "Gmail search query that messages must match (e.g. 'category:promotions')" },
          negatedQuery: { type: "string", description: "Gmail search query that messages must NOT match" },
          hasAttachment: { type: "boolean", description: "Match only messages with attachments" },
          excludeChats: { type: "boolean", description: "Exclude chat messages" },
          size: { type: "number", description: "Size in bytes; paired with sizeComparison" },
          sizeComparison: {
            type: "string",
            enum: ["smaller", "larger", "unspecified"],
            description: "Size comparison operator",
          },
        },
      },
      action: {
        type: "object",
        description: "Action applied to matching messages. At least one field is required.",
        properties: {
          addLabelIds: {
            type: "array",
            items: { type: "string" },
            description: "Label IDs to add (e.g. ['TRASH'] to delete, or a user label ID to apply it)",
          },
          removeLabelIds: {
            type: "array",
            items: { type: "string" },
            description: "Label IDs to remove (e.g. ['INBOX'] to archive/skip inbox, ['UNREAD'] to mark read)",
          },
          forward: {
            type: "string",
            description: "Forwarding address (must already be configured as a verified forwarding address on the account)",
          },
        },
      },
      ...ACCOUNT_PARAM,
    },
    required: ["criteria", "action"],
  },
};

export const createFilterHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const gmail = await getGmailClient(accountId);

  const criteria = args.criteria as gmail_v1.Schema$FilterCriteria;
  const action = args.action as gmail_v1.Schema$FilterAction;

  const res = await gmail.users.settings.filters.create({
    userId: "me",
    requestBody: { criteria, action },
  });

  return {
    content: [{
      type: "text",
      text: `Filter created in account "${accountId}":\n\n${formatFilter(res.data)}`,
    }],
  };
};

export const deleteFilterTool: ToolDefinition = {
  name: "gmail_delete_filter",
  description: "Delete a Gmail filter by ID. Use gmail_list_filters to find IDs.",
  inputSchema: {
    type: "object",
    properties: {
      filter_id: { type: "string", description: "The Gmail filter ID" },
      ...ACCOUNT_PARAM,
    },
    required: ["filter_id"],
  },
};

export const deleteFilterHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const gmail = await getGmailClient(accountId);

  await gmail.users.settings.filters.delete({
    userId: "me",
    id: args.filter_id as string,
  });

  return {
    content: [{ type: "text", text: `Filter ${args.filter_id} deleted from account "${accountId}".` }],
  };
};
