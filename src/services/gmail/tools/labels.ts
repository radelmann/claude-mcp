import { getGmailClient, resolveAccount } from "../client.js";
import type { ToolDefinition, ToolHandler } from "../../../types.js";

export const listLabelsTool: ToolDefinition = {
  name: "gmail_list_labels",
  description: "List all labels in a Gmail account.",
  inputSchema: {
    type: "object",
    properties: {
      account: {
        type: "string",
        description: 'Account ID to use (e.g. "personal", "pm-personal", "pm-finance"). Defaults to "personal".',
      },
    },
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
