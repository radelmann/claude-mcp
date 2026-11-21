import {
  listConversationsTool, listConversationsHandler,
  getMessagesTool, getMessagesHandler,
  searchMessagesTool, searchMessagesHandler,
  deleteConversationTool, deleteConversationHandler,
} from "./tools/conversations.js";
import type { ServiceModule } from "../../types.js";

const imessagesService: ServiceModule = {
  name: "imessages",
  scopes: [],
  tools: [
    listConversationsTool,
    getMessagesTool,
    searchMessagesTool,
    deleteConversationTool,
  ],
  handlers: {
    imessage_list_conversations: listConversationsHandler,
    imessage_get_messages: getMessagesHandler,
    imessage_search_messages: searchMessagesHandler,
    imessage_delete_conversation: deleteConversationHandler,
  },
};

export default imessagesService;
