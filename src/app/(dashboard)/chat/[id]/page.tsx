import { ConversationList } from "../ConversationList";

export default async function DynamicChatPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;

  return (
    <div className="flex h-full w-full">
      <div className="hidden md:flex h-full shrink-0">
        <ConversationList />
      </div>

      <div className="flex flex-1 flex-col bg-muted/10 h-full relative items-center justify-center">
        {/* Placeholder for the real Chat UI in Issue #9 */}
        <p className="text-muted-foreground">Chat ID: {resolvedParams.id}</p>
        <p className="text-sm text-muted-foreground mt-2">Chat UI coming in Issue #9</p>
      </div>
    </div>
  );
}
