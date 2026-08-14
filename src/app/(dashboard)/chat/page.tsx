import { EmptyWorkspace } from "./EmptyWorkspace";

export default function ChatPage() {
  return (
    <div className="flex h-full w-full min-w-0">
      {/* 
        Main Chat Workspace
        Takes up full width
      */}
      <div className="flex flex-1 flex-col min-w-0 bg-muted/10 h-full relative">
        <EmptyWorkspace />
      </div>
    </div>
  );
}
