import { getGmailClient, getHeader, resolveAccount } from "../client.js";
import type { ToolDefinition, ToolHandler } from "../../../types.js";

function encodeEmail(opts: {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  rfcMessageId?: string; // RFC 2822 Message-ID header value of the message being replied to
}): string {
  const headers = [
    `To: ${opts.to}`,
    ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
    `Subject: ${opts.subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `MIME-Version: 1.0`,
    ...(opts.rfcMessageId ? [
      `In-Reply-To: ${opts.rfcMessageId}`,
      `References: ${opts.rfcMessageId}`,
    ] : []),
  ];
  const lines = [...headers, ``, opts.body].join("\r\n");
  return Buffer.from(lines).toString("base64url");
}

async function resolveReplyInfo(
  gmail: Awaited<ReturnType<typeof getGmailClient>>,
  replyToMessageId: string,
  replyAll: boolean
): Promise<{ rfcMessageId: string; threadId: string; cc?: string }> {
  const msg = await gmail.users.messages.get({
    userId: "me",
    id: replyToMessageId,
    format: "metadata",
    metadataHeaders: ["Message-ID", "From", "To", "Cc"],
  });

  const rfcMessageId = getHeader(msg.data.payload?.headers, "Message-ID") ?? "";
  const threadId = msg.data.threadId ?? "";

  if (!replyAll) return { rfcMessageId, threadId };

  // Build Cc from original From + To + Cc, excluding the current user
  const profile = await gmail.users.getProfile({ userId: "me" });
  const myEmail = profile.data.emailAddress?.toLowerCase() ?? "";

  const originalFrom = getHeader(msg.data.payload?.headers, "From") ?? "";
  const originalTo = getHeader(msg.data.payload?.headers, "To") ?? "";
  const originalCc = getHeader(msg.data.payload?.headers, "Cc") ?? "";

  const allRecipients = [originalFrom, originalTo, originalCc]
    .join(",")
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r && !r.toLowerCase().includes(myEmail));

  const cc = [...new Set(allRecipients)].join(", ") || undefined;

  return { rfcMessageId, threadId, cc };
}

const ACCOUNT_PARAM = {
  account: {
    type: "string",
    description: 'Account ID to use (e.g. "personal", "pm-personal", "pm-finance"). Defaults to "personal".',
  },
};

const REPLY_PARAMS = {
  reply_to_message_id: {
    type: "string",
    description: "Gmail message ID to reply to (optional). When provided, the message will be threaded as a reply — RFC 2822 headers and threadId are resolved automatically.",
  },
  reply_all: {
    type: "boolean",
    description: "When true and reply_to_message_id is set, Cc is auto-populated with all original recipients (From, To, Cc) excluding yourself. Ignored if reply_to_message_id is not provided.",
  },
  thread_id: {
    type: "string",
    description: "Thread ID to add this message to (optional). Not needed when reply_to_message_id is provided, as the thread is resolved automatically.",
  },
};

export const createDraftTool: ToolDefinition = {
  name: "gmail_create_draft",
  description: "Create a draft email in Gmail. Supports plain replies and reply-all via reply_to_message_id and reply_all.",
  inputSchema: {
    type: "object",
    properties: {
      to: { type: "string", description: "Primary recipient email address" },
      cc: { type: "string", description: "Cc recipients as a comma-separated string (optional). When reply_all is true, this is populated automatically." },
      subject: { type: "string", description: "Email subject" },
      body: { type: "string", description: "Plain text email body" },
      ...REPLY_PARAMS,
      ...ACCOUNT_PARAM,
    },
    required: ["to", "subject", "body"],
  },
};

export const createDraftHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const gmail = await getGmailClient(accountId);

  let rfcMessageId: string | undefined;
  let threadId = args.thread_id as string | undefined;
  let cc = args.cc as string | undefined;

  if (args.reply_to_message_id) {
    const reply = await resolveReplyInfo(gmail, args.reply_to_message_id as string, !!args.reply_all);
    rfcMessageId = reply.rfcMessageId;
    threadId ??= reply.threadId;
    cc ??= reply.cc;
  }

  const raw = encodeEmail({
    to: args.to as string,
    cc,
    subject: args.subject as string,
    body: args.body as string,
    rfcMessageId,
  });

  const message: Record<string, unknown> = { raw };
  if (threadId) message.threadId = threadId;

  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message },
  });

  return {
    content: [{
      type: "text",
      text: `Draft created in account "${accountId}".\nDraft ID: ${res.data.id}\nTo: ${args.to}${cc ? `\nCc: ${cc}` : ""}\nSubject: ${args.subject}`,
    }],
  };
};

export const sendEmailTool: ToolDefinition = {
  name: "gmail_send_email",
  description: "Send an email from a Gmail account. Supports plain replies and reply-all via reply_to_message_id and reply_all.",
  inputSchema: {
    type: "object",
    properties: {
      to: { type: "string", description: "Primary recipient email address" },
      cc: { type: "string", description: "Cc recipients as a comma-separated string (optional). When reply_all is true, this is populated automatically." },
      subject: { type: "string", description: "Email subject" },
      body: { type: "string", description: "Plain text email body" },
      ...REPLY_PARAMS,
      ...ACCOUNT_PARAM,
    },
    required: ["to", "subject", "body"],
  },
};

export const sendEmailHandler: ToolHandler = async (args) => {
  const accountId = resolveAccount(args);
  const gmail = await getGmailClient(accountId);

  let rfcMessageId: string | undefined;
  let threadId = args.thread_id as string | undefined;
  let cc = args.cc as string | undefined;

  if (args.reply_to_message_id) {
    const reply = await resolveReplyInfo(gmail, args.reply_to_message_id as string, !!args.reply_all);
    rfcMessageId = reply.rfcMessageId;
    threadId ??= reply.threadId;
    cc ??= reply.cc;
  }

  const raw = encodeEmail({
    to: args.to as string,
    cc,
    subject: args.subject as string,
    body: args.body as string,
    rfcMessageId,
  });

  const requestBody: Record<string, unknown> = { raw };
  if (threadId) requestBody.threadId = threadId;

  const res = await gmail.users.messages.send({ userId: "me", requestBody });

  return {
    content: [{
      type: "text",
      text: `Email sent from account "${accountId}".\nMessage ID: ${res.data.id}\nTo: ${args.to}${cc ? `\nCc: ${cc}` : ""}\nSubject: ${args.subject}`,
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
