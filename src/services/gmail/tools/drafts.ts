import { getGmailClient, getHeader, resolveAccount } from "../client.js";
import type { ToolDefinition, ToolHandler } from "../../../types.js";

function encodeEmail(opts: {
  to: string;
  subject: string;
  body: string;
  replyToMessageId?: string;
}): string {
  const headers = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `MIME-Version: 1.0`,
    ...(opts.replyToMessageId ? [`In-Reply-To: ${opts.replyToMessageId}`] : []),
  ];
  const lines = [...headers, ``, opts.body].join("\r\n");
  return Buffer.from(lines).toString("base64url");
}

const ACCOUNT_PARAM = {
  account: {
    type: "string",
    description: 'Account ID to use (e.g. "personal", "pm-personal", "pm-finance"). Defaults to "personal".',
  },
};

export const createDraftTool: ToolDefinition = {
  name: "gmail_create_draft",
  description: "Create a draft email in Gmail.",
  inputSchema: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Email subject" },
      body: { type: "string", description: "Plain text email body" },
      reply_to_message_id: { type: "string", description: "Message ID to reply to (optional)" },
      thread_id: { type: "string", description: "Thread ID to add this draft to (optional)" },
      ...ACCOUNT_PARAM,
    },
    required: ["to", "subject", "body"],
  },
};

export const createDraftHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const gmail = await getGmailClient(accountId);

  const raw = encodeEmail({
    to: args.to as string,
    subject: args.subject as string,
    body: args.body as string,
    replyToMessageId: args.reply_to_message_id as string | undefined,
  });

  const message: Record<string, unknown> = { raw };
  if (args.thread_id) message.threadId = args.thread_id;

  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message },
  });

  return {
    content: [{
      type: "text",
      text: `Draft created in account "${accountId}".\nDraft ID: ${res.data.id}\nTo: ${args.to}\nSubject: ${args.subject}`,
    }],
  };
};

export const sendEmailTool: ToolDefinition = {
  name: "gmail_send_email",
  description: "Send an email from a Gmail account.",
  inputSchema: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Email subject" },
      body: { type: "string", description: "Plain text email body" },
      reply_to_message_id: { type: "string", description: "Message ID to reply to (optional)" },
      thread_id: { type: "string", description: "Thread ID to reply to (optional)" },
      ...ACCOUNT_PARAM,
    },
    required: ["to", "subject", "body"],
  },
};

export const sendEmailHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const gmail = await getGmailClient(accountId);

  const raw = encodeEmail({
    to: args.to as string,
    subject: args.subject as string,
    body: args.body as string,
    replyToMessageId: args.reply_to_message_id as string | undefined,
  });

  const requestBody: Record<string, unknown> = { raw };
  if (args.thread_id) requestBody.threadId = args.thread_id;

  const res = await gmail.users.messages.send({ userId: "me", requestBody });

  return {
    content: [{
      type: "text",
      text: `Email sent from account "${accountId}".\nMessage ID: ${res.data.id}\nTo: ${args.to}\nSubject: ${args.subject}`,
    }],
  };
};

export const listDraftsTool: ToolDefinition = {
  name: "gmail_list_drafts",
  description: "List draft emails in a Gmail account.",
  inputSchema: {
    type: "object",
    properties: {
      max_results: { type: "number", description: "Maximum number of drafts to return (default 20)" },
      ...ACCOUNT_PARAM,
    },
  },
};

export const listDraftsHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const gmail = await getGmailClient(accountId);
  const maxResults = typeof args.max_results === "number" ? args.max_results : 20;

  const res = await gmail.users.drafts.list({ userId: "me", maxResults });
  const drafts = res.data.drafts ?? [];

  if (drafts.length === 0) {
    return { content: [{ type: "text", text: "No drafts found." }] };
  }

  const details = await Promise.all(
    drafts.map((d) =>
      gmail.users.drafts.get({ userId: "me", id: d.id!, format: "metadata" })
    )
  );

  const lines = details.map((d) => {
    const headers = d.data.message?.payload?.headers;
    const subject = getHeader(headers, "Subject") || "(no subject)";
    const to = getHeader(headers, "To");
    return `[${d.data.id}] To: ${to} | Subject: ${subject}`;
  });

  return {
    content: [{
      type: "text",
      text: `Drafts in account "${accountId}" (${drafts.length}):\n\n${lines.join("\n")}`,
    }],
  };
};
