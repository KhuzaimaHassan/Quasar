import { EmptyWorkspace } from "./EmptyWorkspace";

export default function ChatPage() {
  return (
    <div className="flex h-full w-full">
      {/* 
        Main Chat Workspace
        Takes up full width
      */}
      <div className="flex flex-1 flex-col bg-muted/10 h-full relative">
        <EmptyWorkspace />
      </div>
    </div>
  );
}
