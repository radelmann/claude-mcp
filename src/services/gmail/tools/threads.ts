import { getGmailClient, extractBody, getHeader, resolveAccount } from "../client.js";
import type { ToolDefinition, ToolHandler } from "../../../types.js";

export const readThreadTool: ToolDefinition = {
  name: "gmail_read_thread",
  description: "Read a full Gmail conversation thread by thread ID.",
  inputSchema: {
    type: "object",
    properties: {
      thread_id: { type: "string", description: "The Gmail thread ID" },
      account: {
        type: "string",
        description: 'Account ID to use (e.g. "personal", "pm-personal", "pm-finance"). Defaults to "personal".',
      },
    },
    required: ["thread_id"],
  },
};

export const readThreadHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const gmail = await getGmailClient(accountId);

  const res = await gmail.users.threads.get({
    userId: "me",
    id: args.thread_id as string,
    format: "full",
  });

  const messages = res.data.messages ?? [];
  if (messages.length === 0) {
    return { content: [{ type: "text", text: "Thread is empty." }] };
  }

  const parts = messages.map((msg, i) => {
    const headers = msg.payload?.headers;
    const subject = getHeader(headers, "Subject") || "(no subject)";
    const from = getHeader(headers, "From");
    const date = getHeader(headers, "Date");
    const body = extractBody(msg.payload ?? undefined);
    return [
      `--- Message ${i + 1} of ${messages.length} ---`,
      `ID: ${msg.id}`,
      `Date: ${date}`,
      `From: ${from}`,
      `Subject: ${subject}`,
      ``,
      body || "(no body)",
    ].join("\n");
  });

  return {
    content: [{
      type: "text",
      text: `Thread ${args.thread_id} in account "${accountId}" (${messages.length} message(s)):\n\n${parts.join("\n\n")}`,
    }],
  };
};
