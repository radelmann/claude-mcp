import { getGmailClient, resolveAccount } from "../client.js";
import type { ToolDefinition, ToolHandler } from "../../../types.js";

const ACCOUNT_PARAM = {
  account: {
    type: "string",
    description: 'Account ID to use (e.g. "personal", "pm-personal", "pm-finance"). Defaults to "personal".',
  },
};

export const listLabelsTool: ToolDefinition = {
  name: "gmail_list_labels",
  description: "List all labels in a Gmail account.",
  inputSchema: {
    type: "object",
    properties: { ...ACCOUNT_PARAM },
  },
};

export const listLabelsHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const gmail = await getGmailClient(accountId);
  const res = await gmail.users.labels.list({ userId: "me" });
  const labels = res.data.labels ?? [];

  if (labels.length === 0) {
    return { content: [{ type: "text", text: "No labels found." }] };
  }

  const system = labels.filter((l) => l.type === "system");
  const user = labels.filter((l) => l.type === "user");
  const format = (l: typeof labels[0]) => `  ${l.id} — ${l.name}`;

  return {
    content: [{
      type: "text",
      text: [
        `Labels for account "${accountId}":`,
        ``,
        `System labels (${system.length}):`,
        ...system.map(format),
        ``,
        `User labels (${user.length}):`,
        ...user.map(format),
      ].join("\n"),
    }],
  };
};

export const createLabelTool: ToolDefinition = {
  name: "gmail_create_label",
  description:
    "Create a new user label in a Gmail account. Returns the new label's ID, which can be used in gmail_create_filter actions or gmail_label_message.",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Display name of the label (e.g. 'LinkedIn', 'USPS', 'Delete Later'). Use '/' for nested labels (e.g. 'Receipts/2026').",
      },
      label_list_visibility: {
        type: "string",
        enum: ["labelShow", "labelShowIfUnread", "labelHide"],
        description: "Whether the label appears in the label list in the Gmail UI. Defaults to 'labelShow'.",
      },
      message_list_visibility: {
        type: "string",
        enum: ["show", "hide"],
        description: "Whether the label appears next to messages in the message list. Defaults to 'show'.",
      },
      ...ACCOUNT_PARAM,
    },
    required: ["name"],
  },
};

export const createLabelHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const gmail = await getGmailClient(accountId);

  const res = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: args.name as string,
      labelListVisibility: args.label_list_visibility as string | undefined,
      messageListVisibility: args.message_list_visibility as string | undefined,
    },
  });

  const label = res.data;
  return {
    content: [{
      type: "text",
      text: [
        `Label created in account "${accountId}":`,
        `  id: ${label.id}`,
        `  name: ${label.name}`,
        `  type: ${label.type}`,
        `  labelListVisibility: ${label.labelListVisibility ?? "(default)"}`,
        `  messageListVisibility: ${label.messageListVisibility ?? "(default)"}`,
      ].join("\n"),
    }],
  };
};
