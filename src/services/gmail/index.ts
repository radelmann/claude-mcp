import {
  listAccountsTool, listAccountsHandler,
  searchMessagesTool, searchMessagesHandler,
  readMessageTool, readMessageHandler,
  archiveMessageTool, archiveMessageHandler,
  deleteMessageTool, deleteMessageHandler,
  labelMessageTool, labelMessageHandler,
  getProfileTool, getProfileHandler,
} from "./tools/messages.js";
import { readThreadTool, readThreadHandler } from "./tools/threads.js";
import { listLabelsTool, listLabelsHandler } from "./tools/labels.js";
import {
  createDraftTool, createDraftHandler,
  sendEmailTool, sendEmailHandler,
  listDraftsTool, listDraftsHandler,
} from "./tools/drafts.js";
import type { ServiceModule } from "../../types.js";

const gmailService: ServiceModule = {
  name: "gmail",
  tools: [
    listAccountsTool, searchMessagesTool, readMessageTool, readThreadTool,
    listLabelsTool, labelMessageTool, archiveMessageTool, deleteMessageTool,
    createDraftTool, sendEmailTool, listDraftsTool, getProfileTool,
  ],
  handlers: {
    gmail_list_accounts: listAccountsHandler,
    gmail_search_messages: searchMessagesHandler,
    gmail_read_message: readMessageHandler,
    gmail_read_thread: readThreadHandler,
    gmail_list_labels: listLabelsHandler,
    gmail_label_message: labelMessageHandler,
    gmail_archive_message: archiveMessageHandler,
    gmail_delete_message: deleteMessageHandler,
    gmail_create_draft: createDraftHandler,
    gmail_send_email: sendEmailHandler,
    gmail_list_drafts: listDraftsHandler,
    gmail_get_profile: getProfileHandler,
  },
};

export default gmailService;
