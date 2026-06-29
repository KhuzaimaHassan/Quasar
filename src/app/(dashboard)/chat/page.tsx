import { ConversationList } from "./ConversationList";
import { EmptyWorkspace } from "./EmptyWorkspace";

export default function ChatPage() {
  return (
    <div className="flex h-full w-full">
      {/* 
        Conversation List Panel 
        Hidden on mobile by default per user request.
      */}
      <div className="hidden md:flex h-full shrink-0">
        <ConversationList />
      </div>

      {/* 
        Main Chat Workspace
        Takes up full remaining width
      */}
      <div className="flex flex-1 flex-col bg-muted/10 h-full relative">
        <EmptyWorkspace />
      </div>
    </div>
  );
}
