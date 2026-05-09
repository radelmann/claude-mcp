import {
  listAccountsTool, listAccountsHandler,
  searchMessagesTool, searchMessagesHandler,
  searchAllAccountsTool, searchAllAccountsHandler,
  readMessageTool, readMessageHandler,
  readMessagesTool, readMessagesHandler,
  archiveMessageTool, archiveMessageHandler,
  deleteMessageTool, deleteMessageHandler,
  labelMessageTool, labelMessageHandler,
  getProfileTool, getProfileHandler,
} from "./tools/messages.js";
import { readThreadTool, readThreadHandler } from "./tools/threads.js";
import {
  listLabelsTool, listLabelsHandler,
  createLabelTool, createLabelHandler,
  renameLabelTool, renameLabelHandler,
  deleteLabelTool, deleteLabelHandler,
} from "./tools/labels.js";
import {
  createDraftTool, createDraftHandler,
  sendEmailTool, sendEmailHandler,
  listDraftsTool, listDraftsHandler,
} from "./tools/drafts.js";
import {
  listFiltersTool, listFiltersHandler,
  createFilterTool, createFilterHandler,
  deleteFilterTool, deleteFilterHandler,
} from "./tools/filters.js";
import { GMAIL_SCOPES } from "./auth.js";
import type { ServiceModule } from "../../types.js";

const gmailService: ServiceModule = {
  name: "gmail",
  scopes: GMAIL_SCOPES,
  tools: [
    listAccountsTool, searchMessagesTool, searchAllAccountsTool, readMessageTool, readMessagesTool, readThreadTool,
    listLabelsTool, createLabelTool, renameLabelTool, deleteLabelTool, labelMessageTool, archiveMessageTool, deleteMessageTool,
    createDraftTool, sendEmailTool, listDraftsTool, getProfileTool,
    listFiltersTool, createFilterTool, deleteFilterTool,
  ],
  handlers: {
    gmail_list_accounts: listAccountsHandler,
    gmail_search_messages: searchMessagesHandler,
    gmail_search_all_accounts: searchAllAccountsHandler,
    gmail_read_message: readMessageHandler,
    gmail_read_messages: readMessagesHandler,
    gmail_read_thread: readThreadHandler,
    gmail_list_labels: listLabelsHandler,
    gmail_create_label: createLabelHandler,
    gmail_rename_label: renameLabelHandler,
    gmail_delete_label: deleteLabelHandler,
    gmail_label_message: labelMessageHandler,
    gmail_archive_message: archiveMessageHandler,
    gmail_delete_message: deleteMessageHandler,
    gmail_create_draft: createDraftHandler,
    gmail_send_email: sendEmailHandler,
    gmail_list_drafts: listDraftsHandler,
    gmail_get_profile: getProfileHandler,
    gmail_list_filters: listFiltersHandler,
    gmail_create_filter: createFilterHandler,
    gmail_delete_filter: deleteFilterHandler,
  },
};

export default gmailService;
